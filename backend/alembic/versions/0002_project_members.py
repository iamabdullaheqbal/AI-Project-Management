"""Add project_members table

Revision ID: 0002
Revises: 0001
Create Date: 2025-01-02 00:00:00
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "project_members",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("project_id", sa.String(), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("team_role", sa.String(80), nullable=False, server_default="Member"),
        sa.Column("joined_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_project_members_project_id", "project_members", ["project_id"])
    op.create_index("ix_project_members_user_id", "project_members", ["user_id"])
    # Unique constraint: one membership per user per project
    op.create_unique_constraint("uq_project_members_project_user", "project_members", ["project_id", "user_id"])


def downgrade() -> None:
    op.drop_table("project_members")
