# Telemetry Setup

The dashboard ships with a built-in OpenTelemetry (OTLP/HTTP+JSON) receiver so
Claude Code can send live cost, time, token, and reliability data straight to
your local backend. No extra collector or Prometheus is required.

## What you get

| Signal | Source | Where it shows up |
|---|---|---|
| Cost (USD) per model / skill / agent / plugin / day | `claude_code.cost.usage` metric + `api_request` events | Telemetry tab → Cost cards & charts |
| Active time (excludes idle) | `claude_code.active_time.total` metric | Telemetry tab → Active time |
| API request duration & token usage | `api_request` events | Telemetry tab → API timing + per-prompt drilldown |
| Tool success rate, error categories, retry exhaustion | `tool_result`, `api_error`, `api_retries_exhausted` events | Telemetry tab → Reliability |
| Per-prompt timeline | `prompt.id` correlation across events | Telemetry tab → Recent prompts → Open |

The legacy JSONL-based view (Overview tab) is unchanged — telemetry is additive.

## Start the dashboard

```bash
docker-compose up --build
```

Backend listens on `http://localhost:3001`. The OTLP receiver is at
`POST /v1/metrics`, `/v1/logs`, `/v1/traces`. Telemetry is persisted in a
SQLite file on the `claude-dashboard-data` Docker volume, so data survives
container restarts.

## Point Claude Code at the receiver

Add these to your shell profile (`~/.zshrc`, `~/.bashrc`) or run them in the
terminal where you launch `claude`:

```bash
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export OTEL_METRICS_EXPORTER=otlp
export OTEL_LOGS_EXPORTER=otlp
export OTEL_EXPORTER_OTLP_PROTOCOL=http/json
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:3001

# Faster updates while you're testing (default is 60s for metrics).
export OTEL_METRIC_EXPORT_INTERVAL=10000
export OTEL_LOGS_EXPORT_INTERVAL=5000
```

> **Important:** the receiver only accepts `http/json`. Don't use `grpc` or
> `http/protobuf` — those will get a `415` with a hint. Protobuf parsing isn't
> bundled to keep the backend dependency-light.

Then run Claude Code as usual. Within ~10 seconds you should see the
"Receiving telemetry" banner go green at the top of the Telemetry tab.

### Optional: enable richer events

```bash
# Include skill/plugin/agent breakdown attribution on cost & token counters.
# (Already on by default — no flag needed.)

# Include user prompt content in user_prompt events.
export OTEL_LOG_USER_PROMPTS=1

# Include tool input details (Bash commands, MCP server names, file paths).
export OTEL_LOG_TOOL_DETAILS=1
```

### Optional: distributed traces

The receiver also accepts traces, though the Telemetry view doesn't render them
yet — they're stored in the `spans` table for ad-hoc SQL.

```bash
export CLAUDE_CODE_ENHANCED_TELEMETRY_BETA=1
export OTEL_TRACES_EXPORTER=otlp
```

## Multi-machine / team setup

Run the dashboard backend on a shared host (or behind Tailscale/cloudflared)
and point every developer's machine at it:

```bash
export OTEL_EXPORTER_OTLP_ENDPOINT=http://dashboard.internal:3001
export OTEL_RESOURCE_ATTRIBUTES="enduser.id=jdoe@example.com,team.id=platform"
```

The dashboard surfaces `user.email` / `user.account_id` from each session, and
you can filter prompt drilldown by session id in SQL.

## Verifying ingest

```bash
# Receiver health (last received timestamp per signal):
curl -s http://localhost:3001/api/telemetry/health | jq

# Quick summary of the last 30 days:
curl -s 'http://localhost:3001/api/telemetry/summary?days=30' | jq
```

If metrics & events counts stay at 0 after running Claude Code:

1. Confirm the env vars are set in the shell that launched `claude`
   (`env | grep OTEL_`).
2. Confirm the protocol is `http/json` — not `grpc`.
3. Set `OTLP_DEBUG=1` on the backend to log each received batch.
4. Check the backend logs for parse errors (`docker logs claude-dashboard-backend`).

## Querying the SQLite directly

```bash
docker exec -it claude-dashboard-backend sh -c \
  "sqlite3 /app/data/telemetry.db 'SELECT name, COUNT(*) FROM metrics GROUP BY name'"
```

Tables: `metrics`, `events`, `spans`, `receiver_health`. Schema is in
`backend/db.js`.

## Reliability of the tracking itself

- SQLite is opened with `journal_mode=WAL` so the receiver and reader don't
  block each other.
- Inserts are batched per OTLP request via a transaction.
- The DB lives on a named Docker volume — `docker-compose down` does not lose
  data; only `docker-compose down -v` does.
- The backend writes a `receiver_health` row per signal so the UI can warn if
  data has stopped arriving.
