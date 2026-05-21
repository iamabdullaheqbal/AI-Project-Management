import json
import logging
import re

from mistralai.client import Mistral

from core.config import settings

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are FlowMind, an expert AI project management assistant.
You have access to the project's tasks, notes, and updates via the context below.
Answer questions about project status, priorities, blockers, and team workload.
Be concise, actionable, and specific. Reference actual task names and data when available.

When you need to create or update a task, include a JSON block in your response like:
```json
{"action": "create_task", "title": "...", "status": "todo", "complexity": 3}
```
or
```json
{"action": "update_task", "task_id": "...", "status": "done"}
```
Only include the JSON block when a task action is explicitly requested."""


def build_prompt(user_message: str, retrieved_docs: list[dict]) -> str:
    if retrieved_docs:
        context_lines = "\n\n".join(
            f"[{d['doc_type'].upper()}] {d['content']}" for d in retrieved_docs
        )
        context_block = f"\n\n## Relevant Project Context\n{context_lines}\n"
    else:
        context_block = ""
    return f"{user_message}{context_block}"


async def call_mistral(
    user_message: str,
    retrieved_docs: list[dict],
    history: list[dict] | None = None,
) -> str:
    """Call mistral-large-latest asynchronously and return the response text."""
    messages: list[dict] = [{"role": "system", "content": SYSTEM_PROMPT}]

    for turn in (history or [])[-10:]:
        if turn.get("role") in ("user", "assistant") and turn.get("content"):
            messages.append({"role": turn["role"], "content": str(turn["content"])[:5000]})

    messages.append({"role": "user", "content": build_prompt(user_message, retrieved_docs)})

    async with Mistral(api_key=settings.MISTRAL_API_KEY) as client:
        response = await client.chat.complete_async(
            model="mistral-large-latest",
            messages=messages,
            temperature=0.3,
            max_tokens=1024,
        )

    content = response.choices[0].message.content or ""
    return content


def parse_task_commands(response_text: str) -> list[dict]:
    """Extract JSON task commands embedded in the LLM response."""
    commands: list[dict] = []
    pattern = re.compile(r"```json\s*(\{.*?\})\s*```", re.DOTALL)
    for match in pattern.finditer(response_text):
        try:
            obj = json.loads(match.group(1))
            if isinstance(obj, dict) and "action" in obj:
                commands.append(obj)
        except json.JSONDecodeError:
            logger.warning("Failed to parse task command JSON: %s", match.group(1))
    return commands
