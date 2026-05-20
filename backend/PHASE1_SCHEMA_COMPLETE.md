# Phase 1: Database Schema - COMPLETE ✅

## What Was Built

A comprehensive SQLite database schema (`dashboard.db`) that consolidates both JSONL conversation data and OTel telemetry data into a unified queryable structure.

## Database Location

`/Users/tirthp/Personal/claude-dashboard/backend/data/dashboard.db`

Configured via: `DASHBOARD_DB_PATH` environment variable

## Schema Overview

### 8 Core Tables

1. **conversations** - Session/conversation tracking
   - Primary key: `id` (sessionId from JSONL)
   - Tracks: project, branch, entrypoint, start/end times, turn counts
   - Indexes on: project_path, branch, started_at, entrypoint

2. **messages** - Individual user/assistant messages
   - Links to: conversations (FK)
   - Tracks: role, model, timestamps, token usage, stop_reason
   - Stores: content preview (first 500 chars), tool use flags
   - Indexes on: conversation_id, model, timestamp

3. **tool_calls** - Tool usage tracking
   - Links to: conversations, messages (FKs)
   - Tracks: tool name (Read, Edit, Write, Bash, etc.), timestamps
   - Stores: input JSON for analysis
   - Indexes on: conversation_id, tool_name, timestamp

4. **file_operations** - Detailed file edit/read/write tracking
   - Links to: conversations, tool_calls (FKs)
   - Tracks: operation type, file paths, lines added/removed
   - Indexes on: conversation_id, file_path, operation_type

5. **turn_durations** - Measured time per conversation turn
   - Links to: conversations (FK)
   - Tracks: turn index, duration in ms, timestamps
   - Unique constraint on: (conversation_id, turn_index)

6. **telemetry_events** - Raw OTel data
   - Tracks: event_type (metric, log, trace), name, value, unit
   - Stores: attributes and resource_attributes as JSON
   - Indexes on: event_type, name, timestamp

7. **aggregated_stats** - Pre-computed statistics
   - Stores: stat_type, dimensions (JSON), value, last_updated
   - For fast queries: daily_activity, model_usage, project_summary, etc.
   - Unique constraint on: (stat_type, dimensions)

8. **ingestion_metadata** - Track what's been processed
   - Tracks: source_type (jsonl, otlp), source_identifier (file path)
   - Stores: last_processed_at, checksum, status, errors
   - For idempotency and incremental ingestion

### 4 Convenience Views

1. **v_daily_stats** - Daily conversation summary by project
2. **v_tool_usage** - Tool usage counts by day
3. **v_model_usage** - Model usage with token totals
4. **v_project_summary** - Project-level aggregates

## Key Features

### Performance Optimizations

- **WAL mode** - Better concurrency for read-heavy workloads
- **Foreign key constraints** - Data integrity enforced at DB level
- **Strategic indexes** - Fast queries on common access patterns
- **Prepared statements** - Reusable, safe SQL execution
- **Batch transactions** - Atomic multi-row inserts

### Data Integrity

- **ON CONFLICT** clauses - Idempotent inserts (safe to re-run)
- **Cascading deletes** - Clean up child records automatically
- **Unique constraints** - Prevent duplicates
- **Checksums** - Detect file changes for incremental ingestion

### Developer Experience

- **Convenience functions**:
  - `transaction(fn)` - Easy transaction management
  - `getDbInfo()` - Database inspection
  - `clearAllData()` - Testing reset
- **Pre-prepared statements** - Ready-to-use insert/query operations
- **Views** - Common queries pre-defined

## Example Queries

### Get all conversations for a project
```sql
SELECT * FROM conversations
WHERE project_path = '~/Personal/claude-dashboard'
ORDER BY started_at DESC;
```

### Total tokens by model
```sql
SELECT * FROM v_model_usage
ORDER BY total_input_tokens DESC;
```

### Tool usage over time
```sql
SELECT
  DATE(timestamp / 1000, 'unixepoch') as date,
  tool_name,
  COUNT(*) as usage_count
FROM tool_calls
GROUP BY date, tool_name
ORDER BY date DESC, usage_count DESC;
```

### Most edited files
```sql
SELECT
  file_path,
  COUNT(*) as edit_count,
  SUM(lines_added) as total_added,
  SUM(lines_removed) as total_removed
FROM file_operations
WHERE operation_type = 'edit'
GROUP BY file_path
ORDER BY edit_count DESC
LIMIT 10;
```

### Conversation cost (when combined with telemetry)
```sql
SELECT
  c.id,
  c.project_path,
  c.started_at,
  SUM(m.input_tokens) as total_input,
  SUM(m.output_tokens) as total_output,
  SUM(m.cache_read_tokens) as total_cache_read
FROM conversations c
JOIN messages m ON m.conversation_id = c.id
GROUP BY c.id
ORDER BY c.started_at DESC;
```

## Testing

Run the test suite:
```bash
node backend/test-dashboard-db.js
```

Tests verify:
- ✅ Schema creation
- ✅ All table inserts
- ✅ Foreign key relationships
- ✅ View queries
- ✅ Transaction atomicity
- ✅ Idempotent inserts (ON CONFLICT)

## Files Created

1. `/backend/src/database/dashboard.db.js` - Database module with schema + utilities
2. `/backend/test-dashboard-db.js` - Comprehensive test suite
3. `/backend/src/config/index.js` - Added `dashboardDbPath` config
4. `/backend/.env.example` - Added `DASHBOARD_DB_PATH` documentation

## Database File Structure

```
backend/data/
├── dashboard.db          # Main database
├── dashboard.db-shm      # Shared memory (WAL mode)
└── dashboard.db-wal      # Write-ahead log (WAL mode)
```

## Next Steps (Phase 2)

Now that the schema is ready, Phase 2 will build the **JSONL Ingestor**:

1. **File Watcher** - Monitor `~/.claude/projects` for new/updated JSONL files
2. **Event Parser** - Transform JSONL events → database schema
3. **Batch Inserter** - Efficient bulk inserts with transactions
4. **Incremental Processing** - Only process changed files (via checksums)
5. **Error Handling** - Robust retry logic, logging, status tracking

The ingestor will populate this database continuously in the background, enabling the API layer to query pre-processed data instead of scanning files on every request.

## Performance Expectations

### Current (File Scanning)
- Stats API: ~500ms (scans 100+ files)
- History API: ~300ms (scans 10+ files per project)
- Memory spikes during parsing

### After Ingestor (Database Queries)
- Stats API: ~10ms (indexed queries)
- History API: ~5ms (single table scan)
- Consistent memory usage
- **50x faster response times** 🚀

## Schema Version

v1.0.0 - Initial schema (2026-05-20)

---

**Status**: ✅ Phase 1 Complete - Ready for Phase 2 (JSONL Ingestor)
