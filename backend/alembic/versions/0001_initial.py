"""Initial schema with pgvector

Revision ID: 0001
Revises:
Create Date: 2025-01-01 00:00:00
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enable pgvector extension
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # users
    op.create_table(
        "users",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("role", sa.String(80), nullable=False, server_default="Member"),
        sa.Column("hashed_password", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_users_email", "users", ["email"])

    # projects
    op.create_table(
        "projects",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("owner_id", sa.String(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    # tasks
    op.create_table(
        "tasks",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("project_id", sa.String(), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("assignee_id", sa.String(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="todo"),
        sa.Column("priority_score", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("priority_label", sa.String(10), nullable=False, server_default="low"),
        sa.Column("due_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("complexity", sa.Integer(), nullable=False, server_default="3"),
        sa.Column("dependencies", JSONB(), nullable=False, server_default="[]"),
        sa.Column("tag", sa.String(80), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_tasks_project_id", "tasks", ["project_id"])

    # chat_messages
    op.create_table(
        "chat_messages",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("project_id", sa.String(), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("role", sa.String(10), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_chat_messages_project_id", "chat_messages", ["project_id"])

    # document_embeddings
    op.create_table(
        "document_embeddings",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("project_id", sa.String(), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("task_id", sa.String(), sa.ForeignKey("tasks.id"), nullable=True),
        sa.Column("doc_type", sa.String(20), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("embedding", sa.Text(), nullable=False),  # cast to vector in HNSW index
        sa.Column("metadata", JSONB(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_doc_embeddings_project_id", "document_embeddings", ["project_id"])

    # Change embedding column to vector(1024) and create HNSW index
    op.execute("ALTER TABLE document_embeddings ALTER COLUMN embedding TYPE vector(1024) USING embedding::vector(1024)")
    op.execute(
        "CREATE INDEX ix_doc_embeddings_hnsw ON document_embeddings "
        "USING hnsw (embedding vector_cosine_ops) WITH (m=16, ef_construction=64)"
    )


def downgrade() -> None:
    op.drop_table("document_embeddings")
    op.drop_table("chat_messages")
    op.drop_table("tasks")
    op.drop_table("projects")
    op.drop_table("users")
    op.execute("DROP EXTENSION IF EXISTS vector")
