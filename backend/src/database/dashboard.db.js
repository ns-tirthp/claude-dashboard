import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import config from '../config/index.js';
import logger from '../lib/logger.js';

// Initialize database
const dbPath = config.dashboardDbPath;
const dbDir = path.dirname(dbPath);
const backupDir = path.join(dbDir, 'backups');

fs.mkdirSync(dbDir, { recursive: true });
fs.mkdirSync(backupDir, { recursive: true });

// Auto-backup existing DB on startup (if it has data)
if (fs.existsSync(dbPath)) {
  const stat = fs.statSync(dbPath);
  if (stat.size > 4096) {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `dashboard-${ts}.db`);
    fs.copyFileSync(dbPath, backupPath);
    const walPath = dbPath + '-wal';
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

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

logger.info('database', `Dashboard database initialized at ${dbPath}`);

// ============================================================================
// SCHEMA DEFINITION
// ============================================================================

const SCHEMA = `
-- ============================================================================
-- CONVERSATIONS: Core session/conversation tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,                    -- sessionId from JSONL
  project_path TEXT NOT NULL,             -- e.g., "~/Personal/claude-dashboard"
  project_dir TEXT NOT NULL,              -- e.g., "-Users-tirthp-Personal-claude-dashboard"
  branch TEXT,                            -- git branch (e.g., "master", "HEAD")
  entrypoint TEXT,                        -- "cli", "web", "sdk-ts", etc.
  started_at INTEGER NOT NULL,            -- Unix timestamp (ms)
  ended_at INTEGER,                       -- Unix timestamp (ms)
  total_turns INTEGER DEFAULT 0,          -- Count of user-initiated turns
  total_events INTEGER DEFAULT 0,         -- Total JSONL events in session
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_conversations_project ON conversations(project_path, branch);
CREATE INDEX IF NOT EXISTS idx_conversations_started ON conversations(started_at);
CREATE INDEX IF NOT EXISTS idx_conversations_entrypoint ON conversations(entrypoint);

-- ============================================================================
-- MESSAGES: Individual assistant/user messages
-- ============================================================================
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,                    -- uuid from JSONL event
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,                     -- "user", "assistant", "system"
  type TEXT NOT NULL,                     -- JSONL event type: "user", "assistant", "system"
  subtype TEXT,                           -- For system messages: "turn_duration", etc.
  timestamp INTEGER NOT NULL,             -- Unix timestamp (ms)
  model TEXT,                             -- e.g., "claude-sonnet-4-5-20250929"
  stop_reason TEXT,                       -- "tool_use", "end_turn", etc.
  content_preview TEXT,                   -- First 500 chars of text content
  has_tool_use INTEGER DEFAULT 0,         -- Boolean: does this message call tools?
  has_tool_result INTEGER DEFAULT 0,      -- Boolean: is this a tool result?
  is_synthetic INTEGER DEFAULT 0,         -- Boolean: CLI-injected (slash cmd, system-reminder, hook)
  is_tool_error INTEGER DEFAULT 0,        -- Boolean: tool_result with is_error=true

  -- Token usage (from message.usage)
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  cache_creation_tokens INTEGER DEFAULT 0,
  cache_read_tokens INTEGER DEFAULT 0,

  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_messages_model ON messages(model);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);

-- ============================================================================
-- TOOL CALLS: Tool usage tracking (Edit, Read, Write, Bash, etc.)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tool_calls (
  id TEXT PRIMARY KEY,                    -- Generated from message uuid + tool name + index
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,                -- "Edit", "Read", "Write", "Bash", etc.
  timestamp INTEGER NOT NULL,             -- Same as parent message timestamp
  input_json TEXT,                        -- JSON string of tool input (for analysis)

  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_tool_calls_conversation ON tool_calls(conversation_id);
CREATE INDEX IF NOT EXISTS idx_tool_calls_tool_name ON tool_calls(tool_name);
CREATE INDEX IF NOT EXISTS idx_tool_calls_timestamp ON tool_calls(timestamp);

-- ============================================================================
-- FILE OPERATIONS: Detailed file edit/read/write tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS file_operations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  tool_call_id TEXT REFERENCES tool_calls(id) ON DELETE CASCADE,
  operation_type TEXT NOT NULL,           -- "edit", "read", "write"
  file_path TEXT NOT NULL,                -- Path from tool input
  lines_added INTEGER DEFAULT 0,          -- For Edit/Write operations
  lines_removed INTEGER DEFAULT 0,        -- For Edit operations
  timestamp INTEGER NOT NULL,

  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_file_ops_conversation ON file_operations(conversation_id);
CREATE INDEX IF NOT EXISTS idx_file_ops_file_path ON file_operations(file_path);
CREATE INDEX IF NOT EXISTS idx_file_ops_type ON file_operations(operation_type);

-- ============================================================================
-- TURN DURATIONS: Measured time per conversation turn
-- ============================================================================
CREATE TABLE IF NOT EXISTS turn_durations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  turn_index INTEGER NOT NULL,            -- Sequential turn number
  duration_ms INTEGER NOT NULL,           -- Measured duration
  timestamp INTEGER NOT NULL,             -- When this turn occurred

  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),

  UNIQUE(conversation_id, turn_index)
);

CREATE INDEX IF NOT EXISTS idx_turn_durations_conversation ON turn_durations(conversation_id);

-- ============================================================================
-- TELEMETRY EVENTS: Raw OTel data (from existing telemetry.db)
-- ============================================================================
CREATE TABLE IF NOT EXISTS telemetry_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,               -- "metric", "log", "trace"
  name TEXT NOT NULL,                     -- "cost.usage", "active_time.total", etc.
  value REAL,                             -- Numeric value
  unit TEXT,                              -- "USD", "ms", "count", etc.
  attributes TEXT,                        -- JSON blob of attributes
  resource_attributes TEXT,               -- JSON blob of resource attributes
  timestamp INTEGER NOT NULL,             -- Unix timestamp (ms)

  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_telemetry_events_type ON telemetry_events(event_type);
CREATE INDEX IF NOT EXISTS idx_telemetry_events_name ON telemetry_events(name);
CREATE INDEX IF NOT EXISTS idx_telemetry_events_timestamp ON telemetry_events(timestamp);

-- ============================================================================
-- AGGREGATED STATS: Pre-computed statistics for fast queries
-- ============================================================================
CREATE TABLE IF NOT EXISTS aggregated_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stat_type TEXT NOT NULL,                -- "daily_activity", "model_usage", "project_summary", etc.
  dimensions TEXT,                        -- JSON: {"project": "~/Personal", "date": "2026-05-20"}
  value REAL,                             -- Numeric value or count
  value_json TEXT,                        -- Complex value as JSON (e.g., nested objects)
  last_updated INTEGER NOT NULL,          -- Unix timestamp (ms)

  UNIQUE(stat_type, dimensions)
);

CREATE INDEX IF NOT EXISTS idx_aggregated_stats_type ON aggregated_stats(stat_type);
CREATE INDEX IF NOT EXISTS idx_aggregated_stats_updated ON aggregated_stats(last_updated);

-- ============================================================================
-- INGESTION METADATA: Track what's been processed
-- ============================================================================
CREATE TABLE IF NOT EXISTS ingestion_metadata (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_type TEXT NOT NULL,              -- "jsonl", "otlp"
  source_identifier TEXT NOT NULL,        -- File path or endpoint
  last_processed_at INTEGER NOT NULL,     -- Unix timestamp (ms)
  last_event_timestamp INTEGER,           -- Timestamp of latest event in source
  checksum TEXT,                          -- File hash for change detection
  status TEXT DEFAULT 'success',          -- "success", "error", "partial"
  error_message TEXT,

  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),

  UNIQUE(source_type, source_identifier)
);

CREATE INDEX IF NOT EXISTS idx_ingestion_metadata_source ON ingestion_metadata(source_type, source_identifier);

-- ============================================================================
-- VIEWS: Convenient query interfaces
-- ============================================================================

-- Daily conversation summary
CREATE VIEW IF NOT EXISTS v_daily_stats AS
SELECT
  DATE(started_at / 1000, 'unixepoch') as date,
  project_path,
  COUNT(*) as conversation_count,
  SUM(total_turns) as total_turns,
  COUNT(DISTINCT branch) as unique_branches
FROM conversations
GROUP BY DATE(started_at / 1000, 'unixepoch'), project_path;

-- Tool usage summary
CREATE VIEW IF NOT EXISTS v_tool_usage AS
SELECT
  tool_name,
  COUNT(*) as usage_count,
  COUNT(DISTINCT conversation_id) as conversation_count,
  DATE(timestamp / 1000, 'unixepoch') as date
FROM tool_calls
GROUP BY tool_name, DATE(timestamp / 1000, 'unixepoch');

-- Model usage summary
CREATE VIEW IF NOT EXISTS v_model_usage AS
SELECT
  model,
  COUNT(*) as message_count,
  SUM(input_tokens) as total_input_tokens,
  SUM(output_tokens) as total_output_tokens,
  SUM(cache_read_tokens) as total_cache_read_tokens,
  SUM(cache_creation_tokens) as total_cache_creation_tokens,
  COUNT(DISTINCT conversation_id) as conversation_count
FROM messages
WHERE model IS NOT NULL
GROUP BY model;

-- Project summary
CREATE VIEW IF NOT EXISTS v_project_summary AS
SELECT
  project_path,
  COUNT(DISTINCT id) as conversation_count,
  COUNT(DISTINCT branch) as branch_count,
  MIN(started_at) as first_activity,
  MAX(COALESCE(ended_at, started_at)) as last_activity,
  SUM(total_turns) as total_turns
FROM conversations
GROUP BY project_path;
`;

// Initialize schema
try {
  db.exec(SCHEMA);
  // Lightweight in-place migrations for columns added after the original schema.
  const messageColumns = db.prepare(`PRAGMA table_info(messages)`).all().map(c => c.name);
  if (!messageColumns.includes('is_synthetic')) {
    db.exec(`ALTER TABLE messages ADD COLUMN is_synthetic INTEGER DEFAULT 0`);
  }
  if (!messageColumns.includes('is_tool_error')) {
    db.exec(`ALTER TABLE messages ADD COLUMN is_tool_error INTEGER DEFAULT 0`);
  }
  logger.info('database', 'Dashboard schema initialized');
} catch (err) {
  logger.error('database', 'Failed to initialize dashboard database schema', err);
  throw err;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Execute a transaction
 * @param {Function} fn - Function containing database operations
 * @returns {*} - Result of the transaction
 */
export function transaction(fn) {
  const txn = db.transaction(fn);
  return txn();
}

/**
 * Get database info
 */
export function getDbInfo() {
  const tables = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table' AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `).all();

  const counts = {};
  for (const { name } of tables) {
    const result = db.prepare(`SELECT COUNT(*) as count FROM ${name}`).get();
    counts[name] = result.count;
  }

  return {
    path: dbPath,
    tables: tables.map(t => t.name),
    counts,
    size: fs.statSync(dbPath).size,
  };
}

/**
 * Clear all data (for testing)
 */
export function clearAllData() {
  transaction(() => {
    db.exec(`
      DELETE FROM file_operations;
      DELETE FROM tool_calls;
      DELETE FROM turn_durations;
      DELETE FROM messages;
      DELETE FROM conversations;
      DELETE FROM telemetry_events;
      DELETE FROM aggregated_stats;
      DELETE FROM ingestion_metadata;
    `);
  });
  logger.info('database', 'All data cleared from dashboard database');
}

// ============================================================================
// PREPARED STATEMENTS (for performance)
// ============================================================================

// Conversation operations.
// On conflict we take MAX() for monotonic counters and ended_at, so a partial
// re-parse cannot regress a previously-seen larger value. project_path /
// project_dir / branch / entrypoint are also refreshed when a non-null new
// value is provided (e.g. when we learn the real cwd from a later event).
export const insertConversation = db.prepare(`
  INSERT INTO conversations (
    id, project_path, project_dir, branch, entrypoint,
    started_at, ended_at, total_turns, total_events
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    project_path = COALESCE(excluded.project_path, conversations.project_path),
    project_dir  = COALESCE(excluded.project_dir,  conversations.project_dir),
    branch       = COALESCE(excluded.branch,       conversations.branch),
    entrypoint   = COALESCE(NULLIF(excluded.entrypoint, 'unknown'), conversations.entrypoint),
    started_at   = MIN(conversations.started_at, excluded.started_at),
    ended_at     = MAX(COALESCE(conversations.ended_at, 0), COALESCE(excluded.ended_at, 0)),
    total_turns  = MAX(conversations.total_turns,  excluded.total_turns),
    total_events = MAX(conversations.total_events, excluded.total_events),
    updated_at   = strftime('%s', 'now') * 1000
`);

export const getConversation = db.prepare(`
  SELECT * FROM conversations WHERE id = ?
`);

export const listConversations = db.prepare(`
  SELECT * FROM conversations
  ORDER BY started_at DESC
  LIMIT ? OFFSET ?
`);

// Message operations
export const insertMessage = db.prepare(`
  INSERT INTO messages (
    id, conversation_id, role, type, subtype, timestamp, model, stop_reason,
    content_preview, has_tool_use, has_tool_result, is_synthetic, is_tool_error,
    input_tokens, output_tokens, cache_creation_tokens, cache_read_tokens
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO NOTHING
`);

// Tool call operations
export const insertToolCall = db.prepare(`
  INSERT INTO tool_calls (
    id, conversation_id, message_id, tool_name, timestamp, input_json
  ) VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO NOTHING
`);

// File operation tracking
export const insertFileOperation = db.prepare(`
  INSERT INTO file_operations (
    conversation_id, tool_call_id, operation_type, file_path,
    lines_added, lines_removed, timestamp
  ) VALUES (?, ?, ?, ?, ?, ?, ?)
`);

// Turn duration tracking
export const insertTurnDuration = db.prepare(`
  INSERT INTO turn_durations (
    conversation_id, turn_index, duration_ms, timestamp
  ) VALUES (?, ?, ?, ?)
  ON CONFLICT(conversation_id, turn_index) DO UPDATE SET
    duration_ms = excluded.duration_ms
`);

// Ingestion metadata tracking
export const upsertIngestionMetadata = db.prepare(`
  INSERT INTO ingestion_metadata (
    source_type, source_identifier, last_processed_at,
    last_event_timestamp, checksum, status, error_message
  ) VALUES (?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(source_type, source_identifier) DO UPDATE SET
    last_processed_at = excluded.last_processed_at,
    last_event_timestamp = excluded.last_event_timestamp,
    checksum = excluded.checksum,
    status = excluded.status,
    error_message = excluded.error_message,
    updated_at = strftime('%s', 'now') * 1000
`);

export const getIngestionMetadata = db.prepare(`
  SELECT * FROM ingestion_metadata
  WHERE source_type = ? AND source_identifier = ?
`);

export default db;
