# Testing Checklist: Recommendations Feature

## Pre-Flight Checks

- [ ] Node.js version >= 18
- [ ] SQLite3 installed
- [ ] Backend dependencies installed (`npm install` in `/backend`)
- [ ] Frontend dependencies installed (`npm install` in `/frontend`)
- [ ] Data directory exists and is writable: `mkdir -p backend/data && chmod 755 backend/data`

## Backend Tests

### 1. Database Initialization

```bash
# Start backend
cd backend
npm start

# Check if analytics.db was created
ls -la data/analytics.db

# Expected: File exists, size > 0
```

**✅ Pass criteria:** Analytics database file exists

### 2. Database Schema

```bash
# Verify tables were created
sqlite3 data/analytics.db ".tables"

# Expected output:
# patterns
# recommendations  
# project_health
# session_analysis
# cross_project_insights
```

**✅ Pass criteria:** All 5 tables exist

### 3. API Endpoints

#### Health Check
```bash
curl http://localhost:3001/api/analytics/dashboard
```
**✅ Pass criteria:** Returns JSON with stats (even if empty)

#### Run Analysis
```bash
curl -X POST http://localhost:3001/api/analytics/analyze \
  -H "Content-Type: application/json" \
  -d '{"daysBack": 30}'
```
**✅ Pass criteria:** Returns `{"success": true, "patterns_detected": N, "recommendations_generated": N}`

#### Get Dashboard
```bash
curl http://localhost:3001/api/analytics/dashboard
```
**✅ Pass criteria:** Returns stats, top_patterns, urgent_projects

#### Get Recommendations
```bash
# Replace with actual project path
curl "http://localhost:3001/api/analytics/projects/Users/tirthp/sase-ui/recommendations"
```
**✅ Pass criteria:** Returns recommendations array (or empty array)

#### Get Patterns
```bash
curl "http://localhost:3001/api/analytics/projects/Users/tirthp/sase-ui/patterns"
```
**✅ Pass criteria:** Returns patterns array

### 4. Pattern Detection

**Test with mock data:**

```bash
# Insert test tool failure
sqlite3 backend/data/telemetry.db << EOF
INSERT INTO tool_calls (id, session_id, prompt_id, tool_name, result, timestamp, project_path)
VALUES 
  ('test1', 'session1', 'prompt1', 'Bash', 'error', unixepoch(), '/test/project'),
  ('test2', 'session1', 'prompt2', 'Bash', 'error', unixepoch(), '/test/project'),
  ('test3', 'session1', 'prompt3', 'Bash', 'error', unixepoch(), '/test/project'),
  ('test4', 'session1', 'prompt4', 'Bash', 'error', unixepoch(), '/test/project');
EOF

# Run analysis
curl -X POST http://localhost:3001/api/analytics/analyze \
  -H "Content-Type: application/json" \
  -d '{"projectPath": "/test/project", "daysBack": 1}'

# Check if pattern was detected
sqlite3 backend/data/analytics.db "SELECT * FROM patterns WHERE project_path='/test/project';"
```

**✅ Pass criteria:** At least 1 pattern detected for tool failures

### 5. Recommendation Generation

```bash
# Check if recommendations were created
sqlite3 backend/data/analytics.db "SELECT id, title, priority FROM recommendations LIMIT 5;"
```

**✅ Pass criteria:** Recommendations exist with action_items

### 6. Apply/Dismiss Workflow

```bash
# Get a recommendation ID
REC_ID=$(sqlite3 backend/data/analytics.db "SELECT id FROM recommendations LIMIT 1;")

# Apply it
curl -X POST "http://localhost:3001/api/analytics/recommendations/$REC_ID/apply"

# Check status changed
sqlite3 backend/data/analytics.db "SELECT status FROM recommendations WHERE id=$REC_ID;"
# Expected: applied

# Dismiss another
REC_ID2=$(sqlite3 backend/data/analytics.db "SELECT id FROM recommendations WHERE status='pending' LIMIT 1;")
curl -X POST "http://localhost:3001/api/analytics/recommendations/$REC_ID2/dismiss" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Not applicable"}'

# Check status changed
sqlite3 backend/data/analytics.db "SELECT status, dismissed_reason FROM recommendations WHERE id=$REC_ID2;"
# Expected: dismissed, Not applicable
```

**✅ Pass criteria:** Status updates work correctly

### 7. CLI Script

```bash
cd backend

# Run analyzer
node src/scripts/analyze-patterns.js

# Expected output:
# 🔍 Starting pattern analysis...
# ✅ Analysis complete!
# 📊 Summary: ...
```

**✅ Pass criteria:** Script runs without errors, shows summary

### 8. Error Handling

```bash
# Invalid project path
curl "http://localhost:3001/api/analytics/projects//recommendations"
# Should return 404 or empty array, not crash

# Invalid recommendation ID
curl -X POST "http://localhost:3001/api/analytics/recommendations/99999/apply"
# Should return error message, not crash

# Missing body
curl -X POST http://localhost:3001/api/analytics/analyze
# Should use defaults or return validation error
```

**✅ Pass criteria:** No server crashes, graceful error messages

## Frontend Tests

### 1. Component Renders

```bash
cd frontend
npm run dev

# Open http://localhost:3000
# Navigate to Recommendations tab (if integrated)
```

**✅ Pass criteria:** Component loads without console errors

### 2. UI Elements Present

- [ ] Header: "AI Recommendations"
- [ ] "Run Analysis" button
- [ ] Stats cards: Pending, Active Patterns, Applied
- [ ] Filter buttons: All, Urgent, High, Documentation, Optimization
- [ ] Recommendations list (or empty state)

### 3. Run Analysis Button

**Action:** Click "Run Analysis" button

**✅ Pass criteria:**
- Button shows spinner and "Analyzing..." text
- After completion, recommendations list updates
- Button returns to normal state

### 4. Filter Buttons

**Action:** Click each filter button

**✅ Pass criteria:**
- Active filter changes styling (highlighted)
- Recommendations list filters accordingly
- Count in parentheses matches filtered results

### 5. Expandable Cards

**Action:** Click on a recommendation card

**✅ Pass criteria:**
- Card expands to show action items
- Chevron icon flips (down → up)
- Action items show with step numbers
- "Mark as Applied" and "Dismiss" buttons appear

### 6. Apply Recommendation

**Action:** Expand card, click "Mark as Applied"

**✅ Pass criteria:**
- Card disappears from pending list
- "Applied" stat increments
- Re-loading page doesn't show it again

### 7. Dismiss Recommendation

**Action:** Expand card, click "Dismiss"

**✅ Pass criteria:**
- Prompt appears asking for reason
- After entering reason, card disappears
- Can view dismissed recommendations by changing status filter (if implemented)

### 8. Empty States

**Test scenarios:**
1. No recommendations yet
2. All recommendations applied
3. Filtered category has no items

**✅ Pass criteria:** Appropriate empty state message for each

### 9. Responsive Design

**Action:** Resize browser window

**✅ Pass criteria:**
- Layout adapts to small screens
- Cards remain readable
- Buttons don't overflow
- Filter buttons wrap if needed

### 10. Loading States

**Action:** Slow down network (Chrome DevTools → Network → Slow 3G)

**✅ Pass criteria:**
- Loading spinner shows while fetching
- No flash of wrong content
- Error message if request fails

## Integration Tests

### 1. Backend → Database

```bash
# Start backend
cd backend && npm start

# Run analysis via API
curl -X POST http://localhost:3001/api/analytics/analyze \
  -H "Content-Type: application/json" \
  -d '{"daysBack": 30}'

# Verify data in DB
sqlite3 data/analytics.db "SELECT COUNT(*) FROM patterns;"
sqlite3 data/analytics.db "SELECT COUNT(*) FROM recommendations;"
```

**✅ Pass criteria:** Data is stored in analytics.db

### 2. Frontend → Backend → Database

```bash
# Start both frontend and backend
# Use UI to run analysis
# Check DB for new entries

sqlite3 backend/data/analytics.db "SELECT * FROM patterns ORDER BY created_at DESC LIMIT 1;"
```

**✅ Pass criteria:** UI actions persist to database

### 3. Real Telemetry Data

**If you have actual Claude Code telemetry:**

```bash
# Check telemetry exists
sqlite3 backend/data/telemetry.db "SELECT COUNT(*) FROM tool_calls;"
# Should return > 0

# Run full analysis
curl -X POST http://localhost:3001/api/analytics/analyze \
  -H "Content-Type: application/json" \
  -d '{"daysBack": 30}'

# Check realistic patterns were found
curl http://localhost:3001/api/analytics/dashboard | jq .
```

**✅ Pass criteria:** Realistic patterns detected from your actual usage

## Performance Tests

### 1. Large Dataset

```bash
# If you have months of telemetry data
time curl -X POST http://localhost:3001/api/analytics/analyze \
  -H "Content-Type: application/json" \
  -d '{"daysBack": 90}'
```

**✅ Pass criteria:** Completes in < 30 seconds

### 2. Many Recommendations

```bash
# Check query performance
time curl "http://localhost:3001/api/analytics/projects/YOUR_PROJECT/recommendations"
```

**✅ Pass criteria:** Returns in < 2 seconds

### 3. Dashboard Summary

```bash
time curl http://localhost:3001/api/analytics/dashboard
```

**✅ Pass criteria:** Returns in < 1 second

## Edge Cases

### 1. Empty Telemetry

```bash
# Point to empty telemetry DB or fresh install
# Run analysis
curl -X POST http://localhost:3001/api/analytics/analyze \
  -H "Content-Type: application/json" \
  -d '{"daysBack": 30}'
```

**✅ Pass criteria:** No errors, returns 0 patterns/recommendations

### 2. Project with Special Characters

```bash
curl "http://localhost:3001/api/analytics/projects/Users/name%20with%20spaces/project/recommendations"
```

**✅ Pass criteria:** Handles URL encoding correctly

### 3. Concurrent Requests

```bash
# Run multiple analyses in parallel
for i in {1..5}; do
  curl -X POST http://localhost:3001/api/analytics/analyze \
    -H "Content-Type: application/json" \
    -d '{"daysBack": 30}' &
done
wait
```

**✅ Pass criteria:** All complete successfully, no database locks

### 4. Interrupted Analysis

```bash
# Start analysis
curl -X POST http://localhost:3001/api/analytics/analyze \
  -H "Content-Type: application/json" \
  -d '{"daysBack": 90}' &
PID=$!

# Kill it mid-way
sleep 2 && kill $PID

# Run again
curl -X POST http://localhost:3001/api/analytics/analyze \
  -H "Content-Type: application/json" \
  -d '{"daysBack": 90}'
```

**✅ Pass criteria:** Second run completes successfully

## Security Tests

### 1. SQL Injection

```bash
# Try SQL injection in project path
curl "http://localhost:3001/api/analytics/projects/'; DROP TABLE patterns;--/recommendations"
```

**✅ Pass criteria:** No SQL executed, safe handling

### 2. XSS in Recommendations

**Action:** If recommendations contain user-generated content, verify HTML is escaped in UI

**✅ Pass criteria:** No script execution from recommendation text

### 3. File Path Traversal

```bash
curl "http://localhost:3001/api/analytics/projects/../../etc/passwd/recommendations"
```

**✅ Pass criteria:** Rejected or sanitized

## Documentation Tests

- [ ] README updated with recommendations feature
- [ ] API docs include new endpoints
- [ ] Component usage documented
- [ ] Database schema documented
- [ ] Setup instructions clear
- [ ] Troubleshooting section helpful

## Final Smoke Test

**Full end-to-end flow:**

1. Fresh start (rm backend/data/analytics.db)
2. Start backend
3. Run analysis via API
4. Check patterns created
5. Check recommendations generated
6. Start frontend
7. Navigate to recommendations
8. View recommendations
9. Expand a card
10. Mark as applied
11. Verify it's gone from pending
12. Run analysis again
13. Verify no duplicate recommendations

**✅ Pass criteria:** Entire flow works without errors

## Test Results Summary

| Category | Tests Passed | Tests Failed | Notes |
|----------|--------------|--------------|-------|
| Backend | __/8 | __/8 | |
| Frontend | __/10 | __/10 | |
| Integration | __/3 | __/3 | |
| Performance | __/3 | __/3 | |
| Edge Cases | __/4 | __/4 | |
| Security | __/3 | __/3 | |
| Documentation | __/6 | __/6 | |
| **Total** | **__/37** | **__/37** | |

## Known Issues

List any issues found during testing:

1. 
2. 
3. 

## Next Steps

After passing all tests:

- [ ] Deploy to production
- [ ] Set up monitoring
- [ ] Configure automated analysis (cron)
- [ ] Announce feature to users
- [ ] Collect feedback
- [ ] Plan Phase 2 features

---

**Testing completed by:** _______________  
**Date:** _______________  
**Ready for production:** ☐ Yes ☐ No ☐ Needs fixes
