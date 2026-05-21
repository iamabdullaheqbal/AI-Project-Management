"""
LLM Service — build prompts, call Mistral mistral-large-latest,
parse task commands from responses.
"""
import json
import logging
import re
from typing import Any

from mistralai.client import Mistral

from core.config import settings

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = """\
You are FlowMind, an intelligent AI project management assistant with access to \
real project data retrieved from the database.

Guidelines:
- Always ground your answers in the provided context. If context is empty, say so.
- Be concise, actionable, and professional.
- Reference actual task titles, statuses, and assignees when available.
- When asked to create or update a task, output a JSON block exactly like this:

```json
{"action": "create_task", "data": {"title": "...", "status": "todo", "complexity": 3, "tag": "..."}}
```

or for updates:

```json
{"action": "update_task", "data": {"task_id": "...", "status": "done"}}
```

Only include a JSON block when a task action is explicitly requested by the user.\
"""


def build_prompt(
    user_message: str,
    retrieved_docs: list[dict],
    chat_history: list[dict],
) -> list[dict]:
    """
    Build the messages array for Mistral chat completion.

    Structure:
      1. System message with instructions
      2. Context message with retrieved docs (if any)
      3. Prior chat history turns (capped at last 10)
      4. Current user message
    """
    messages: list[dict] = [{"role": "system", "content": _SYSTEM_PROMPT}]

    # Inject retrieved context as a system-level context block
    if retrieved_docs:
        context_lines = "\n\n".join(
            f"[{d['doc_type'].upper()} | similarity={d.get('similarity', 0):.2f}]\n{d['content']}"
            for d in retrieved_docs
        )
        context_block = (
            "## Retrieved Project Context\n\n"
            f"{context_lines}\n\n"
            "Use the above context to answer the user's question accurately."
        )
        messages.append({"role": "system", "content": context_block})

    # Append prior conversation (cap at 10 turns to stay within token budget)
    for turn in chat_history[-10:]:
        role = turn.get("role", "")
        content = turn.get("content", "")
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": str(content)[:4000]})

    # Current user message
    messages.append({"role": "user", "content": user_message})
    return messages


async def call_mistral(messages: list[dict], max_tokens: int = 1024) -> str:
    """
    Call mistral-large-latest asynchronously.
    Returns the response text string.
    Raises on API errors — callers should handle.
    """
    client = Mistral(api_key=settings.MISTRAL_API_KEY)
    try:
        response = await client.chat.complete_async(
            model="mistral-large-latest",
            messages=messages,
            temperature=0.3,
            max_tokens=max_tokens,
        )
        content = response.choices[0].message.content or ""
        logger.debug(
            "Mistral response: %d chars, finish_reason=%s",
            len(content),
            response.choices[0].finish_reason,
        )
        return content
    except Exception as exc:
        logger.error("Mistral API error: %s", exc, exc_info=True)
        raise


def parse_task_commands(response_text: str) -> list[dict] | None:
    """
    Extract JSON task command blocks from the LLM response.

    Looks for:
      ```json
      {"action": "create_task" | "update_task", "data": {...}}
      ```

    Returns a list of parsed command dicts, or None if none found.
    Robust to extra whitespace and minor formatting variations.
    """
    commands: list[dict] = []

    # Match fenced JSON blocks
    pattern = re.compile(r"```json\s*(\{.*?\})\s*```", re.DOTALL | re.IGNORECASE)
    for match in pattern.finditer(response_text):
        raw = match.group(1).strip()
        try:
            obj: Any = json.loads(raw)
            if not isinstance(obj, dict):
                continue
            action = obj.get("action", "")
            if action in ("create_task", "update_task") and "data" in obj:
                commands.append(obj)
                logger.info("Parsed task command: action=%s", action)
        except json.JSONDecodeError as exc:
            logger.warning("Failed to parse task command JSON: %s — %s", raw[:100], exc)

    return commands if commands else None
