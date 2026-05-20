import * as queries from '../../database/queries.js';
import { NotFoundError } from '../../lib/errors.js';

/**
 * NEW Database-backed History Service
 * Replaces file scanning with efficient DB queries
 */

/**
 * List all history sessions with summaries
 */
export function listHistorySessions() {
  const sessions = queries.getAllSessions({ limit: 1000 });

  // Get first user message preview for all sessions in a single query
  const sessionIds = sessions.map(s => s.id);
  const firstMessages = queries.getFirstUserMessagesBatch(sessionIds);

  return {
    sessions: sessions.map(s => {
      const firstMessage = firstMessages[s.id];

      let preview = 'New conversation';
      if (firstMessage?.content_preview) {
        preview = firstMessage.content_preview.substring(0, 100).trim();
        if (firstMessage.content_preview.length > 100) {
          preview += '...';
        }
      }

      return {
        sessionId: s.id,
        projectName: s.project_path,
        preview,
        messageCount: s.message_count || 0,
        userMessages: firstMessage?.user_count || 0,
        assistantMessages: firstMessage?.assistant_count || 0,
        createdAt: new Date(s.started_at).toISOString(),
        updatedAt: new Date(s.ended_at || s.started_at).toISOString(),
        gitBranch: s.branch || null
      };
    })
  };
}

/**
 * Get single history session with full conversation
 */
export function getHistorySession(projectDir, sessionId) {
  const sessionData = queries.getSessionById(sessionId);

  if (!sessionData) {
    throw new NotFoundError('Session not found');
  }

  const { conversation, messages, toolCalls } = sessionData;

  // Build conversation with tool calls embedded
  const conversationOutput = [];
  const seenUuids = new Set();

  for (const message of messages) {
    // Skip tool results — they're plumbing, not part of the visible conversation.
    if (message.has_tool_result) continue;
    // Skip CLI-injected synthetic messages (slash commands, system reminders, hooks).
    if (message.is_synthetic) continue;

    // Skip duplicates
    if (seenUuids.has(message.id)) continue;
    seenUuids.add(message.id);

    if (message.role === 'user') {
      conversationOutput.push({
        role: 'user',
        content: message.content_preview || '',
        timestamp: new Date(message.timestamp).toISOString(),
        uuid: message.id
      });
    }

    if (message.role === 'assistant') {
      // Find tool calls for this message
      const messageToolCalls = toolCalls.filter(tc => tc.message_id === message.id);

      conversationOutput.push({
        role: 'assistant',
        content: message.content_preview || '',
        toolCalls: messageToolCalls.length > 0 ? messageToolCalls.map(tc => ({
          name: tc.tool_name,
          id: tc.id,
          input: tc.input_json ? JSON.parse(tc.input_json) : null
        })) : null,
        model: message.model,
        timestamp: new Date(message.timestamp).toISOString(),
        uuid: message.id,
        usage: message.input_tokens ? {
          input_tokens: message.input_tokens,
          output_tokens: message.output_tokens,
          cache_creation_input_tokens: message.cache_creation_tokens,
          cache_read_input_tokens: message.cache_read_tokens
        } : null
      });
    }
  }

  return {
    sessionId,
    projectName: conversation.project_path,
    conversation: conversationOutput,
    metadata: {
      gitBranch: conversation.branch,
      entrypoint: conversation.entrypoint,
      cwd: null, // Not stored in DB currently
      createdAt: new Date(conversation.started_at).toISOString(),
      updatedAt: new Date(conversation.ended_at || conversation.started_at).toISOString(),
      messageCount: conversationOutput.length
    }
  };
}
