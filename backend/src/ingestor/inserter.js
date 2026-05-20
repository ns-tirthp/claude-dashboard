import db, {
  insertConversation,
  insertMessage,
  insertToolCall,
  insertFileOperation,
  insertTurnDuration,
  upsertIngestionMetadata,
  transaction
} from '../database/dashboard.db.js';
import logger from '../lib/logger.js';

/**
 * Batch insert transformed records into database
 */
export class BatchInserter {
  constructor() {
    this.stats = {
      conversations: 0,
      messages: 0,
      toolCalls: 0,
      fileOperations: 0,
      turnDurations: 0,
      errors: 0
    };
  }

  /**
   * Insert a single session's data
   */
  insertSession(data) {
    if (!data || !data.conversation) {
      return false;
    }

    try {
      transaction(() => {
        // Insert conversation
        if (data.conversation) {
          this.insertConversationRecord(data.conversation);
        }

        // Insert messages
        if (data.messages && data.messages.length > 0) {
          this.insertMessages(data.messages);
        }

        // Insert tool calls
        if (data.toolCalls && data.toolCalls.length > 0) {
          this.insertToolCalls(data.toolCalls);
        }

        // Insert file operations
        if (data.fileOperations && data.fileOperations.length > 0) {
          this.insertFileOperations(data.fileOperations);
        }

        // Insert turn durations
        if (data.turnDurations && data.turnDurations.length > 0) {
          this.insertTurnDurations(data.turnDurations);
        }
      });

      return true;
    } catch (err) {
      this.stats.errors++;
      logger.error('inserter', `Error inserting session ${data.conversation.id}`, { error: err.message });
      return false;
    }
  }

  /**
   * Insert conversation record
   */
  insertConversationRecord(conversation) {
    try {
      insertConversation.run(
        conversation.id,
        conversation.project_path,
        conversation.project_dir,
        conversation.branch,
        conversation.entrypoint,
        conversation.started_at,
        conversation.ended_at,
        conversation.total_turns,
        conversation.total_events
      );
      this.stats.conversations++;
    } catch (err) {
      logger.error('inserter', `Error inserting conversation ${conversation.id}`, { error: err.message });
      throw err;
    }
  }

  /**
   * Insert messages in batch
   */
  insertMessages(messages) {
    for (const msg of messages) {
      try {
        insertMessage.run(
          msg.id,
          msg.conversation_id,
          msg.role,
          msg.type,
          msg.subtype,
          msg.timestamp,
          msg.model,
          msg.stop_reason,
          msg.content_preview,
          msg.has_tool_use,
          msg.has_tool_result,
          msg.is_synthetic ? 1 : 0,
          msg.is_tool_error ? 1 : 0,
          msg.input_tokens,
          msg.output_tokens,
          msg.cache_creation_tokens,
          msg.cache_read_tokens
        );
        this.stats.messages++;
      } catch (err) {
        if (!err.message.includes('UNIQUE constraint')) {
          logger.error('inserter', `Error inserting message ${msg.id}`, { error: err.message });
        }
      }
    }
  }

  /**
   * Insert tool calls in batch
   */
  insertToolCalls(toolCalls) {
    for (const tc of toolCalls) {
      try {
        insertToolCall.run(
          tc.id,
          tc.conversation_id,
          tc.message_id,
          tc.tool_name,
          tc.timestamp,
          tc.input_json
        );
        this.stats.toolCalls++;
      } catch (err) {
        if (!err.message.includes('UNIQUE constraint')) {
          logger.error('inserter', `Error inserting tool call ${tc.id}`, { error: err.message });
        }
      }
    }
  }

  /**
   * Insert file operations in batch
   */
  insertFileOperations(fileOps) {
    for (const op of fileOps) {
      try {
        insertFileOperation.run(
          op.conversation_id,
          op.tool_call_id,
          op.operation_type,
          op.file_path,
          op.lines_added,
          op.lines_removed,
          op.timestamp
        );
        this.stats.fileOperations++;
      } catch (err) {
        logger.error('inserter', 'Error inserting file operation', { error: err.message });
      }
    }
  }

  /**
   * Insert turn durations in batch
   */
  insertTurnDurations(durations) {
    for (const dur of durations) {
      try {
        insertTurnDuration.run(
          dur.conversation_id,
          dur.turn_index,
          dur.duration_ms,
          dur.timestamp
        );
        this.stats.turnDurations++;
      } catch (err) {
        if (!err.message.includes('UNIQUE constraint')) {
          logger.error('inserter', 'Error inserting turn duration', { error: err.message });
        }
      }
    }
  }

  /**
   * Get insertion statistics
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      conversations: 0,
      messages: 0,
      toolCalls: 0,
      fileOperations: 0,
      turnDurations: 0,
      errors: 0
    };
  }
}

/**
 * Track ingestion metadata for a file
 */
export function trackIngestion(filePath, checksum, lastEventTimestamp, status = 'success', errorMessage = null) {
  try {
    upsertIngestionMetadata.run(
      'jsonl',
      filePath,
      Date.now(),
      lastEventTimestamp,
      checksum,
      status,
      errorMessage
    );
  } catch (err) {
    logger.error('inserter', `Error tracking ingestion metadata for ${filePath}`, { error: err.message });
  }
}

/**
 * Convenience function to insert a single file's data
 */
export function insertJSONLFile(filePath, transformedData, checksum) {
  if (!transformedData) {
    logger.warn('inserter', `No data to insert for ${filePath}`);
    return false;
  }

  const inserter = new BatchInserter();
  const success = inserter.insertSession(transformedData);

  // Track ingestion
  const lastEventTimestamp = transformedData.conversation?.ended_at || Date.now();
  trackIngestion(
    filePath,
    checksum,
    lastEventTimestamp,
    success ? 'success' : 'error',
    success ? null : 'Failed to insert data'
  );

  const stats = inserter.getStats();
  logger.info('inserter', `Ingested ${filePath}`, {
    conversations: stats.conversations,
    messages: stats.messages,
    toolCalls: stats.toolCalls,
    fileOperations: stats.fileOperations,
    turnDurations: stats.turnDurations,
  });

  return success;
}

export default BatchInserter;
