import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import get_current_user, verify_project_access
from models.project import Project
from models.project_member import TEAM_ROLES, ProjectMember
from models.task import Task
from models.user import User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/team", tags=["team"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class MemberOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str           # membership id
    user_id: str
    name: str
    email: str
    team_role: str
    assigned: int
    capacity: int
    joined_at: datetime


class InviteMemberRequest(BaseModel):
    project_id: str = Field(min_length=1)
    email: EmailStr
    team_role: str = Field(default="Member")

    def validate_role(self) -> None:
        if self.team_role not in TEAM_ROLES:
            raise ValueError(f"team_role must be one of {TEAM_ROLES}")


class UpdateRoleRequest(BaseModel):
    team_role: str

    def validate_role(self) -> None:
        if self.team_role not in TEAM_ROLES:
            raise ValueError(f"team_role must be one of {TEAM_ROLES}")


class TeamRolesOut(BaseModel):
    roles: list[str]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _get_member_workload(user_ids: list[str], project_ids: list[str], db: AsyncSession) -> dict[str, int]:
    if not user_ids or not project_ids:
        return {}
    counts_result = await db.execute(
        select(Task.assignee_id, func.count(Task.id).label("count"))
        .where(Task.project_id.in_(project_ids))
        .where(Task.status != "done")
        .where(Task.assignee_id.in_(user_ids))
        .group_by(Task.assignee_id)
    )
    return {row.assignee_id: row.count for row in counts_result}


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/roles", response_model=TeamRolesOut)
async def list_roles(current_user: User = Depends(get_current_user)):
    """Return all available team roles."""
    return TeamRolesOut(roles=TEAM_ROLES)


@router.get("/{project_id}", response_model=list[MemberOut])
async def get_project_team(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all members of a project with their workload."""
    await verify_project_access(project_id, current_user.id, db)

    result = await db.execute(
        select(ProjectMember, User)
        .join(User, ProjectMember.user_id == User.id)
        .where(ProjectMember.project_id == project_id)
        .order_by(User.name)
    )
    rows = result.all()

    user_ids = [u.id for _, u in rows]
    workload = await _get_member_workload(user_ids, [project_id], db)

    CAPACITY = 10
    return [
        MemberOut(
            id=m.id,
            user_id=u.id,
            name=u.name,
            email=u.email,
            team_role=m.team_role,
            assigned=workload.get(u.id, 0),
            capacity=CAPACITY,
            joined_at=m.joined_at,
        )
        for m, u in rows
    ]


@router.post("/{project_id}/invite", response_model=MemberOut, status_code=status.HTTP_201_CREATED)
async def invite_member(
    project_id: str,
    body: InviteMemberRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Invite a registered user to the project by email."""
    await verify_project_access(project_id, current_user.id, db)

    if body.team_role not in TEAM_ROLES:
        raise HTTPException(status_code=422, detail=f"team_role must be one of {TEAM_ROLES}")

    # Find the user by email
    user_result = await db.execute(select(User).where(User.email == body.email))
    target_user = user_result.scalar_one_or_none()
    if not target_user:
        raise HTTPException(
            status_code=404,
            detail=f"No account found for {body.email}. They must register first.",
        )

    # Check not already a member
    existing = await db.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == target_user.id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="User is already a member of this project")

    member = ProjectMember(
        id=str(uuid.uuid4()),
        project_id=project_id,
        user_id=target_user.id,
        team_role=body.team_role,
        joined_at=datetime.now(timezone.utc),
    )
    db.add(member)
    await db.flush()

    workload = await _get_member_workload([target_user.id], [project_id], db)
    logger.info("User %s invited to project %s as %s", target_user.id, project_id, body.team_role)

    return MemberOut(
        id=member.id,
        user_id=target_user.id,
        name=target_user.name,
        email=target_user.email,
        team_role=member.team_role,
        assigned=workload.get(target_user.id, 0),
        capacity=10,
        joined_at=member.joined_at,
    )


@router.put("/{project_id}/members/{member_id}", response_model=MemberOut)
async def update_member_role(
    project_id: str,
    member_id: str,
    body: UpdateRoleRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a team member's role."""
    await verify_project_access(project_id, current_user.id, db)

    if body.team_role not in TEAM_ROLES:
        raise HTTPException(status_code=422, detail=f"team_role must be one of {TEAM_ROLES}")

    result = await db.execute(
        select(ProjectMember, User)
        .join(User, ProjectMember.user_id == User.id)
        .where(ProjectMember.id == member_id, ProjectMember.project_id == project_id)
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Member not found")

    member, user = row
    member.team_role = body.team_role
    db.add(member)
    await db.flush()

    workload = await _get_member_workload([user.id], [project_id], db)
    return MemberOut(
        id=member.id,
        user_id=user.id,
        name=user.name,
        email=user.email,
        team_role=member.team_role,
        assigned=workload.get(user.id, 0),
        capacity=10,
        joined_at=member.joined_at,
    )


@router.delete("/{project_id}/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    project_id: str,
    member_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove a member from the project."""
    await verify_project_access(project_id, current_user.id, db)

    result = await db.execute(
        select(ProjectMember).where(
            ProjectMember.id == member_id,
            ProjectMember.project_id == project_id,
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    # Prevent removing yourself (owner)
    if member.user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot remove yourself from the project")

    await db.delete(member)
    logger.info("Member %s removed from project %s", member_id, project_id)


# ---------------------------------------------------------------------------
# Legacy endpoint — global team view for dashboard workload chart
# ---------------------------------------------------------------------------

@router.get("", response_model=list[MemberOut])
async def get_all_team(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all members across all of the current user's projects (deduplicated)."""
    projects_result = await db.execute(
        select(Project.id).where(Project.owner_id == current_user.id)
    )
    project_ids = [row[0] for row in projects_result.fetchall()]

    if not project_ids:
        return []

    # Get all memberships across those projects
    result = await db.execute(
        select(ProjectMember, User)
        .join(User, ProjectMember.user_id == User.id)
        .where(ProjectMember.project_id.in_(project_ids))
        .order_by(User.name)
    )
    rows = result.all()

    # Deduplicate by user_id — keep first membership found
    seen: set[str] = set()
    unique_rows = []
    for m, u in rows:
        if u.id not in seen:
            seen.add(u.id)
            unique_rows.append((m, u))

    if not unique_rows:
        return []

    user_ids = [u.id for _, u in unique_rows]
    workload = await _get_member_workload(user_ids, project_ids, db)

    return [
        MemberOut(
            id=m.id,
            user_id=u.id,
            name=u.name,
            email=u.email,
            team_role=m.team_role,
            assigned=workload.get(u.id, 0),
            capacity=10,
            joined_at=m.joined_at,
        )
        for m, u in unique_rows
    ]
