# Backend Architecture

## Overview

The backend is a Node.js Express application with a domain-driven architecture. Each feature area (stats, telemetry, chat, etc.) is organized as a self-contained domain with its own routes, business logic, and data access.

## Directory Structure

```
backend/
├── src/
│   ├── index.js                    # Entry point - starts the server
│   ├── app.js                      # Express app factory - middleware & route mounting
│   ├── routes.js                   # Root router - mounts all domain routes
│   │
│   ├── config/
│   │   └── index.js               # Centralized configuration - all env vars
│   │
│   ├── lib/
│   │   ├── errors.js              # Custom error classes (AppError, NotFoundError, etc.)
│   │   ├── jsonl.js               # JSONL parsing utilities
│   │   └── logger.js              # Structured logging
│   │
│   ├── middleware/
│   │   ├── error-handler.js       # Global error handler - maps errors to HTTP responses
│   │   └── async-wrap.js          # Async route wrapper - catches promise rejections
│   │
│   ├── database/
│   │   ├── telemetry.db.js        # Telemetry SQLite connection & schema
│   │   └── chat.db.js             # Chat SQLite connection & schema
│   │
│   └── domains/
│       ├── stats/                 # Claude usage statistics from JSONL files
│       │   ├── stats.routes.js
│       │   ├── stats.service.js
│       │   └── stats.repository.js
│       │
│       ├── telemetry/             # Live telemetry data from SQLite
│       │   ├── telemetry.routes.js
│       │   ├── telemetry.service.js
│       │   └── telemetry.repository.js
│       │
│       ├── otlp/                  # OpenTelemetry Protocol receiver
│       │   ├── otlp.routes.js
│       │   └── otlp.receiver.js
│       │
│       ├── history/               # Conversation history from JSONL files
│       │   ├── history.routes.js
│       │   ├── history.service.js
│       │   └── history.repository.js
│       │
│       └── chat/                  # Natural language SQL query interface
│           ├── chat.routes.js
│           ├── chat.service.js
│           ├── chat.repository.js
│           ├── query-executor.js   # SQL validation & safe execution
│           ├── schema-context.js   # AI prompts & schema documentation
│           └── providers/          # AI provider implementations
│               ├── ai-adapter.js
│               ├── claude.provider.js
│               ├── openai.provider.js
│               └── local.provider.js
│
├── data/                          # Runtime SQLite databases (gitignored)
├── package.json
└── .env.example                   # Environment variable documentation
```

## Architecture Layers

### Domain Organization

Each domain follows a three-layer pattern:

1. **Routes** (`*.routes.js`) - HTTP request handling
   - Defines API endpoints
   - Request validation
   - Response formatting
   - Delegates to service layer

2. **Services** (`*.service.js`) - Business logic
   - Orchestrates data flow
   - Applies business rules
   - Coordinates between repositories
   - Error handling

3. **Repositories** (`*.repository.js`) - Data access
   - Database queries
   - File system operations
   - External API calls
   - Returns raw data to services

### Infrastructure

#### Configuration (`src/config/`)
- Single source of truth for all environment variables
- Read once at startup, frozen to prevent modification
- Type conversion and default values

#### Shared Libraries (`src/lib/`)
- **errors.js** - Custom error classes with HTTP status codes
- **jsonl.js** - Utilities for parsing Claude's JSONL transcript files
- **logger.js** - Structured logging wrapper

#### Middleware (`src/middleware/`)
- **error-handler.js** - Catches all errors, maps to HTTP responses
- **async-wrap.js** - Wraps async route handlers to catch rejections

#### Database (`src/database/`)
- SQLite connection management
- Schema initialization
- Shared database utilities

## Data Sources

The backend integrates two data sources:

### 1. JSONL Transcripts (Read-only)
- **Location**: `~/.claude/projects/*/*/transcripts/*.jsonl`
- **Used by**: Stats domain, History domain
- **Format**: Line-delimited JSON containing conversation turns, tool calls, token usage
- **Access pattern**: Full file scans, cached in memory

### 2. SQLite Databases (Read-write)
- **Telemetry DB** (`data/telemetry.db`)
  - Live telemetry data ingested via OTLP protocol
  - Metrics: cost, latency, token usage, tool reliability
  - Used by: Telemetry domain, OTLP domain

- **Chat DB** (`data/chat.db`)
  - Stores chat sessions and messages
  - Used by: Chat domain

## API Endpoints

### Stats (`/api/stats`, `/api/filters`)
- Aggregated statistics from JSONL transcripts
- Project/branch filters
- Health checks

### Telemetry (`/api/telemetry/*`)
- `/api/telemetry/summary` - Overall metrics summary
- `/api/telemetry/cost` - Cost breakdown by project/model
- `/api/telemetry/time` - Time usage analytics
- `/api/telemetry/reliability` - Tool success/failure rates
- `/api/telemetry/health` - Ingest health monitoring

### OTLP Receiver (`/v1/*`)
- `/v1/metrics` - OpenTelemetry metrics endpoint
- `/v1/logs` - OpenTelemetry logs endpoint
- `/v1/traces` - OpenTelemetry traces endpoint

### History (`/api/history/*`)
- `/api/history/sessions` - List all conversation sessions
- `/api/history/sessions/:projectPath` - Sessions for a project
- `/api/history/sessions/:projectPath/:sessionId` - Single session details

### Chat (`/api/chat`)
- Natural language SQL query interface
- Supports multiple AI providers (Claude, OpenAI, local models)
- Safe query execution with validation

## Configuration

All configuration is centralized in `src/config/index.js` and sourced from environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | HTTP server port |
| `CLAUDE_PROJECTS_PATH` | `~/.claude/projects` | Path to Claude projects directory |
| `TELEMETRY_DB_PATH` | `./data/telemetry.db` | Telemetry database location |
| `CHAT_DB_PATH` | `./data/chat.db` | Chat database location |
| `AI_PROVIDER` | `claude` | AI provider: `claude`, `openai`, or `local` |
| `AI_MODEL` | (provider default) | Model override |
| `ANTHROPIC_API_KEY` | - | Anthropic API key |
| `OPENAI_API_KEY` | - | OpenAI API key |
| `OPENAI_BASE_URL` | OpenAI default | Custom OpenAI endpoint |
| `LOCAL_AI_URL` | `http://localhost:11434` | Local AI endpoint |
| `CHAT_ROW_LIMIT` | `500` | Max rows in SQL query results |
| `OTLP_DEBUG` | `false` | Enable OTLP debug logging |

See `.env.example` for full documentation.

## Running the Server

```bash
# Development with auto-reload
npm run dev

# Production
npm start
```

## Key Design Decisions

1. **Domain-driven structure** - Features grouped by business capability, not technical layer
2. **Frozen configuration** - Config loaded once at startup, immutable
3. **Centralized error handling** - Single middleware maps all errors to HTTP responses
4. **No barrel files** - Direct imports reduce indirection
5. **Synchronous repositories** - No dependency injection needed for single-process app
6. **Provider pattern for AI** - Chat domain supports multiple AI providers via adapter

## Migration Notes

This architecture replaces the previous layered structure (`routes/`, `services/`, `repositories/`) with domain-driven organization. The migration was completed in phases:

1. Infrastructure setup (config, lib, middleware)
2. Database layer extraction
3. Domain-by-domain migration (OTLP → Stats → History → Telemetry → Chat)
4. Bootstrap files (app.js, routes.js, index.js)
5. Cleanup of old structure

The new structure makes the architecture readable from the folder tree and keeps related code together.
