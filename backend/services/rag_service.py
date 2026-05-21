import logging
from datetime import datetime, timezone

from mistralai.client import Mistral
from sqlalchemy import delete, text
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from models.document_embedding import DocumentEmbedding

logger = logging.getLogger(__name__)


async def embed_text(text_content: str) -> list[float]:
    """Call Mistral embed API asynchronously and return 1024-dim vector."""
    async with Mistral(api_key=settings.MISTRAL_API_KEY) as client:
        response = await client.embeddings.create_async(
            model="mistral-embed",
            inputs=[text_content],
        )
    return response.data[0].embedding


async def embed_and_store(
    text_content: str,
    project_id: str,
    db: AsyncSession,
    task_id: str | None = None,
    doc_type: str = "task",
    metadata: dict | None = None,
) -> DocumentEmbedding:
    """Embed text and persist to document_embeddings table."""
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
    logger.info("Stored embedding id=%s for project=%s", doc.id, project_id)
    return doc


async def remove_task_embeddings(task_id: str, db: AsyncSession) -> None:
    await db.execute(
        delete(DocumentEmbedding).where(DocumentEmbedding.task_id == task_id)
    )


async def retrieve_context(
    query: str,
    project_id: str,
    db: AsyncSession,
    top_k: int = 5,
) -> list[dict]:
    """Embed query and run pgvector cosine similarity search."""
    vector = await embed_text(query)

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
        {"vec": str(vector), "project_id": project_id, "top_k": top_k},
    )
    rows = result.fetchall()
    return [
        {
            "id": row.id,
            "content": row.content,
            "doc_type": row.doc_type,
            "metadata": row.metadata,
            "similarity": float(row.similarity),
        }
        for row in rows
    ]
