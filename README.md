<div align="center">

# 🧠 FlowMind

### *Plan. Prioritize. Ship.*

**RAG-powered AI project management platform with real-time chat, intelligent task scoring, and autonomous documentation generation**

![Python](https://img.shields.io/badge/Python-3.13+-3776AB?style=flat-square&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?style=flat-square&logo=fastapi&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-15.3-000000?style=flat-square&logo=next.js&logoColor=white)
![Mistral](https://img.shields.io/badge/Mistral-Large_Latest-FF7000?style=flat-square)
![pgvector](https://img.shields.io/badge/pgvector-PostgreSQL-336791?style=flat-square&logo=postgresql&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)

</div>

---

## What Is FlowMind

FlowMind is a full-stack AI project management platform where every project gets its own intelligent assistant. When you create a project, FlowMind automatically generates comprehensive professional documentation using Mistral and embeds it into a pgvector knowledge base. From that moment, the AI assistant can answer questions about your project grounded in real data — tasks, blockers, team workload, and the auto-generated docs — not generic guesses.

The priority scoring engine continuously recalculates every task's urgency based on due dates, complexity, blocking relationships, and staleness, so your team always knows what to work on next.

---

## How It Works

```
User creates a project
        ↓
Background task fires (asyncio.create_task)
        ↓
Mistral generates 10-section professional documentation (4096 tokens)
        ↓
Doc embedded via mistral-embed (1024-dim) → stored in pgvector
        ↓
User adds tasks → each task auto-embedded + priority scored
        ↓
User opens AI Assistant → selects project from dropdown
        ↓
WebSocket connects (JWT auth via query param)
        ↓
User sends message
        ↓
RAG: embed query → cosine similarity search → top-5 relevant chunks
        ↓
Mistral Large: system prompt + context + chat history → response
        ↓
Parse task commands from response → execute create/update if found
        ↓
Response streamed back over WebSocket with retrieved_count
```

---

## Key Features

- **RAG-powered AI chat** — every response is grounded in your actual project data, not hallucinations
- **Per-project chat rooms** — separate WebSocket connections and persistent chat history per project
- **Auto-documentation on project creation** — Mistral generates a 10-section professional doc (goals, architecture, risks, milestones, KPIs) the moment you create a project
- **AI task execution** — the assistant can create and update tasks directly from chat by parsing JSON command blocks in its responses
- **Priority scoring engine** — every task scored on urgency (40%), complexity (25%), blocking (20%), staleness (15%) — recalculated on every update
- **Kanban board** — full create/edit/delete with status columns, filters, and priority breakdown modal
- **JWT auth with refresh tokens** — access + refresh token pair, automatic silent refresh on 401
- **Security hardened** — security headers middleware, CORS scoped to env-configured origins, ownership checks on every endpoint
- **Fully async** — SQLAlchemy 2.x async, asyncpg, async Mistral SDK calls throughout

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | Next.js 15 + Tailwind CSS v3 | App UI, kanban board, chat interface |
| State | Zustand + TanStack Query | Auth store, server state, cache invalidation |
| Backend | FastAPI (Python 3.13, async) | REST API, WebSocket, orchestration |
| LLM | Mistral `mistral-large-latest` | AI chat responses, project documentation |
| Embeddings | Mistral `mistral-embed` | 1024-dim vectors for RAG |
| Vector DB | PostgreSQL + pgvector | HNSW index, cosine similarity search |
| ORM | SQLAlchemy 2.x async + asyncpg | Async database access |
| Migrations | Alembic (async engine) | Schema versioning |
| Auth | python-jose (JWT) + bcrypt | Access + refresh tokens |
| Markdown | react-markdown | Renders AI responses with formatting |
| Charts | Recharts | Dashboard workload and completion charts |
| Package Manager | `uv` | Python dependency management |

---

## Project Structure

```
flowmind/
├── README.md
├── .gitignore
│
├── backend/
│   ├── main.py                    # FastAPI app, CORS, security headers, router registration
│   ├── alembic.ini
│   ├── seed.py                    # Demo data seeder
│   ├── pyproject.toml             # Python dependencies (managed by uv)
│   │
│   ├── core/
│   │   ├── config.py              # Typed settings via pydantic-settings, startup validation
│   │   ├── database.py            # Async SQLAlchemy engine + session factory
│   │   └── security.py            # JWT creation/validation, bcrypt, ownership helpers
│   │
│   ├── models/
│   │   ├── user.py
│   │   ├── project.py
│   │   ├── task.py                # JSONB dependencies, priority_score, priority_label
│   │   ├── chat_message.py
│   │   └── document_embedding.py  # Vector(1024) column for pgvector
│   │
│   ├── schemas/
│   │   ├── user.py                # LoginRequest, TokenResponse, UserCreate
│   │   ├── project.py
│   │   ├── task.py                # Field validators, status enum enforcement
│   │   └── chat.py                # ChatMessageOut, DashboardOut
│   │
│   ├── services/
│   │   ├── rag_service.py         # embed_text, embed_and_store, retrieve_context, update_task_embedding
│   │   ├── llm_service.py         # build_prompt, call_mistral, parse_task_commands
│   │   └── task_service.py        # Priority scoring engine, rescore_task, rescore_project
│   │
│   ├── routers/
│   │   ├── auth.py                # /auth/register, /auth/login, /auth/refresh, /auth/me
│   │   ├── projects.py            # CRUD + background auto-documentation task
│   │   ├── tasks.py               # CRUD + auto-embed + rescore on every write
│   │   ├── dashboard.py           # Stats, critical tasks, blockers
│   │   ├── team.py                # Team workload scoped to current user's projects
│   │   └── chat.py                # WebSocket /ws/chat/{project_id}, REST fallback, history
│   │
│   └── alembic/
│       ├── env.py                 # Async alembic setup
│       └── versions/
│           └── 0001_initial.py    # pgvector extension + all tables + HNSW index
│
└── frontend/
    ├── package.json
    ├── next.config.ts
    ├── tailwind.config.ts
    ├── tsconfig.json
    │
    └── src/
        ├── app/
        │   ├── layout.tsx             # Root layout, Providers, Toaster
        │   ├── login/
        │   │   └── page.tsx           # Sign up / Sign in toggle (single page)
        │   └── (main)/
        │       ├── layout.tsx         # Sidebar layout + AuthGuard
        │       ├── page.tsx           # Dashboard — metrics, charts, critical tasks, project creation
        │       ├── tasks/page.tsx     # Kanban board — create, edit, delete, priority breakdown
        │       ├── chat/page.tsx      # AI assistant — project selector, WebSocket, markdown rendering
        │       ├── team/page.tsx      # Team workload cards
        │       ├── progress/page.tsx  # Project progress + burndown chart
        │       └── settings/page.tsx  # Profile, notifications, AI preferences
        │
        ├── components/
        │   ├── AppSidebar.tsx         # Collapsible sidebar with nav + user footer
        │   ├── AuthGuard.tsx          # Client-side auth redirect
        │   ├── Providers.tsx          # React Query + Sonner
        │   ├── Skeletons.tsx
        │   ├── EmptyState.tsx
        │   └── ui/                    # 40+ shadcn/ui primitives
        │
        ├── lib/
        │   ├── api.ts                 # Axios instance, JWT interceptor, silent refresh
        │   ├── queries.ts             # All TanStack Query hooks + TypeScript types
        │   └── socket.ts              # WebSocket manager, onSocketMessage, onSocketStatus
        │
        └── stores/
            ├── auth.ts                # Zustand auth store (token, refreshToken, user)
            └── chat.ts                # Per-project message store
```

---

## Prerequisites

- Python 3.13+
- Node.js 18+
- [`uv`](https://docs.astral.sh/uv/getting-started/installation/) — Python package manager
- PostgreSQL with pgvector extension
- Mistral API key — [console.mistral.ai](https://console.mistral.ai)

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://user:password@host:5432/dbname` |
| `SECRET_KEY` | 64-char hex string — generate with `python -c "import secrets; print(secrets.token_hex(32))"` |
| `ALGORITHM` | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Default: `30` |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Default: `7` |
| `MISTRAL_API_KEY` | From [console.mistral.ai](https://console.mistral.ai) |
| `ALLOWED_ORIGINS` | Comma-separated: `http://localhost:3000` |

### Frontend (`frontend/.env.local`)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Default: `http://localhost:8000` |

---

## Running the Backend

```bash
# 1. Navigate to backend
cd backend

# 2. Install dependencies
uv sync

# 3. Create .env
cp .env.example .env
# Fill in DATABASE_URL, SECRET_KEY, MISTRAL_API_KEY
```

**4. Set up PostgreSQL with pgvector**

```sql
-- Run in psql or your DB client
CREATE DATABASE flowmind_db;
\c flowmind_db
CREATE EXTENSION IF NOT EXISTS vector;
```

```bash
# 5. Run migrations (creates all tables + HNSW index)
uv run alembic upgrade head

# 6. (Optional) Seed demo data
uv run python seed.py

# 7. Start the server
uv run uvicorn main:app --reload
```

Backend runs at **http://localhost:8000**
Interactive docs at **http://localhost:8000/docs**

---

## Running the Frontend

```bash
# 1. Navigate to frontend
cd frontend

# 2. Install dependencies
npm install

# 3. Start dev server
npm run dev
```

Frontend runs at **http://localhost:3000**

---

## API Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/register` | — | Create account, returns token pair |
| `POST` | `/auth/login` | — | Sign in, returns token pair |
| `POST` | `/auth/refresh` | — | Refresh access token |
| `GET` | `/auth/me` | ✓ | Current user profile |
| `GET` | `/projects` | ✓ | List user's projects |
| `POST` | `/projects` | ✓ | Create project + trigger auto-documentation |
| `GET` | `/projects/{id}` | ✓ | Get project (ownership enforced) |
| `PUT` | `/projects/{id}` | ✓ | Update project |
| `DELETE` | `/projects/{id}` | ✓ | Delete project |
| `GET` | `/tasks/{project_id}` | ✓ | List tasks with live priority scores |
| `POST` | `/tasks` | ✓ | Create task + embed + score |
| `PUT` | `/tasks/{id}` | ✓ | Update task + re-embed + rescore |
| `DELETE` | `/tasks/{id}` | ✓ | Delete task + remove embeddings |
| `GET` | `/tasks/{id}/priority` | ✓ | Full score breakdown with factor weights |
| `POST` | `/tasks/bulk-score` | ✓ | Recalculate all scores for a project |
| `GET` | `/dashboard/{project_id}` | ✓ | Completion %, task counts, overdue |
| `GET` | `/dashboard/{project_id}/critical` | ✓ | HIGH + CRITICAL tasks sorted by score |
| `GET` | `/dashboard/{project_id}/blockers` | ✓ | Blocked tasks |
| `GET` | `/team` | ✓ | Team workload scoped to user's projects |
| `WS` | `/ws/chat/{project_id}?token=` | ✓ | Real-time AI chat |
| `POST` | `/chat/message` | ✓ | REST fallback single-turn chat |
| `GET` | `/chat/history/{project_id}` | ✓ | Paginated chat history |
| `GET` | `/health` | — | Health check |

---

## Priority Scoring Engine

Every task is scored continuously on four factors:

| Factor | Weight | Calculation |
|---|---|---|
| Urgency | 40% | `<1 day=1.0`, `<3=0.8`, `<7=0.6`, `<14=0.4`, `>14=0.2`, overdue=1.0 |
| Complexity | 25% | `task.complexity / 5.0` |
| Blocking | 20% | `min(tasks_blocked_by_this / 5, 1.0)` |
| Staleness | 15% | `min(days_since_update / 14, 1.0)` — only for `in_progress` tasks |

**Labels:** `0.00–0.30` = low · `0.30–0.55` = medium · `0.55–0.75` = high · `0.75–1.00` = critical

---

## RAG Architecture

```
User message
     ↓
embed_text(query) → mistral-embed → 1024-dim vector
     ↓
SELECT content, doc_type, metadata,
       1 - (embedding <=> query_vector) AS similarity
FROM document_embeddings
WHERE project_id = :project_id
ORDER BY embedding <=> query_vector
LIMIT 5
     ↓
Top-5 chunks injected into system prompt with similarity scores
     ↓
Mistral Large generates grounded response
```

The HNSW index (`m=16, ef_construction=64`) on the `embedding` column ensures sub-millisecond retrieval even at scale.

---

## WebSocket Protocol

```jsonc
// Client → Server
{ "content": "What is blocking deployment?", "project_id": "uuid" }

// Server → Client: typing indicator
{ "type": "typing" }

// Server → Client: AI task commands (if any)
{ "type": "task_commands", "commands": [{ "action": "create_task", "task_id": "...", "title": "..." }] }

// Server → Client: final response
{
  "type": "message",
  "role": "assistant",
  "content": "Two blockers right now...",
  "retrieved_count": 4,
  "id": "uuid",
  "timestamp": 1716300000000
}

// Server → Client: error
{ "type": "error", "content": "Message must be 1–10000 chars" }
```

Authentication is via `?token=<JWT>` query parameter — the connection is rejected with code `4001` if the token is invalid or the user doesn't own the project.

---

## Database Schema

```sql
-- pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Core tables
users              (id, name, email, role, hashed_password, created_at)
projects           (id, name, description, owner_id → users, created_at, updated_at)
tasks              (id, project_id → projects, title, description, assignee_id → users,
                    status, priority_score, priority_label, due_date, complexity,
                    dependencies JSONB, tag, created_at, updated_at)
chat_messages      (id, project_id → projects, role, content, created_at)
document_embeddings(id BIGSERIAL, project_id → projects, task_id → tasks,
                    doc_type, content, embedding VECTOR(1024), metadata JSONB, created_at)

-- HNSW index for fast cosine similarity
CREATE INDEX ON document_embeddings
USING hnsw (embedding vector_cosine_ops)
WITH (m=16, ef_construction=64);
```

---

## Security

- All endpoints require JWT Bearer token (except `/auth/*` and `/health`)
- Every project/task operation verifies ownership — users can only access their own data
- Passwords hashed with bcrypt (12 rounds)
- JWT tokens include type claim (`access` / `refresh`) to prevent token type confusion
- Security headers on every response: `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy`
- CORS restricted to configured origins, specific methods, and specific headers
- Input validation via Pydantic v2 `Field` constraints on all schemas

---

*FlowMind is a development tool. Always review AI-generated content before acting on it.*
