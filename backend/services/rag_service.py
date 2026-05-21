"""
RAG Service — embed, store, and retrieve project context using
Mistral mistral-embed (1024-dim) + pgvector cosine similarity.
"""
import logging
from datetime import datetime, timezone

from mistralai.client import Mistral
from sqlalchemy import delete, text
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from models.document_embedding import DocumentEmbedding

logger = logging.getLogger(__name__)

# Reuse a single client instance per process (thread-safe, connection-pooled)
_mistral_client: Mistral | None = None


def _get_client() -> Mistral:
    global _mistral_client
    if _mistral_client is None:
        _mistral_client = Mistral(api_key=settings.MISTRAL_API_KEY)
    return _mistral_client


async def embed_text(text_content: str) -> list[float]:
    """
    Call Mistral mistral-embed API asynchronously.
    Returns a 1024-dimensional float vector.
    """
    if not text_content or not text_content.strip():
        raise ValueError("Cannot embed empty text")

    client = _get_client()
    response = await client.embeddings.create_async(
        model="mistral-embed",
        inputs=text_content,
    )
    embedding: list[float] = response.data[0].embedding
    if len(embedding) != 1024:
        raise RuntimeError(f"Expected 1024-dim embedding, got {len(embedding)}")
    return embedding


async def embed_and_store(
    text_content: str,
    project_id: str,
    db: AsyncSession,
    task_id: str | None = None,
    doc_type: str = "task",
    metadata: dict | None = None,
) -> int:
    """
    Embed text and persist to document_embeddings.
    Returns the new embedding row id.
    """
    vector = await embed_text(text_content)

    doc = DocumentEmbedding(
        project_id=project_id,
        task_id=task_id,
        doc_type=doc_type,
        content=text_content,
        embedding=vector,
        metadata_=metadata or {},
        created_at=datetime.now(timezone.utc),
    )
    db.add(doc)
    await db.flush()
    logger.info("Stored embedding id=%s project=%s doc_type=%s", doc.id, project_id, doc_type)
    return doc.id


async def retrieve_context(
    query: str,
    project_id: str,
    db: AsyncSession,
    top_k: int = 5,
) -> list[dict]:
    """
    Embed the query then run pgvector cosine similarity search
    scoped to the given project.

    Returns list of dicts: {content, metadata, doc_type, similarity}
    """
    query_vector = await embed_text(query)

    # pgvector cosine distance operator: <=>
    # 1 - distance = similarity (higher = more similar)
    sql = text(
        """
        SELECT id, content, doc_type, metadata,
               1 - (embedding <=> CAST(:vec AS vector)) AS similarity
        FROM document_embeddings
        WHERE project_id = :project_id
        ORDER BY embedding <=> CAST(:vec AS vector)
        LIMIT :top_k
        """
    )
    result = await db.execute(
        sql,
        {
            "vec": str(query_vector),
            "project_id": project_id,
            "top_k": top_k,
        },
    )
    rows = result.fetchall()
    docs = [
        {
            "id": row.id,
            "content": row.content,
            "doc_type": row.doc_type,
            "metadata": row.metadata or {},
            "similarity": round(float(row.similarity), 4),
        }
        for row in rows
    ]
    logger.debug(
        "Retrieved %d docs for project=%s query_len=%d",
        len(docs), project_id, len(query),
    )
    return docs


async def delete_task_embeddings(task_id: str, db: AsyncSession) -> None:
    """Remove all embeddings associated with a task."""
    await db.execute(
        delete(DocumentEmbedding).where(DocumentEmbedding.task_id == task_id)
    )
    logger.debug("Deleted embeddings for task=%s", task_id)


async def update_task_embedding(
    task: object,
    project_id: str,
    db: AsyncSession,
) -> int:
    """
    Delete stale embeddings for a task then re-embed with current content.
    Returns the new embedding id.
    """
    task_id: str = getattr(task, "id")
    title: str = getattr(task, "title", "") or ""
    description: str = getattr(task, "description", "") or ""
    status: str = getattr(task, "status", "") or ""
    priority_label: str = getattr(task, "priority_label", "") or ""
    tag: str = getattr(task, "tag", "") or ""

    await delete_task_embeddings(task_id, db)

    text_content = (
        f"{title}. {description}. "
        f"Status: {status}. Priority: {priority_label}. Tag: {tag}."
    ).strip()

    return await embed_and_store(
        text_content=text_content,
        project_id=project_id,
        db=db,
        task_id=task_id,
        doc_type="task",
        metadata={
            "task_id": task_id,
            "title": title,
            "status": status,
            "priority_label": priority_label,
        },
    )
