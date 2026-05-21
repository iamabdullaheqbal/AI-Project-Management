"""
Chat router — WebSocket real-time chat + REST fallback.

WebSocket pipeline per message:
  1. Save user message to chat_messages
  2. Fetch last 10 messages as history
  3. RAG: retrieve_context(query, project_id)
  4. LLM: build_prompt + call_mistral
  5. Parse task commands -> execute via task_service if found
  6. Save assistant response to chat_messages
  7. Send response over WebSocket
"""
import json
import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import AsyncSessionLocal, get_db
from core.security import _resolve_user_from_token, get_current_user, verify_project_access
from models.chat_message import ChatMessage
from models.task import Task
from models.user import User
from schemas.chat import ChatMessageOut, ChatMessageRequest
from services.llm_service import build_prompt, call_mistral, parse_task_commands
from services.rag_service import retrieve_context, update_task_embedding
from services.task_service import rescore_task

logger = logging.getLogger(__name__)
router = APIRouter(tags=["chat"])


# ---------------------------------------------------------------------------
# Connection manager
# ---------------------------------------------------------------------------

class ConnectionManager:
    """Manages concurrent WebSocket connections grouped by project room."""

    def __init__(self) -> None:
        self._rooms: dict[str, list[WebSocket]] = {}

    async def connect(self, project_id: str, ws: WebSocket) -> None:
        await ws.accept()
        self._rooms.setdefault(project_id, []).append(ws)
        logger.info("WS connected project=%s room_size=%d", project_id, len(self._rooms[project_id]))

    def disconnect(self, project_id: str, ws: WebSocket) -> None:
        room = self._rooms.get(project_id, [])
        if ws in room:
            room.remove(ws)
        logger.info("WS disconnected project=%s remaining=%d", project_id, len(room))

    async def send(self, ws: WebSocket, payload: dict) -> None:
        await ws.send_text(json.dumps(payload))


manager = ConnectionManager()


# ---------------------------------------------------------------------------
# Task command executor
# ---------------------------------------------------------------------------

async def _execute_task_commands(
    commands: list[dict],
    project_id: str,
    db: AsyncSession,
) -> list[dict]:
    """Execute create_task / update_task commands from LLM. Returns result summaries."""
    results = []
    for cmd in commands:
        action = cmd.get("action")
        data = cmd.get("data", {})
        try:
            if action == "create_task":
                task = Task(
                    id=str(uuid.uuid4()),
                    project_id=project_id,
                    title=str(data.get("title", "Untitled"))[:300],
                    description=(str(data.get("description", ""))[:5000] or None),
                    status=data.get("status", "todo"),
                    complexity=int(data.get("complexity", 3)),
                    tag=(str(data.get("tag", ""))[:80] or None),
                    dependencies=[],
                    created_at=datetime.now(timezone.utc),
                    updated_at=datetime.now(timezone.utc),
                )
                db.add(task)
                await db.flush()
                await rescore_task(task, db)
                try:
                    await update_task_embedding(task, project_id, db)
                except Exception as emb_exc:
                    logger.warning("Embedding failed for AI-created task %s: %s", task.id, emb_exc)
                results.append({"action": "create_task", "task_id": task.id, "title": task.title})
                logger.info("AI created task %s in project %s", task.id, project_id)

            elif action == "update_task":
                task_id = str(data.get("task_id", ""))
                if not task_id:
                    continue
                result = await db.execute(
                    select(Task).where(Task.id == task_id, Task.project_id == project_id)
                )
                task = result.scalar_one_or_none()
                if not task:
                    logger.warning("AI tried to update unknown task %s", task_id)
                    continue
                for field in ("title", "description", "status", "complexity", "tag"):
                    if field in data:
                        setattr(task, field, data[field])
                task.updated_at = datetime.now(timezone.utc)
                await rescore_task(task, db)
                try:
                    await update_task_embedding(task, project_id, db)
                except Exception as emb_exc:
                    logger.warning("Embedding failed for AI-updated task %s: %s", task_id, emb_exc)
                results.append({"action": "update_task", "task_id": task_id})
                logger.info("AI updated task %s in project %s", task_id, project_id)

        except Exception as exc:
            logger.error("Failed to execute task command %s: %s", action, exc, exc_info=True)

    return results


# ---------------------------------------------------------------------------
# WebSocket endpoint
# ---------------------------------------------------------------------------

@router.websocket("/ws/chat/{project_id}")
async def websocket_chat(
    websocket: WebSocket,
    project_id: str,
    token: str = Query(..., description="JWT access token"),
) -> None:
    # Authenticate before accepting the connection
    async with AsyncSessionLocal() as auth_db:
        try:
            user = await _resolve_user_from_token(token, auth_db)
            await verify_project_access(project_id, user.id, auth_db)
        except Exception:
            await websocket.close(code=4001)
            return

    await manager.connect(project_id, websocket)

    try:
        while True:
            raw = await websocket.receive_text()

            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                await manager.send(websocket, {"type": "error", "content": "Invalid JSON"})
                continue

            user_content: str = (data.get("content") or "").strip()
            response_style: str = data.get("response_style", "concise")
            if response_style not in ("concise", "detailed"):
                response_style = "concise"

            if not user_content or len(user_content) > 10_000:
                await manager.send(websocket, {"type": "error", "content": "Message must be 1-10000 chars"})
                continue

            # Step 1: Save user message
            async with AsyncSessionLocal() as db:
                user_msg = ChatMessage(
                    id=str(uuid.uuid4()),
                    project_id=project_id,
                    role="user",
                    content=user_content,
                    created_at=datetime.now(timezone.utc),
                )
                db.add(user_msg)
                await db.commit()

            await manager.send(websocket, {"type": "typing"})

            try:
                # Step 2: Fetch last 10 messages as history
                async with AsyncSessionLocal() as db:
                    hist_result = await db.execute(
                        select(ChatMessage)
                        .where(ChatMessage.project_id == project_id)
                        .order_by(ChatMessage.created_at.desc())
                        .limit(10)
                    )
                    history_rows = hist_result.scalars().all()
                    chat_history = [
                        {"role": m.role, "content": m.content}
                        for m in reversed(history_rows)
                        if m.id != user_msg.id
                    ]

                # Step 3: RAG — retrieve relevant context
                async with AsyncSessionLocal() as db:
                    retrieved_docs = await retrieve_context(
                        query=user_content,
                        project_id=project_id,
                        db=db,
                        top_k=5,
                    )

                # Step 4: Build prompt and call Mistral
                messages = build_prompt(
                    user_message=user_content,
                    retrieved_docs=retrieved_docs,
                    chat_history=chat_history,
                    response_style=response_style,
                )
                reply = await call_mistral(messages, response_style=response_style)

                # Step 5: Parse and execute task commands
                task_results: list[dict] = []
                commands = parse_task_commands(reply)
                if commands:
                    async with AsyncSessionLocal() as db:
                        task_results = await _execute_task_commands(commands, project_id, db)
                        await db.commit()
                    await manager.send(websocket, {
                        "type": "task_commands",
                        "commands": task_results,
                    })

                # Step 6: Save assistant response
                async with AsyncSessionLocal() as db:
                    assistant_msg = ChatMessage(
                        id=str(uuid.uuid4()),
                        project_id=project_id,
                        role="assistant",
                        content=reply,
                        created_at=datetime.now(timezone.utc),
                    )
                    db.add(assistant_msg)
                    await db.commit()

                # Step 7: Send response to client
                await manager.send(websocket, {
                    "type": "message",
                    "role": "assistant",
                    "content": reply,
                    "retrieved_count": len(retrieved_docs),
                    "id": assistant_msg.id,
                    "timestamp": int(assistant_msg.created_at.timestamp() * 1000),
                })

            except Exception as exc:
                logger.error("Chat pipeline error project=%s: %s", project_id, exc, exc_info=True)
                await manager.send(websocket, {
                    "type": "error",
                    "content": "An error occurred processing your message. Please try again.",
                })

    except WebSocketDisconnect:
        manager.disconnect(project_id, websocket)


# ---------------------------------------------------------------------------
# REST fallback
# ---------------------------------------------------------------------------

@router.post("/chat/message")
async def chat_message(
    body: ChatMessageRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    await verify_project_access(body.project_id, current_user.id, db)

    hist_result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.project_id == body.project_id)
        .order_by(ChatMessage.created_at.desc())
        .limit(10)
    )
    chat_history = [
        {"role": m.role, "content": m.content}
        for m in reversed(hist_result.scalars().all())
    ]

    retrieved_docs = await retrieve_context(body.content, body.project_id, db, top_k=5)
    messages = build_prompt(body.content, retrieved_docs, chat_history, response_style=body.response_style)
    reply = await call_mistral(messages, response_style=body.response_style)

    for role, content in [("user", body.content), ("assistant", reply)]:
        db.add(ChatMessage(
            id=str(uuid.uuid4()),
            project_id=body.project_id,
            role=role,
            content=content,
            created_at=datetime.now(timezone.utc),
        ))
    await db.flush()

    task_results: list[dict] = []
    commands = parse_task_commands(reply)
    if commands:
        task_results = await _execute_task_commands(commands, body.project_id, db)

    return {
        "content": reply,
        "retrieved_count": len(retrieved_docs),
        "task_commands": task_results,
    }


# ---------------------------------------------------------------------------
# Chat history
# ---------------------------------------------------------------------------

@router.get("/chat/history/{project_id}")
async def get_history(
    project_id: str,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ChatMessageOut]:
    await verify_project_access(project_id, current_user.id, db)

    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.project_id == project_id)
        .order_by(ChatMessage.created_at.asc())
        .offset(offset)
        .limit(limit)
    )
    return [ChatMessageOut.from_orm_with_ts(m) for m in result.scalars().all()]
