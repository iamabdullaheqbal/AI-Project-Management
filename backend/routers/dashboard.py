import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import get_current_user, verify_project_access
from models.task import Task
from models.user import User
from schemas.chat import DashboardOut
from schemas.task import PriorityBreakdown, TaskOut
from services.task_service import calculate_priority_score

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/{project_id}", response_model=DashboardOut)
async def get_dashboard(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await verify_project_access(project_id, current_user.id, db)

    result = await db.execute(select(Task).where(Task.project_id == project_id))
    tasks = result.scalars().all()

    now = datetime.now(timezone.utc)
    total = len(tasks)
    done = sum(1 for t in tasks if t.status == "done")
    in_progress = sum(1 for t in tasks if t.status == "in_progress")
    todo = sum(1 for t in tasks if t.status == "todo")
    blocked = sum(1 for t in tasks if t.status == "blocked")
    overdue = sum(
        1 for t in tasks
        if t.due_date is not None
        and t.status != "done"
        and (t.due_date.replace(tzinfo=timezone.utc) if t.due_date.tzinfo is None else t.due_date) < now
    )
    completion = round((done / total) * 100) if total else 0

    return DashboardOut(
        total=total,
        done=done,
        inProgress=in_progress,
        overdue=overdue,
        blocked=blocked,
        completion=completion,
        total_tasks=total,
        todo_count=todo,
        in_progress_count=in_progress,
        done_count=done,
        blocked_count=blocked,
        completion_percentage=float(completion),
    )


@router.get("/{project_id}/critical", response_model=list[TaskOut])
async def get_critical(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await verify_project_access(project_id, current_user.id, db)

    result = await db.execute(
        select(Task)
        .where(Task.project_id == project_id)
        .where(Task.priority_label.in_(["high", "critical"]))
        .order_by(Task.priority_score.desc())
        .limit(10)
    )
    tasks = result.scalars().all()
    out = []
    for t in tasks:
        _, _, bd = await calculate_priority_score(t, db)
        task_out = TaskOut.model_validate(t)
        task_out.score = PriorityBreakdown(**bd)
        out.append(task_out)
    return out


@router.get("/{project_id}/blockers", response_model=list[TaskOut])
async def get_blockers(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await verify_project_access(project_id, current_user.id, db)

    result = await db.execute(
        select(Task)
        .where(Task.project_id == project_id)
        .where(Task.status == "blocked")
        .order_by(Task.priority_score.desc())
    )
    tasks = result.scalars().all()
    out = []
    for t in tasks:
        _, _, bd = await calculate_priority_score(t, db)
        task_out = TaskOut.model_validate(t)
        task_out.score = PriorityBreakdown(**bd)
        out.append(task_out)
    return out
