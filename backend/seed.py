"""
Seed script — creates demo user, Apollo Launch project, and 10 tasks.
Run: uv run python seed.py
"""
import asyncio
import logging
import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
from sqlalchemy import select

from core.database import AsyncSessionLocal
from models.chat_message import ChatMessage  # noqa: F401 — ensure table registered
from models.document_embedding import DocumentEmbedding  # noqa: F401
from models.project import Project
from models.task import Task
from models.user import User
from services.rag_service import embed_and_store

logging.basicConfig(level=logging.INFO, format="%(levelname)s — %(message)s")
logger = logging.getLogger(__name__)

NOW = datetime.now(timezone.utc)


def hpw(p: str) -> str:
    return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()


DEMO_USER = {
    "id": "u1",
    "name": "Alex Morgan",
    "email": "alex@flowmind.app",
    "role": "Product Lead",
    "hashed_password": hpw("demo"),
}

TASKS_DATA = [
    {
        "title": "Fix production payment outage",
        "description": "Stripe webhooks failing for EU customers since 14:00 UTC. Revenue impact ~$12k/hr.",
        "status": "in_progress",
        "complexity": 5,
        "due_date": NOW + timedelta(hours=4),
        "tag": "Incident",
        "dependencies": [],
    },
    {
        "title": "Redesign onboarding flow",
        "description": "Reduce step count from 6 to 3, add progress indicator. Figma mockups ready.",
        "status": "in_progress",
        "complexity": 3,
        "due_date": NOW + timedelta(days=1),
        "tag": "Design",
        "dependencies": [],
    },
    {
        "title": "API rate limiting",
        "description": "Awaiting platform team sign-off on Redis cluster config. Blocked by infra review.",
        "status": "blocked",
        "complexity": 4,
        "due_date": NOW + timedelta(days=3),
        "tag": "Backend",
        "dependencies": [],
    },
    {
        "title": "Marketing site copy refresh",
        "description": "Rewrite hero + features section for new positioning. SEO keywords updated.",
        "status": "todo",
        "complexity": 2,
        "due_date": NOW + timedelta(days=7),
        "tag": "Marketing",
        "dependencies": [],
    },
    {
        "title": "Launch beta to design partners",
        "description": "Send invites + onboarding kit to 12 design partners. Overdue by 2 days.",
        "status": "in_progress",
        "complexity": 2,
        "due_date": NOW - timedelta(days=2),
        "tag": "Launch",
        "dependencies": [],
    },
    {
        "title": "Migrate analytics pipeline",
        "description": "Cut over from Segment to in-house event bus. 80% complete.",
        "status": "in_progress",
        "complexity": 4,
        "due_date": NOW + timedelta(days=4),
        "tag": "Data",
        "dependencies": [],
    },
    {
        "title": "User interview synthesis",
        "description": "Synthesize findings from 8 user interviews into actionable themes.",
        "status": "todo",
        "complexity": 2,
        "due_date": NOW + timedelta(days=2),
        "tag": "Research",
        "dependencies": [],
    },
    {
        "title": "Database backups not running",
        "description": "Nightly snapshot job failed 3 nights in a row. Data loss risk.",
        "status": "blocked",
        "complexity": 4,
        "due_date": NOW + timedelta(hours=8),
        "tag": "Infra",
        "dependencies": [],
    },
    {
        "title": "Setup CI for mobile app",
        "description": "EAS build + TestFlight auto-publish on main branch merge.",
        "status": "todo",
        "complexity": 3,
        "due_date": NOW + timedelta(days=1),
        "tag": "DevOps",
        "dependencies": [],
    },
    {
        "title": "Quarterly OKR review prep",
        "description": "Compile metrics + narrative for leadership review. Deck template shared.",
        "status": "done",
        "complexity": 2,
        "due_date": NOW + timedelta(days=14),
        "tag": "Strategy",
        "dependencies": [],
    },
]


async def seed():
    async with AsyncSessionLocal() as db:
        # Upsert demo user
        result = await db.execute(select(User).where(User.email == DEMO_USER["email"]))
        user = result.scalar_one_or_none()
        if not user:
            user = User(**DEMO_USER, created_at=NOW)
            db.add(user)
            await db.flush()
            logger.info("Created user: %s", user.email)
        else:
            logger.info("User already exists: %s", user.email)

        # Upsert project
        result = await db.execute(select(Project).where(Project.name == "Apollo Launch"))
        project = result.scalar_one_or_none()
        if not project:
            project = Project(
                id=str(uuid.uuid4()),
                name="Apollo Launch",
                description="Full-stack product launch — payments, onboarding, analytics, and partner beta.",
                owner_id=user.id,
                created_at=NOW,
                updated_at=NOW,
            )
            db.add(project)
            await db.flush()
            logger.info("Created project: %s (%s)", project.name, project.id)
        else:
            logger.info("Project already exists: %s", project.name)

        # Seed tasks
        for td in TASKS_DATA:
            result = await db.execute(
                select(Task).where(Task.project_id == project.id).where(Task.title == td["title"])
            )
            existing = result.scalar_one_or_none()
            if existing:
                logger.info("Task already exists: %s", td["title"])
                continue

            task = Task(
                id=str(uuid.uuid4()),
                project_id=project.id,
                assignee_id=user.id,
                created_at=NOW,
                updated_at=NOW,
                **td,
            )
            db.add(task)
            await db.flush()

            # Embed into pgvector
            embed_content = f"{task.title}. {task.description or ''} Status: {task.status}. Tag: {task.tag or ''}."
            try:
                await embed_and_store(
                    embed_content,
                    project.id,
                    db,
                    task_id=task.id,
                    doc_type="task",
                    metadata={"title": task.title, "status": task.status, "tag": task.tag},
                )
                logger.info("Embedded task: %s", task.title)
            except Exception as exc:
                logger.warning("Embedding skipped for '%s': %s", task.title, exc)

        await db.commit()
        logger.info("Seed complete. Project ID: %s", project.id)
        print(f"\nDemo project_id: {project.id}")
        print("Login: alex@flowmind.app / demo")


if __name__ == "__main__":
    asyncio.run(seed())
