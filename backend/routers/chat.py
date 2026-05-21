import json
import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import AsyncSessionLocal, get_db
from core.security import get_current_user, verify_project_access, _resolve_user_from_token
from models.chat_message import ChatMessage
from models.user import User
from schemas.chat import ChatMessageOut, ChatMessageRequest
from services.llm_service import call_mistral, parse_task_commands
from services.rag_service import retrieve_context

logger = logging.getLogger(__name__)
router = APIRouter(tags=["chat"])


# ---------------------------------------------------------------------------
# WebSocket connection manager
# ---------------------------------------------------------------------------

class ConnectionManager:
    def __init__(self):
        self._rooms: dict[str, list[WebSocket]] = {}

    async def connect(self, project_id: str, ws: WebSocket):
        await ws.accept()
        self._rooms.setdefault(project_id, []).append(ws)

    def disconnect(self, project_id: str, ws: WebSocket):
        room = self._rooms.get(project_id, [])
        if ws in room:
            room.remove(ws)

    async def send(self, ws: WebSocket, payload: dict):
        await ws.send_text(json.dumps(payload))


manager = ConnectionManager()


# ---------------------------------------------------------------------------
# WebSocket endpoint — token passed as query param for WS auth
# ---------------------------------------------------------------------------

@router.websocket("/ws/chat/{project_id}")
async def websocket_chat(
    websocket: WebSocket,
    project_id: str,
    token: str = Query(..., description="JWT access token"),
):
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

            user_content: str = data.get("content", "").strip()
            history: list[dict] = data.get("history", [])[:20]  # cap history

            if not user_content or len(user_content) > 10_000:
                await manager.send(websocket, {"type": "error", "content": "Invalid message"})
                continue

            # Persist user message
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
                async with AsyncSessionLocal() as db:
                    docs = await retrieve_context(user_content, project_id, db)

                reply = await call_mistral(user_content, docs, history)

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

                commands = parse_task_commands(reply)
                if commands:
                    await manager.send(websocket, {"type": "task_commands", "commands": commands})

                await manager.send(websocket, {"type": "message", "content": reply})

            except Exception as exc:
                logger.error("Chat pipeline error project=%s: %s", project_id, exc, exc_info=True)
                await manager.send(
                    websocket,
                    {"type": "message", "content": "Sorry, I encountered an error. Please try again."},
                )

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
):
    await verify_project_access(body.project_id, current_user.id, db)

    docs = await retrieve_context(body.content, body.project_id, db)
    reply = await call_mistral(body.content, docs, body.history)

    for role, content in [("user", body.content), ("assistant", reply)]:
        db.add(ChatMessage(
            id=str(uuid.uuid4()),
            project_id=body.project_id,
            role=role,
            content=content,
            created_at=datetime.now(timezone.utc),
        ))
    await db.flush()

    commands = parse_task_commands(reply)
    return {"content": reply, "task_commands": commands}


@router.get("/chat/history/{project_id}")
async def get_history(
    project_id: str,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await verify_project_access(project_id, current_user.id, db)

    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.project_id == project_id)
        .order_by(ChatMessage.created_at.asc())
        .offset(offset)
        .limit(limit)
    )
    messages = result.scalars().all()
    return [ChatMessageOut.from_orm_with_ts(m) for m in messages]
