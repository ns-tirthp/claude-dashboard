import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import config from '../config/index.js';

const dbDir = path.dirname(config.telemetryDbPath);
const backupDir = path.join(dbDir, 'backups');
fs.mkdirSync(dbDir, { recursive: true });
fs.mkdirSync(backupDir, { recursive: true });

// Auto-backup existing DB on startup (if it has data)
if (fs.existsSync(config.telemetryDbPath)) {
  const stat = fs.statSync(config.telemetryDbPath);
  // Only back up if file is larger than an empty WAL-mode SQLite DB (~64KB with schema)
  if (stat.size > 4096) {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `telemetry-${ts}.db`);
    fs.copyFileSync(config.telemetryDbPath, backupPath);
    // Also copy WAL if present so the backup is complete
    const walPath = config.telemetryDbPath + '-wal';
    if (fs.existsSync(walPath) && fs.statSync(walPath).size > 0) {
      fs.copyFileSync(walPath, backupPath + '-wal');
    }
    // Prune backups older than 30 days
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    for (const file of fs.readdirSync(backupDir)) {
      const filePath = path.join(backupDir, file);
      if (fs.statSync(filePath).mtimeMs < cutoff) {
        fs.unlinkSync(filePath);
      }
    }
  }
}

const db = new Database(config.telemetryDbPath);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    value REAL NOT NULL,
    unit TEXT,
    timestamp INTEGER NOT NULL,
    session_id TEXT,
    account_id TEXT,
    organization_id TEXT,
    user_email TEXT,
    model TEXT,
    type TEXT,
    query_source TEXT,
    speed TEXT,
    effort TEXT,
    skill_name TEXT,
    plugin_name TEXT,
    agent_name TEXT,
    tool_name TEXT,
    decision TEXT,
    source TEXT,
    language TEXT,
    start_type TEXT,
    attributes TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_metrics_name_ts ON metrics(name, timestamp);
  CREATE INDEX IF NOT EXISTS idx_metrics_session ON metrics(session_id);
  CREATE INDEX IF NOT EXISTS idx_metrics_model ON metrics(model);

  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
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
    success INTEGER,
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
    attributes TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_events_name_ts ON events(name, timestamp);
  CREATE INDEX IF NOT EXISTS idx_events_prompt ON events(prompt_id);
  CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id);
  CREATE INDEX IF NOT EXISTS idx_events_tool ON events(tool_name);

  CREATE TABLE IF NOT EXISTS spans (
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
  CREATE INDEX IF NOT EXISTS idx_spans_trace ON spans(trace_id);
  CREATE INDEX IF NOT EXISTS idx_spans_name_start ON spans(name, start_ns);

  CREATE TABLE IF NOT EXISTS receiver_health (
    signal TEXT PRIMARY KEY,
    last_received_at INTEGER NOT NULL,
    received_count INTEGER NOT NULL DEFAULT 0
  );
`);

const insertMetric = db.prepare(`
  INSERT INTO metrics (
    name, value, unit, timestamp, session_id, account_id, organization_id, user_email,
    model, type, query_source, speed, effort, skill_name, plugin_name, agent_name,
    tool_name, decision, source, language, start_type, attributes
  ) VALUES (
    @name, @value, @unit, @timestamp, @session_id, @account_id, @organization_id, @user_email,
    @model, @type, @query_source, @speed, @effort, @skill_name, @plugin_name, @agent_name,
    @tool_name, @decision, @source, @language, @start_type, @attributes
  )
`);

const insertEvent = db.prepare(`
  INSERT INTO events (
    name, timestamp, session_id, account_id, organization_id, user_email, prompt_id,
    model, cost_usd, duration_ms, input_tokens, output_tokens, cache_read_tokens,
    cache_creation_tokens, request_id, tool_name, tool_use_id, success, error_type,
    error_message, decision, decision_source, speed, query_source, effort, status_code,
    attempt, workspace_paths, attributes
  ) VALUES (
    @name, @timestamp, @session_id, @account_id, @organization_id, @user_email, @prompt_id,
    @model, @cost_usd, @duration_ms, @input_tokens, @output_tokens, @cache_read_tokens,
    @cache_creation_tokens, @request_id, @tool_name, @tool_use_id, @success, @error_type,
    @error_message, @decision, @decision_source, @speed, @query_source, @effort, @status_code,
    @attempt, @workspace_paths, @attributes
  )
`);

const insertSpan = db.prepare(`
  INSERT INTO spans (
    trace_id, span_id, parent_span_id, name, start_ns, end_ns, duration_ms,
    status_code, session_id, attributes
  ) VALUES (
    @trace_id, @span_id, @parent_span_id, @name, @start_ns, @end_ns, @duration_ms,
    @status_code, @session_id, @attributes
  )
`);

const upsertHealth = db.prepare(`
  INSERT INTO receiver_health (signal, last_received_at, received_count)
  VALUES (@signal, @timestamp, 1)
  ON CONFLICT(signal) DO UPDATE SET
    last_received_at = excluded.last_received_at,
    received_count = received_count + 1
`);

export const insertMetricsBatch = db.transaction((rows) => {
  for (const row of rows) insertMetric.run(row);
});

export const insertEventsBatch = db.transaction((rows) => {
  for (const row of rows) insertEvent.run(row);
});

export const insertSpansBatch = db.transaction((rows) => {
  for (const row of rows) insertSpan.run(row);
});

export function recordHealth(signal, timestamp) {
  upsertHealth.run({ signal, timestamp });
}

export function getHealth() {
  return db.prepare('SELECT * FROM receiver_health').all();
}

export default db;
