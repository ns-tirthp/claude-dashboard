# Parsing Accuracy Fixes

## Issues Fixed (2026-05-19)

### 1. ✅ Tool Call Parsing - FIXED
**Problem:** Code was checking for `event.type === 'tool_use'` which doesn't exist in the JSONL format.

**Fix:** Changed to only parse tool calls from `event.type === 'assistant'` messages with content arrays containing `tool_use` blocks.

**Before:**
```javascript
if (event.type === 'tool_use' || (event.message && event.message.content)) {
  const content = event.message?.content || [];
  // ...
}
```

**After:**
```javascript
if (event.type === 'assistant' && event.message && event.message.content) {
  const content = event.message.content;
  // ...
}
```

### 2. ✅ Message Deduplication - FIXED
**Problem:** Multiple assistant events can have the same UUID (streaming chunks, retries). Without deduplication, model usage and tokens were potentially overcounted.

**Fix:** Added UUID tracking to count each unique assistant message only once.

**Implementation:**
```javascript
const seenMessageIds = new Set();
// ...
if (event.type === 'assistant' && event.message && event.message.model && event.uuid) {
  if (!seenMessageIds.has(event.uuid)) {
    seenMessageIds.add(event.uuid);
    // Count model usage and tokens here
  }
}
```

**Impact:** Prevents duplicate counting of model usage and token metrics.

### 3. ✅ Token Aggregation - VALIDATED
**Status:** Already correct, but now protected by deduplication.

Token fields correctly parsed:
- `input_tokens`
- `output_tokens`
- `cache_creation_input_tokens`
- `cache_read_input_tokens`

### 4. ✅ Time Tracking - VALIDATED
**Status:** Already correct.

Uses `turn_duration` system events which represent actual wall-clock time per Claude turn. This is the correct metric for "time spent with Claude."

```javascript
if (event.type === 'system' && event.subtype === 'turn_duration') {
  const durationMs = event.durationMs || 0;
  // Aggregate time
}
```

### 5. ✅ Conversation Counting - VALIDATED
**Status:** Already correct.

Each `.jsonl` file represents one session. Counting files = counting conversations is accurate.

## Validation Results

### Test Project: `-Users-tirthp-Personal-claude-dashboard`
- **Sessions tested:** 5
- **Total assistant events:** 91
- **Unique UUIDs:** 91
- **Duplicates found:** 0
- **Duplication rate:** 0.0%

### Conclusion
No duplicate events found in current data, but deduplication logic added as safety measure for edge cases (streaming, retries, etc.).

## What Remains Accurate

✅ **Conversation counts** - 1 JSONL file = 1 session  
✅ **Time tracking** - Uses turn_duration system events  
✅ **Token aggregation** - Correctly sums all token types  
✅ **Timestamp tracking** - Accurate last activity and timelines  
✅ **Branch/entrypoint stats** - Properly tracked  

## What Was Fixed

🔧 **Tool call parsing** - Now only parses from assistant messages  
🔧 **Model usage counting** - Deduplicates by UUID  
🔧 **Token counting** - Protected against duplicate accumulation  

## New Features Ready to Build

With accurate parsing, we can now confidently add:
- Cost calculators (tokens are accurate)
- Tool efficiency metrics (tool counts are accurate)
- Time-based analytics (duration is accurate)
- Token optimization suggestions (cache metrics are accurate)

## Files Modified

- `backend/server.js` - Updated `getStatistics()` function (lines 94-197)
- `backend/validate-parsing.js` - New validation script

## Testing

Run validation script:
```bash
cd backend
node validate-parsing.js
```

Check API response:
```bash
curl http://localhost:3001/api/stats | jq '.projects[0]'
```
