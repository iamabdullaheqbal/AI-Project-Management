import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    assignee_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="todo")
    priority_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    priority_label: Mapped[str] = mapped_column(String(10), nullable=False, default="low")
    due_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    complexity: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    dependencies: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    tag: Mapped[str | None] = mapped_column(String(80), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    project = relationship("Project", back_populates="tasks")
    assignee = relationship("User", back_populates="tasks", foreign_keys=[assignee_id])
    document_embeddings = relationship("DocumentEmbedding", back_populates="task", cascade="all, delete-orphan")
