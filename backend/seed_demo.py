"""
Demo data seeder — populates the dashboard with realistic projects, tasks,
team members, and chat history for the existing user.

Run: uv run python seed_demo.py [email]
Default email: abdullaheqbalhere@gmail.com
"""
import asyncio
import logging
import sys
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from core.database import AsyncSessionLocal
from models.chat_message import ChatMessage  # noqa: F401
from models.document_embedding import DocumentEmbedding  # noqa: F401
from models.project import Project
from models.project_member import ProjectMember
from models.task import Task
from models.user import User
from services.task_service import rescore_project

logging.basicConfig(level=logging.INFO, format="%(levelname)s — %(message)s")
logger = logging.getLogger(__name__)

NOW = datetime.now(timezone.utc)
TARGET_EMAIL = sys.argv[1] if len(sys.argv) > 1 else "abdullaheqbalhere@gmail.com"


# ---------------------------------------------------------------------------
# Data
# ---------------------------------------------------------------------------

PROJECTS = [
    {
        "name": "FlowMind Platform",
        "description": "Core SaaS product — AI-powered project management with RAG chat.",
    },
    {
        "name": "Mobile App v2",
        "description": "React Native rewrite with offline support and push notifications.",
    },
    {
        "name": "Data Pipeline Overhaul",
        "description": "Migrate from Segment to in-house event bus. Reduce latency by 60%.",
    },
]

# Tasks per project: (title, description, status, complexity, due_offset_days, tag)
TASKS_BY_PROJECT = {
    "FlowMind Platform": [
        ("Fix production payment outage",
         "Stripe webhooks failing for EU customers since 14:00 UTC. Revenue impact ~$12k/hr.",
         "in_progress", 5, 0, "Incident"),
        ("Redesign onboarding flow",
         "Reduce step count from 6 to 3, add progress indicator. Figma mockups ready.",
         "in_progress", 3, 1, "Design"),
        ("API rate limiting blocked by infra review",
         "Awaiting platform team sign-off on Redis cluster config.",
         "blocked", 4, 3, "Backend"),
        ("Launch beta to design partners",
         "Send invites + onboarding kit to 12 design partners.",
         "in_progress", 2, -2, "Launch"),
        ("User interview synthesis",
         "Synthesize findings from 8 user interviews into actionable themes.",
         "todo", 2, 2, "Research"),
        ("Database backups not running",
         "Nightly snapshot job failed 3 nights in a row. Data loss risk.",
         "blocked", 4, 0, "Infra"),
        ("Setup CI/CD pipeline",
         "GitHub Actions — build, test, deploy to staging on every PR merge.",
         "done", 3, -5, "DevOps"),
        ("Quarterly OKR review prep",
         "Compile metrics + narrative for leadership review.",
         "todo", 2, 14, "Strategy"),
        ("Implement refresh token rotation",
         "Security hardening — rotate refresh tokens on every use.",
         "done", 3, -3, "Backend"),
        ("Add dark mode support",
         "Tailwind dark variant + system preference detection.",
         "todo", 2, 7, "Frontend"),
        ("Performance audit — dashboard",
         "Lighthouse score below 70. Identify and fix render-blocking resources.",
         "in_progress", 3, 4, "Frontend"),
        ("Write API documentation",
         "OpenAPI spec review + Postman collection for all endpoints.",
         "todo", 2, 10, "Docs"),
    ],
    "Mobile App v2": [
        ("Setup React Native project",
         "Expo SDK 51, TypeScript, ESLint, Prettier, Husky pre-commit hooks.",
         "done", 2, -10, "Setup"),
        ("Implement offline task sync",
         "SQLite local cache + background sync when connectivity restored.",
         "in_progress", 5, 5, "Backend"),
        ("Push notification service",
         "Expo Notifications + FCM/APNs integration for task reminders.",
         "todo", 4, 8, "Backend"),
        ("Design system migration",
         "Port web shadcn components to React Native Paper equivalents.",
         "in_progress", 4, 3, "Design"),
        ("App Store submission prep",
         "Screenshots, metadata, privacy policy, TestFlight beta group.",
         "todo", 2, 21, "Launch"),
        ("Biometric authentication",
         "Face ID / fingerprint login using expo-local-authentication.",
         "todo", 3, 14, "Security"),
        ("Crash reporting integration",
         "Sentry SDK setup with source maps and release tracking.",
         "done", 2, -7, "DevOps"),
        ("E2E tests with Detox",
         "Critical user flows: login, create task, mark done, chat.",
         "blocked", 4, 6, "QA"),
    ],
    "Data Pipeline Overhaul": [
        ("Audit current Segment events",
         "Document all 47 event types, properties, and downstream consumers.",
         "done", 3, -14, "Data"),
        ("Design new event schema",
         "JSON Schema v7 definitions for all events. Versioning strategy.",
         "done", 3, -8, "Data"),
        ("Build Kafka producer service",
         "FastAPI microservice publishing events to Kafka topics.",
         "in_progress", 5, 4, "Backend"),
        ("Migrate analytics dashboard",
         "Update Metabase queries to read from new event store.",
         "todo", 3, 10, "Data"),
        ("Backfill historical data",
         "ETL job to migrate 18 months of Segment data to new schema.",
         "todo", 5, 15, "Data"),
        ("Load testing",
         "Simulate 10k events/sec. Target p99 latency < 50ms.",
         "todo", 4, 12, "QA"),
        ("Decommission Segment",
         "Remove SDK, cancel subscription, archive raw data to S3.",
         "todo", 2, 30, "Ops"),
    ],
}

CHAT_MESSAGES = [
    ("user", "What tasks are blocking the FlowMind Platform release?"),
    ("assistant", "There are **2 blocked tasks** right now:\n\n1. **API rate limiting** — waiting on platform team sign-off for the Redis cluster. Daniel Park is the blocker.\n2. **Database backups not running** — nightly snapshot job has failed 3 consecutive nights. This is a critical data risk.\n\nI'd recommend unblocking the backup job first — it's a P0 data safety issue. The rate limiting can wait until after the Redis review is complete."),
    ("user", "Who has the most tasks assigned?"),
    ("assistant", "Based on current assignments:\n\n- **Abdullah** — 8 active tasks (at capacity)\n- **Sara Chen** — 5 active tasks\n- **Daniel Park** — 4 active tasks\n\nAbdullah is at capacity. Consider redistributing the *API documentation* and *dark mode* tasks to free up bandwidth for the critical incident work."),
    ("user", "Summarize this week's progress"),
    ("assistant", "**This week's summary:**\n\n✅ **Completed (3 tasks)**\n- Setup CI/CD pipeline\n- Implement refresh token rotation\n- Crash reporting integration\n\n🔄 **In Progress (4 tasks)**\n- Fix production payment outage *(critical — overdue)*\n- Redesign onboarding flow\n- Launch beta to design partners *(overdue by 2 days)*\n- Performance audit — dashboard\n\n🚫 **Blocked (2 tasks)**\n- API rate limiting\n- Database backups not running\n\nOverall sprint completion: **~35%**. The two blocked items are the main risk to hitting this week's goals."),
]


# ---------------------------------------------------------------------------
# Seed
# ---------------------------------------------------------------------------

async def seed() -> None:
    async with AsyncSessionLocal() as db:
        # Find the target user
        result = await db.execute(select(User).where(User.email == TARGET_EMAIL))
        user = result.scalar_one_or_none()
        if not user:
            logger.error("User not found: %s — register first, then run this script.", TARGET_EMAIL)
            return

        logger.info("Seeding data for user: %s (%s)", user.name, user.email)

        created_projects: list[Project] = []

        for proj_data in PROJECTS:
            # Skip if project already exists
            existing = await db.execute(
                select(Project).where(
                    Project.name == proj_data["name"],
                    Project.owner_id == user.id,
                )
            )
            project = existing.scalar_one_or_none()

            if not project:
                project = Project(
                    id=str(uuid.uuid4()),
                    name=proj_data["name"],
                    description=proj_data["description"],
                    owner_id=user.id,
                    created_at=NOW - timedelta(days=30),
                    updated_at=NOW,
                )
                db.add(project)
                await db.flush()
                logger.info("Created project: %s", project.name)
            else:
                logger.info("Project already exists: %s", project.name)

            created_projects.append(project)

            # Add owner as a project member if not already
            existing_member = await db.execute(
                select(ProjectMember).where(
                    ProjectMember.project_id == project.id,
                    ProjectMember.user_id == user.id,
                )
            )
            if not existing_member.scalar_one_or_none():
                db.add(ProjectMember(
                    id=str(uuid.uuid4()),
                    project_id=project.id,
                    user_id=user.id,
                    team_role="Owner",
                    joined_at=NOW - timedelta(days=30),
                ))
                await db.flush()

            # Seed tasks for this project
            tasks_data = TASKS_BY_PROJECT.get(proj_data["name"], [])
            for (title, desc, status, complexity, due_offset, tag) in tasks_data:
                existing_task = await db.execute(
                    select(Task).where(Task.project_id == project.id, Task.title == title)
                )
                if existing_task.scalar_one_or_none():
                    continue

                due_date = NOW + timedelta(days=due_offset) if due_offset != 0 else None
                task = Task(
                    id=str(uuid.uuid4()),
                    project_id=project.id,
                    title=title,
                    description=desc,
                    assignee_id=user.id,
                    status=status,
                    complexity=complexity,
                    due_date=due_date,
                    tag=tag,
                    dependencies=[],
                    priority_score=0.0,
                    priority_label="low",
                    created_at=NOW - timedelta(days=abs(due_offset) + 1),
                    updated_at=NOW - timedelta(hours=abs(due_offset) * 2),
                )
                db.add(task)
                await db.flush()

            logger.info("Seeded %d tasks for %s", len(tasks_data), project.name)

        # Seed chat history for the first project
        if created_projects:
            first_project = created_projects[0]
            existing_msgs = await db.execute(
                select(ChatMessage).where(ChatMessage.project_id == first_project.id).limit(1)
            )
            if not existing_msgs.scalar_one_or_none():
                for i, (role, content) in enumerate(CHAT_MESSAGES):
                    db.add(ChatMessage(
                        id=str(uuid.uuid4()),
                        project_id=first_project.id,
                        role=role,
                        content=content,
                        created_at=NOW - timedelta(hours=len(CHAT_MESSAGES) - i),
                    ))
                await db.flush()
                logger.info("Seeded %d chat messages for %s", len(CHAT_MESSAGES), first_project.name)

        await db.commit()

        # Rescore all tasks now that they're committed
        async with AsyncSessionLocal() as db2:
            for p in created_projects:
                tasks = await rescore_project(p.id, db2)
                await db2.commit()
                logger.info("Rescored %d tasks for: %s", len(tasks), p.name)

        logger.info("\n✅ Seed complete!")
        logger.info("Projects created: %d", len(created_projects))
        for p in created_projects:
            task_count = len(TASKS_BY_PROJECT.get(p.name, []))
            logger.info("  • %s — %d tasks", p.name, task_count)
        logger.info("\nOpen http://localhost:3000 and refresh the dashboard.")


if __name__ == "__main__":
    asyncio.run(seed())
