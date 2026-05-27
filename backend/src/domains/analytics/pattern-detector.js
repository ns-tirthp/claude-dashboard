/**
 * Pattern Detection Engine
 *
 * Analyzes telemetry (events) and dashboard (conversations/messages/tool_calls)
 * databases to detect problematic patterns that warrant recommendations.
 *
 * Schema notes:
 *   - telemetryDb.events: per-event records with tool_name, success, error_type,
 *     error_message, input_tokens, output_tokens, session_id. No project_path —
 *     workspace_paths is a JSON string under attributes.
 *   - dashboardDb.conversations: project_path, branch, started_at, etc.
 *   - dashboardDb.messages: per-message tokens, is_tool_error.
 *   - dashboardDb.tool_calls: tool_name, input_json (no success field — errors
 *     live on the corresponding messages.is_tool_error).
 */

class PatternDetector {
  constructor(telemetryDb, dashboardDb, analyticsDb) {
    this.telemetryDb = telemetryDb;
    this.dashboardDb = dashboardDb;
    this.analyticsDb = analyticsDb;
  }

  async detectAll(options = {}) {
    const { projectPath, daysBack = 30 } = options;
    const results = { patterns: [], timestamp: Date.now() };

    const detectors = [
      this.detectToolFailurePatterns.bind(this),
      this.detectContextWastePatterns.bind(this),
      this.detectRepeatedOperations.bind(this),
      this.detectMissingDocumentation.bind(this),
    ];

    for (const detector of detectors) {
      try {
        const patterns = await detector({ projectPath, daysBack });
        results.patterns.push(...patterns);
      } catch (error) {
        console.error(`Pattern detector ${detector.name} failed:`, error.message);
      }
    }

    for (const pattern of results.patterns) {
      this.storePattern(pattern);
    }

    return results;
  }

  /**
   * Detect: Tool failures via telemetry events.
   * Joins events to dashboard.conversations through session_id to attribute
   * failures to a project.
   */
  async detectToolFailurePatterns({ projectPath, daysBack }) {
    const cutoffMs = Date.now() - daysBack * 86400 * 1000;

    // Collect failures per session+tool+error_type
    const failureRows = this.telemetryDb
      .prepare(
        `
      SELECT
        session_id,
        tool_name,
        COALESCE(error_type, 'unknown') AS error_type,
        COUNT(*) AS failure_count,
        GROUP_CONCAT(DISTINCT COALESCE(error_message, '')) AS sample_errors
      FROM events
      WHERE name = 'claude_code.tool_result'
        AND success = 0
        AND timestamp >= ?
        AND tool_name IS NOT NULL
      GROUP BY session_id, tool_name, error_type
    `
      )
      .all(cutoffMs);

    if (failureRows.length === 0) return [];

    // Map session_id → project_path via dashboard conversations
    const sessionIds = [...new Set(failureRows.map((r) => r.session_id).filter(Boolean))];
    if (sessionIds.length === 0) return [];

    const placeholders = sessionIds.map(() => '?').join(',');
    const sessionMap = new Map();
    const sessionRows = this.dashboardDb
      .prepare(`SELECT id, project_path FROM conversations WHERE id IN (${placeholders})`)
      .all(...sessionIds);
    for (const row of sessionRows) sessionMap.set(row.id, row.project_path);

    // Aggregate by project + tool + error_type
    const aggregated = new Map();
    for (const row of failureRows) {
      const proj = sessionMap.get(row.session_id);
      if (!proj) continue;
      if (projectPath && proj !== projectPath) continue;

      const key = `${proj}|${row.tool_name}|${row.error_type}`;
      const existing = aggregated.get(key);
      if (existing) {
        existing.failure_count += row.failure_count;
        if (row.sample_errors) existing.sample_errors.add(row.sample_errors);
      } else {
        aggregated.set(key, {
          project_path: proj,
          tool_name: row.tool_name,
          error_type: row.error_type,
          failure_count: row.failure_count,
          sample_errors: new Set(row.sample_errors ? [row.sample_errors] : []),
        });
      }
    }

    return [...aggregated.values()]
      .filter((agg) => agg.failure_count >= 3)
      .map((agg) => ({
        pattern_type: 'tool_failure',
        project_path: agg.project_path,
        severity:
          agg.failure_count > 10 ? 'high' : agg.failure_count > 5 ? 'medium' : 'low',
        title: `Repeated ${agg.tool_name} failures`,
        description: `The ${agg.tool_name} tool failed ${agg.failure_count} times with error type: ${agg.error_type}`,
        frequency: agg.failure_count,
        metadata: JSON.stringify({
          tool_name: agg.tool_name,
          error_type: agg.error_type,
          sample_errors: [...agg.sample_errors].slice(0, 5).join(' | ').slice(0, 500),
        }),
      }));
  }

  /**
   * Detect: High token usage with low file output (context waste).
   * Uses dashboard.conversations + messages + tool_calls — no project_path
   * lookup needed.
   */
  async detectContextWastePatterns({ projectPath, daysBack }) {
    const cutoffMs = Date.now() - daysBack * 86400 * 1000;

    const sql = `
      SELECT
        c.id AS conversation_id,
        c.project_path,
        SUM(COALESCE(m.input_tokens, 0) + COALESCE(m.output_tokens, 0)) AS total_tokens,
        SUM(CASE WHEN tc.tool_name IN ('Edit', 'Write') THEN 1 ELSE 0 END) AS file_modifications
      FROM conversations c
      LEFT JOIN messages m ON m.conversation_id = c.id
      LEFT JOIN tool_calls tc ON tc.conversation_id = c.id
      WHERE c.started_at >= ?
        ${projectPath ? 'AND c.project_path = ?' : ''}
      GROUP BY c.id
      HAVING total_tokens > 100000 AND file_modifications <= 2
    `;
    const params = projectPath ? [cutoffMs, projectPath] : [cutoffMs];
    const wastefulSessions = this.dashboardDb.prepare(sql).all(...params);

    if (wastefulSessions.length < 2) return [];

    const byProject = {};
    for (const session of wastefulSessions) {
      if (!byProject[session.project_path]) byProject[session.project_path] = [];
      byProject[session.project_path].push(session);
    }

    return Object.entries(byProject).map(([path, sessions]) => ({
      pattern_type: 'context_waste',
      project_path: path,
      severity: sessions.length > 5 ? 'high' : 'medium',
      title: 'High token usage with minimal output',
      description: `Found ${sessions.length} sessions with >100K tokens but ≤2 file modifications. Possible inefficient exploration or unclear requirements.`,
      frequency: sessions.length,
      metadata: JSON.stringify({
        avg_tokens: Math.round(
          sessions.reduce((sum, s) => sum + s.total_tokens, 0) / sessions.length
        ),
        session_ids: sessions.map((s) => s.conversation_id).slice(0, 10),
      }),
    }));
  }

  /**
   * Detect: Repeated file reads in a single conversation.
   * Reads input_json from tool_calls to extract file_path.
   */
  async detectRepeatedOperations({ projectPath, daysBack }) {
    const cutoffMs = Date.now() - daysBack * 86400 * 1000;

    const sql = `
      SELECT
        c.id AS conversation_id,
        c.project_path,
        json_extract(tc.input_json, '$.file_path') AS file_path,
        COUNT(*) AS call_count
      FROM tool_calls tc
      JOIN conversations c ON c.id = tc.conversation_id
      WHERE tc.tool_name = 'Read'
        AND tc.timestamp >= ?
        ${projectPath ? 'AND c.project_path = ?' : ''}
        AND json_extract(tc.input_json, '$.file_path') IS NOT NULL
      GROUP BY c.id, file_path
      HAVING call_count >= 8
      ORDER BY call_count DESC
    `;
    const params = projectPath ? [cutoffMs, projectPath] : [cutoffMs];
    const repeated = this.dashboardDb.prepare(sql).all(...params);

    if (repeated.length === 0) return [];

    const byProject = {};
    for (const item of repeated) {
      if (!byProject[item.project_path]) byProject[item.project_path] = [];
      byProject[item.project_path].push(item);
    }

    return Object.entries(byProject).map(([path, items]) => ({
      pattern_type: 'repeated_read',
      project_path: path,
      severity: 'medium',
      title: 'Repeated file reads detected',
      description: `Found ${items.length} sessions with excessive file re-reads (8+ times). May indicate context loss or unclear instructions.`,
      frequency: items.length,
      metadata: JSON.stringify({
        most_repeated: items[0],
        total_occurrences: items.length,
      }),
    }));
  }

  /**
   * Detect: Active projects with errors but no CLAUDE.md.
   * "Errors" = messages.is_tool_error count for the project.
   * "Has CLAUDE.md reference" = any tool_call where input_json's file_path
   * mentions CLAUDE.md.
   */
  async detectMissingDocumentation({ projectPath, daysBack }) {
    const cutoffMs = Date.now() - daysBack * 86400 * 1000;

    const sql = `
      SELECT
        c.project_path,
        COUNT(DISTINCT c.id) AS session_count,
        SUM(COALESCE(m.is_tool_error, 0)) AS error_count
      FROM conversations c
      LEFT JOIN messages m ON m.conversation_id = c.id
      WHERE c.started_at >= ?
        ${projectPath ? 'AND c.project_path = ?' : ''}
      GROUP BY c.project_path
      HAVING session_count >= 3 AND error_count > 5
    `;
    const params = projectPath ? [cutoffMs, projectPath] : [cutoffMs];
    const activeProjects = this.dashboardDb.prepare(sql).all(...params);
    if (activeProjects.length === 0) return [];

    const claudeMdCheck = this.dashboardDb.prepare(`
      SELECT COUNT(*) AS count
      FROM tool_calls tc
      JOIN conversations c ON c.id = tc.conversation_id
      WHERE c.project_path = ?
        AND tc.tool_name = 'Read'
        AND LOWER(json_extract(tc.input_json, '$.file_path')) LIKE '%claude.md'
    `);

    const patterns = [];
    for (const project of activeProjects) {
      const { count } = claudeMdCheck.get(project.project_path);
      if (count > 0) continue;

      patterns.push({
        pattern_type: 'missing_documentation',
        project_path: project.project_path,
        severity: project.error_count > 20 ? 'high' : 'medium',
        title: 'No CLAUDE.md documentation found',
        description: `Project has ${project.session_count} sessions and ${project.error_count} errors, but no CLAUDE.md file detected.`,
        frequency: 1,
        metadata: JSON.stringify({
          session_count: project.session_count,
          error_count: project.error_count,
        }),
      });
    }
    return patterns;
  }

  storePattern(pattern) {
    const now = Math.floor(Date.now() / 1000);

    const existing = this.analyticsDb
      .prepare(
        `
      SELECT id FROM patterns
      WHERE pattern_type = ? AND project_path = ? AND status = 'active'
      ORDER BY last_seen DESC
      LIMIT 1
    `
      )
      .get(pattern.pattern_type, pattern.project_path);

    if (existing) {
      this.analyticsDb
        .prepare(
          `
        UPDATE patterns
        SET frequency = ?,
            last_seen = ?,
            severity = ?,
            description = ?,
            metadata = ?,
            updated_at = ?
        WHERE id = ?
      `
        )
        .run(
          pattern.frequency,
          now,
          pattern.severity,
          pattern.description,
          pattern.metadata,
          now,
          existing.id
        );
      return existing.id;
    }

    const result = this.analyticsDb
      .prepare(
        `
      INSERT INTO patterns (
        pattern_type, project_path, severity, title, description,
        frequency, first_seen, last_seen, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
      )
      .run(
        pattern.pattern_type,
        pattern.project_path,
        pattern.severity,
        pattern.title,
        pattern.description,
        pattern.frequency,
        now,
        now,
        pattern.metadata
      );
    return result.lastInsertRowid;
  }
}

export default PatternDetector;
