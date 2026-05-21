"""
Seed demo data for the newest user account (abdullah@gmail.com).
Run: uv run python seed_new_user.py [email]
Data is scoped to this user only — other accounts are unaffected.
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
TARGET_EMAIL = sys.argv[1] if len(sys.argv) > 1 else "abdullah@gmail.com"

# ---------------------------------------------------------------------------
# Unique projects for this account (different from the other account's data)
# ---------------------------------------------------------------------------

PROJECTS = [
    {
        "name": "E-Commerce Relaunch",
        "description": "Full redesign of the storefront — new checkout flow, mobile-first, Stripe integration.",
    },
    {
        "name": "AI Chatbot MVP",
        "description": "Customer support bot using GPT-4 + RAG over product docs. Target: 80% deflection rate.",
    },
    {
        "name": "DevOps Modernisation",
        "description": "Migrate from bare-metal to Kubernetes. Zero-downtime deployments, auto-scaling.",
    },
]

# (title, description, status, complexity, due_offset_days, tag)
TASKS_BY_PROJECT = {
    "E-Commerce Relaunch": [
        ("Audit current checkout funnel",
         "Record drop-off rates at each step. Heatmaps + session recordings via Hotjar.",
         "done", 2, -12, "Research"),
        ("Redesign product listing page",
         "New card layout, lazy-load images, filter sidebar. Figma prototype approved.",
         "done", 3, -6, "Design"),
        ("Implement new cart UI",
         "React component with optimistic updates, quantity controls, promo code field.",
         "in_progress", 4, 2, "Frontend"),
        ("Stripe Checkout v2 integration",
         "Replace legacy payment form with Stripe Elements. 3DS2 support required.",
         "in_progress", 5, 3, "Backend"),
        ("Mobile responsive audit",
         "Test on 12 device sizes. Fix overflow issues on iPhone SE and Galaxy Fold.",
         "todo", 3, 5, "QA"),
        ("SEO metadata overhaul",
         "Add structured data (JSON-LD), fix duplicate title tags, update sitemap.",
         "todo", 2, 7, "Marketing"),
        ("Performance optimisation",
         "Target LCP < 2.5s. Compress images, defer non-critical JS, add CDN.",
         "blocked", 4, 4, "Frontend"),
        ("A/B test new checkout flow",
         "50/50 split between old and new checkout. Run for 2 weeks, measure conversion.",
         "todo", 3, 14, "Growth"),
        ("Email transactional templates",
         "Order confirmation, shipping update, abandoned cart. Figma designs ready.",
         "in_progress", 2, 1, "Design"),
        ("Load testing — Black Friday prep",
         "Simulate 10k concurrent users. Target: zero errors at peak load.",
         "todo", 5, 21, "QA"),
    ],
    "AI Chatbot MVP": [
        ("Collect and clean product docs",
         "Export 340 help articles from Zendesk. Remove duplicates, fix formatting.",
         "done", 3, -10, "Data"),
        ("Set up pgvector knowledge base",
         "Chunk docs into 512-token segments, embed with text-embedding-3-small, store in Neon DB.",
         "done", 4, -5, "Backend"),
        ("Build RAG retrieval pipeline",
         "Cosine similarity search, top-5 chunks, inject into system prompt.",
         "in_progress", 5, 2, "Backend"),
        ("Design chat widget UI",
         "Floating button, slide-in panel, typing indicator, markdown rendering.",
         "in_progress", 3, 1, "Frontend"),
        ("Integrate GPT-4o API",
         "Streaming responses, token budget management, fallback to GPT-3.5 on rate limit.",
         "in_progress", 4, 3, "Backend"),
        ("Human handoff flow",
         "Detect low-confidence responses, route to live agent via Intercom.",
         "todo", 4, 8, "Backend"),
        ("Analytics dashboard",
         "Track deflection rate, CSAT score, avg resolution time per category.",
         "todo", 3, 10, "Data"),
        ("Security review",
         "Prompt injection testing, PII redaction, rate limiting per user.",
         "blocked", 4, 5, "Security"),
        ("Beta launch to 100 users",
         "Invite power users from support ticket history. Collect feedback via Typeform.",
         "todo", 2, 15, "Launch"),
    ],
    "DevOps Modernisation": [
        ("Inventory current infrastructure",
         "Document all 23 bare-metal servers, services, ports, and dependencies.",
         "done", 3, -20, "Ops"),
        ("Design Kubernetes cluster architecture",
         "3-node control plane, 6 worker nodes, separate namespaces per environment.",
         "done", 5, -14, "DevOps"),
        ("Set up staging cluster on EKS",
         "Terraform modules for VPC, EKS, RDS, ElastiCache. IaC review complete.",
         "in_progress", 5, 5, "DevOps"),
        ("Containerise API services",
         "Dockerfiles for 8 microservices. Multi-stage builds, non-root users.",
         "in_progress", 4, 3, "Backend"),
        ("Configure Helm charts",
         "Values files per environment. Secrets via AWS Secrets Manager + External Secrets Operator.",
         "todo", 4, 7, "DevOps"),
        ("Set up Prometheus + Grafana",
         "Cluster metrics, custom app dashboards, PagerDuty alerting rules.",
         "todo", 3, 10, "Ops"),
        ("Database migration to RDS",
         "Migrate PostgreSQL from bare-metal to RDS Multi-AZ. Zero-downtime cutover plan.",
         "blocked", 5, 6, "Backend"),
        ("CI/CD pipeline update",
         "GitHub Actions → build → push to ECR → Helm upgrade. Rollback on failure.",
         "in_progress", 4, 4, "DevOps"),
        ("Load balancer cutover",
         "Switch DNS from bare-metal nginx to ALB. Blue/green deployment.",
         "todo", 4, 12, "DevOps"),
        ("Decommission bare-metal servers",
         "Wipe and return 23 servers to data centre. Cancel hosting contracts.",
         "todo", 2, 45, "Ops"),
    ],
}

CHAT_MESSAGES_BY_PROJECT = {
    "E-Commerce Relaunch": [
        ("user", "What's blocking the performance optimisation task?"),
        ("assistant", "The **Performance optimisation** task is currently blocked. Based on the project context, it's likely waiting on the new cart UI and Stripe integration to be finalised first — you can't accurately measure LCP until the critical-path components are stable.\n\n**Recommended next steps:**\n1. Unblock once the cart UI (due in 2 days) is merged\n2. Run Lighthouse baseline before and after optimisation\n3. Prioritise image compression first — typically the highest LCP impact"),
        ("user", "Which tasks should we focus on this week?"),
        ("assistant", "Based on due dates and priority scores, here's your focus list for this week:\n\n**🔴 Critical (due ≤ 3 days)**\n- Implement new cart UI — due in 2 days\n- Email transactional templates — due tomorrow\n\n**🟠 High priority**\n- Stripe Checkout v2 integration — due in 3 days, high complexity\n\n**💡 Recommendation:** Pair the frontend and backend engineers on the cart + Stripe work — they're tightly coupled and blocking the A/B test milestone."),
    ],
    "AI Chatbot MVP": [
        ("user", "How is the RAG pipeline performing?"),
        ("assistant", "The RAG pipeline is **in progress** with the knowledge base already set up (pgvector with 340 embedded help articles).\n\nCurrent status:\n- ✅ Knowledge base: 340 docs chunked and embedded\n- 🔄 Retrieval pipeline: being built now\n- 🔄 GPT-4o integration: in parallel\n- 🚫 Security review: blocked — needs to happen before beta\n\n**Key risk:** The security review is blocked and must complete before the beta launch. I'd recommend scheduling it immediately after the RAG pipeline is stable."),
        ("user", "Create a task to write unit tests for the RAG retrieval pipeline"),
        ("assistant", "I'll create that task now.\n\n```json\n{\"action\": \"create_task\", \"data\": {\"title\": \"Unit tests for RAG retrieval pipeline\", \"description\": \"Test embedding quality, cosine similarity thresholds, top-k retrieval accuracy, and edge cases (empty query, no results).\", \"status\": \"todo\", \"complexity\": 3, \"tag\": \"Backend\"}}\n```\n\nTask created. I'd suggest targeting 80% coverage on the retrieval module before the beta launch."),
    ],
    "DevOps Modernisation": [
        ("user", "What are the biggest risks in the Kubernetes migration?"),
        ("assistant", "Based on the project tasks, here are the **top 3 risks**:\n\n**1. Database migration (BLOCKED — highest risk)**\nMigrating PostgreSQL to RDS Multi-AZ is the most complex task (complexity 5) and is currently blocked. A failed cutover could cause data loss or extended downtime. Ensure you have a tested rollback plan and a maintenance window.\n\n**2. Service containerisation dependencies**\nAll 8 microservices need working Dockerfiles before Helm charts can be configured. Any service that can't be containerised cleanly will delay the entire cluster cutover.\n\n**3. DNS cutover timing**\nThe load balancer cutover (blue/green) is the point of no return. Schedule it during lowest-traffic hours with the full team on standby.\n\n**Recommendation:** Unblock the database migration first — it's on the critical path for everything else."),
    ],
}


async def seed() -> None:
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.email == TARGET_EMAIL))
        user = result.scalar_one_or_none()
        if not user:
            logger.error("User not found: %s — register first.", TARGET_EMAIL)
            return

        logger.info("Seeding data for: %s (%s)", user.name, user.email)
        created_projects: list[Project] = []

        for proj_data in PROJECTS:
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
                    created_at=NOW - timedelta(days=45),
                    updated_at=NOW,
                )
                db.add(project)
                await db.flush()
                logger.info("Created project: %s", project.name)
            else:
                logger.info("Project already exists: %s", project.name)

            created_projects.append(project)

            # Add owner as project member
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
                    joined_at=NOW - timedelta(days=45),
                ))
                await db.flush()

            # Seed tasks
            tasks_data = TASKS_BY_PROJECT.get(proj_data["name"], [])
            seeded = 0
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
                    created_at=NOW - timedelta(days=abs(due_offset) + 2),
                    updated_at=NOW - timedelta(hours=abs(due_offset) * 3 + 1),
                )
                db.add(task)
                await db.flush()
                seeded += 1

            logger.info("Seeded %d tasks for %s", seeded, project.name)

            # Seed chat messages
            msgs = CHAT_MESSAGES_BY_PROJECT.get(proj_data["name"], [])
            existing_msg = await db.execute(
                select(ChatMessage).where(ChatMessage.project_id == project.id).limit(1)
            )
            if not existing_msg.scalar_one_or_none() and msgs:
                for i, (role, content) in enumerate(msgs):
                    db.add(ChatMessage(
                        id=str(uuid.uuid4()),
                        project_id=project.id,
                        role=role,
                        content=content,
                        created_at=NOW - timedelta(hours=len(msgs) - i),
                    ))
                await db.flush()
                logger.info("Seeded %d chat messages for %s", len(msgs), project.name)

        await db.commit()

        # Rescore all tasks
        async with AsyncSessionLocal() as db2:
            for p in created_projects:
                tasks = await rescore_project(p.id, db2)
                await db2.commit()
                logger.info("Rescored %d tasks for: %s", len(tasks), p.name)

        logger.info("\n✅ Done! Seeded for %s (%s)", user.name, user.email)
        for p in created_projects:
            count = len(TASKS_BY_PROJECT.get(p.name, []))
            logger.info("  • %s — %d tasks", p.name, count)
        logger.info("\nLog in as %s and refresh the dashboard.", TARGET_EMAIL)


if __name__ == "__main__":
    asyncio.run(seed())
