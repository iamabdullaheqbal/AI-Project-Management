import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.task import Task

logger = logging.getLogger(__name__)

WEIGHTS = {"urgency": 0.40, "complexity": 0.25, "blocking": 0.20, "staleness": 0.15}


def _urgency(due_date: datetime | None) -> float:
    if due_date is None:
        return 0.2
    now = datetime.now(timezone.utc)
    # make due_date tz-aware if naive
    if due_date.tzinfo is None:
        due_date = due_date.replace(tzinfo=timezone.utc)
    days = (due_date - now).total_seconds() / 86400
    if days < 0:
        return 1.0  # overdue
    if days < 1:
        return 1.0
    if days < 3:
        return 0.8
    if days < 7:
        return 0.6
    if days < 14:
        return 0.4
    return 0.2


def _staleness(task: Task) -> float:
    if task.status != "in_progress":
        return 0.0
    now = datetime.now(timezone.utc)
    updated = task.updated_at
    if updated.tzinfo is None:
        updated = updated.replace(tzinfo=timezone.utc)
    days = (now - updated).total_seconds() / 86400
    return min(days / 14, 1.0)


async def calculate_priority_score(
    task: Task,
    db: AsyncSession,
) -> tuple[float, str, dict]:
    """Return (score, label, breakdown_dict)."""
    urgency = _urgency(task.due_date)
    complexity = task.complexity / 5.0

    # blocking: how many other tasks depend on this one
    result = await db.execute(select(Task).where(Task.project_id == task.project_id))
    all_tasks = result.scalars().all()
    blocked_by_this = [t for t in all_tasks if task.id in (t.dependencies or [])]
    blocking = min(len(blocked_by_this) / 5, 1.0)

    staleness = _staleness(task)

    score = round(
        urgency * WEIGHTS["urgency"]
        + complexity * WEIGHTS["complexity"]
        + blocking * WEIGHTS["blocking"]
        + staleness * WEIGHTS["staleness"],
        4,
    )

    if score < 0.30:
        label = "low"
    elif score < 0.55:
        label = "medium"
    elif score < 0.75:
        label = "high"
    else:
        label = "critical"

    breakdown = {
        "urgency": round(urgency, 4),
        "complexity": round(complexity, 4),
        "blocking": round(blocking, 4),
        "staleness": round(staleness, 4),
        "final": score,
    }
    return score, label, breakdown


async def rescore_task(task: Task, db: AsyncSession) -> Task:
    score, label, _ = await calculate_priority_score(task, db)
    task.priority_score = score
    task.priority_label = label
    task.updated_at = datetime.now(timezone.utc)
    db.add(task)
    return task


async def rescore_project(project_id: str, db: AsyncSession) -> list[Task]:
    result = await db.execute(select(Task).where(Task.project_id == project_id))
    tasks = result.scalars().all()
    for task in tasks:
        await rescore_task(task, db)
    await db.flush()
    return list(tasks)
