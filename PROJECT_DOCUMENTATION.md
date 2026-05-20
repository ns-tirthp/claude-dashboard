# Claude Usage Dashboard - Complete Project Documentation

**Version:** 1.1.0  
**Last Updated:** May 19, 2026  
**Target Audience:** New team members, contributors, and maintainers

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Data Sources & Data Flow](#data-sources--data-flow)
4. [Database Schema (SQLite)](#database-schema-sqlite)
5. [Backend API Specification](#backend-api-specification)
6. [Frontend Architecture](#frontend-architecture)
7. [JSONL Event Parsing Logic](#jsonl-event-parsing-logic)
8. [Time Tracking Implementation](#time-tracking-implementation)
9. [Deployment & Docker](#deployment--docker)
10. [Development Workflow](#development-workflow)
11. [Testing & Validation](#testing--validation)
12. [Troubleshooting](#troubleshooting)

---

## 1. Project Overview

### What is This?

Claude Usage Dashboard is a **local-first analytics platform** for developers using Claude Code (Anthropic's official CLI and IDE integrations). It parses your local Claude session files and telemetry data to provide:

- **Project-level statistics**: conversations, tool calls, time spent, token usage
- **Real-time telemetry**: cost tracking, tool reliability, active time via OpenTelemetry
- **AI-powered chat assistant**: natural language queries against your usage data
- **Filtering & drill-down**: by project, git branch, date range

### Key Features

✅ **Privacy-first**: All data stays on your machine. No external API calls.  
✅ **Dual data sources**: Parses both legacy JSONL session files + live OTel streams.  
✅ **Branch-level filtering**: Analyze usage per project AND per git branch.  
✅ **Time accuracy**: Handles CLI (measured) vs SDK/IDE (estimated) sessions.  
✅ **Neo-brutalist UI**: Monospace, high-contrast, developer-focused design.

### Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, Vite, Ant Design, Recharts, Tailwind CSS |
| **Backend** | Node.js 20, Express, better-sqlite3 |
| **Database** | SQLite (2 DBs: telemetry.db, chat.db) |
| **Containerization** | Docker, Docker Compose |
| **Data Sources** | `~/.claude/projects/` JSONL files, OTLP/HTTP+JSON |

---

## 2. Architecture

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  User's Machine                                                 │
│                                                                 │
│  ┌──────────────────┐         ┌──────────────────┐              │
│  │ Claude Code CLI  │         │ IDE Integration  │              │
│  │ (entrypoint:cli) │         │ (entrypoint:sdk) │              │
│  └────────┬─────────┘         └────────┬─────────┘              │
│           │                            │                        │
│           │ writes JSONL               │ writes JSONL           │
│           ▼                            ▼                        │
│  ┌─────────────────────────────────────────────────┐            │
│  │   ~/.claude/projects/                           │            │
│  │   -Users-username-project-name/                 │            │
│  │     ├── <session-uuid>.jsonl                    │            │
│  │     └── <session-uuid>.jsonl                    │            │
│  └──────────────────┬──────────────────────────────┘            │
│                     │ read-only mount                           │
│                     │                                           │
│  ┌──────────────────▼─────────────────────────────┐             │
│  │  Docker: claude-dashboard-backend              │             │
│  │  ┌─────────────────────────────────────────┐   │             │
│  │  │ JSONL Parser (server.js)                │   │             │
│  │  │  - getStatistics(filters)               │   │             │
│  │  │  - getFilterOptions()                   │   │             │
│  │  │  - Aggregates: projects, tools, tokens  │   │             │
│  │  └──────────┬──────────────────────────────┘   │             │
│  │             │                                  │             │
│  │  ┌──────────▼──────────────────────────────┐   │             │
│  │  │ OTLP Receiver (otlp-receiver.js)        │   │             │
│  │  │  POST /v1/metrics, /v1/logs, /v1/traces │   │             │
│  │  └──────────┬──────────────────────────────┘   │             │
│  │             │                                  │             │
│  │  ┌──────────▼──────────────────────────────┐   │             │
│  │  │ SQLite: telemetry.db                    │   │             │
│  │  │  - metrics (cost, tokens, durations)    │   │             │
│  │  │  - events (prompts, tools, errors)      │   │             │
│  │  │  - spans (distributed traces)           │   │             │
│  │  └─────────────────────────────────────────┘   │             │
│  │                                                │             │
│  │  ┌──────────────────────────────────────────┐  │             │
│  │  │ SQLite: chat.db                          │  │             │
│  │  │  - chat_sessions                         │  │             │
│  │  │  - chat_messages                         │  │             │
│  │  └──────────────────────────────────────────┘  │             │
│  │                                                │             │
│  │  Express Server (port 3001)                    │             │
│  │  - REST API (/api/stats, /api/telemetry/*)     │             │
│  │  - AI Chat (/api/chat)                         │             │
│  └──────────────────┬─────────────────────────────┘             │
│                     │ HTTP                                      │
│  ┌──────────────────▼──────────────────────────────┐            │
│  │  Docker: claude-dashboard-frontend              │            │
│  │  ┌─────────────────────────────────────────┐    │            │
│  │  │ React App (Nginx, port 3000)            │    │            │
│  │  │  - Overview tab (JSONL stats)           │    │            │
│  │  │  - Telemetry tab (OTel live data)       │    │            │
│  │  │  - Assistant tab (AI chat)              │    │            │
│  │  └─────────────────────────────────────────┘    │            │
│  └─────────────────────────────────────────────────┘            │
│                                                                 │
│  Browser: http://localhost:3000                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Role |
|-----------|------|
| **JSONL Parser** | Reads `~/.claude/projects/`, aggregates metrics, handles CLI vs SDK time, deduplicates events |
| **OTLP Receiver** | Ingests OpenTelemetry metrics/logs/traces via HTTP, writes to SQLite |
| **Telemetry API** | Queries telemetry.db for cost, time, reliability analytics |
| **Chat System** | AI assistant for natural language queries against telemetry + schema introspection |
| **Frontend** | React SPA with 3 tabs: Overview (JSONL), Telemetry (OTel), Assistant (Chat) |

---

## 3. Data Sources & Data Flow

### 3.1 JSONL Session Files

**Location:** `~/.claude/projects/-<encoded-path>/`

Each project directory name is the absolute path with slashes replaced by hyphens:
- `/Users/tirthp/Personal/rusty` → `-Users-tirthp-Personal-rusty`
- `~/Work/project` → `-Users-username-Work-project`

Inside each directory, **one `.jsonl` file per conversation session**, named by UUID.

#### JSONL Event Structure

Each line is a JSON object representing one event in the conversation. Common event types:

```json
{
  "type": "user",
  "uuid": "abc-123",
  "parentUuid": "xyz-789",
  "timestamp": "2026-05-18T12:30:19.812Z",
  "entrypoint": "cli",
  "gitBranch": "main",
  "sessionId": "session-uuid",
  "message": {
    "role": "user",
    "content": "User's prompt text or array of content blocks"
  }
}
```

```json
{
  "type": "assistant",
  "uuid": "def-456",
  "timestamp": "2026-05-18T12:30:23.178Z",
  "gitBranch": "main",
  "message": {
    "role": "assistant",
    "model": "claude-opus-4-7",
    "content": [
      { "type": "text", "text": "Response text" },
      { "type": "tool_use", "name": "Read", "input": {...} }
    ],
    "usage": {
      "input_tokens": 100,
      "output_tokens": 50,
      "cache_creation_input_tokens": 0,
      "cache_read_input_tokens": 500
    }
  }
}
```

```json
{
  "type": "system",
  "subtype": "turn_duration",
  "timestamp": "2026-05-18T12:30:45.000Z",
  "durationMs": 21822
}
```

**Key Fields:**
- `type`: `user`, `assistant`, `system`, `tool_use`, `tool_result`, `permission-mode`, etc.
- `entrypoint`: `"cli"` (Claude Code CLI) or `"sdk-ts"` (IDE integrations)
- `gitBranch`: Git branch name at time of event (only on assistant messages)
- `uuid`: Unique event ID (used for deduplication)
- `parentUuid`: Chain of events (forms a tree structure)
- `message.usage`: Token counts (only on assistant messages with model field)

### 3.2 OpenTelemetry (OTel) Data

**Ingestion:** Claude Code can be configured to send telemetry via OTLP/HTTP+JSON:

```bash
export OTLP_ENDPOINT=http://localhost:3001
# Claude Code automatically sends metrics/logs/traces
```

**Signal Types:**

1. **Metrics** (counters, gauges):
   - `claude_code.cost.usage` — cost in USD per API call
   - `claude_code.token.usage` — token counts by type (input/output/cache)
   - `claude_code.time.active` — active session time
   - `claude_code.tool.duration` — tool execution time

2. **Logs** (discrete events):
   - `prompt.start`, `prompt.finish` — prompt lifecycle
   - `tool.start`, `tool.finish`, `tool.error` — tool execution
   - `api.request`, `api.response` — API calls with request bodies

3. **Traces** (spans):
   - Distributed traces for multi-step operations (agents, skills)

**Storage:** All signals are normalized and written to `telemetry.db` SQLite tables.

---

## 4. Database Schema (SQLite)

### 4.1 Telemetry Database (`telemetry.db`)

#### Table: `metrics`

Stores time-series metrics (counters, gauges, histograms).

```sql
CREATE TABLE metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,              -- e.g., 'claude_code.cost.usage'
  value REAL NOT NULL,              -- numeric value
  unit TEXT,                        -- e.g., 'USD', 'tokens'
  timestamp INTEGER NOT NULL,       -- Unix ms
  session_id TEXT,
  account_id TEXT,
  organization_id TEXT,
  user_email TEXT,
  model TEXT,                       -- 'claude-opus-4-7', 'claude-sonnet-4-5'
  type TEXT,                        -- token type: 'input', 'output', 'cache_read'
  query_source TEXT,
  speed TEXT,                       -- 'fast', 'standard'
  effort TEXT,                      -- 'low', 'medium', 'extended'
  skill_name TEXT,
  plugin_name TEXT,
  agent_name TEXT,
  tool_name TEXT,
  decision TEXT,
  source TEXT,
  language TEXT,
  start_type TEXT,
  attributes TEXT                   -- JSON blob of additional attrs
);

CREATE INDEX idx_metrics_name_ts ON metrics(name, timestamp);
CREATE INDEX idx_metrics_session ON metrics(session_id);
CREATE INDEX idx_metrics_model ON metrics(model);
```

**Typical Rows:**

| name | value | unit | model | type | skill_name |
|------|-------|------|-------|------|------------|
| claude_code.cost.usage | 0.0045 | USD | claude-opus-4-7 | NULL | NULL |
| claude_code.token.usage | 1500 | tokens | claude-opus-4-7 | input | NULL |
| claude_code.token.usage | 3200 | tokens | claude-opus-4-7 | cache_read | NULL |

#### Table: `events`

Stores discrete events (prompt starts, tool calls, errors).

```sql
CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,              -- 'prompt.start', 'tool.finish', 'api.request'
  timestamp INTEGER NOT NULL,
  session_id TEXT,
  account_id TEXT,
  organization_id TEXT,
  user_email TEXT,
  prompt_id TEXT,
  model TEXT,
  cost_usd REAL,
  duration_ms INTEGER,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cache_read_tokens INTEGER,
  cache_creation_tokens INTEGER,
  request_id TEXT,
  tool_name TEXT,
  tool_use_id TEXT,
  success INTEGER,                 -- 0 or 1
  error_type TEXT,
  error_message TEXT,
  decision TEXT,
  decision_source TEXT,
  speed TEXT,
  query_source TEXT,
  effort TEXT,
  status_code INTEGER,
  attempt INTEGER,
  workspace_paths TEXT,
  attributes TEXT                  -- JSON blob
);

CREATE INDEX idx_events_name_ts ON events(name, timestamp);
CREATE INDEX idx_events_prompt ON events(prompt_id);
CREATE INDEX idx_events_session ON events(session_id);
CREATE INDEX idx_events_tool ON events(tool_name);
```

**Typical Rows:**

| name | tool_name | success | duration_ms | error_type |
|------|-----------|---------|-------------|------------|
| tool.finish | Read | 1 | 45 | NULL |
| tool.error | Bash | 0 | 2300 | ExitCodeError |
| prompt.finish | NULL | 1 | 18500 | NULL |

#### Table: `spans`

Stores OpenTelemetry spans (distributed tracing).

```sql
CREATE TABLE spans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trace_id TEXT NOT NULL,
  span_id TEXT NOT NULL,
  parent_span_id TEXT,
  name TEXT NOT NULL,
  start_ns INTEGER NOT NULL,
  end_ns INTEGER NOT NULL,
  duration_ms INTEGER,
  status_code INTEGER,
  session_id TEXT,
  attributes TEXT
);

CREATE INDEX idx_spans_trace ON spans(trace_id);
CREATE INDEX idx_spans_name_start ON spans(name, start_ns);
```

#### Table: `receiver_health`

Tracks last received timestamp per signal type (metrics/logs/traces).

```sql
CREATE TABLE receiver_health (
  signal TEXT PRIMARY KEY,         -- 'metrics', 'logs', 'traces'
  last_received_at INTEGER NOT NULL,
  received_count INTEGER NOT NULL DEFAULT 0
);
```

### 4.2 Chat Database (`chat.db`)

Used by the AI assistant feature.

#### Table: `chat_sessions`

```sql
CREATE TABLE chat_sessions (
  id TEXT PRIMARY KEY,             -- UUID
  title TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

#### Table: `chat_messages`

```sql
CREATE TABLE chat_messages (
  id TEXT PRIMARY KEY,             -- UUID
  session_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'error')),
  content TEXT NOT NULL,
  sql_query TEXT,                  -- SQL generated by assistant
  result_data TEXT,                -- JSON-encoded query result
  created_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
);

CREATE INDEX idx_messages_session ON chat_messages(session_id, created_at);
```

### Entity-Relationship Diagram (ERD)

```
telemetry.db:
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│   metrics   │       │   events    │       │    spans    │
├─────────────┤       ├─────────────┤       ├─────────────┤
│ id (PK)     │       │ id (PK)     │       │ id (PK)     │
│ name        │       │ name        │       │ trace_id    │
│ value       │       │ timestamp   │       │ span_id     │
│ timestamp   │       │ session_id  │       │ parent_span │
│ session_id  │       │ prompt_id   │       │ name        │
│ model       │       │ tool_name   │       │ start_ns    │
│ type        │       │ success     │       │ end_ns      │
│ skill_name  │       │ duration_ms │       │ session_id  │
│ ...         │       │ ...         │       │ ...         │
└─────────────┘       └─────────────┘       └─────────────┘

chat.db:
┌─────────────────┐
│ chat_sessions   │
├─────────────────┤       ┌─────────────────┐
│ id (PK)         │◄──────│ chat_messages   │
│ title           │  1:N  ├─────────────────┤
│ created_at      │       │ id (PK)         │
│ updated_at      │       │ session_id (FK) │
└─────────────────┘       │ role            │
                          │ content         │
                          │ sql_query       │
                          │ result_data     │
                          │ created_at      │
                          └─────────────────┘
```

---

## 5. Backend API Specification

Base URL: `http://localhost:3001`

### 5.1 JSONL-Based Stats API

#### `GET /api/stats`

Returns aggregated statistics from `~/.claude/projects/` JSONL files.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `project` | string | `"all"` | Filter by project name (e.g., `"~/Personal/rusty"`) |
| `branch` | string | `"all"` | Filter by git branch (e.g., `"main"`) |

**Response:**

```json
{
  "projects": [
    {
      "name": "~/Personal/claude/dashboard",
      "conversations": 17,
      "toolCalls": 478,
      "totalTime": 3961449,
      "timeSource": "mixed",
      "tools": { "Read": 120, "Edit": 85, "Bash": 45 },
      "models": { "claude-opus-4-7": 12, "claude-sonnet-4-5": 5 },
      "tokens": {
        "input": 12000,
        "output": 8500,
        "cacheCreation": 4500,
        "cacheRead": 18000
      },
      "branches": { "HEAD": 15, "feature-x": 2 },
      "entrypoints": { "cli": 17 },
      "fileOperations": { "edits": 85, "reads": 120, "writes": 30 },
      "lastActivity": "2026-05-19T12:45:00.000Z"
    }
  ],
  "totalConversations": 138,
  "totalToolCalls": 6470,
  "totalTime": 133849893,
  "timeSource": "mixed",
  "toolUsage": { "Read": 1500, "Edit": 900, "Bash": 600 },
  "modelUsage": { "claude-opus-4-7": 80, "claude-sonnet-4-5": 58 },
  "timeline": [
    { "project": "~/Personal/rusty", "date": "2026-05-19", "timestamp": "..." }
  ],
  "branchActivity": { "HEAD": 50, "main": 30, "feature-x": 10 },
  "entrypointUsage": { "cli": 100, "sdk-ts": 38 },
  "hourlyActivity": [0, 0, 5, 10, ...],
  "dailyActivity": { "2026-05-18": 20, "2026-05-19": 35 },
  "fileEditStats": { "totalEdits": 900, "totalReads": 1500, "totalWrites": 400 }
}
```

**timeSource Field:**

- `"measured"`: All sessions have authoritative `turn_duration` events (CLI)
- `"estimated"`: All sessions lack turn_duration (SDK/IDE), time derived from timestamps
- `"mixed"`: Project has both CLI and SDK sessions
- `"none"`: No time data available

**Notes:**

- Projects with 0 conversations after filtering are excluded
- Tool calls are counted from `assistant` message content blocks with `type: "tool_use"`
- Model usage is deduplicated by `uuid` to avoid double-counting streaming responses
- Time is measured in milliseconds

#### `GET /api/filters`

Returns available projects and their branches (for filter dropdown population).

**Response:**

```json
{
  "projects": [
    {
      "name": "~/Personal/claude/dashboard",
      "branches": ["HEAD", "feature-x"]
    },
    {
      "name": "~/Personal/rusty",
      "branches": ["master"]
    }
  ]
}
```

### 5.2 Telemetry API (OTel Data)

All telemetry endpoints support date range filtering:

| Query Param | Type | Default | Description |
|-------------|------|---------|-------------|
| `days` | number | 30 | Last N days |
| `sinceMs` | number | - | Unix timestamp (ms) start |
| `untilMs` | number | - | Unix timestamp (ms) end |

#### `GET /api/telemetry/summary`

High-level totals.

**Response:**

```json
{
  "totalCostUsd": 15.43,
  "totalPrompts": 450,
  "totalTokens": 1200000,
  "sessionsCount": 138
}
```

#### `GET /api/telemetry/cost`

Cost breakdown by model, skill, agent, plugin, day.

**Response:**

```json
{
  "totalUsd": 15.43,
  "byModel": [
    { "model": "opus-4-7", "usd": 12.50, "samples": 80 },
    { "model": "sonnet-4-5", "usd": 2.93, "samples": 58 }
  ],
  "bySkill": [
    { "skill": "review", "usd": 5.20 },
    { "skill": "none", "usd": 10.23 }
  ],
  "byAgent": [
    { "agent": "main", "usd": 14.00 },
    { "agent": "code-reviewer", "usd": 1.43 }
  ],
  "byPlugin": [
    { "plugin": "stitch-kit", "usd": 2.10 },
    { "plugin": "none", "usd": 13.33 }
  ],
  "daily": [
    { "day": "2026-05-18", "usd": 7.20 },
    { "day": "2026-05-19", "usd": 8.23 }
  ],
  "tokensByType": [
    { "type": "input", "tokens": 400000 },
    { "type": "output", "tokens": 300000 },
    { "type": "cache_read", "tokens": 500000 }
  ]
}
```

#### `GET /api/telemetry/time`

Active time and duration breakdowns.

**Response:**

```json
{
  "totalActiveMinutes": 2450,
  "avgPromptDurationMs": 18500,
  "avgToolDurationMs": 850,
  "byTool": [
    { "tool": "Read", "avgMs": 120, "p50Ms": 90, "p95Ms": 250 },
    { "tool": "Bash", "avgMs": 2300, "p50Ms": 1800, "p95Ms": 5000 }
  ]
}
```

#### `GET /api/telemetry/reliability`

Tool success rates, errors, retries.

**Response:**

```json
{
  "toolStats": [
    {
      "tool": "Read",
      "total": 1500,
      "success": 1498,
      "failed": 2,
      "successRate": 99.87,
      "avgRetries": 1.02
    },
    {
      "tool": "Bash",
      "total": 600,
      "success": 580,
      "failed": 20,
      "successRate": 96.67,
      "avgRetries": 1.15
    }
  ],
  "errorsByType": [
    { "type": "FileNotFoundError", "count": 8 },
    { "type": "ExitCodeError", "count": 15 }
  ]
}
```

#### `GET /api/telemetry/prompts`

Recent prompts with summary.

**Query Params:**
- `limit`: number of prompts (default 50, max 200)

**Response:**

```json
{
  "prompts": [
    {
      "promptId": "abc-123",
      "timestamp": 1748035200000,
      "model": "claude-opus-4-7",
      "costUsd": 0.045,
      "durationMs": 18500,
      "inputTokens": 5000,
      "outputTokens": 1200,
      "toolCount": 5,
      "success": 1
    }
  ]
}
```

#### `GET /api/telemetry/prompts/:id`

Full event timeline for a single prompt.

**Response:**

```json
{
  "promptId": "abc-123",
  "events": [
    {
      "name": "prompt.start",
      "timestamp": 1748035000000,
      "model": "claude-opus-4-7"
    },
    {
      "name": "tool.start",
      "timestamp": 1748035005000,
      "toolName": "Read"
    },
    {
      "name": "tool.finish",
      "timestamp": 1748035005120,
      "toolName": "Read",
      "durationMs": 120,
      "success": 1
    },
    {
      "name": "prompt.finish",
      "timestamp": 1748035018500,
      "costUsd": 0.045,
      "durationMs": 18500
    }
  ]
}
```

#### `GET /api/telemetry/sessions`

Session-level rollup.

**Response:**

```json
{
  "sessions": [
    {
      "sessionId": "session-uuid",
      "startTime": 1748035000000,
      "endTime": 1748040000000,
      "promptCount": 12,
      "totalCostUsd": 0.54,
      "totalTokens": 85000
    }
  ]
}
```

#### `GET /api/telemetry/health`

OTLP receiver health.

**Response:**

```json
{
  "signals": [
    { "signal": "metrics", "lastReceivedAt": 1748035200000, "receivedCount": 4500 },
    { "signal": "logs", "lastReceivedAt": 1748035190000, "receivedCount": 1200 },
    { "signal": "traces", "lastReceivedAt": 0, "receivedCount": 0 }
  ]
}
```

### 5.3 OTLP Ingestion Endpoints

#### `POST /v1/metrics`

Ingests OTLP/HTTP+JSON metrics.

**Request Body:** OTLP MetricsData JSON

**Response:** `202 Accepted`

#### `POST /v1/logs`

Ingests OTLP/HTTP+JSON logs.

**Request Body:** OTLP LogsData JSON

**Response:** `202 Accepted`

#### `POST /v1/traces`

Ingests OTLP/HTTP+JSON traces.

**Request Body:** OTLP TracesData JSON

**Response:** `202 Accepted`

**OTLP Configuration for Claude Code:**

```bash
export OTLP_ENDPOINT=http://localhost:3001
export OTLP_PROTOCOL=http/json
```

### 5.4 Chat Assistant API

#### `POST /api/chat`

Send a message to the AI assistant.

**Request:**

```json
{
  "sessionId": "optional-existing-session-uuid",
  "message": "How much did I spend on Opus 4.7 this week?"
}
```

**Response:**

```json
{
  "sessionId": "session-uuid",
  "reply": "You spent $12.50 on Opus 4.7 this week across 80 prompts.",
  "sqlQuery": "SELECT SUM(value) FROM metrics WHERE name='claude_code.cost.usage' AND model='claude-opus-4-7' AND timestamp >= ...",
  "resultData": [{"sum": 12.50}]
}
```

#### `GET /api/chat/sessions`

List all chat sessions.

**Response:**

```json
{
  "sessions": [
    {
      "id": "session-uuid",
      "title": "Cost analysis",
      "created_at": 1748035000000,
      "updated_at": 1748040000000
    }
  ]
}
```

#### `GET /api/chat/sessions/:id`

Get messages for a session.

**Response:**

```json
{
  "messages": [
    {
      "id": "msg-uuid",
      "role": "user",
      "content": "How much did I spend?",
      "created_at": 1748035000000
    },
    {
      "id": "msg-uuid-2",
      "role": "assistant",
      "content": "You spent $12.50.",
      "sql_query": "SELECT ...",
      "result_data": [{"sum": 12.50}],
      "created_at": 1748035002000
    }
  ]
}
```

### 5.5 Health & Diagnostics

#### `GET /api/health`

Basic health check.

**Response:**

```json
{ "status": "ok" }
```

---

## 6. Frontend Architecture

### Technology Stack

- **React 18**: Component framework
- **Vite**: Build tool and dev server
- **Ant Design**: UI component library
- **Recharts**: Chart library (bar, pie, line charts)
- **Tailwind CSS**: Utility-first CSS
- **Nginx**: Production static file server

### File Structure

```
frontend/
├── src/
│   ├── main.jsx              # React entry point
│   ├── App.jsx               # Main dashboard component (3 tabs)
│   ├── TelemetryView.jsx     # Telemetry tab (OTel data)
│   ├── AssistantChat.jsx     # AI chat assistant tab
│   └── index.css             # Global styles + Ant Design overrides
├── index.html                # HTML template
├── package.json
├── vite.config.js            # Vite config (proxy to backend)
├── tailwind.config.js        # Tailwind customization
├── postcss.config.js
├── nginx.conf                # Production Nginx config
└── Dockerfile
```

### Component Hierarchy

```
App.jsx (main container)
├── Tabs (Ant Design)
│   ├── Overview Tab
│   │   ├── Filter Bar (project + branch selects)
│   │   ├── Summary Cards (4 cards: projects, conversations, tools, time)
│   │   ├── Insights Cards (3 cards: avg tools/conv, total tokens, cache hit rate)
│   │   ├── File Operations Cards (3 cards: edits, reads, writes)
│   │   ├── Charts Row
│   │   │   ├── Top 10 Tools Bar Chart
│   │   │   └── Model Distribution Pie Chart
│   │   ├── Activity Charts
│   │   │   ├── Branch Activity Bar Chart
│   │   │   ├── Hourly Activity Line Chart
│   │   │   ├── Daily Activity Line Chart (30 days)
│   │   │   └── Entrypoint Pie Chart
│   │   └── Projects Table (sortable, all project metrics)
│   │
│   ├── Telemetry Tab (TelemetryView.jsx)
│   │   ├── Summary Cards (cost, prompts, tokens, sessions)
│   │   ├── Cost Charts (by model, daily trend)
│   │   ├── Time & Reliability Charts
│   │   └── Recent Prompts Table
│   │
│   └── Assistant Tab (AssistantChat.jsx)
│       ├── Chat Messages List
│       ├── SQL Query Display (collapsible)
│       ├── Result Data Table
│       └── Message Input
```

### State Management

**App.jsx state:**

```javascript
{
  stats: null,                    // JSONL stats from /api/stats
  loading: boolean,
  error: string | null,
  filterOptions: { projects: [] },
  selectedProject: "all",
  selectedBranch: "all"
}
```

**Data flow:**

1. Component mounts → `fetchStats()` + `fetchFilterOptions()`
2. User selects filter → `handleProjectChange()` / `handleBranchChange()` → `fetchStats(project, branch)`
3. Loading state only shows full-screen spinner on initial load (when `stats === null`)
4. Subsequent filter changes show inline spinner, keep UI mounted

### UI Theme

**Design System:** Neo-Brutalist Developer Dashboard

**CSS Variables:**

```css
:root {
  --bd-bg: #EEEEE8;          /* beige background */
  --bd-surface: #FFFFFF;      /* white cards */
  --bd-ink: #1A1A1A;          /* black text/borders */
  --bd-ink-soft: #555555;     /* muted text */
  --bd-rule: #E0E0E0;         /* dividers */
  --bd-mono: 'Space Mono', 'Courier New', monospace;
}
```

**Visual Language:**

- **No border-radius**: All elements have sharp corners (`border-radius: 0`)
- **Bold borders**: 1-2px solid black borders
- **Box shadows**: Offset shadows (`3px 3px 0px #1A1A1A`) for depth
- **Monospace font**: Space Mono everywhere
- **High contrast**: Black text on white cards on beige background
- **Uppercase labels**: Buttons and titles in uppercase with letter-spacing

**Card Styles:**

```css
.ant-card {
  border-radius: 0;
  border: 1px solid var(--bd-ink);
  box-shadow: 3px 3px 0px var(--bd-ink);
}
```

**Filter Bar:**

```css
.filter-bar {
  display: flex;
  gap: 20px;
  background: white;
  border: 1px solid black;
  box-shadow: 3px 3px 0px black;
  padding: 14px 20px;
}
```

---

## 7. JSONL Event Parsing Logic

**Location:** `backend/server.js` → `getStatistics(filters)`

### Parsing Flow

```
1. Read `~/.claude/projects/` directory
2. For each project directory (-encoded-path)
   a. Decode directory name to project path
   b. Skip if doesn't match project filter
   c. Read all *.jsonl files
   d. For each session file:
      i.   Parse JSONL (one JSON object per line)
      ii.  Sort events chronologically by timestamp
      iii. Check session branches, skip if doesn't match branch filter
      iv.  Determine time source (has turn_duration events?)
      v.   Walk events chronologically:
           - Track current branch from assistant events
           - Skip events that don't match branch filter
           - Count tool calls from assistant messages
           - Aggregate tokens (deduplicate by uuid)
           - Sum turn_duration OR estimate from timestamps
      vi.  If session matched filter, increment conversation count
3. Drop projects with 0 conversations
4. Sort projects by last activity
5. Calculate top-level aggregates
6. Resolve timeSource labels
```

### Key Functions

#### `parseJSONL(filePath)`

```javascript
function parseJSONL(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  return content
    .split('\n')
    .filter(line => line.trim())
    .map(line => {
      try { return JSON.parse(line); }
      catch (e) { return null; }
    })
    .filter(Boolean);
}
```

#### `getProjectName(dirName)`

Converts encoded directory name back to user-friendly path:

```javascript
function getProjectName(dirName) {
  return dirName
    .replace(/^-/, '')           // Remove leading dash
    .replace(/-/g, '/')          // Dashes → slashes
    .replace(/^Users\/[^\/]+\//, '~/');  // /Users/username/ → ~/
}
```

**Examples:**

- `-Users-tirthp-Personal-rusty` → `~/Personal/rusty`
- `-Users-tirthp-Work-project` → `~/Work/project`

#### Tool Call Extraction

```javascript
// Only parse tool calls from assistant messages
if (event.type === 'assistant' && event.message && event.message.content) {
  const content = event.message.content;
  for (const item of content) {
    if (item.type === 'tool_use') {
      const toolName = item.name;  // "Read", "Edit", "Bash", etc.
      stats.totalToolCalls++;
      stats.toolUsage[toolName] = (stats.toolUsage[toolName] || 0) + 1;
    }
  }
}
```

**Why only assistant messages?** Tool calls appear in the assistant's response as intent. Tool results (user messages with `tool_result` blocks) are the execution output, not new tool invocations.

#### Token Deduplication

```javascript
const seenMessageIds = new Set();

if (event.type === 'assistant' && event.message && event.message.model && event.uuid) {
  if (!seenMessageIds.has(event.uuid)) {
    seenMessageIds.add(event.uuid);

    const model = event.message.model;
    stats.modelUsage[model] = (stats.modelUsage[model] || 0) + 1;

    if (event.message.usage) {
      const usage = event.message.usage;
      stats.tokens.input += usage.input_tokens || 0;
      stats.tokens.output += usage.output_tokens || 0;
      stats.tokens.cacheCreation += usage.cache_creation_input_tokens || 0;
      stats.tokens.cacheRead += usage.cache_read_input_tokens || 0;
    }
  }
}
```

**Why deduplicate?** Streaming responses or retries can emit the same assistant message multiple times with identical `uuid`. Deduplication ensures each unique response is counted once.

#### Branch Attribution

Events inherit branch from the most recent `assistant` event:

```javascript
let currentBranch = null;
const firstBranch = events.find(e => e.type === 'assistant' && e.gitBranch)?.gitBranch || null;

for (const event of events) {
  if (event.type === 'assistant' && event.gitBranch) {
    currentBranch = event.gitBranch;
  }
  const eventBranch = currentBranch || firstBranch;

  if (filterByBranch && eventBranch !== filterBranch) {
    continue; // skip event
  }
  // ... process event
}
```

**Why this approach?** `turn_duration` and `user` events don't carry `gitBranch`. We walk chronologically and attribute each event to the last known branch. Fallback to first branch for events before any assistant appears.

---

## 8. Time Tracking Implementation

### The Problem

**CLI sessions** (`entrypoint: "cli"`) emit `turn_duration` system events:

```json
{
  "type": "system",
  "subtype": "turn_duration",
  "durationMs": 21822
}
```

These are **authoritative** — wall-clock time from prompt submission to turn completion.

**SDK/IDE sessions** (`entrypoint: "sdk-ts"`) do NOT emit `turn_duration`. Without a fix, they show 0 time.

### The Solution: Dual-Source Time Tracking

**Strategy:**

1. **Measured** (CLI): Use `turn_duration` events as-is
2. **Estimated** (SDK): Derive time from event timestamps with turn boundary detection

**Turn Boundary Heuristic:**

- A **new turn** starts at an **external user message** (not a tool result)
- Turn ends at the timestamp of the last event before the next external user message
- Turn duration = `last_event_ts - turn_start_ts`
- Cap each turn at **5 minutes** to avoid idle-time inflation

### Implementation

#### Helper: Detect Tool Result User Messages

Tool results are intermediate, not turn boundaries:

```javascript
function isToolResultUserMessage(event) {
  if (event.type !== 'user') return false;
  const content = event.message?.content;
  if (!Array.isArray(content)) return false;
  return content.some(item => item && item.type === 'tool_result');
}
```

#### Helper: Estimate Session Time

```javascript
const MAX_ESTIMATED_TURN_MS = 5 * 60 * 1000;  // 5 minutes

function estimateSessionTime(events) {
  let total = 0;
  let turnStart = null;
  let lastEventTs = null;

  const closeTurn = () => {
    if (turnStart != null && lastEventTs != null) {
      const delta = lastEventTs - turnStart;
      if (delta > 0) {
        total += Math.min(delta, MAX_ESTIMATED_TURN_MS);
      }
    }
    turnStart = null;
    lastEventTs = null;
  };

  for (const event of events) {
    if (!event.timestamp) continue;
    const ts = new Date(event.timestamp).getTime();
    if (Number.isNaN(ts)) continue;

    const isExternalUserPrompt = event.type === 'user' && !isToolResultUserMessage(event);

    if (isExternalUserPrompt) {
      closeTurn();  // End previous turn
      turnStart = ts;
      lastEventTs = ts;
      continue;
    }

    if (turnStart != null) {
      lastEventTs = ts;  // Extend turn to this event
    }
  }

  closeTurn();  // Close final turn
  return total;
}
```

#### Per-Session Logic

```javascript
const hasTurnDurationEvents = events.some(
  e => e.type === 'system' && e.subtype === 'turn_duration'
);

let sessionTime = 0;

if (hasTurnDurationEvents) {
  // CLI path: aggregate turn_duration
  for (const event of events) {
    if (event.type === 'system' && event.subtype === 'turn_duration') {
      sessionTime += event.durationMs || 0;
    }
  }
  stats.projects[projectName]._timeSourceMeasured += 1;
} else {
  // SDK path: estimate from timestamps
  sessionTime = estimateSessionTime(events);
  stats.projects[projectName]._timeSourceEstimated += 1;
}

stats.projects[projectName].totalTime += sessionTime;
```

#### Resolve `timeSource` Label

After all sessions are processed:

```javascript
const measured = project._timeSourceMeasured;
const estimated = project._timeSourceEstimated;

let timeSource = 'none';
if (measured > 0 && estimated > 0) timeSource = 'mixed';
else if (measured > 0) timeSource = 'measured';
else if (estimated > 0) timeSource = 'estimated';

project.timeSource = timeSource;
```

### Frontend Display

**Summary Card:**

```jsx
{(stats.timeSource === 'estimated' || stats.timeSource === 'mixed') && (
  <Tag>~ {stats.timeSource === 'estimated' ? 'EST' : 'MIXED'}</Tag>
)}
```

**Project Table:**

```jsx
const renderDuration = (ms, source) => {
  const isEstimate = source === 'estimated' || source === 'mixed';
  const text = formatDuration(ms);
  
  if (!isEstimate) {
    return <span>{text}</span>;
  }
  
  return (
    <Tooltip title="Estimated from timestamps (SDK session)">
      <span style={{ borderBottom: '1px dotted', cursor: 'help' }}>
        ~{text}
      </span>
    </Tooltip>
  );
};
```

**Visual Result:**

- CLI projects: `1h 23m` (no indicator)
- SDK projects: `~3m 53s` (tilde + dotted underline + tooltip)
- Mixed projects: `~1h 5m` with "MIXED" tag

---

## 9. Deployment & Docker

### Docker Architecture

```
docker-compose.yml
├── backend service
│   ├── Builds from ./backend/Dockerfile
│   ├── Ports: 3001:3001
│   ├── Volumes:
│   │   ├── ~/.claude/projects:/root/.claude/projects:ro (read-only)
│   │   └── claude-dashboard-data:/app/data (SQLite persistence)
│   └── Environment:
│       ├── TELEMETRY_DB_PATH=/app/data/telemetry.db
│       ├── PORT=3001
│       ├── AI_PROVIDER=local
│       └── LOCAL_AI_URL=http://host.docker.internal:11434
│
└── frontend service
    ├── Builds from ./frontend/Dockerfile
    ├── Ports: 3000:3000
    ├── Depends on: backend
    └── Serves: Static React app via Nginx
```

### Backend Dockerfile

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 3001
CMD ["node", "server.js"]
```

### Frontend Dockerfile

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
```

### Nginx Config

```nginx
server {
  listen 3000;
  root /usr/share/nginx/html;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }

  location /api/ {
    proxy_pass http://backend:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
  }
}
```

### Commands

```bash
# Build and start
docker-compose up --build

# Start detached
docker-compose up -d

# View logs
docker-compose logs -f

# Restart single service
docker-compose restart backend

# Stop all
docker-compose down

# Rebuild after code changes
docker-compose up -d --build backend
docker-compose up -d --build frontend
```

### Volume Persistence

**claude-dashboard-data** volume persists:
- `telemetry.db` (OpenTelemetry data)
- `chat.db` (AI chat history)

Data survives container restarts. To reset:

```bash
docker-compose down -v  # WARNING: deletes all databases
```

---

## 10. Development Workflow

### Local Development (No Docker)

#### Backend

```bash
cd backend
npm install
npm start  # or npm run dev (with --watch)
```

Runs on `http://localhost:3001`

**Environment Variables:**

```bash
export TELEMETRY_DB_PATH=./data/telemetry.db
export CHAT_DB_PATH=./data/chat.db
export PORT=3001
export AI_PROVIDER=local  # or 'openai', 'claude'
export LOCAL_AI_URL=http://localhost:11434
```

#### Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs on `http://localhost:5173` (Vite dev server)

**Vite config** proxies `/api/*` to `http://localhost:3001`

### Making Changes

#### Backend Changes

1. Edit files in `backend/`
2. Restart backend:
   ```bash
   # Local dev:
   npm restart
   
   # Docker:
   docker-compose restart backend
   # OR rebuild if Dockerfile/package.json changed:
   docker-compose up -d --build backend
   ```

#### Frontend Changes

1. Edit files in `frontend/src/`
2. Vite hot-reloads automatically in local dev
3. For Docker:
   ```bash
   docker-compose up -d --build frontend
   ```

#### Database Schema Changes

1. Edit `backend/db.js` or `backend/chat/chat-db.js`
2. Delete old database:
   ```bash
   rm backend/data/telemetry.db
   # OR in Docker:
   docker-compose down -v
   ```
3. Restart backend — tables recreate automatically

### Code Structure Guidelines

**Backend:**
- `server.js` — Main entry, JSONL parsing, Express routes
- `db.js` — Telemetry SQLite schema + insert functions
- `otlp-receiver.js` — OTLP/JSON ingestion logic
- `telemetry-api.js` — Query endpoints for telemetry data
- `chat/` — AI assistant subsystem
  - `chat-router.js` — Express routes
  - `chat-db.js` — Chat SQLite schema
  - `query-executor.js` — SQL generation + execution
  - `schema-context.js` — DB schema introspection for AI
  - `providers/` — AI provider adapters (OpenAI, Claude, Local)

**Frontend:**
- `App.jsx` — Main component with 3 tabs, filter state
- `TelemetryView.jsx` — Telemetry tab
- `AssistantChat.jsx` — Chat tab
- `index.css` — Global styles, neo-brutalist theme

### Adding New Features

#### Add a New API Endpoint

1. Define route in `backend/server.js`:
   ```javascript
   app.get('/api/new-endpoint', (req, res) => {
     const data = computeSomething();
     res.json(data);
   });
   ```

2. Call from frontend:
   ```javascript
   const response = await fetch(`${API_URL}/api/new-endpoint`);
   const data = await response.json();
   ```

#### Add a New Metric to JSONL Stats

1. Edit `getStatistics()` in `backend/server.js`
2. Add field to `stats` object
3. Compute value during event loop
4. Return in response
5. Display in `App.jsx` or create new component

#### Add a New Chart

1. Install Recharts component if needed:
   ```bash
   npm install recharts
   ```

2. Import chart type:
   ```javascript
   import { LineChart, Line, XAxis, YAxis } from 'recharts';
   ```

3. Prepare data shape:
   ```javascript
   const chartData = stats.something.map(item => ({
     name: item.label,
     value: item.count
   }));
   ```

4. Render chart with theme styles (see existing charts in App.jsx)

---

## 11. Testing & Validation

### Manual Testing

#### Test JSONL Parsing

```bash
curl http://localhost:3001/api/stats | jq .
```

Verify:
- `projects` array has correct counts
- `totalConversations`, `totalToolCalls` match expectations
- `timeSource` labels are correct (CLI = measured, SDK = estimated)
- Token counts are reasonable (no double-counting)

#### Test Filtering

```bash
# Filter by project
curl "http://localhost:3001/api/stats?project=~/Personal/rusty" | jq '.projects[].name'

# Filter by branch
curl "http://localhost:3001/api/stats?project=~/Work/app&branch=main" | jq '.totalConversations'
```

#### Test Telemetry API

```bash
# Get cost summary
curl http://localhost:3001/api/telemetry/cost?days=7 | jq '.totalUsd'

# Get recent prompts
curl http://localhost:3001/api/telemetry/prompts?limit=10 | jq '.prompts[0]'

# Check OTLP receiver health
curl http://localhost:3001/api/telemetry/health | jq .
```

#### Test Chat Assistant

```bash
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What was my total cost yesterday?"}' | jq .
```

### Validation Script

**Location:** `backend/validate-parsing.js`

```bash
node validate-parsing.js
```

Reports:
- Tool call counts
- Message deduplication stats (before/after)
- Token usage inflation detection
- Time source distribution

### Edge Cases to Test

1. **Empty project directory** (no JSONL files)
2. **Malformed JSONL** (lines with invalid JSON)
3. **Session with no assistant messages** (no branches, no tokens)
4. **SDK session** (no turn_duration events) — verify estimated time > 0
5. **Mixed project** (some CLI, some SDK sessions) — verify timeSource = "mixed"
6. **Branch filter with no matches** — verify empty result, not crash
7. **Large dataset** (100+ sessions) — verify performance < 2 seconds

---

## 12. Troubleshooting

### Common Issues

#### No Data Showing

**Symptoms:** Dashboard loads but shows 0 projects.

**Causes:**
- `~/.claude/projects/` doesn't exist or is empty
- Docker volume mount incorrect
- Permission issues

**Fix:**

```bash
# Check projects directory exists
ls ~/.claude/projects/

# Check Docker mount
docker exec claude-dashboard-backend ls /root/.claude/projects

# Check backend logs
docker logs claude-dashboard-backend
```

#### Time Showing as 0 for SDK Projects

**Symptoms:** Projects with `entrypoint: "sdk-ts"` show 0 time.

**Cause:** Missing timestamp-based estimation (old code version).

**Fix:** Ensure `estimateSessionTime()` function is present in `backend/server.js` and being called for sessions without `turn_duration` events.

**Verify:**

```bash
curl "http://localhost:3001/api/stats" | jq '.projects[] | select(.entrypoints.["sdk-ts"]) | {name, totalTime, timeSource}'
```

Should show `totalTime > 0` and `timeSource: "estimated"`.

#### Backend API Returns 500 Error

**Symptoms:** Frontend shows "Failed to fetch stats".

**Debug:**

```bash
# Check backend logs
docker logs claude-dashboard-backend

# Test API directly
curl http://localhost:3001/api/stats

# Check for JS errors in code
```

**Common causes:**
- Syntax error in recent code change
- Database locked (SQLite contention)
- Missing dependency

#### Frontend Shows Blank Page

**Symptoms:** Browser shows white screen, no errors in console.

**Debug:**

```bash
# Check frontend logs
docker logs claude-dashboard-frontend

# Check Nginx is serving files
docker exec claude-dashboard-frontend ls /usr/share/nginx/html

# Test frontend directly
curl http://localhost:3000
```

**Fix:**

```bash
# Rebuild frontend
docker-compose up -d --build frontend
```

#### OTLP Data Not Appearing

**Symptoms:** Telemetry tab shows 0 data, `/api/telemetry/health` shows no recent metrics.

**Causes:**
- OTLP_ENDPOINT not configured in Claude Code
- Wrong port or protocol
- Backend OTLP receiver crashed

**Fix:**

```bash
# Configure Claude Code to send OTLP
export OTLP_ENDPOINT=http://localhost:3001
export OTLP_PROTOCOL=http/json

# Test OTLP receiver
curl http://localhost:3001/api/telemetry/health

# Check backend can receive
docker logs claude-dashboard-backend | grep -i otlp
```

#### Duplicate Tool Calls or Tokens

**Symptoms:** Counts seem 2x-3x higher than expected.

**Cause:** Missing UUID deduplication or counting tool_result as tool_use.

**Fix:** Verify `seenMessageIds` deduplication in `server.js` and that only `assistant` messages with `tool_use` content blocks are counted.

**Test:**

```bash
node backend/validate-parsing.js
```

Look for "Duplicates" count — should be 0 or very low.

#### Chat Assistant Not Responding

**Symptoms:** Chat message sends but no reply.

**Debug:**

```bash
# Check AI provider config
docker logs claude-dashboard-backend | grep AI_PROVIDER

# Test provider directly
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "test"}' | jq .
```

**Common causes:**
- `AI_PROVIDER=local` but Ollama not running
- OpenAI API key not set
- Query executor generated invalid SQL

**Fix:**

```bash
# If using local Ollama:
docker run -d -p 11434:11434 ollama/ollama
docker exec -it ollama ollama pull llama3

# Check connection
curl http://localhost:11434/api/tags
```

### Performance Issues

#### Slow Initial Load

**Cause:** Large number of JSONL files (100+ sessions per project).

**Optimization:**

1. **Add pagination** to `/api/stats` (limit projects returned)
2. **Cache results** in memory with TTL
3. **Index JSONL files** (pre-parse once, cache aggregates)

#### High Memory Usage

**Cause:** Loading all JSONL files into memory at once.

**Fix:** Stream large files instead of `readFileSync`:

```javascript
const readline = require('readline');
const stream = fs.createReadStream(sessionPath);
const rl = readline.createInterface({ input: stream });

for await (const line of rl) {
  const event = JSON.parse(line);
  // process event
}
```

### Database Issues

#### SQLite Database Locked

**Error:** `SQLITE_BUSY: database is locked`

**Cause:** Concurrent writes from multiple OTLP requests.

**Fix:** Already mitigated by WAL mode + transaction batching. If still occurs:

```javascript
db.pragma('busy_timeout = 5000');  // Wait 5s for lock
```

#### Database Corruption

**Symptoms:** `SQLITE_CORRUPT` error or garbage data.

**Recovery:**

```bash
# Stop containers
docker-compose down

# Delete corrupt DB
docker volume rm claude-dashboard_claude-dashboard-data

# Restart (DB recreates)
docker-compose up -d
```

**Prevention:** Always use `better-sqlite3` prepared statements (already implemented).

---

## Glossary

| Term | Definition |
|------|------------|
| **JSONL** | JSON Lines format — one JSON object per line, newline-delimited |
| **OTLP** | OpenTelemetry Protocol — standard for telemetry data exchange |
| **Turn** | One user prompt → Claude response cycle |
| **CLI** | Claude Code CLI (`entrypoint: "cli"`) |
| **SDK** | Claude Code SDK used by IDEs (`entrypoint: "sdk-ts"`) |
| **Measured time** | Authoritative duration from `turn_duration` events (CLI only) |
| **Estimated time** | Timestamp-derived duration for SDK sessions (capped at 5min/turn) |
| **timeSource** | Label indicating how time was computed: `measured`, `estimated`, `mixed`, `none` |
| **Cache read tokens** | Tokens served from Claude's prompt cache (not billed at full rate) |
| **Cache creation tokens** | Tokens that initialize the prompt cache |

---

## Quick Reference

### URLs

| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://localhost:3000 | Dashboard UI |
| Backend API | http://localhost:3001/api/stats | JSONL stats |
| Telemetry API | http://localhost:3001/api/telemetry/* | OTel data |
| Health Check | http://localhost:3001/api/health | Backend health |
| Chat API | http://localhost:3001/api/chat | AI assistant |

### File Locations

| Path | Description |
|------|-------------|
| `~/.claude/projects/` | Claude session JSONL files |
| `backend/data/telemetry.db` | OpenTelemetry data (local dev) |
| `backend/data/chat.db` | Chat history (local dev) |
| `/app/data/` | Database location inside Docker |

### Key npm Scripts

```bash
# Backend
cd backend
npm start          # Start production
npm run dev        # Start with --watch (Node 18+)

# Frontend
cd frontend
npm run dev        # Vite dev server
npm run build      # Production build
npm run preview    # Preview production build

# Root
npm run docker:build    # Build Docker images
npm run docker:up       # Start containers
npm run docker:down     # Stop containers
```

---

## Appendix: Sample JSONL Event Types

### User Message (External Prompt)

```json
{
  "type": "user",
  "uuid": "abc-123",
  "parentUuid": "xyz-789",
  "timestamp": "2026-05-18T12:30:19.812Z",
  "entrypoint": "cli",
  "gitBranch": "main",
  "sessionId": "session-uuid",
  "cwd": "/Users/username/project",
  "version": "2.1.143",
  "userType": "external",
  "permissionMode": "default",
  "message": {
    "role": "user",
    "content": "Add error handling to server.js"
  }
}
```

### Assistant Message (with Tool Use)

```json
{
  "type": "assistant",
  "uuid": "def-456",
  "parentUuid": "abc-123",
  "timestamp": "2026-05-18T12:30:23.178Z",
  "gitBranch": "main",
  "message": {
    "model": "claude-opus-4-7",
    "role": "assistant",
    "content": [
      {
        "type": "text",
        "text": "I'll read the server.js file first."
      },
      {
        "type": "tool_use",
        "id": "tool-call-id",
        "name": "Read",
        "input": {
          "file_path": "/Users/username/project/server.js"
        }
      }
    ],
    "stop_reason": "tool_use",
    "usage": {
      "input_tokens": 5000,
      "output_tokens": 120,
      "cache_creation_input_tokens": 0,
      "cache_read_input_tokens": 12000
    }
  }
}
```

### User Message (Tool Result)

```json
{
  "type": "user",
  "uuid": "ghi-789",
  "parentUuid": "def-456",
  "timestamp": "2026-05-18T12:30:23.500Z",
  "userType": "tool",
  "message": {
    "role": "user",
    "content": [
      {
        "type": "tool_result",
        "tool_use_id": "tool-call-id",
        "content": "const express = require('express');\n..."
      }
    ]
  }
}
```

### Turn Duration Event (CLI Only)

```json
{
  "type": "system",
  "subtype": "turn_duration",
  "timestamp": "2026-05-18T12:30:45.000Z",
  "durationMs": 21822
}
```

### Permission Mode Event

```json
{
  "type": "permission-mode",
  "permissionMode": "default",
  "sessionId": "session-uuid"
}
```

---

## Contributing

When contributing to this project:

1. **Read this doc fully** — understanding the data flow is critical
2. **Test with real data** — use your own `~/.claude/projects/` for validation
3. **Verify time calculations** — run `validate-parsing.js` before submitting
4. **Match the theme** — follow neo-brutalist design system (sharp corners, mono font, shadows)
5. **Update this doc** — if you add features, document them here

---

**End of Documentation**

For questions or issues, open a GitHub issue or reach out to the maintainers.
