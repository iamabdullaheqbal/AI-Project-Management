import logging

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import get_current_user
from models.task import Task
from models.user import User
from pydantic import BaseModel, ConfigDict

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/team", tags=["team"])


class MemberOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    role: str
    email: str


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
    """Return all users with their active task counts."""
    # Get all users
    users_result = await db.execute(select(User).order_by(User.name))
    users = users_result.scalars().all()

    # Count active (non-done) tasks per user
    counts_result = await db.execute(
        select(Task.assignee_id, func.count(Task.id).label("count"))
        .where(Task.status != "done")
        .where(Task.assignee_id.isnot(None))
        .group_by(Task.assignee_id)
    )
    counts = {row.assignee_id: row.count for row in counts_result}

    # Capacity is a fixed business rule (10 tasks per person)
    CAPACITY = 10
    return [
        MemberWorkloadOut(
            id=u.id,
            name=u.name,
            role=u.role,
            status="Active",  # Could be extended with a status field on User model
            assigned=counts.get(u.id, 0),
            capacity=CAPACITY,
        )
        for u in users
    ]
