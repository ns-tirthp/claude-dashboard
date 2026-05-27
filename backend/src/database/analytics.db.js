/**
 * Analytics Database
 *
 * Stores derived insights, patterns, and recommendations from telemetry and session data.
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import config from '../config/index.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = config.analyticsDbPath;
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/**
 * Schema for analytics and recommendations
 */
const schema = `
-- Pattern Detection: Stores detected patterns across sessions
CREATE TABLE IF NOT EXISTS patterns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pattern_type TEXT NOT NULL, -- 'tool_failure', 'context_waste', 'permission_denial', 'repeated_read'
    project_path TEXT,
    severity TEXT NOT NULL, -- 'low', 'medium', 'high', 'critical'
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    frequency INTEGER DEFAULT 1, -- how many times this pattern occurred
    first_seen INTEGER NOT NULL, -- timestamp
    last_seen INTEGER NOT NULL, -- timestamp
    metadata TEXT, -- JSON: { tool_name, error_type, file_path, etc. }
    status TEXT DEFAULT 'active', -- 'active', 'resolved', 'ignored'
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_patterns_project ON patterns(project_path, status);
CREATE INDEX IF NOT EXISTS idx_patterns_type ON patterns(pattern_type, status);
CREATE INDEX IF NOT EXISTS idx_patterns_severity ON patterns(severity, status);

-- Recommendations: Actionable suggestions based on patterns
CREATE TABLE IF NOT EXISTS recommendations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pattern_id INTEGER,
    project_path TEXT,
    category TEXT NOT NULL, -- 'documentation', 'permissions', 'optimization', 'tooling'
    priority TEXT NOT NULL, -- 'low', 'medium', 'high', 'urgent'
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    action_items TEXT NOT NULL, -- JSON array of actionable steps
    impact_estimate TEXT, -- estimated impact: "Could reduce failures by 80%"
    confidence_score REAL, -- 0.0 - 1.0
    status TEXT DEFAULT 'pending', -- 'pending', 'applied', 'dismissed', 'archived'
    applied_at INTEGER,
    dismissed_reason TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (pattern_id) REFERENCES patterns(id)
);

CREATE INDEX IF NOT EXISTS idx_recommendations_project ON recommendations(project_path, status);
CREATE INDEX IF NOT EXISTS idx_recommendations_priority ON recommendations(priority, status);
CREATE INDEX IF NOT EXISTS idx_recommendations_pattern ON recommendations(pattern_id);

-- Project Health Metrics: Derived metrics per project
CREATE TABLE IF NOT EXISTS project_health (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_path TEXT NOT NULL UNIQUE,
    -- Effectiveness metrics
    task_success_rate REAL, -- % of sessions without errors
    tool_rejection_rate REAL, -- % of tool calls rejected by user
    context_efficiency REAL, -- tokens per file edited
    redo_rate REAL, -- % of edits that get reverted
    -- Documentation status
    has_claude_md BOOLEAN DEFAULT 0,
    claude_md_quality_score REAL, -- 0-1 based on completeness
    -- Activity metrics
    total_sessions INTEGER DEFAULT 0,
    total_tool_calls INTEGER DEFAULT 0,
    avg_tokens_per_session REAL,
    -- Last updated
    last_analyzed INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_project_health_path ON project_health(project_path);
CREATE INDEX IF NOT EXISTS idx_project_health_success ON project_health(task_success_rate);

-- Session Analysis: Detailed analysis per session
CREATE TABLE IF NOT EXISTS session_analysis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL UNIQUE, -- references telemetry sessions
    project_path TEXT,
    analyzed BOOLEAN DEFAULT 0,
    -- Session characteristics
    duration_seconds INTEGER,
    total_tokens INTEGER,
    total_tool_calls INTEGER,
    unique_files_touched INTEGER,
    -- Issues found
    context_wasted BOOLEAN DEFAULT 0, -- high token usage, low output
    tool_failures INTEGER DEFAULT 0,
    permission_denials INTEGER DEFAULT 0,
    repeated_operations INTEGER DEFAULT 0, -- same file read 5+ times
    -- Outcomes
    had_git_commit BOOLEAN DEFAULT 0,
    files_created INTEGER DEFAULT 0,
    files_modified INTEGER DEFAULT 0,
    -- Timestamps
    session_start INTEGER,
    session_end INTEGER,
    analyzed_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_session_analysis_project ON session_analysis(project_path);
CREATE INDEX IF NOT EXISTS idx_session_analysis_session ON session_analysis(session_id);

-- Cross-Project Learning: Insights derived from comparing projects
CREATE TABLE IF NOT EXISTS cross_project_insights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    insight_type TEXT NOT NULL, -- 'best_practice', 'common_mistake', 'optimization'
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    -- Evidence
    sample_projects TEXT, -- JSON array of project paths that demonstrate this
    confidence_score REAL, -- 0.0 - 1.0
    impact_metric TEXT, -- e.g., "40% fewer permission prompts"
    -- Applicability
    applies_to_project_type TEXT, -- 'react', 'node', 'python', 'all'
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_insights_type ON cross_project_insights(insight_type);
`;

// Initialize schema
db.exec(schema);

console.log('Analytics database initialized:', dbPath);

export default db;
