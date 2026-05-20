import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import config from '../config/index.js';

fs.mkdirSync(path.dirname(config.chatDbPath), { recursive: true });

const db = new Database(config.chatDbPath);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS chat_sessions (
    id TEXT PRIMARY KEY,
    title TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'error')),
    content TEXT NOT NULL,
    sql_query TEXT,
    result_data TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_messages_session ON chat_messages(session_id, created_at);
`);

export default db;
