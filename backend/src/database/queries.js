import db from './dashboard.db.js';
import logger from '../lib/logger.js';

/**
 * Database Query Layer
 * Provides efficient queries for Stats and History APIs
 */

// ============================================================================
// STATS QUERIES
// ============================================================================

/**
 * Get all projects with summary statistics
 */
export function getAllProjects(filters = {}) {
  const { project: filterProject, branch: filterBranch } = filters;

  let sql = `
    SELECT
      c.project_path,
      c.branch,
      COUNT(DISTINCT c.id) as conversation_count,
      COUNT(DISTINCT m.id) as message_count,
      SUM(m.input_tokens) as total_input_tokens,
      SUM(m.output_tokens) as total_output_tokens,
      SUM(m.cache_creation_tokens) as total_cache_creation_tokens,
      SUM(m.cache_read_tokens) as total_cache_read_tokens,
      MAX(c.ended_at) as last_activity,
      MIN(c.started_at) as first_activity,
      c.entrypoint
    FROM conversations c
    LEFT JOIN messages m ON m.conversation_id = c.id
  `;

  const params = [];
  const conditions = [];

  if (filterProject && filterProject !== 'all') {
    conditions.push('c.project_path = ?');
    params.push(filterProject);
  }

  if (filterBranch && filterBranch !== 'all') {
    conditions.push('c.branch = ?');
    params.push(filterBranch);
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  sql += ' GROUP BY c.project_path, c.branch, c.entrypoint';

  return db.prepare(sql).all(...params);
}

/**
 * Get tool usage statistics
 */
export function getToolUsage(filters = {}) {
  const { project: filterProject, branch: filterBranch } = filters;

  let sql = `
    SELECT
      tc.tool_name,
      COUNT(*) as usage_count,
      COUNT(DISTINCT tc.conversation_id) as conversation_count
    FROM tool_calls tc
    JOIN conversations c ON c.id = tc.conversation_id
  `;

  const params = [];
  const conditions = [];

  if (filterProject && filterProject !== 'all') {
    conditions.push('c.project_path = ?');
    params.push(filterProject);
  }

  if (filterBranch && filterBranch !== 'all') {
    conditions.push('c.branch = ?');
    params.push(filterBranch);
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  sql += ' GROUP BY tc.tool_name ORDER BY usage_count DESC';

  return db.prepare(sql).all(...params);
}

/**
 * Get tool usage by project
 */
export function getToolUsageByProject(filters = {}) {
  const { project: filterProject, branch: filterBranch } = filters;

  let sql = `
    SELECT
      c.project_path,
      tc.tool_name,
      COUNT(*) as usage_count
    FROM tool_calls tc
    JOIN conversations c ON c.id = tc.conversation_id
  `;

  const params = [];
  const conditions = [];

  if (filterProject && filterProject !== 'all') {
    conditions.push('c.project_path = ?');
    params.push(filterProject);
  }

  if (filterBranch && filterBranch !== 'all') {
    conditions.push('c.branch = ?');
    params.push(filterBranch);
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  sql += ' GROUP BY c.project_path, tc.tool_name';

  return db.prepare(sql).all(...params);
}

/**
 * Get model usage by project
 */
export function getModelUsageByProject(filters = {}) {
  const { project: filterProject, branch: filterBranch } = filters;

  let sql = `
    SELECT
      c.project_path,
      m.model,
      COUNT(*) as message_count
    FROM messages m
    JOIN conversations c ON c.id = m.conversation_id
    WHERE m.model IS NOT NULL
  `;

  const params = [];

  if (filterProject && filterProject !== 'all') {
    sql += ' AND c.project_path = ?';
    params.push(filterProject);
  }

  if (filterBranch && filterBranch !== 'all') {
    sql += ' AND c.branch = ?';
    params.push(filterBranch);
  }

  sql += ' GROUP BY c.project_path, m.model';

  return db.prepare(sql).all(...params);
}

/**
 * Get model usage statistics
 */
export function getModelUsage(filters = {}) {
  const { project: filterProject, branch: filterBranch } = filters;

  let sql = `
    SELECT
      m.model,
      COUNT(*) as message_count,
      COUNT(DISTINCT m.conversation_id) as conversation_count,
      SUM(m.input_tokens) as total_input_tokens,
      SUM(m.output_tokens) as total_output_tokens,
      SUM(m.cache_creation_tokens) as total_cache_creation_tokens,
      SUM(m.cache_read_tokens) as total_cache_read_tokens
    FROM messages m
    JOIN conversations c ON c.id = m.conversation_id
    WHERE m.model IS NOT NULL
  `;

  const params = [];

  if (filterProject && filterProject !== 'all') {
    sql += ' AND c.project_path = ?';
    params.push(filterProject);
  }

  if (filterBranch && filterBranch !== 'all') {
    sql += ' AND c.branch = ?';
    params.push(filterBranch);
  }

  sql += ' GROUP BY m.model ORDER BY message_count DESC';

  return db.prepare(sql).all(...params);
}

/**
 * Get hourly activity distribution
 */
export function getHourlyActivity(filters = {}) {
  const { project: filterProject, branch: filterBranch } = filters;

  let sql = `
    SELECT
      CAST(strftime('%H', timestamp / 1000, 'unixepoch') AS INTEGER) as hour,
      COUNT(*) as event_count
    FROM messages m
    JOIN conversations c ON c.id = m.conversation_id
    WHERE 1=1
  `;

  const params = [];

  if (filterProject && filterProject !== 'all') {
    sql += ' AND c.project_path = ?';
    params.push(filterProject);
  }

  if (filterBranch && filterBranch !== 'all') {
    sql += ' AND c.branch = ?';
    params.push(filterBranch);
  }

  sql += ' GROUP BY hour ORDER BY hour';

  const results = db.prepare(sql).all(...params);

  // Fill in missing hours with 0
  const hourlyActivity = Array(24).fill(0);
  results.forEach(row => {
    hourlyActivity[row.hour] = row.event_count;
  });

  return hourlyActivity;
}

/**
 * Get daily activity
 */
export function getDailyActivity(filters = {}) {
  const { project: filterProject, branch: filterBranch } = filters;

  let sql = `
    SELECT
      DATE(timestamp / 1000, 'unixepoch') as date,
      COUNT(*) as event_count
    FROM messages m
    JOIN conversations c ON c.id = m.conversation_id
    WHERE 1=1
  `;

  const params = [];

  if (filterProject && filterProject !== 'all') {
    sql += ' AND c.project_path = ?';
    params.push(filterProject);
  }

  if (filterBranch && filterBranch !== 'all') {
    sql += ' AND c.branch = ?';
    params.push(filterBranch);
  }

  sql += ' GROUP BY date ORDER BY date DESC';

  const results = db.prepare(sql).all(...params);

  // Convert to object { "2026-05-20": 42, ... }
  const dailyActivity = {};
  results.forEach(row => {
    dailyActivity[row.date] = row.event_count;
  });

  return dailyActivity;
}

/**
 * Get branch activity
 */
export function getBranchActivity(filters = {}) {
  const { project: filterProject, branch: filterBranch } = filters;

  let sql = `
    SELECT
      c.branch,
      COUNT(DISTINCT c.id) as conversation_count,
      COUNT(m.id) as message_count
    FROM conversations c
    LEFT JOIN messages m ON m.conversation_id = c.id
    WHERE c.branch IS NOT NULL
  `;

  const params = [];

  if (filterProject && filterProject !== 'all') {
    sql += ' AND c.project_path = ?';
    params.push(filterProject);
  }

  if (filterBranch && filterBranch !== 'all') {
    sql += ' AND c.branch = ?';
    params.push(filterBranch);
  }

  sql += ' GROUP BY c.branch ORDER BY message_count DESC';

  const results = db.prepare(sql).all(...params);

  // Convert to object { "main": 42, "dev": 23, ... }
  const branchActivity = {};
  results.forEach(row => {
    branchActivity[row.branch] = row.message_count;
  });

  return branchActivity;
}

/**
 * Get entrypoint usage
 */
export function getEntrypointUsage(filters = {}) {
  const { project: filterProject, branch: filterBranch } = filters;

  let sql = `
    SELECT
      c.entrypoint,
      COUNT(DISTINCT c.id) as conversation_count
    FROM conversations c
    WHERE c.entrypoint IS NOT NULL
  `;

  const params = [];

  if (filterProject && filterProject !== 'all') {
    sql += ' AND c.project_path = ?';
    params.push(filterProject);
  }

  if (filterBranch && filterBranch !== 'all') {
    sql += ' AND c.branch = ?';
    params.push(filterBranch);
  }

  sql += ' GROUP BY c.entrypoint ORDER BY conversation_count DESC';

  const results = db.prepare(sql).all(...params);

  // Convert to object { "cli": 42, "web": 23, ... }
  const entrypointUsage = {};
  results.forEach(row => {
    entrypointUsage[row.entrypoint] = row.conversation_count;
  });

  return entrypointUsage;
}

/**
 * Get file operation statistics
 */
export function getFileOperationStats(filters = {}) {
  const { project: filterProject, branch: filterBranch } = filters;

  let sql = `
    SELECT
      fo.operation_type,
      COUNT(*) as count
    FROM file_operations fo
    JOIN conversations c ON c.id = fo.conversation_id
    WHERE 1=1
  `;

  const params = [];

  if (filterProject && filterProject !== 'all') {
    sql += ' AND c.project_path = ?';
    params.push(filterProject);
  }

  if (filterBranch && filterBranch !== 'all') {
    sql += ' AND c.branch = ?';
    params.push(filterBranch);
  }

  sql += ' GROUP BY fo.operation_type';

  const results = db.prepare(sql).all(...params);

  const stats = {
    totalEdits: 0,
    totalReads: 0,
    totalWrites: 0
  };

  results.forEach(row => {
    if (row.operation_type === 'edit') stats.totalEdits = row.count;
    if (row.operation_type === 'read') stats.totalReads = row.count;
    if (row.operation_type === 'write') stats.totalWrites = row.count;
  });

  return stats;
}

/**
 * Get file operation statistics by project
 */
export function getFileOperationsByProject(filters = {}) {
  const { project: filterProject, branch: filterBranch } = filters;

  let sql = `
    SELECT
      c.project_path,
      fo.operation_type,
      COUNT(*) as count
    FROM file_operations fo
    JOIN conversations c ON c.id = fo.conversation_id
    WHERE 1=1
  `;

  const params = [];

  if (filterProject && filterProject !== 'all') {
    sql += ' AND c.project_path = ?';
    params.push(filterProject);
  }

  if (filterBranch && filterBranch !== 'all') {
    sql += ' AND c.branch = ?';
    params.push(filterBranch);
  }

  sql += ' GROUP BY c.project_path, fo.operation_type';

  return db.prepare(sql).all(...params);
}

/**
 * Get timeline of conversation activity
 */
export function getTimeline(filters = {}, limit = 100) {
  const { project: filterProject, branch: filterBranch } = filters;

  let sql = `
    SELECT
      c.id,
      c.project_path,
      c.branch,
      c.started_at as timestamp,
      DATE(c.started_at / 1000, 'unixepoch') as date
    FROM conversations c
    WHERE 1=1
  `;

  const params = [];

  if (filterProject && filterProject !== 'all') {
    sql += ' AND c.project_path = ?';
    params.push(filterProject);
  }

  if (filterBranch && filterBranch !== 'all') {
    sql += ' AND c.branch = ?';
    params.push(filterBranch);
  }

  sql += ' ORDER BY c.started_at DESC LIMIT ?';
  params.push(limit);

  const results = db.prepare(sql).all(...params);

  return results.map(row => ({
    project: row.project_path,
    date: row.date,
    timestamp: new Date(row.timestamp).toISOString()
  }));
}

/**
 * Get turn durations for time calculation
 */
export function getTurnDurations(filters = {}) {
  const { project: filterProject, branch: filterBranch } = filters;

  let sql = `
    SELECT
      td.conversation_id,
      td.duration_ms
    FROM turn_durations td
    JOIN conversations c ON c.id = td.conversation_id
    WHERE 1=1
  `;

  const params = [];

  if (filterProject && filterProject !== 'all') {
    sql += ' AND c.project_path = ?';
    params.push(filterProject);
  }

  if (filterBranch && filterBranch !== 'all') {
    sql += ' AND c.branch = ?';
    params.push(filterBranch);
  }

  return db.prepare(sql).all(...params);
}

/**
 * Sum measured turn durations per project (CLI sessions emit system/turn_duration events).
 * Returns rows like { project_path, conversations_with_measured, total_measured_ms }.
 */
export function getMeasuredTimeByProject(filters = {}) {
  const { project: filterProject, branch: filterBranch } = filters;

  let sql = `
    SELECT
      c.project_path,
      COUNT(DISTINCT td.conversation_id) as conversations_with_measured,
      SUM(td.duration_ms) as total_measured_ms
    FROM turn_durations td
    JOIN conversations c ON c.id = td.conversation_id
    WHERE 1=1
  `;

  const params = [];

  if (filterProject && filterProject !== 'all') {
    sql += ' AND c.project_path = ?';
    params.push(filterProject);
  }

  if (filterBranch && filterBranch !== 'all') {
    sql += ' AND c.branch = ?';
    params.push(filterBranch);
  }

  sql += ' GROUP BY c.project_path';

  return db.prepare(sql).all(...params);
}

/**
 * Estimate time from message timestamps per project, only for conversations that
 * have NO measured turn_durations (e.g. SDK / IDE sessions). Each per-turn delta
 * is capped at maxTurnMs to limit idle-time inflation.
 *
 * Returns rows like { project_path, conversations_with_estimated, total_estimated_ms }.
 */
export function getEstimatedTimeByProject(filters = {}, maxTurnMs = 5 * 60 * 1000) {
  const { project: filterProject, branch: filterBranch } = filters;

  const params = [];
  const conditions = [];

  if (filterProject && filterProject !== 'all') {
    conditions.push('c.project_path = ?');
    params.push(filterProject);
  }

  if (filterBranch && filterBranch !== 'all') {
    conditions.push('c.branch = ?');
    params.push(filterBranch);
  }

  const whereClause = conditions.length ? 'AND ' + conditions.join(' AND ') : '';

  // The `min(...)` cap parameter is appended after the project/branch filters so
  // the `?` placeholders bind in source order.
  params.push(maxTurnMs);

  // Walk messages per conversation, compute per-turn deltas, cap at maxTurnMs.
  // Skip conversations that already have measured turn_durations (avoid double counting).
  const sql = `
    WITH ordered AS (
      SELECT
        m.conversation_id,
        c.project_path,
        m.timestamp,
        LAG(m.timestamp) OVER (
          PARTITION BY m.conversation_id ORDER BY m.timestamp
        ) AS prev_ts
      FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
      WHERE m.conversation_id NOT IN (SELECT conversation_id FROM turn_durations)
        ${whereClause}
    ),
    deltas AS (
      SELECT
        conversation_id,
        project_path,
        min(timestamp - prev_ts, ?) AS delta_ms
      FROM ordered
      WHERE prev_ts IS NOT NULL
        AND timestamp > prev_ts
    )
    SELECT
      project_path,
      COUNT(DISTINCT conversation_id) AS conversations_with_estimated,
      SUM(delta_ms) AS total_estimated_ms
    FROM deltas
    GROUP BY project_path
  `;

  return db.prepare(sql).all(...params);
}

// ============================================================================
// FILTER OPTIONS QUERIES
// ============================================================================

/**
 * Get all unique projects and their branches
 */
export function getProjectsWithBranches() {
  const sql = `
    SELECT
      c.project_path,
      c.branch,
      COUNT(DISTINCT c.id) as conversation_count
    FROM conversations c
    GROUP BY c.project_path, c.branch
    ORDER BY c.project_path, c.branch
  `;

  const results = db.prepare(sql).all();

  // Group by project
  const projectMap = {};

  results.forEach(row => {
    if (!projectMap[row.project_path]) {
      projectMap[row.project_path] = {
        name: row.project_path,
        branches: []
      };
    }
    if (row.branch) {
      projectMap[row.project_path].branches.push(row.branch);
    }
  });

  return Object.values(projectMap);
}

// ============================================================================
// HISTORY QUERIES
// ============================================================================

/**
 * Get all sessions with summary info
 */
export function getAllSessions(options = {}) {
  const { project, limit = 100, offset = 0 } = options;

  let sql = `
    SELECT
      c.id,
      c.project_path,
      c.branch,
      c.entrypoint,
      c.started_at,
      c.ended_at,
      c.total_turns,
      c.total_events,
      COUNT(DISTINCT m.id) as message_count,
      COUNT(DISTINCT tc.id) as tool_call_count
    FROM conversations c
    LEFT JOIN messages m ON m.conversation_id = c.id
    LEFT JOIN tool_calls tc ON tc.conversation_id = c.id
  `;

  const params = [];

  if (project) {
    sql += ' WHERE c.project_path = ?';
    params.push(project);
  }

  sql += ' GROUP BY c.id ORDER BY c.started_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  return db.prepare(sql).all(...params);
}

/**
 * Get single session with full details
 */
export function getSessionById(sessionId) {
  const conversation = db.prepare(`
    SELECT * FROM conversations WHERE id = ?
  `).get(sessionId);

  if (!conversation) {
    return null;
  }

  const messages = db.prepare(`
    SELECT * FROM messages
    WHERE conversation_id = ?
    ORDER BY timestamp ASC
  `).all(sessionId);

  const toolCalls = db.prepare(`
    SELECT * FROM tool_calls
    WHERE conversation_id = ?
    ORDER BY timestamp ASC
  `).all(sessionId);

  const fileOperations = db.prepare(`
    SELECT * FROM file_operations
    WHERE conversation_id = ?
    ORDER BY timestamp ASC
  `).all(sessionId);

  const turnDurations = db.prepare(`
    SELECT * FROM turn_durations
    WHERE conversation_id = ?
    ORDER BY turn_index ASC
  `).all(sessionId);

  return {
    conversation,
    messages,
    toolCalls,
    fileOperations,
    turnDurations
  };
}

/**
 * Get sessions for a specific project
 */
export function getSessionsByProject(projectPath, options = {}) {
  const { limit = 100, offset = 0 } = options;

  const sql = `
    SELECT
      c.id,
      c.project_path,
      c.branch,
      c.entrypoint,
      c.started_at,
      c.ended_at,
      c.total_turns,
      COUNT(DISTINCT m.id) as message_count,
      COUNT(DISTINCT tc.id) as tool_call_count
    FROM conversations c
    LEFT JOIN messages m ON m.conversation_id = c.id
    LEFT JOIN tool_calls tc ON tc.conversation_id = c.id
    WHERE c.project_path = ?
    GROUP BY c.id
    ORDER BY c.started_at DESC
    LIMIT ? OFFSET ?
  `;

  return db.prepare(sql).all(projectPath, limit, offset);
}

/**
 * Get first user message preview for multiple sessions (batch query).
 *
 * Filters out:
 *   - tool_result user messages (they're framework plumbing, not human input)
 *   - synthetic user messages (CLI-injected slash commands, system reminders, hooks)
 *
 * `user_count` reflects real human turns; `assistant_count` is unchanged.
 */
export function getFirstUserMessagesBatch(sessionIds) {
  if (!sessionIds || sessionIds.length === 0) {
    return {};
  }

  const placeholders = sessionIds.map(() => '?').join(',');
  const sql = `
    WITH ranked_messages AS (
      SELECT
        m.conversation_id,
        m.content_preview,
        m.timestamp,
        ROW_NUMBER() OVER (PARTITION BY m.conversation_id ORDER BY m.timestamp ASC) as rn
      FROM messages m
      WHERE m.conversation_id IN (${placeholders})
        AND m.role = 'user'
        AND m.has_tool_result = 0
        AND COALESCE(m.is_synthetic, 0) = 0
    ),
    message_counts AS (
      SELECT
        conversation_id,
        SUM(CASE WHEN role = 'user'
                  AND has_tool_result = 0
                  AND COALESCE(is_synthetic, 0) = 0 THEN 1 ELSE 0 END) as user_count,
        SUM(CASE WHEN role = 'assistant' THEN 1 ELSE 0 END) as assistant_count
      FROM messages
      WHERE conversation_id IN (${placeholders})
      GROUP BY conversation_id
    )
    SELECT
      rm.conversation_id,
      rm.content_preview,
      mc.user_count,
      mc.assistant_count
    FROM ranked_messages rm
    JOIN message_counts mc ON mc.conversation_id = rm.conversation_id
    WHERE rm.rn = 1
  `;

  const results = db.prepare(sql).all(...sessionIds, ...sessionIds);

  const resultMap = {};
  for (const row of results) {
    resultMap[row.conversation_id] = row;
  }
  return resultMap;
}

export default {
  // Stats queries
  getAllProjects,
  getToolUsage,
  getToolUsageByProject,
  getModelUsage,
  getModelUsageByProject,
  getHourlyActivity,
  getDailyActivity,
  getBranchActivity,
  getEntrypointUsage,
  getFileOperationStats,
  getFileOperationsByProject,
  getTimeline,
  getTurnDurations,
  getMeasuredTimeByProject,
  getEstimatedTimeByProject,

  // Filter queries
  getProjectsWithBranches,

  // History queries
  getAllSessions,
  getSessionById,
  getSessionsByProject,
  getFirstUserMessagesBatch
};
