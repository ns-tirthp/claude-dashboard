import fs from 'fs';
import path from 'path';
import config from '../config/index.js';

// Returns { events, invalidLines } — invalidLines counts JSON lines we failed
// to parse so callers can surface partial corruption instead of silently
// dropping data. Backwards compatibility: legacy callers that only expect an
// array can use parseJSONLEvents.
export function parseJSONL(filePath) {
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return { events: [], invalidLines: 0 };
  }
  const events = [];
  let invalidLines = 0;
  for (const raw of content.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    try {
      events.push(JSON.parse(line));
    } catch {
      invalidLines++;
    }
  }
  return { events, invalidLines };
}

export function parseJSONLEvents(filePath) {
  return parseJSONL(filePath).events;
}

export function getProjectDirectories() {
  if (!fs.existsSync(config.claudeProjectsPath)) {
    return [];
  }
  return fs.readdirSync(config.claudeProjectsPath)
    .filter(name => {
      const fullPath = path.join(config.claudeProjectsPath, name);
      return name.startsWith('-') && fs.statSync(fullPath).isDirectory();
    });
}

// Fallback: derive a display name from the encoded directory name.
// Claude Code encodes "/" as "-" but DOES NOT escape original "-", so this is
// only a best-effort guess. Prefer deriveProjectNameFromCwd() when an event has cwd.
export function getProjectName(dirName) {
  return dirName
    .replace(/^-/, '')
    .replace(/-/g, '/')
    .replace(/^Users\/[^\/]+\//, '~/');
}

// Convert an absolute cwd (e.g. "/Users/alice/Personal/claude-dashboard") to a
// display path ("~/Personal/claude-dashboard"). Preserves hyphens correctly.
export function deriveProjectNameFromCwd(cwd) {
  if (!cwd || typeof cwd !== 'string') return null;
  const normalized = cwd.replace(/\/+$/, '');
  const homeMatch = normalized.match(/^\/Users\/[^\/]+(\/.*)?$/);
  if (homeMatch) {
    return '~' + (homeMatch[1] || '');
  }
  return normalized;
}

// Pick the most common cwd across events — handles sessions that cd between
// subdirs (e.g. backend/ vs frontend/) by choosing the modal value rather than
// the first one we see.
export function pickPrimaryCwd(events) {
  const counts = new Map();
  for (const e of events) {
    const cwd = e && e.cwd;
    if (!cwd) continue;
    counts.set(cwd, (counts.get(cwd) || 0) + 1);
  }
  if (counts.size === 0) return null;
  let best = null;
  let bestCount = -1;
  for (const [cwd, count] of counts) {
    if (count > bestCount) { best = cwd; bestCount = count; }
  }
  // Walk up to a reasonable project root: if we have a/b/c/backend AND a/b/c/frontend,
  // prefer the common parent. Implemented simply: if best ends with a known subdir, strip it.
  // Keep it simple — just return the modal cwd; users can run from a subdir intentionally.
  return best;
}

export function getProjectPath(projectDir) {
  return path.join(config.claudeProjectsPath, projectDir);
}

export function getSessionFiles(projectDir) {
  const projectPath = getProjectPath(projectDir);
  return fs.readdirSync(projectPath)
    .filter(file => file.endsWith('.jsonl'));
}

export function getSessionFilePath(projectDir, sessionFile) {
  return path.join(config.claudeProjectsPath, projectDir, sessionFile);
}
