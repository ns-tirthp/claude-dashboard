export const ALLOWED_TABLES = ['metrics', 'events', 'spans', 'receiver_health'];

export const SCHEMA_DESCRIPTION = `
You have access to a SQLite database with Claude Code telemetry data. Here are the tables:

## Table: metrics
Stores numeric telemetry metrics from Claude Code sessions.
Columns:
- id (INTEGER, PRIMARY KEY)
- name (TEXT) — metric name (e.g., "token_usage", "api_request_duration")
- value (REAL) — numeric value
- unit (TEXT) — unit of measurement
- timestamp (INTEGER) — Unix epoch milliseconds
- session_id (TEXT) — unique session identifier
- account_id (TEXT)
- organization_id (TEXT)
- user_email (TEXT)
- model (TEXT) — Claude model used (e.g., "claude-sonnet-4-6-20250929")
- type (TEXT) — metric type
- query_source (TEXT)
- speed (TEXT)
- effort (TEXT)
- skill_name (TEXT)
- plugin_name (TEXT)
- agent_name (TEXT)
- tool_name (TEXT) — which tool was used (e.g., "Read", "Edit", "Bash")
- decision (TEXT)
- source (TEXT)
- language (TEXT)
- start_type (TEXT)
- attributes (TEXT) — JSON string with additional attributes

## Table: events
Stores discrete telemetry events (API calls, tool uses, errors).
Columns:
- id (INTEGER, PRIMARY KEY)
- name (TEXT) — event name (e.g., "api_request", "tool_use", "permission_decision")
- timestamp (INTEGER) — Unix epoch milliseconds
- session_id (TEXT)
- account_id (TEXT)
- organization_id (TEXT)
- user_email (TEXT)
- prompt_id (TEXT)
- model (TEXT) — Claude model
- cost_usd (REAL) — cost in USD for this event
- duration_ms (INTEGER) — duration in milliseconds
- input_tokens (INTEGER)
- output_tokens (INTEGER)
- cache_read_tokens (INTEGER)
- cache_creation_tokens (INTEGER)
- request_id (TEXT)
- tool_name (TEXT)
- tool_use_id (TEXT)
- success (INTEGER) — 1 for success, 0 for failure
- error_type (TEXT)
- error_message (TEXT)
- decision (TEXT)
- decision_source (TEXT)
- speed (TEXT)
- query_source (TEXT)
- effort (TEXT)
- status_code (INTEGER)
- attempt (INTEGER)
- workspace_paths (TEXT)
- attributes (TEXT) — JSON string

## Table: spans
Stores distributed tracing spans.
Columns:
- id (INTEGER, PRIMARY KEY)
- trace_id (TEXT)
- span_id (TEXT)
- parent_span_id (TEXT)
- name (TEXT) — span operation name
- start_ns (INTEGER) — start time in nanoseconds
- end_ns (INTEGER) — end time in nanoseconds
- duration_ms (INTEGER)
- status_code (INTEGER)
- session_id (TEXT)
- attributes (TEXT) — JSON string

## Table: receiver_health
Tracks health of the telemetry receiver.
Columns:
- signal (TEXT, PRIMARY KEY) — signal type (metrics, logs, traces)
- last_received_at (INTEGER) — Unix epoch milliseconds
- received_count (INTEGER)

## JSONL Stats Data
Additionally, you can query pre-aggregated statistics from JSONL session files. When the user asks about projects, conversations, tool usage counts, model usage, branch activity, hourly/daily patterns, or token totals — these come from the JSONL stats endpoint. Indicate when you need JSONL data by setting source to "jsonl" in your response.

## Important Notes
- Timestamps are Unix epoch in MILLISECONDS (not seconds)
- To convert to date: datetime(timestamp/1000, 'unixepoch')
- Only generate SELECT statements
- Always include a LIMIT clause (max 500 rows)
- Use appropriate aggregations (COUNT, SUM, AVG, GROUP BY) for summary questions
`;

export const EXAMPLE_QUERIES = `
Example natural language to SQL mappings:

Q: "How much have I spent on API calls today?"
SQL: SELECT SUM(cost_usd) as total_cost FROM events WHERE name = 'api_request' AND timestamp >= strftime('%s', 'now', 'start of day') * 1000 LIMIT 1;

Q: "What are the most used tools?"
SQL: SELECT tool_name, COUNT(*) as usage_count FROM events WHERE tool_name IS NOT NULL GROUP BY tool_name ORDER BY usage_count DESC LIMIT 20;

Q: "Show me errors from the last hour"
SQL: SELECT name, error_type, error_message, datetime(timestamp/1000, 'unixepoch') as time FROM events WHERE success = 0 AND timestamp >= (strftime('%s', 'now') - 3600) * 1000 ORDER BY timestamp DESC LIMIT 50;

Q: "Average API response time by model"
SQL: SELECT model, AVG(duration_ms) as avg_duration, COUNT(*) as request_count FROM events WHERE name = 'api_request' AND duration_ms IS NOT NULL GROUP BY model ORDER BY avg_duration DESC LIMIT 20;

Q: "How many tokens have I used this week?"
SQL: SELECT SUM(input_tokens) as total_input, SUM(output_tokens) as total_output, SUM(input_tokens + output_tokens) as total FROM events WHERE timestamp >= (strftime('%s', 'now', 'weekday 0', '-7 days')) * 1000 LIMIT 1;
`;

export function buildSystemPrompt() {
  return `You are a data analyst assistant for a Claude Code usage dashboard. Users ask questions about their Claude Code usage statistics in natural language. Your job is to convert their questions into SQL queries.

${SCHEMA_DESCRIPTION}

${EXAMPLE_QUERIES}

## Response Format
You must respond with ONLY a JSON object (no markdown, no explanation outside the JSON):
{
  "source": "sqlite" | "jsonl",
  "sql": "SELECT ...",
  "explanation": "Brief explanation of what the query does"
}

- Set source to "jsonl" if the question is about high-level project stats, total conversations, tool usage rankings, model usage distribution, branch activity, or daily/hourly patterns (these come from pre-aggregated JSONL files, not the telemetry DB).
- Set source to "sqlite" for detailed queries about costs, tokens, specific events, timing, errors, or anything requiring filtering/aggregation from raw telemetry.
- When source is "jsonl", the sql field should describe what data to extract (it won't be executed as SQL, but guides the extraction logic).

## Rules
- ONLY generate SELECT statements
- Always include LIMIT (max 500)
- Use the exact column names from the schema
- Only query allowed tables: metrics, events, spans, receiver_health
- For time-based questions, remember timestamps are in milliseconds
`;
}

export function buildSummaryPrompt(userQuestion, queryResult) {
  return `The user asked: "${userQuestion}"

The query returned the following data:
${JSON.stringify(queryResult, null, 2)}

Provide a concise, natural language summary of these results. Be specific with numbers. If the data is empty, say so clearly. Keep it to 2-3 sentences max.`;
}
