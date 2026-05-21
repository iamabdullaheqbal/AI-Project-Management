import asyncio
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import AsyncSessionLocal, get_db
from core.security import get_current_user, verify_project_access
from models.project import Project
from models.user import User
from schemas.project import ProjectCreate, ProjectOut, ProjectUpdate

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/projects", tags=["projects"])


async def _generate_project_docs(project_id: str, name: str, description: str) -> None:
    """
    Called as a background task after project creation.
    Generates a full professional documentation embedding so the AI has immediate context.
    """
    from services.llm_service import call_mistral, build_prompt
    from services.rag_service import embed_and_store

    try:
        messages = build_prompt(
            user_message=(
                f"You are a senior technical project manager. Write a comprehensive, professional "
                f"project documentation for a software project named **'{name}'**.\n\n"
                f"Project description: {description or 'Not provided — infer reasonable goals from the name.'}\n\n"
                "The documentation must include ALL of the following sections in full detail:\n\n"
                "## 1. Executive Summary\n"
                "A 2-3 paragraph overview of the project, its purpose, business value, and expected outcomes.\n\n"
                "## 2. Project Goals & Objectives\n"
                "List 4-6 specific, measurable goals (SMART format).\n\n"
                "## 3. Scope\n"
                "What is in scope and explicitly out of scope.\n\n"
                "## 4. Stakeholders & Team Structure\n"
                "Recommended roles: Project Manager, Tech Lead, Backend/Frontend Engineers, QA, DevOps, Designer.\n"
                "Responsibilities for each role.\n\n"
                "## 5. Technical Architecture\n"
                "Recommended tech stack, system components, data flow, and integration points.\n\n"
                "## 6. Project Phases & Milestones\n"
                "Break the project into 4-5 phases with estimated durations and key deliverables per phase.\n\n"
                "## 7. Task Breakdown (Initial Backlog)\n"
                "List 10-15 concrete initial tasks across different categories (setup, backend, frontend, testing, deployment).\n\n"
                "## 8. Risk Register\n"
                "Identify 5-7 risks with likelihood (High/Medium/Low), impact, and mitigation strategy.\n\n"
                "## 9. Definition of Done\n"
                "Clear criteria for when the project is considered complete.\n\n"
                "## 10. Success Metrics & KPIs\n"
                "How success will be measured post-launch.\n\n"
                "Write in a professional tone. Be specific and detailed. Do not truncate any section."
            ),
            retrieved_docs=[],
            chat_history=[],
        )
        doc_text = await call_mistral(messages, max_tokens=4096)

        async with AsyncSessionLocal() as db:
            await embed_and_store(
                text_content=f"# Project Documentation: {name}\n\n{doc_text}",
                project_id=project_id,
                db=db,
                doc_type="note",
                metadata={"type": "auto_documentation", "project_name": name},
            )
            await db.commit()

        logger.info("Auto-generated full documentation for project %s (%d chars)", project_id, len(doc_text))
    except Exception as exc:
        logger.warning("Failed to auto-generate docs for project %s: %s", project_id, exc)


@router.get("", response_model=list[ProjectOut])
async def list_projects(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Project)
        .where(Project.owner_id == current_user.id)
        .order_by(Project.created_at.desc())
    )
    return result.scalars().all()


@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
async def create_project(
    body: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = Project(
        name=body.name,
        description=body.description,
        owner_id=current_user.id,
    )
    db.add(project)
    await db.flush()
    await db.refresh(project)
    logger.info("Project created: %s by user %s", project.id, current_user.id)

    # Auto-generate project documentation and embed it into pgvector
    # so the AI assistant has immediate context about this project
    asyncio.create_task(_generate_project_docs(project.id, project.name, project.description or ""))

    return project


@router.get("/{project_id}", response_model=ProjectOut)
async def get_project(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await verify_project_access(project_id, current_user.id, db)
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.put("/{project_id}", response_model=ProjectOut)
async def update_project(
    project_id: str,
    body: ProjectUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await verify_project_access(project_id, current_user.id, db)
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if body.name is not None:
        project.name = body.name
    if body.description is not None:
        project.description = body.description
    project.updated_at = datetime.now(timezone.utc)
    db.add(project)
    await db.flush()
    await db.refresh(project)
    return project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await verify_project_access(project_id, current_user.id, db)
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    await db.delete(project)
    logger.info("Project deleted: %s by user %s", project_id, current_user.id)
