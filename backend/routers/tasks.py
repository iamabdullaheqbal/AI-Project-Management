import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import get_current_user, verify_project_access, verify_task_access
from models.task import Task
from models.user import User
from schemas.task import BulkScoreRequest, PriorityBreakdown, PriorityDetail, TaskCreate, TaskOut, TaskUpdate
from services.rag_service import embed_and_store, remove_task_embeddings
from services.task_service import calculate_priority_score, rescore_project, rescore_task

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/tasks", tags=["tasks"])


def _task_to_out(task: Task, breakdown: dict | None = None) -> TaskOut:
    out = TaskOut.model_validate(task)
    if breakdown:
        out.score = PriorityBreakdown(**breakdown)
    return out


@router.get("/{project_id}", response_model=list[TaskOut])
async def list_tasks(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await verify_project_access(project_id, current_user.id, db)
    result = await db.execute(
        select(Task).where(Task.project_id == project_id).order_by(Task.priority_score.desc())
    )
    tasks = result.scalars().all()
    out = []
    for t in tasks:
        _, _, bd = await calculate_priority_score(t, db)
        out.append(_task_to_out(t, bd))
    return out


@router.post("", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
async def create_task(
    body: TaskCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await verify_project_access(body.project_id, current_user.id, db)

    task = Task(
        project_id=body.project_id,
        title=body.title,
        description=body.description,
        assignee_id=body.assignee_id,
        status=body.status,
        due_date=body.due_date,
        complexity=body.complexity,
        dependencies=body.dependencies,
        tag=body.tag,
    )
    db.add(task)
    await db.flush()

    score, label, breakdown = await calculate_priority_score(task, db)
    task.priority_score = score
    task.priority_label = label
    await db.flush()

    embed_text = f"{task.title}. {task.description or ''} Status: {task.status}. Tag: {task.tag or ''}."
    try:
        await embed_and_store(embed_text, task.project_id, db, task_id=task.id, doc_type="task")
    except Exception as exc:
        logger.warning("Embedding failed for task %s: %s", task.id, exc)

    await db.refresh(task)
    return _task_to_out(task, breakdown)


@router.put("/{task_id}", response_model=TaskOut)
async def update_task(
    task_id: str,
    body: TaskUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await verify_task_access(task_id, current_user.id, db)

    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(task, field, value)
    task.updated_at = datetime.now(timezone.utc)

    await rescore_task(task, db)
    _, _, breakdown = await calculate_priority_score(task, db)

    embed_text = f"{task.title}. {task.description or ''} Status: {task.status}. Tag: {task.tag or ''}."
    try:
        await remove_task_embeddings(task_id, db)
        await embed_and_store(embed_text, task.project_id, db, task_id=task.id, doc_type="task")
    except Exception as exc:
        logger.warning("Re-embedding failed for task %s: %s", task_id, exc)

    await db.flush()
    await db.refresh(task)
    return _task_to_out(task, breakdown)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await verify_task_access(task_id, current_user.id, db)

    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    await remove_task_embeddings(task_id, db)
    await db.delete(task)
    logger.info("Task deleted: %s by user %s", task_id, current_user.id)


@router.get("/{task_id}/priority", response_model=PriorityDetail)
async def get_priority(
    task_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await verify_task_access(task_id, current_user.id, db)

    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    score, label, breakdown = await calculate_priority_score(task, db)
    return PriorityDetail(
        priority_score=score,
        priority_label=label,
        breakdown=PriorityBreakdown(**breakdown),
    )


@router.post("/bulk-score", response_model=list[TaskOut])
async def bulk_score(
    body: BulkScoreRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await verify_project_access(body.project_id, current_user.id, db)
    tasks = await rescore_project(body.project_id, db)
    out = []
    for t in tasks:
        _, _, bd = await calculate_priority_score(t, db)
        out.append(_task_to_out(t, bd))
    return out
