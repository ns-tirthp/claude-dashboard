import { getProvider } from './providers/ai-adapter.js';
import { executeQuery } from './query-executor.js';
import { buildSystemPrompt, buildSummaryPrompt } from './schema-context.js';
import * as repo from './chat.repository.js';

function extractJSON(text) {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
}

export async function processChat(message, sessionId) {
  if (!message || typeof message !== 'string') {
    throw new Error('message is required');
  }

  let session;
  if (sessionId) {
    session = repo.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }
  } else {
    session = repo.createSession(message.slice(0, 60));
  }

  repo.addMessage(session.id, { role: 'user', content: message });

  const history = repo.getMessages(session.id)
    .filter(m => m.role !== 'error')
    .slice(-20)
    .map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }));

  const provider = getProvider();
  const systemPrompt = buildSystemPrompt();

  const aiResponse = await provider.generateSQL(systemPrompt, message, history.slice(0, -1));
  const parsed = extractJSON(aiResponse);

  if (!parsed) {
    const errorMsg = 'I couldn\'t understand how to query that. Could you rephrase your question?';
    repo.addMessage(session.id, { role: 'assistant', content: errorMsg });
    return { sessionId: session.id, summary: errorMsg, source: null, data: null };
  }

  if (parsed.source === 'jsonl') {
    const summary = parsed.explanation || 'This information comes from session-level statistics. Check the Overview tab for this data.';
    repo.addMessage(session.id, { role: 'assistant', content: summary });
    return {
      sessionId: session.id,
      summary,
      source: 'jsonl',
      sql: null,
      data: null,
      redirectToStats: true,
    };
  }

  const result = executeQuery(parsed.sql);

  if (!result.success) {
    const errorMsg = `Query failed: ${result.error}`;
    repo.addMessage(session.id, { role: 'error', content: errorMsg });
    const retryMsg = `I generated a query but it failed to execute. Error: ${result.error}. Could you try rephrasing?`;
    repo.addMessage(session.id, { role: 'assistant', content: retryMsg });
    return { sessionId: session.id, summary: retryMsg, source: 'sqlite', sql: parsed.sql, data: null, error: result.error };
  }

  const summaryPrompt = buildSummaryPrompt(message, result.data.rows.slice(0, 50));
  let summary;
  try {
    summary = await provider.summarizeResults(summaryPrompt);
  } catch {
    summary = `Query returned ${result.data.rowCount} row(s).`;
  }

  repo.addMessage(session.id, {
    role: 'assistant',
    content: summary,
    sqlQuery: parsed.sql,
    resultData: result.data,
  });

  if (history.length <= 2) {
    repo.updateSessionTitle(session.id, message.slice(0, 60));
  }

  return {
    sessionId: session.id,
    summary,
    source: 'sqlite',
    sql: parsed.sql,
    data: result.data,
  };
}

export function getChatSessions() {
  return repo.listSessions();
}

export function getChatSessionById(id) {
  const session = repo.getSession(id);
  if (!session) {
    throw new Error('Session not found');
  }
  const messages = repo.getMessages(session.id);
  return { ...session, messages };
}

export function deleteChatSession(id) {
  repo.deleteSession(id);
  return { success: true };
}
