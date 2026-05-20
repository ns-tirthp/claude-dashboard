import db, { getHealth } from "../../database/telemetry.db.js";

// Build WHERE clause for time range queries
function buildRangeClause(query, column = "timestamp") {
  const sinceMs = query.sinceMs ? Number(query.sinceMs) : null;
  const untilMs = query.untilMs ? Number(query.untilMs) : null;
  const days = query.days ? Number(query.days) : 30;
  const params = {};
  let sql = "";

  if (sinceMs) {
    sql += ` AND ${column} >= @sinceMs`;
    params.sinceMs = sinceMs;
  } else {
    sql += ` AND ${column} >= @sinceMs`;
    params.sinceMs = Date.now() - days * 86400000;
  }

  if (untilMs) {
    sql += ` AND ${column} <= @untilMs`;
    params.untilMs = untilMs;
  }

  return { sql, params };
}

// Cost Queries
export function getTotalCost(query) {
  const { sql, params } = buildRangeClause(query);
  return db
    .prepare(
      `
    SELECT COALESCE(SUM(value), 0) AS total_usd
    FROM metrics
    WHERE name = 'claude_code.cost.usage' ${sql}
  `,
    )
    .get(params);
}

export function getCostByModel(query) {
  const { sql, params } = buildRangeClause(query);
  return db
    .prepare(
      `
    SELECT COALESCE(model, 'unknown') AS model,
           SUM(value) AS usd,
           COUNT(*) AS samples
    FROM metrics
    WHERE name = 'claude_code.cost.usage' ${sql}
    GROUP BY model
    ORDER BY usd DESC
  `,
    )
    .all(params);
}

export function getCostBySkill(query) {
  const { sql, params } = buildRangeClause(query);
  return db
    .prepare(
      `
    SELECT COALESCE(skill_name, 'none') AS skill,
           SUM(value) AS usd
    FROM metrics
    WHERE name = 'claude_code.cost.usage' ${sql}
    GROUP BY skill_name
    ORDER BY usd DESC
    LIMIT 20
  `,
    )
    .all(params);
}

export function getCostByAgent(query) {
  const { sql, params } = buildRangeClause(query);
  return db
    .prepare(
      `
    SELECT COALESCE(agent_name, 'main') AS agent,
           SUM(value) AS usd
    FROM metrics
    WHERE name = 'claude_code.cost.usage' ${sql}
    GROUP BY agent_name
    ORDER BY usd DESC
    LIMIT 20
  `,
    )
    .all(params);
}

export function getCostByPlugin(query) {
  const { sql, params } = buildRangeClause(query);
  return db
    .prepare(
      `
    SELECT COALESCE(plugin_name, 'none') AS plugin,
           SUM(value) AS usd
    FROM metrics
    WHERE name = 'claude_code.cost.usage' ${sql}
    GROUP BY plugin_name
    ORDER BY usd DESC
    LIMIT 20
  `,
    )
    .all(params);
}

export function getDailyCost(query) {
  const { sql, params } = buildRangeClause(query);
  return db
    .prepare(
      `
    SELECT date(timestamp / 1000, 'unixepoch') AS day,
           SUM(value) AS usd
    FROM metrics
    WHERE name = 'claude_code.cost.usage' ${sql}
    GROUP BY day
    ORDER BY day ASC
  `,
    )
    .all(params);
}

export function getTokensByType(query) {
  const { sql, params } = buildRangeClause(query);
  return db
    .prepare(
      `
    SELECT COALESCE(type, 'unknown') AS type,
           SUM(value) AS tokens
    FROM metrics
    WHERE name = 'claude_code.token.usage' ${sql}
    GROUP BY type
  `,
    )
    .all(params);
}

// Time Queries
export function getActiveTimeBreakdown(query) {
  const { sql, params } = buildRangeClause(query);
  return db
    .prepare(
      `
    SELECT COALESCE(type, 'unknown') AS type,
           SUM(value) AS seconds
    FROM metrics
    WHERE name = 'claude_code.active_time.total' ${sql}
    GROUP BY type
  `,
    )
    .all(params);
}

export function getApiDuration(query) {
  const { sql, params } = buildRangeClause(query);
  return db
    .prepare(
      `
    SELECT
      COUNT(*) AS count,
      AVG(duration_ms) AS avg_ms,
      MIN(duration_ms) AS min_ms,
      MAX(duration_ms) AS max_ms,
      SUM(duration_ms) AS sum_ms
    FROM events
    WHERE name = 'claude_code.api_request' AND duration_ms IS NOT NULL ${sql}
  `,
    )
    .get(params);
}

export function getToolDuration(query) {
  const { sql, params } = buildRangeClause(query);
  return db
    .prepare(
      `
    SELECT
      tool_name,
      COUNT(*) AS count,
      AVG(duration_ms) AS avg_ms,
      SUM(duration_ms) AS sum_ms
    FROM events
    WHERE name = 'claude_code.tool_result' AND duration_ms IS NOT NULL ${sql}
    GROUP BY tool_name
    ORDER BY sum_ms DESC
    LIMIT 20
  `,
    )
    .all(params);
}

export function getActiveTimeByDay(query) {
  const { sql, params } = buildRangeClause(query);
  return db
    .prepare(
      `
    SELECT date(timestamp / 1000, 'unixepoch') AS day,
           SUM(value) AS seconds
    FROM metrics
    WHERE name = 'claude_code.active_time.total' ${sql}
    GROUP BY day
    ORDER BY day ASC
  `,
    )
    .all(params);
}

// Reliability Queries
export function getToolStats(query) {
  const { sql, params } = buildRangeClause(query);
  return db
    .prepare(
      `
    SELECT
      tool_name,
      COUNT(*) AS total,
      SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) AS successes,
      SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) AS failures
    FROM events
    WHERE name = 'claude_code.tool_result' ${sql}
    GROUP BY tool_name
    ORDER BY total DESC
    LIMIT 30
  `,
    )
    .all(params);
}

export function getErrorBreakdown(query) {
  const { sql, params } = buildRangeClause(query);
  return db
    .prepare(
      `
    SELECT
      COALESCE(error_type, 'unknown') AS error_type,
      tool_name,
      COUNT(*) AS count
    FROM events
    WHERE name = 'claude_code.tool_result' AND success = 0 ${sql}
    GROUP BY error_type, tool_name
    ORDER BY count DESC
    LIMIT 30
  `,
    )
    .all(params);
}

export function getApiErrors(query) {
  const { sql, params } = buildRangeClause(query);
  return db
    .prepare(
      `
    SELECT
      COUNT(*) AS total_errors,
      SUM(CASE WHEN attempt > 1 THEN 1 ELSE 0 END) AS retried,
      AVG(attempt) AS avg_attempts
    FROM events
    WHERE name = 'claude_code.api_error' ${sql}
  `,
    )
    .get(params);
}

export function getRetriesExhausted(query) {
  const { sql, params } = buildRangeClause(query);
  return db
    .prepare(
      `
    SELECT COUNT(*) AS count
    FROM events
    WHERE name = 'claude_code.api_retries_exhausted' ${sql}
  `,
    )
    .get(params);
}

export function getToolDecisions(query) {
  const { sql, params } = buildRangeClause(query);
  return db
    .prepare(
      `
    SELECT
      COALESCE(decision, 'unknown') AS decision,
      COALESCE(decision_source, 'unknown') AS source,
      COUNT(*) AS count
    FROM events
    WHERE name = 'claude_code.tool_decision' ${sql}
    GROUP BY decision, decision_source
    ORDER BY count DESC
  `,
    )
    .all(params);
}

// Prompts Queries
export function getPrompts(query) {
  const { sql, params } = buildRangeClause(query);
  const limit = Math.min(Number(query.limit) || 50, 500);

  return db
    .prepare(
      `
    SELECT
      prompt_id,
      MIN(timestamp) AS started_at,
      MAX(timestamp) AS ended_at,
      session_id,
      SUM(CASE WHEN name = 'claude_code.api_request' THEN cost_usd ELSE 0 END) AS cost_usd,
      SUM(CASE WHEN name = 'claude_code.api_request' THEN duration_ms ELSE 0 END) AS api_ms,
      SUM(CASE WHEN name = 'claude_code.tool_result' THEN duration_ms ELSE 0 END) AS tool_ms,
      SUM(CASE WHEN name = 'claude_code.api_request' THEN input_tokens ELSE 0 END) AS input_tokens,
      SUM(CASE WHEN name = 'claude_code.api_request' THEN output_tokens ELSE 0 END) AS output_tokens,
      SUM(CASE WHEN name = 'claude_code.tool_result' THEN 1 ELSE 0 END) AS tool_calls,
      SUM(CASE WHEN name = 'claude_code.api_request' THEN 1 ELSE 0 END) AS api_calls,
      SUM(CASE WHEN name = 'claude_code.api_error' THEN 1 ELSE 0 END) AS api_errors
    FROM events
    WHERE prompt_id IS NOT NULL ${sql}
    GROUP BY prompt_id
    ORDER BY started_at DESC
    LIMIT @limit
  `,
    )
    .all({ ...params, limit });
}

export function getPromptEvents(id) {
  return db
    .prepare(
      `
    SELECT name, timestamp, model, cost_usd, duration_ms, input_tokens, output_tokens,
           cache_read_tokens, cache_creation_tokens, tool_name, success, error_type,
           error_message, attributes
    FROM events
    WHERE prompt_id = ?
    ORDER BY timestamp ASC
  `,
    )
    .all(id);
}

// Sessions Queries
export function getSessions(query) {
  const { sql, params } = buildRangeClause(query);
  const limit = Math.min(Number(query.limit) || 50, 500);

  return db
    .prepare(
      `
    SELECT
      session_id,
      MIN(timestamp) AS started_at,
      MAX(timestamp) AS ended_at,
      COUNT(DISTINCT prompt_id) AS prompt_count,
      SUM(CASE WHEN name = 'claude_code.api_request' THEN cost_usd ELSE 0 END) AS cost_usd,
      SUM(CASE WHEN name = 'claude_code.tool_result' THEN 1 ELSE 0 END) AS tool_calls,
      SUM(CASE WHEN name = 'claude_code.api_request' THEN input_tokens ELSE 0 END) AS input_tokens,
      SUM(CASE WHEN name = 'claude_code.api_request' THEN output_tokens ELSE 0 END) AS output_tokens
    FROM events
    WHERE session_id IS NOT NULL ${sql}
    GROUP BY session_id
    ORDER BY started_at DESC
    LIMIT @limit
  `,
    )
    .all({ ...params, limit });
}

// Productivity Queries
export function getLinesByType(query) {
  const { sql, params } = buildRangeClause(query);
  return db
    .prepare(
      `
    SELECT COALESCE(type, 'unknown') AS type,
           COALESCE(SUM(value), 0) AS lines
    FROM metrics
    WHERE name = 'claude_code.lines_of_code.count' ${sql}
    GROUP BY type
  `,
    )
    .all(params);
}

export function getLinesDaily(query) {
  const { sql, params } = buildRangeClause(query);
  return db
    .prepare(
      `
    SELECT date(timestamp / 1000, 'unixepoch') AS day,
           COALESCE(type, 'unknown') AS type,
           SUM(value) AS lines
    FROM metrics
    WHERE name = 'claude_code.lines_of_code.count' ${sql}
    GROUP BY day, type
    ORDER BY day ASC
  `,
    )
    .all(params);
}

export function getCommitsCount(query) {
  const { sql, params } = buildRangeClause(query);
  return db
    .prepare(
      `
    SELECT COALESCE(SUM(value), 0) AS commits
    FROM metrics
    WHERE name = 'claude_code.commit.count' ${sql}
  `,
    )
    .get(params);
}

export function getPullRequestsCount(query) {
  const { sql, params } = buildRangeClause(query);
  return db
    .prepare(
      `
    SELECT COALESCE(SUM(value), 0) AS prs
    FROM metrics
    WHERE name = 'claude_code.pull_request.count' ${sql}
  `,
    )
    .get(params);
}

export function getEditDecisions(query) {
  const { sql, params } = buildRangeClause(query);
  return db
    .prepare(
      `
    SELECT COALESCE(tool_name, 'unknown') AS tool,
           COALESCE(decision, 'unknown') AS decision,
           SUM(value) AS count
    FROM metrics
    WHERE name = 'claude_code.code_edit_tool.decision' ${sql}
    GROUP BY tool_name, decision
    ORDER BY count DESC
  `,
    )
    .all(params);
}

export function getEditsByLanguage(query) {
  const { sql, params } = buildRangeClause(query);
  return db
    .prepare(
      `
    SELECT COALESCE(language, 'unknown') AS language,
           COALESCE(decision, 'unknown') AS decision,
           SUM(value) AS count
    FROM metrics
    WHERE name = 'claude_code.code_edit_tool.decision' ${sql}
    GROUP BY language, decision
    ORDER BY count DESC
    LIMIT 50
  `,
    )
    .all(params);
}

// Health Queries
export function getHealthSignals() {
  return getHealth();
}

export function getTableCounts() {
  return {
    metrics: db.prepare("SELECT COUNT(*) AS c FROM metrics").get().c,
    events: db.prepare("SELECT COUNT(*) AS c FROM events").get().c,
    spans: db.prepare("SELECT COUNT(*) AS c FROM spans").get().c,
  };
}

// Summary Queries
export function getTotalSessions(query) {
  const { sql, params } = buildRangeClause(query);
  return db
    .prepare(
      `
    SELECT COALESCE(SUM(value), 0) AS sessions
    FROM metrics WHERE name = 'claude_code.session.count' ${sql}
  `,
    )
    .get(params);
}

export function getToolReliability(query) {
  const { sql, params } = buildRangeClause(query);
  return db
    .prepare(
      `
    SELECT
      SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) AS successes,
      SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) AS failures
    FROM events
    WHERE name = 'claude_code.tool_result' ${sql}
  `,
    )
    .get(params);
}
