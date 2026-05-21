import logging
from datetime import datetime, timedelta, timezone
from typing import Literal

import bcrypt
from fastapi import Depends, HTTPException, Query, WebSocket, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.database import get_db

logger = logging.getLogger(__name__)
bearer_scheme = HTTPBearer(auto_error=False)

_TOKEN_TYPE_ACCESS = "access"
_TOKEN_TYPE_REFRESH = "refresh"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12)).decode()


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode(), hashed.encode())
    except ValueError:
        logger.warning("Password verification failed because the stored hash is invalid")
        return False


def create_access_token(subject: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode(
        {"sub": subject, "exp": expire, "type": _TOKEN_TYPE_ACCESS},
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )


def create_refresh_token(subject: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    return jwt.encode(
        {"sub": subject, "exp": expire, "type": _TOKEN_TYPE_REFRESH},
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )


async def _resolve_user_from_token(token: str, db: AsyncSession, token_type: str = _TOKEN_TYPE_ACCESS):
    from models.user import User  # avoid circular import

    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if payload.get("type") != token_type:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")
        user_id: str = payload.get("sub", "")
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    except JWTError as exc:
        logger.warning("JWT decode failed: %s", exc)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
):
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return await _resolve_user_from_token(credentials.credentials, db)


async def get_current_user_ws(
    websocket: WebSocket,
    token: str = Query(..., description="JWT access token"),
    db: AsyncSession = Depends(get_db),
):
    """Dependency for WebSocket endpoints — token passed as query param."""
    return await _resolve_user_from_token(token, db)


async def verify_project_access(project_id: str, user_id: str, db: AsyncSession) -> None:
    """Raise 403 if the user does not own the project."""
    from models.project import Project

    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.owner_id == user_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")


async def verify_task_access(task_id: str, user_id: str, db: AsyncSession) -> None:
    """Raise 403 if the user does not own the task's project."""
    from models.task import Task
    from models.project import Project

    result = await db.execute(
        select(Task).join(Project, Task.project_id == Project.id)
        .where(Task.id == task_id, Project.owner_id == user_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
