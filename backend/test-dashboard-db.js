#!/usr/bin/env node

import db, {
  insertConversation,
  insertMessage,
  insertToolCall,
  insertFileOperation,
  insertTurnDuration,
  getDbInfo,
  transaction,
  clearAllData
} from './src/database/dashboard.db.js';

console.log('\n=== Testing Dashboard Database ===\n');

// Clear previous test data
clearAllData();

// Test 1: Insert a conversation
console.log('Test 1: Inserting conversation...');
transaction(() => {
  insertConversation.run(
    'test-session-001',                           // id
    '~/Personal/claude-dashboard',                // project_path
    '-Users-tirthp-Personal-claude-dashboard',    // project_dir
    'main',                                       // branch
    'cli',                                        // entrypoint
    Date.now(),                                   // started_at
    Date.now() + 300000,                          // ended_at (5 min later)
    5,                                            // total_turns
    42                                            // total_events
  );
});
console.log('✓ Conversation inserted');

// Test 2: Insert messages
console.log('\nTest 2: Inserting messages...');
transaction(() => {
  const now = Date.now();

  // User message
  insertMessage.run(
    'msg-001',                    // id
    'test-session-001',           // conversation_id
    'user',                       // role
    'user',                       // type
    null,                         // subtype
    now,                          // timestamp
    null,                         // model
    null,                         // stop_reason
    'Hello, can you help me refactor this code?', // content_preview
    0,                            // has_tool_use
    0,                            // has_tool_result
    0, 0, 0, 0                    // tokens
  );

  // Assistant message with tool use
  insertMessage.run(
    'msg-002',                    // id
    'test-session-001',           // conversation_id
    'assistant',                  // role
    'assistant',                  // type
    null,                         // subtype
    now + 1000,                   // timestamp
    'claude-sonnet-4-5-20250929', // model
    'tool_use',                   // stop_reason
    "I'll help you refactor the code. Let me read the file first.", // content_preview
    1,                            // has_tool_use
    0,                            // has_tool_result
    1500,                         // input_tokens
    250,                          // output_tokens
    8000,                         // cache_creation_tokens
    0                             // cache_read_tokens
  );
});
console.log('✓ Messages inserted');

// Test 3: Insert tool calls
console.log('\nTest 3: Inserting tool calls...');
transaction(() => {
  const now = Date.now() + 1000;

  insertToolCall.run(
    'tool-001',                   // id
    'test-session-001',           // conversation_id
    'msg-002',                    // message_id
    'Read',                       // tool_name
    now,                          // timestamp
    JSON.stringify({ file_path: '/Users/tirthp/test.js' }) // input_json
  );

  insertToolCall.run(
    'tool-002',
    'test-session-001',
    'msg-002',
    'Edit',
    now + 2000,
    JSON.stringify({
      file_path: '/Users/tirthp/test.js',
      old_string: 'const x = 1;',
      new_string: 'const x = 2;'
    })
  );
});
console.log('✓ Tool calls inserted');

// Test 4: Insert file operations
console.log('\nTest 4: Inserting file operations...');
transaction(() => {
  const now = Date.now() + 1000;

  insertFileOperation.run(
    'test-session-001',           // conversation_id
    'tool-001',                   // tool_call_id
    'read',                       // operation_type
    '/Users/tirthp/test.js',      // file_path
    0,                            // lines_added
    0,                            // lines_removed
    now                           // timestamp
  );

  insertFileOperation.run(
    'test-session-001',
    'tool-002',
    'edit',
    '/Users/tirthp/test.js',
    1,                            // lines_added
    1,                            // lines_removed
    now + 2000
  );
});
console.log('✓ File operations inserted');

// Test 5: Insert turn duration
console.log('\nTest 5: Inserting turn durations...');
transaction(() => {
  insertTurnDuration.run(
    'test-session-001',           // conversation_id
    1,                            // turn_index
    45000,                        // duration_ms (45 seconds)
    Date.now()                    // timestamp
  );

  insertTurnDuration.run(
    'test-session-001',
    2,
    32000,                        // 32 seconds
    Date.now() + 45000
  );
});
console.log('✓ Turn durations inserted');

// Test 6: Query data
console.log('\n=== Querying Data ===\n');

console.log('Conversations:');
const conversations = db.prepare('SELECT * FROM conversations').all();
console.log(JSON.stringify(conversations, null, 2));

console.log('\nMessages:');
const messages = db.prepare('SELECT id, role, model, input_tokens, output_tokens FROM messages').all();
console.log(JSON.stringify(messages, null, 2));

console.log('\nTool Calls:');
const toolCalls = db.prepare('SELECT tool_name, COUNT(*) as count FROM tool_calls GROUP BY tool_name').all();
console.log(JSON.stringify(toolCalls, null, 2));

console.log('\nFile Operations:');
const fileOps = db.prepare('SELECT operation_type, COUNT(*) as count FROM file_operations GROUP BY operation_type').all();
console.log(JSON.stringify(fileOps, null, 2));

console.log('\nTurn Durations:');
const durations = db.prepare('SELECT turn_index, duration_ms FROM turn_durations ORDER BY turn_index').all();
console.log(JSON.stringify(durations, null, 2));

// Test 7: Test views
console.log('\n=== Testing Views ===\n');

console.log('v_tool_usage:');
const toolUsage = db.prepare('SELECT * FROM v_tool_usage').all();
console.log(JSON.stringify(toolUsage, null, 2));

console.log('\nv_model_usage:');
const modelUsage = db.prepare('SELECT * FROM v_model_usage').all();
console.log(JSON.stringify(modelUsage, null, 2));

console.log('\nv_project_summary:');
const projectSummary = db.prepare('SELECT * FROM v_project_summary').all();
console.log(JSON.stringify(projectSummary, null, 2));

// Test 8: Database info
console.log('\n=== Database Info ===\n');
const info = getDbInfo();
console.log(JSON.stringify(info, null, 2));

console.log('\n✅ All tests passed!\n');
