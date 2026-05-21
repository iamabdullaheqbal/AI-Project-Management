from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


VALID_STATUSES = {"todo", "in_progress", "done", "blocked"}
VALID_PRIORITIES = {"low", "medium", "high", "critical"}


class PriorityBreakdown(BaseModel):
    urgency: float
    complexity: float
    blocking: float
    staleness: float
    final: float


class TaskCreate(BaseModel):
    project_id: str = Field(min_length=1, max_length=100)
    title: str = Field(min_length=1, max_length=300)
    description: str | None = Field(default=None, max_length=5000)
    assignee_id: str | None = Field(default=None, max_length=100)
    status: str = Field(default="todo")
    due_date: datetime | None = None
    complexity: int = Field(default=3, ge=1, le=5)
    dependencies: list[str] = Field(default_factory=list, max_length=50)
    tag: str | None = Field(default=None, max_length=80)

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in VALID_STATUSES:
            raise ValueError(f"status must be one of {VALID_STATUSES}")
        return v


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=300)
    description: str | None = Field(default=None, max_length=5000)
    assignee_id: str | None = Field(default=None, max_length=100)
    status: str | None = None
    due_date: datetime | None = None
    complexity: int | None = Field(default=None, ge=1, le=5)
    dependencies: list[str] | None = Field(default=None, max_length=50)
    tag: str | None = Field(default=None, max_length=80)

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str | None) -> str | None:
        if v is not None and v not in VALID_STATUSES:
            raise ValueError(f"status must be one of {VALID_STATUSES}")
        return v


class TaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    title: str
    description: str | None
    assignee_id: str | None
    status: str
    priority_score: float
    priority_label: str
    due_date: datetime | None
    complexity: int
    dependencies: list[Any]
    tag: str | None
    created_at: datetime
    updated_at: datetime
    score: PriorityBreakdown | None = None


class PriorityDetail(BaseModel):
    priority_score: float
    priority_label: str
    breakdown: PriorityBreakdown
    weights: dict[str, float] = {
        "urgency": 0.40,
        "complexity": 0.25,
        "blocking": 0.20,
        "staleness": 0.15,
    }


class BulkScoreRequest(BaseModel):
    project_id: str = Field(min_length=1, max_length=100)
