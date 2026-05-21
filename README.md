<div align="center">

# 🧠 FlowMind

### *Plan. Prioritize. Ship.*

**RAG-powered AI project management platform with real-time chat, intelligent task scoring, and autonomous documentation generation**

![Python](https://img.shields.io/badge/Python-3.13+-3776AB?style=flat-square&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?style=flat-square&logo=fastapi&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-15.3.2-000000?style=flat-square&logo=next.js&logoColor=white)
![Mistral](https://img.shields.io/badge/Mistral-Large_Latest-FF7000?style=flat-square)
![pgvector](https://img.shields.io/badge/pgvector-1024--dim-336791?style=flat-square&logo=postgresql&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)

</div>

---

## What Is FlowMind

FlowMind is a full-stack AI project management platform where every project gets its own intelligent assistant. When you create a project, FlowMind automatically generates comprehensive professional documentation using **Mistral Large** and embeds it into a **pgvector** knowledge base using **Mistral Embed** (1024-dim vectors). From that moment, the AI assistant answers questions about your project grounded in real data — tasks, blockers, team workload, and the auto-generated docs — not generic guesses.

The priority scoring engine continuously recalculates every task's urgency based on due dates, complexity, blocking relationships, and staleness, so your team always knows what to work on next.

---

## How It Works

```
User creates a project
        ↓
Background task fires (asyncio.create_task)
        ↓
Mistral Large (mistral-large-latest) generates 10-section professional documentation
        ↓
mistral-embed → 1024-dim vector → stored in PostgreSQL pgvector
        ↓
User adds tasks → each task auto-embedded + priority scored
        ↓
User opens AI Assistant → selects project from dropdown
        ↓
WebSocket connects (JWT auth via ?token= query param)
        ↓
User sends message
        ↓
RAG: mistral-embed(query) → cosine similarity search → top-5 relevant chunks
        ↓
Mistral Large: system prompt + context + chat history (last 10 turns) → response
        ↓
Parse JSON task commands from response → execute create/update if found
        ↓
Response sent over WebSocket with retrieved_count
```

---

## Key Features

- **RAG-powered AI chat** — every response grounded in your actual project data via `mistral-embed` + pgvector cosine search
- **Per-project chat rooms** — separate WebSocket connections and persistent chat history per project, per user
- **Auto-documentation on project creation** — `mistral-large-latest` generates a 10-section professional doc (goals, architecture, risks, milestones, KPIs) as a background task the moment you create a project
- **AI task execution** — the assistant creates and updates tasks directly from chat by parsing `{"action": "create_task", "data": {...}}` JSON blocks in its responses
- **Configurable response style** — Concise or Detailed mode, persisted in localStorage, sent with every message
- **Priority scoring engine** — every task scored on urgency (40%), complexity (25%), blocking (20%), staleness (15%) — recalculated on every update
- **Kanban board** — full create/edit/delete with status columns, filters, due dates, and priority breakdown modal
- **Team management** — invite members by email, assign roles (Owner/Manager/Developer/Designer/QA/DevOps/Analyst/Member), workload tracking
- **JWT auth with refresh tokens** — access + refresh token pair, automatic silent refresh on 401, auth endpoints excluded from interceptor
- **Security hardened** — security headers middleware, CORS scoped to env-configured origins, ownership checks on every endpoint, bcrypt (12 rounds)
- **Fully async** — SQLAlchemy 2.x async, asyncpg driver, async Mistral SDK calls throughout

---

## Tech Stack

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| Frontend | Next.js | 15.3.2 | App UI, kanban board, chat interface |
| Styling | Tailwind CSS | 3.4.17 | Utility-first styling |
| UI Components | shadcn/ui + Radix UI | — | 40+ accessible primitives |
| State | Zustand | 5.0.3 | Auth store, settings store, chat store |
| Server State | TanStack Query | 5.100.11 | Data fetching, cache invalidation |
| Markdown | react-markdown | 10.1.0 | Renders AI responses with formatting |
| Charts | Recharts | 2.15.0 | Dashboard workload and completion charts |
| HTTP Client | Axios | 1.7.9 | API calls with JWT interceptor + refresh |
| Backend | FastAPI | 0.115+ | REST API, WebSocket, orchestration |
| Runtime | Python | 3.13+ | Async throughout |
| LLM | Mistral `mistral-large-latest` | — | AI chat responses, project documentation |
| Embeddings | Mistral `mistral-embed` | — | 1024-dim vectors for RAG |
| Vector DB | PostgreSQL + pgvector | — | HNSW index, cosine similarity search |
| ORM | SQLAlchemy | 2.x async | Async database access via asyncpg |
| DB Driver | asyncpg | 0.29+ | Async PostgreSQL driver |
| Migrations | Alembic | 1.13+ | Schema versioning with async engine |
| Auth | python-jose | 3.3+ | JWT access + refresh tokens (HS256) |
| Password | bcrypt | 4.1+ | Password hashing (12 rounds) |
| Validation | Pydantic v2 | 2.7+ | Request/response schemas with Field validators |
| Package Manager | `uv` | — | Python dependency management |

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
│   ├── seed_demo.py               # Seeds demo data for existing user
│   ├── seed_new_user.py           # Seeds demo data for a new user account
│   ├── pyproject.toml             # Python dependencies (managed by uv)
│   │
│   ├── core/
│   │   ├── config.py              # pydantic-settings — validates all env vars on startup
│   │   ├── database.py            # Async SQLAlchemy engine, session factory, get_db
│   │   └── security.py            # JWT (HS256), bcrypt, ownership helpers, WS auth
│   │
│   ├── models/
│   │   ├── user.py                # users table
│   │   ├── project.py             # projects table
│   │   ├── project_member.py      # project_members table (role-based team membership)
│   │   ├── task.py                # tasks table — JSONB dependencies, priority_score
│   │   ├── chat_message.py        # chat_messages table
│   │   └── document_embedding.py  # document_embeddings — Vector(1024) column
│   │
│   ├── schemas/
│   │   ├── user.py                # LoginRequest, UserCreate, TokenResponse, UserOut
│   │   ├── project.py             # ProjectCreate, ProjectUpdate, ProjectOut
│   │   ├── task.py                # TaskCreate/Update/Out, PriorityBreakdown, Field validators
│   │   └── chat.py                # ChatMessageOut, ChatMessageRequest, DashboardOut
│   │
│   ├── services/
│   │   ├── rag_service.py         # mistral-embed → pgvector store/retrieve/update
│   │   ├── llm_service.py         # mistral-large-latest chat, build_prompt, parse_task_commands
│   │   └── task_service.py        # Priority scoring engine (urgency/complexity/blocking/staleness)
│   │
│   ├── routers/
│   │   ├── auth.py                # /auth/register, /auth/login, /auth/refresh, /auth/me, PUT /auth/me
│   │   ├── projects.py            # CRUD + background auto-documentation via mistral-large-latest
│   │   ├── tasks.py               # CRUD + auto-embed (mistral-embed) + rescore on every write
│   │   ├── dashboard.py           # Stats, critical tasks, blockers — scoped to project owner
│   │   ├── team.py                # Project members CRUD, invite by email, role management
│   │   └── chat.py                # WebSocket /ws/chat/{project_id}, REST fallback, history
│   │
│   └── alembic/
│       ├── env.py                 # Async alembic setup
│       └── versions/
│           ├── 0001_initial.py    # pgvector extension + all tables + HNSW index
│           └── 0002_project_members.py  # project_members table
│
└── frontend/
    ├── package.json
    ├── next.config.ts
    ├── tailwind.config.ts
    ├── tsconfig.json
    │
    └── src/
        ├── app/
        │   ├── layout.tsx             # Root layout, Providers, Toaster, suppressHydrationWarning
        │   ├── login/page.tsx         # Sign up / Sign in toggle — calls /auth/register or /auth/login
        │   └── (main)/
        │       ├── layout.tsx         # Sidebar layout + AuthGuard (client-side redirect)
        │       ├── page.tsx           # Dashboard — metrics, charts, critical tasks, project creation
        │       ├── tasks/page.tsx     # Kanban board — create, edit, delete, priority breakdown
        │       ├── chat/page.tsx      # AI assistant — project selector, WebSocket, react-markdown
        │       ├── team/page.tsx      # Team management — invite, roles, workload cards
        │       ├── progress/page.tsx  # Project progress + burndown chart
        │       └── settings/page.tsx  # Profile (live update), AI response style preference
        │
        ├── components/
        │   ├── AppSidebar.tsx         # Collapsible sidebar with nav + user footer
        │   ├── AuthGuard.tsx          # Client-side auth redirect
        │   ├── Providers.tsx          # React Query + Sonner
        │   └── ui/                    # 40+ shadcn/ui primitives
        │
        ├── lib/
        │   ├── api.ts                 # Axios instance, JWT interceptor, silent refresh, auth path exclusion
        │   ├── queries.ts             # All TanStack Query hooks + TypeScript types
        │   └── socket.ts              # WebSocket manager, onSocketMessage, onSocketStatus
        │
        └── stores/
            ├── auth.ts                # Zustand — token, refreshToken, user (persisted)
            ├── chat.ts                # Zustand — per-project message store
            └── settings.ts            # Zustand — responseStyle: "concise" | "detailed" (persisted)
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

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✓ | `postgresql+asyncpg://user:password@host:5432/dbname` |
| `SECRET_KEY` | ✓ | 64-char hex — `python -c "import secrets; print(secrets.token_hex(32))"` |
| `ALGORITHM` | — | Default: `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | — | Default: `30` |
| `REFRESH_TOKEN_EXPIRE_DAYS` | — | Default: `7` |
| `MISTRAL_API_KEY` | ✓ | From [console.mistral.ai](https://console.mistral.ai) |
| `ALLOWED_ORIGINS` | — | Default: `http://localhost:3000` (comma-separated for multiple) |

### Frontend (`frontend/.env.local`)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Default: `http://localhost:8000` |

---

## Running the Backend

```bash
cd backend

# Install dependencies
uv sync

# Copy and fill in environment variables
cp .env.example .env
# Set DATABASE_URL, SECRET_KEY, MISTRAL_API_KEY

# Create the database
psql -U postgres -c "CREATE DATABASE ai_pm_db;"

# Run migrations (creates all tables + pgvector extension + HNSW index)
uv run alembic upgrade head

# (Optional) Seed demo data for an existing account
uv run python seed_demo.py your@email.com

# Start the server
uv run uvicorn main:app --reload
```

Backend runs at **http://localhost:8000** · Docs at **http://localhost:8000/docs**

---

## Running the Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at **http://localhost:3000**

---

## API Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/register` | — | Create account, returns access + refresh tokens |
| `POST` | `/auth/login` | — | Sign in, returns access + refresh tokens |
| `POST` | `/auth/refresh` | — | Exchange refresh token for new token pair |
| `GET` | `/auth/me` | ✓ | Current user profile |
| `PUT` | `/auth/me` | ✓ | Update name and role |
| `GET` | `/projects` | ✓ | List user's projects |
| `POST` | `/projects` | ✓ | Create project + trigger auto-documentation (background) |
| `GET` | `/projects/{id}` | ✓ | Get project (ownership enforced) |
| `PUT` | `/projects/{id}` | ✓ | Update project |
| `DELETE` | `/projects/{id}` | ✓ | Delete project + cascade |
| `GET` | `/tasks/{project_id}` | ✓ | List tasks with live priority scores |
| `POST` | `/tasks` | ✓ | Create task + embed (mistral-embed) + score |
| `PUT` | `/tasks/{id}` | ✓ | Update task + re-embed + rescore |
| `DELETE` | `/tasks/{id}` | ✓ | Delete task + remove embeddings |
| `GET` | `/tasks/{id}/priority` | ✓ | Full score breakdown with factor weights |
| `POST` | `/tasks/bulk-score` | ✓ | Recalculate all scores for a project |
| `GET` | `/dashboard/{project_id}` | ✓ | Completion %, task counts, overdue count |
| `GET` | `/dashboard/{project_id}/critical` | ✓ | HIGH + CRITICAL tasks sorted by score |
| `GET` | `/dashboard/{project_id}/blockers` | ✓ | Blocked tasks |
| `GET` | `/team` | ✓ | All members across user's projects (dashboard chart) |
| `GET` | `/team/{project_id}` | ✓ | Members of a specific project with workload |
| `POST` | `/team/{project_id}/invite` | ✓ | Invite registered user by email with role |
| `PUT` | `/team/{project_id}/members/{id}` | ✓ | Update member role |
| `DELETE` | `/team/{project_id}/members/{id}` | ✓ | Remove member |
| `GET` | `/team/roles` | ✓ | List available roles |
| `WS` | `/ws/chat/{project_id}?token=` | ✓ | Real-time AI chat (JWT in query param) |
| `POST` | `/chat/message` | ✓ | REST fallback single-turn chat |
| `GET` | `/chat/history/{project_id}` | ✓ | Paginated chat history |
| `GET` | `/health` | — | Health check |

---

## AI Models Used

| Model | Provider | Used For |
|---|---|---|
| `mistral-large-latest` | Mistral AI | Chat responses, project documentation generation, task command parsing |
| `mistral-embed` | Mistral AI | 1024-dim text embeddings for RAG storage and query |

**Chat parameters:** `temperature=0.3`, `max_tokens=1024` (concise) / `4096` (detailed mode)

**Documentation generation:** `temperature=0.3`, `max_tokens=4096` — 10-section professional doc including executive summary, goals, architecture, milestones, risk register, and KPIs

---

## Priority Scoring Engine

Every task is scored continuously on four factors:

| Factor | Weight | Calculation |
|---|---|---|
| Urgency | 40% | Overdue or `<1 day` = 1.0 · `<3d` = 0.8 · `<7d` = 0.6 · `<14d` = 0.4 · `>14d` = 0.2 · no due date = 0.2 |
| Complexity | 25% | `task.complexity / 5.0` (complexity is 1–5 integer) |
| Blocking | 20% | `min(count_of_tasks_depending_on_this / 5, 1.0)` |
| Staleness | 15% | `min(days_since_update / 14, 1.0)` — only for `in_progress` tasks |

**Labels:** `0.00–0.30` = low · `0.30–0.55` = medium · `0.55–0.75` = high · `0.75–1.00` = critical

---

## RAG Architecture

```
User message
     ↓
mistral-embed(query) → 1024-dim float vector
     ↓
SELECT content, doc_type, metadata,
       1 - (embedding <=> CAST(:vec AS vector)) AS similarity
FROM document_embeddings
WHERE project_id = :project_id
ORDER BY embedding <=> CAST(:vec AS vector)
LIMIT 5
     ↓
Top-5 chunks injected into system prompt with similarity scores
     ↓
mistral-large-latest generates grounded response (temp=0.3)
```

**HNSW index:** `m=16, ef_construction=64` on `embedding vector_cosine_ops` — sub-millisecond retrieval.

**Embedding sources:** task content (title + description + status + priority + tag), auto-generated project documentation, chat notes.

---

## WebSocket Protocol

```jsonc
// Client → Server
{
  "content": "What is blocking deployment?",
  "project_id": "uuid",
  "response_style": "concise"   // or "detailed" — from Settings page
}

// Server → Client: typing indicator
{ "type": "typing" }

// Server → Client: AI-executed task commands
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

Authentication: `?token=<JWT>` query param. Connection rejected with code `4001` if token is invalid or user doesn't own the project.

---

## Database Schema

```sql
CREATE EXTENSION IF NOT EXISTS vector;

users              (id UUID PK, name, email UNIQUE, role, hashed_password, created_at)
projects           (id UUID PK, name, description, owner_id → users, created_at, updated_at)
project_members    (id UUID PK, project_id → projects, user_id → users, team_role, joined_at)
                   UNIQUE(project_id, user_id)
tasks              (id UUID PK, project_id → projects, title, description,
                    assignee_id → users, status, priority_score REAL, priority_label,
                    due_date, complexity INT, dependencies JSONB, tag, created_at, updated_at)
chat_messages      (id UUID PK, project_id → projects, role, content TEXT, created_at)
document_embeddings(id BIGSERIAL PK, project_id → projects, task_id → tasks,
                    doc_type, content TEXT, embedding VECTOR(1024), metadata JSONB, created_at)

-- HNSW index for fast cosine similarity (mistral-embed 1024-dim)
CREATE INDEX ix_doc_embeddings_hnsw ON document_embeddings
USING hnsw (embedding vector_cosine_ops)
WITH (m=16, ef_construction=64);
```

---

## Security

- All endpoints require JWT Bearer token (except `/auth/*` and `/health`)
- Every project/task/team operation verifies ownership — users only access their own data
- Passwords hashed with bcrypt (12 rounds)
- JWT tokens include `type` claim (`access` / `refresh`) to prevent token type confusion
- Access tokens expire in 30 minutes; refresh tokens in 7 days
- Auth endpoints excluded from Axios interceptor — login/register errors pass through directly
- Security headers on every response: `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy`, `Permissions-Policy`
- CORS restricted to `ALLOWED_ORIGINS` env var, specific HTTP methods, and specific headers

---

*FlowMind is a development tool. Always review AI-generated content before acting on it.*
