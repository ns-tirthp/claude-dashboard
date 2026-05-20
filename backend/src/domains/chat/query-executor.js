import Database from 'better-sqlite3';
import config from '../../config/index.js';
import { ALLOWED_TABLES } from './schema-context.js';

const QUERY_TIMEOUT_MS = 5000;

const FORBIDDEN_KEYWORDS = [
  'INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE',
  'ATTACH', 'DETACH', 'REPLACE', 'PRAGMA', 'VACUUM', 'REINDEX',
];

let readOnlyDb = null;

function getReadOnlyDb() {
  if (readOnlyDb) return readOnlyDb;
  readOnlyDb = new Database(config.telemetryDbPath, { readonly: true });
  readOnlyDb.pragma('query_only = ON');
  return readOnlyDb;
}

export function validateSQL(sql) {
  const errors = [];
  const normalized = sql.trim().replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const upper = normalized.toUpperCase();

  if (!upper.startsWith('SELECT')) {
    errors.push('Only SELECT statements are allowed');
  }

  for (const keyword of FORBIDDEN_KEYWORDS) {
    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
    if (regex.test(normalized)) {
      errors.push(`Forbidden keyword: ${keyword}`);
    }
  }

  if (normalized.includes(';')) {
    const statements = normalized.split(';').filter(s => s.trim());
    if (statements.length > 1) {
      errors.push('Multiple statements are not allowed');
    }
  }

  const tablePattern = /\bFROM\s+(\w+)|\bJOIN\s+(\w+)/gi;
  let match;
  while ((match = tablePattern.exec(normalized)) !== null) {
    const table = (match[1] || match[2]).toLowerCase();
    if (!ALLOWED_TABLES.includes(table)) {
      errors.push(`Table "${table}" is not in the allowlist. Allowed: ${ALLOWED_TABLES.join(', ')}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

export function ensureLimit(sql) {
  const upper = sql.toUpperCase();
  if (!upper.includes('LIMIT')) {
    return `${sql.replace(/;?\s*$/, '')} LIMIT ${config.chatRowLimit}`;
  }

  const limitMatch = upper.match(/LIMIT\s+(\d+)/);
  if (limitMatch && parseInt(limitMatch[1], 10) > config.chatRowLimit) {
    return sql.replace(/LIMIT\s+\d+/i, `LIMIT ${config.chatRowLimit}`);
  }

  return sql;
}

export function executeQuery(sql) {
  const validation = validateSQL(sql);
  if (!validation.valid) {
    return { success: false, error: `Validation failed: ${validation.errors.join('; ')}` };
  }

  const safeSql = ensureLimit(sql);
  const db = getReadOnlyDb();

  try {
    db.pragma(`busy_timeout = ${QUERY_TIMEOUT_MS}`);
    const stmt = db.prepare(safeSql);
    const rows = stmt.all();
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

    return {
      success: true,
      data: { columns, rows, rowCount: rows.length, sql: safeSql },
    };
  } catch (err) {
    return { success: false, error: `Query execution error: ${err.message}` };
  }
}
