import logging

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, ConfigDict

from core.database import get_db
from core.security import get_current_user
from models.project import Project
from models.task import Task
from models.user import User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/team", tags=["team"])


class MemberWorkloadOut(BaseModel):
    id: str
    name: str
    role: str
    status: str
    assigned: int
    capacity: int


@router.get("", response_model=list[MemberWorkloadOut])
async def get_team(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return only users who are assigned to tasks in the current user's projects,
    with their active (non-done) task counts scoped to those projects.
    """
    # Get all project IDs owned by the current user
    projects_result = await db.execute(
        select(Project.id).where(Project.owner_id == current_user.id)
    )
    project_ids = [row[0] for row in projects_result.fetchall()]

    if not project_ids:
        return []

    # Find distinct assignee IDs within those projects (non-done tasks only)
    assignees_result = await db.execute(
        select(Task.assignee_id)
        .where(Task.project_id.in_(project_ids))
        .where(Task.assignee_id.isnot(None))
        .distinct()
    )
    assignee_ids = [row[0] for row in assignees_result.fetchall()]

    # Always include the project owner themselves
    if current_user.id not in assignee_ids:
        assignee_ids.append(current_user.id)

    if not assignee_ids:
        return []

    # Fetch those users
    users_result = await db.execute(
        select(User).where(User.id.in_(assignee_ids)).order_by(User.name)
    )
    users = users_result.scalars().all()

    # Count active tasks per user scoped to the current user's projects
    counts_result = await db.execute(
        select(Task.assignee_id, func.count(Task.id).label("count"))
        .where(Task.project_id.in_(project_ids))
        .where(Task.status != "done")
        .where(Task.assignee_id.isnot(None))
        .group_by(Task.assignee_id)
    )
    counts = {row.assignee_id: row.count for row in counts_result}

    CAPACITY = 10
    return [
        MemberWorkloadOut(
            id=u.id,
            name=u.name,
            role=u.role,
            status="Active",
            assigned=counts.get(u.id, 0),
            capacity=CAPACITY,
        )
        for u in users
    ]
