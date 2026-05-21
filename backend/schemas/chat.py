from pydantic import BaseModel, ConfigDict, Field


class ChatMessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    role: str
    content: str
    timestamp: int  # epoch ms — matches frontend ChatMessage shape

    @classmethod
    def from_orm_with_ts(cls, obj: object) -> "ChatMessageOut":
        created = getattr(obj, "created_at")
        return cls(
            id=getattr(obj, "id"),
            role=getattr(obj, "role"),
            content=getattr(obj, "content"),
            timestamp=int(created.timestamp() * 1000),
        )


class ChatMessageRequest(BaseModel):
    project_id: str = Field(min_length=1, max_length=100)
    content: str = Field(min_length=1, max_length=10_000)
    history: list[dict] = Field(default_factory=list, max_length=50)


class DashboardOut(BaseModel):
    # Frontend-compatible field names
    total: int
    done: int
    inProgress: int
    overdue: int
    blocked: int
    completion: int
    # Spec field names
    total_tasks: int
    todo_count: int
    in_progress_count: int
    done_count: int
    blocked_count: int
    completion_percentage: float
