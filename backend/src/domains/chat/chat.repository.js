import crypto from 'crypto';
import db from '../../database/chat.db.js';

export function createSession(title) {
  const id = crypto.randomUUID();
  const now = Date.now();
  db.prepare(
    'INSERT INTO chat_sessions (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)'
  ).run(id, title || 'New conversation', now, now);
  return { id, title: title || 'New conversation', created_at: now, updated_at: now };
}

export function listSessions() {
  return db.prepare('SELECT * FROM chat_sessions ORDER BY updated_at DESC').all();
}

export function getSession(sessionId) {
  return db.prepare('SELECT * FROM chat_sessions WHERE id = ?').get(sessionId);
}

export function updateSessionTitle(sessionId, title) {
  db.prepare('UPDATE chat_sessions SET title = ?, updated_at = ? WHERE id = ?')
    .run(title, Date.now(), sessionId);
}

export function deleteSession(sessionId) {
  db.prepare('DELETE FROM chat_sessions WHERE id = ?').run(sessionId);
}

export function addMessage(sessionId, { role, content, sqlQuery, resultData }) {
  const id = crypto.randomUUID();
  const now = Date.now();
  db.prepare(
    `INSERT INTO chat_messages (id, session_id, role, content, sql_query, result_data, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, sessionId, role, content, sqlQuery || null, resultData ? JSON.stringify(resultData) : null, now);
  db.prepare('UPDATE chat_sessions SET updated_at = ? WHERE id = ?').run(now, sessionId);
  return { id, session_id: sessionId, role, content, sql_query: sqlQuery, result_data: resultData, created_at: now };
}

export function getMessages(sessionId) {
  const rows = db.prepare(
    'SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC'
  ).all(sessionId);
  return rows.map(row => ({
    ...row,
    result_data: row.result_data ? JSON.parse(row.result_data) : null,
  }));
}
