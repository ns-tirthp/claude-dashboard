import crypto from 'crypto';
import logger from '../lib/logger.js';
import { deriveProjectNameFromCwd, pickPrimaryCwd, getProjectName } from '../lib/jsonl.js';

/**
 * Transform raw JSONL events into database-ready records
 */
export class EventTransformer {
  constructor(sessionId, projectPath, projectDir) {
    this.sessionId = sessionId;
    this.projectPath = projectPath;
    this.projectDir = projectDir;

    // Track seen events to avoid duplicates
    this.seenMessageIds = new Set();
    this.seenToolCallIds = new Set();

    // Accumulate records for batch insert
    this.conversation = null;
    this.messages = [];
    this.toolCalls = [];
    this.fileOperations = [];
    this.turnDurations = [];
  }

  /**
   * Process an array of JSONL events
   */
  transform(events) {
    if (!events || events.length === 0) {
      return this.getResult();
    }

    // Filter out sidechain (subagent) events — they belong to a separate logical
    // conversation and would inflate token counts and tool usage on the parent.
    const mainEvents = events.filter(e => !e.isSidechain);

    // Sort events by timestamp (stable enough for our purposes)
    mainEvents.sort((a, b) => {
      if (!a.timestamp) return 1;
      if (!b.timestamp) return -1;
      return new Date(a.timestamp) - new Date(b.timestamp);
    });

    // Extract conversation metadata
    this.extractConversation(mainEvents);

    // Process each event
    for (const event of mainEvents) {
      try {
        this.processEvent(event);
      } catch (err) {
        logger.error('transformer', `Error processing event in session ${this.sessionId}`, err);
      }
    }

    return this.getResult();
  }

  /**
   * Extract conversation-level metadata
   */
  extractConversation(events) {
    const firstEvent = events[0];
    const lastEvent = events[events.length - 1];

    // Branch: prefer any event with a real git branch; null if absent rather than
    // a fake "HEAD" sentinel (which pollutes branch-activity charts).
    const branchEvent = events.find(e => e.gitBranch && e.gitBranch !== 'HEAD');
    const fallbackBranchEvent = events.find(e => e.gitBranch);
    const branch = branchEvent?.gitBranch || fallbackBranchEvent?.gitBranch || null;

    const entrypointEvent = events.find(e => e.entrypoint);
    const entrypoint = entrypointEvent?.entrypoint || 'unknown';

    // Count turns by distinct promptId (real human-initiated prompts). Falls back
    // to non-tool-result user messages if promptId isn't present.
    const promptIds = new Set();
    let fallbackTurnCount = 0;
    for (const e of events) {
      if (e.type !== 'user') continue;
      if (this.isToolResultUserMessage(e)) continue;
      if (e.promptId) {
        promptIds.add(e.promptId);
      } else if (!this.isSyntheticUserMessage(e)) {
        fallbackTurnCount++;
      }
    }
    const totalTurns = promptIds.size > 0 ? promptIds.size : fallbackTurnCount;

    this.conversation = {
      id: this.sessionId,
      project_path: this.projectPath,
      project_dir: this.projectDir,
      branch,
      entrypoint,
      started_at: this.parseTimestamp(firstEvent.timestamp),
      ended_at: this.parseTimestamp(lastEvent.timestamp),
      total_turns: totalTurns,
      total_events: events.length
    };
  }

  /**
   * Synthetic user messages are CLI-injected text (slash commands, system reminders,
   * hooks) — not human prompts.
   */
  isSyntheticUserMessage(event) {
    if (event.type !== 'user') return false;
    const c = event.message?.content;
    const text = typeof c === 'string'
      ? c
      : Array.isArray(c)
        ? c.filter(i => i && i.type === 'text').map(i => i.text || '').join('')
        : '';
    if (!text) return false;
    return /^<(local-command|command-name|command-message|command-args|system-reminder|local-command-stdout|local-command-caveat)\b/.test(text.trimStart());
  }

  /**
   * Process a single JSONL event
   */
  processEvent(event) {
    const eventType = event.type;

    switch (eventType) {
      case 'assistant':
        this.processAssistantMessage(event);
        break;
      case 'user':
        this.processUserMessage(event);
        break;
      case 'system':
        this.processSystemEvent(event);
        break;
      default:
        // Ignore other event types (queue-operation, etc.)
        break;
    }
  }

  /**
   * Process assistant message
   */
  processAssistantMessage(event) {
    if (!event.uuid || !event.message) return;

    // Avoid duplicate messages
    if (this.seenMessageIds.has(event.uuid)) return;
    this.seenMessageIds.add(event.uuid);

    const message = event.message;
    const timestamp = this.parseTimestamp(event.timestamp);

    // Extract content preview
    const textContent = message.content
      ?.filter(c => c.type === 'text')
      .map(c => c.text)
      .join(' ');
    const contentPreview = textContent?.slice(0, 500) || '';

    // Check for tool use
    const toolUseItems = message.content?.filter(c => c.type === 'tool_use') || [];
    const hasToolUse = toolUseItems.length > 0 ? 1 : 0;

    // Extract token usage
    const usage = message.usage || {};
    const inputTokens = usage.input_tokens || 0;
    const outputTokens = usage.output_tokens || 0;
    const cacheCreationTokens = usage.cache_creation_input_tokens || 0;
    const cacheReadTokens = usage.cache_read_input_tokens || 0;

    // Create message record
    this.messages.push({
      id: event.uuid,
      conversation_id: this.sessionId,
      role: 'assistant',
      type: 'assistant',
      subtype: null,
      timestamp,
      model: message.model || null,
      stop_reason: message.stop_reason || null,
      content_preview: contentPreview,
      has_tool_use: hasToolUse,
      has_tool_result: 0,
      is_synthetic: 0,
      is_tool_error: 0,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cache_creation_tokens: cacheCreationTokens,
      cache_read_tokens: cacheReadTokens
    });

    // Process tool calls
    if (toolUseItems.length > 0) {
      this.processToolCalls(event.uuid, toolUseItems, timestamp);
    }
  }

  /**
   * Process user message
   */
  processUserMessage(event) {
    if (!event.uuid || !event.message) return;

    // Avoid duplicate messages
    if (this.seenMessageIds.has(event.uuid)) return;
    this.seenMessageIds.add(event.uuid);

    const message = event.message;
    const timestamp = this.parseTimestamp(event.timestamp);

    const isToolResult = this.isToolResultUserMessage(event);
    const isSynthetic = this.isSyntheticUserMessage(event);
    const isToolError = isToolResult && Array.isArray(message.content)
      && message.content.some(c => c && c.type === 'tool_result' && c.is_error === true);

    // Extract content preview
    let contentPreview = '';
    if (Array.isArray(message.content)) {
      const parts = [];
      for (const c of message.content) {
        if (!c) continue;
        if (c.type === 'text' && typeof c.text === 'string') {
          parts.push(c.text);
        } else if (c.type === 'tool_result') {
          // Surface a short, safe representation of tool results so previews show
          // SOMETHING when an assistant message is just tool output.
          if (typeof c.content === 'string') parts.push(c.content);
          else if (Array.isArray(c.content)) {
            for (const sub of c.content) {
              if (sub && sub.type === 'text' && typeof sub.text === 'string') parts.push(sub.text);
            }
          }
        }
      }
      contentPreview = parts.join(' ').slice(0, 500);
    } else if (typeof message.content === 'string') {
      contentPreview = message.content.slice(0, 500);
    }

    this.messages.push({
      id: event.uuid,
      conversation_id: this.sessionId,
      role: 'user',
      type: 'user',
      subtype: null,
      timestamp,
      model: null,
      stop_reason: null,
      content_preview: contentPreview,
      has_tool_use: 0,
      has_tool_result: isToolResult ? 1 : 0,
      is_synthetic: isSynthetic ? 1 : 0,
      is_tool_error: isToolError ? 1 : 0,
      input_tokens: 0,
      output_tokens: 0,
      cache_creation_tokens: 0,
      cache_read_tokens: 0
    });
  }

  /**
   * Process system event
   */
  processSystemEvent(event) {
    if (event.subtype === 'turn_duration') {
      const timestamp = this.parseTimestamp(event.timestamp);
      const durationMs = event.durationMs || 0;
      const turnIndex = event.turnIndex || 0;

      this.turnDurations.push({
        conversation_id: this.sessionId,
        turn_index: turnIndex,
        duration_ms: durationMs,
        timestamp
      });
    }
  }

  /**
   * Process tool calls from assistant message content
   */
  processToolCalls(messageId, toolUseItems, timestamp) {
    for (let i = 0; i < toolUseItems.length; i++) {
      const toolUse = toolUseItems[i];
      const toolName = toolUse.name;
      const toolInput = toolUse.input || {};

      // Generate unique ID for this tool call
      const toolCallId = this.generateToolCallId(messageId, toolName, i);

      // Avoid duplicates
      if (this.seenToolCallIds.has(toolCallId)) continue;
      this.seenToolCallIds.add(toolCallId);

      this.toolCalls.push({
        id: toolCallId,
        conversation_id: this.sessionId,
        message_id: messageId,
        tool_name: toolName,
        timestamp,
        input_json: JSON.stringify(toolInput)
      });

      // Track file operations
      this.trackFileOperation(toolCallId, toolName, toolInput, timestamp);
    }
  }

  /**
   * Track file operations (Edit, Read, Write)
   */
  trackFileOperation(toolCallId, toolName, toolInput, timestamp) {
    let operationType = null;
    let filePath = null;
    let linesAdded = 0;
    let linesRemoved = 0;

    switch (toolName) {
      case 'Read':
        operationType = 'read';
        filePath = toolInput.file_path;
        break;

      case 'Write':
        operationType = 'write';
        filePath = toolInput.file_path;
        if (toolInput.content) {
          linesAdded = toolInput.content.split('\n').length;
        }
        break;

      case 'Edit':
        operationType = 'edit';
        filePath = toolInput.file_path;
        if (toolInput.old_string && toolInput.new_string) {
          const oldLines = toolInput.old_string.split('\n').length;
          const newLines = toolInput.new_string.split('\n').length;
          linesRemoved = oldLines;
          linesAdded = newLines;
        }
        break;

      default:
        // Not a file operation
        return;
    }

    if (filePath) {
      this.fileOperations.push({
        conversation_id: this.sessionId,
        tool_call_id: toolCallId,
        operation_type: operationType,
        file_path: filePath,
        lines_added: linesAdded,
        lines_removed: linesRemoved,
        timestamp
      });
    }
  }

  /**
   * Check if user message contains tool results
   */
  isToolResultUserMessage(event) {
    if (event.type !== 'user') return false;
    const content = event.message?.content;
    if (!Array.isArray(content)) return false;
    return content.some(item => item && item.type === 'tool_result');
  }

  /**
   * Parse timestamp to Unix milliseconds
   */
  parseTimestamp(timestamp) {
    if (!timestamp) return Date.now();
    const date = new Date(timestamp);
    return date.getTime();
  }

  /**
   * Generate unique tool call ID
   */
  generateToolCallId(messageId, toolName, index) {
    const hash = crypto.createHash('md5')
      .update(`${messageId}-${toolName}-${index}`)
      .digest('hex')
      .slice(0, 16);
    return `tool-${hash}`;
  }

  /**
   * Get transformed result
   */
  getResult() {
    return {
      conversation: this.conversation,
      messages: this.messages,
      toolCalls: this.toolCalls,
      fileOperations: this.fileOperations,
      turnDurations: this.turnDurations
    };
  }
}

/**
 * Transform JSONL file into database records.
 *
 * Project name is derived from the modal `cwd` across events when available,
 * falling back to the encoded directory name (which can corrupt hyphens).
 *
 * @param {string} filePath - Path to JSONL file
 * @param {Array} events - Parsed JSONL events
 * @param {string} projectDir - Directory name (e.g., "-Users-tirthp-Personal-claude-dashboard")
 * @param {string} [projectPathHint] - Optional override for the display path
 * @returns {Object|null}
 */
export function transformJSONLFile(filePath, events, projectDir, projectPathHint) {
  if (!events || events.length === 0) {
    return null;
  }

  const sessionId = events[0]?.sessionId ||
                   filePath.match(/([a-f0-9-]{36})\.jsonl$/)?.[1] ||
                   'unknown-session';

  const cwd = pickPrimaryCwd(events);
  const projectPath = projectPathHint
    || deriveProjectNameFromCwd(cwd)
    || getProjectName(projectDir);

  const transformer = new EventTransformer(sessionId, projectPath, projectDir);
  return transformer.transform(events);
}
