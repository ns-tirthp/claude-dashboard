# Recommendations System Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         DATA SOURCES                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐    │
│  │  Telemetry DB   │  │  Dashboard DB   │  │   JSONL Files   │    │
│  │  (telemetry.db) │  │ (dashboard.db)  │  │  (sessions/)    │    │
│  │                 │  │                 │  │                 │    │
│  │ • tool_calls    │  │ • conversations │  │ • Raw sessions  │    │
│  │ • prompts       │  │ • projects      │  │ • Tool history  │    │
│  │ • sessions      │  │ • metrics       │  │                 │    │
│  │ • errors        │  │                 │  │                 │    │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘    │
│           │                     │                     │             │
└───────────┼─────────────────────┼─────────────────────┼─────────────┘
            │                     │                     │
            └─────────────┬───────┴──────────┬──────────┘
                          ▼                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     ANALYSIS LAYER                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │           Pattern Detector (pattern-detector.js)              │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │                                                               │  │
│  │  ┌───────────────────────────────────────────────────────┐  │  │
│  │  │  1. Tool Failure Detector                             │  │  │
│  │  │     • Finds: Repeated command errors                  │  │  │
│  │  │     • Example: Bash "command not found" 8x            │  │  │
│  │  │     • SQL: GROUP BY tool + error_type, HAVING >=3     │  │  │
│  │  └───────────────────────────────────────────────────────┘  │  │
│  │                                                               │  │
│  │  ┌───────────────────────────────────────────────────────┐  │  │
│  │  │  2. Context Waste Detector                            │  │  │
│  │  │     • Finds: High tokens, low output                  │  │  │
│  │  │     • Example: 180K tokens → 1 file edit              │  │  │
│  │  │     • SQL: SUM(tokens) > 100K, COUNT(edits) <= 2      │  │  │
│  │  └───────────────────────────────────────────────────────┘  │  │
│  │                                                               │  │
│  │  ┌───────────────────────────────────────────────────────┐  │  │
│  │  │  3. Repeated Operations Detector                      │  │  │
│  │  │     • Finds: Same file read 8+ times                  │  │  │
│  │  │     • Example: config.json read 12x in session        │  │  │
│  │  │     • SQL: GROUP BY file_path, HAVING COUNT >= 8      │  │  │
│  │  └───────────────────────────────────────────────────────┘  │  │
│  │                                                               │  │
│  │  ┌───────────────────────────────────────────────────────┐  │  │
│  │  │  4. Missing Documentation Detector                    │  │  │
│  │  │     • Finds: Active projects without CLAUDE.md        │  │  │
│  │  │     • Example: 5 sessions, 20 errors, no CLAUDE.md    │  │  │
│  │  │     • SQL: sessions >= 3 AND errors > 5 AND no reads  │  │  │
│  │  └───────────────────────────────────────────────────────┘  │  │
│  │                                                               │  │
│  │  ┌───────────────────────────────────────────────────────┐  │  │
│  │  │  5. Permission Denial Detector (TODO)                 │  │  │
│  │  │     • Finds: Frequent permission prompts              │  │  │
│  │  │     • Requires: Denial tracking in telemetry          │  │  │
│  │  └───────────────────────────────────────────────────────┘  │  │
│  │                                                               │  │
│  └───────────────────────────────┬───────────────────────────────┘  │
│                                  │ Detected Patterns                │
│                                  ▼                                  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │     Recommendation Engine (recommendation-engine.js)          │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │                                                               │  │
│  │  Pattern Type → Recommendation Generator                     │  │
│  │  ────────────────────────────────────────                    │  │
│  │  tool_failure       → Document commands in CLAUDE.md         │  │
│  │  context_waste      → Add structure docs, use agents         │  │
│  │  repeated_read      → Document file purposes                 │  │
│  │  missing_docs       → Create CLAUDE.md                       │  │
│  │  permission_denial  → Configure allowlist                    │  │
│  │                                                               │  │
│  │  Output: {                                                   │  │
│  │    priority: "urgent|high|medium|low",                       │  │
│  │    category: "documentation|optimization|...",               │  │
│  │    action_items: [ step-by-step instructions ],             │  │
│  │    impact_estimate: "Could reduce failures by 80%",          │  │
│  │    confidence_score: 0.85                                    │  │
│  │  }                                                           │  │
│  └───────────────────────────────┬───────────────────────────────┘  │
│                                  │ Generated Recommendations        │
└──────────────────────────────────┼──────────────────────────────────┘
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     STORAGE LAYER                                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │            Analytics Database (analytics.db)                  │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │                                                               │  │
│  │  patterns                                                     │  │
│  │  ├─ id, pattern_type, project_path, severity                 │  │
│  │  ├─ title, description, frequency                            │  │
│  │  ├─ first_seen, last_seen, status                            │  │
│  │  └─ metadata (JSON)                                          │  │
│  │                                                               │  │
│  │  recommendations                                              │  │
│  │  ├─ id, pattern_id, project_path                             │  │
│  │  ├─ category, priority, title, description                   │  │
│  │  ├─ action_items (JSON), impact_estimate                     │  │
│  │  ├─ confidence_score, status                                 │  │
│  │  └─ applied_at, dismissed_reason                             │  │
│  │                                                               │  │
│  │  project_health                                               │  │
│  │  ├─ task_success_rate, tool_rejection_rate                   │  │
│  │  ├─ context_efficiency, redo_rate                            │  │
│  │  └─ has_claude_md, quality_score                             │  │
│  │                                                               │  │
│  │  session_analysis                                             │  │
│  │  ├─ session_id, analyzed, duration                           │  │
│  │  ├─ context_wasted, tool_failures                            │  │
│  │  └─ files_created, files_modified                            │  │
│  │                                                               │  │
│  │  cross_project_insights                                       │  │
│  │  ├─ insight_type, title, description                         │  │
│  │  ├─ sample_projects (JSON), confidence_score                 │  │
│  │  └─ impact_metric, applies_to_project_type                   │  │
│  │                                                               │  │
│  └───────────────────────────────┬───────────────────────────────┘  │
│                                  │                                  │
└──────────────────────────────────┼──────────────────────────────────┘
                                   │
            ┌──────────────────────┴──────────────────────┐
            │                                              │
            ▼                                              ▼
┌───────────────────────────┐              ┌───────────────────────────┐
│      API LAYER            │              │   BACKGROUND JOBS         │
│  (analytics.routes.js)    │              │  (analyze-patterns.js)    │
├───────────────────────────┤              ├───────────────────────────┤
│                           │              │                           │
│ POST /api/analytics/      │              │  Runs via:                │
│      analyze              │              │  • Cron (nightly)         │
│                           │              │  • Manual CLI             │
│ GET  /api/analytics/      │              │  • API trigger            │
│      dashboard            │              │                           │
│                           │              │  Output:                  │
│ GET  /api/analytics/      │              │  • Console logs           │
│      projects/:path/      │              │  • Updates analytics.db   │
│      recommendations      │              │                           │
│                           │              │                           │
│ POST /api/analytics/      │              │                           │
│      recommendations/     │              │                           │
│      :id/apply            │              │                           │
│                           │              │                           │
│ POST /api/analytics/      │              │                           │
│      recommendations/     │              │                           │
│      :id/dismiss          │              │                           │
│                           │              │                           │
└───────────┬───────────────┘              └───────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     FRONTEND LAYER                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │         Recommendations Component (Recommendations.jsx)       │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │                                                               │  │
│  │  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓  │  │
│  │  ┃  💡 AI Recommendations           [Run Analysis]     ┃  │  │
│  │  ┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫  │  │
│  │  ┃                                                       ┃  │  │
│  │  ┃  📊 Stats:                                           ┃  │  │
│  │  ┃  [ Pending: 8 ] [ Patterns: 12 ] [ Applied: 3 ]     ┃  │  │
│  │  ┃                                                       ┃  │  │
│  │  ┃  Filters: [All] [Urgent] [High] [Docs] [Optimize]   ┃  │  │
│  │  ┃                                                       ┃  │  │
│  │  ┃  ┌─────────────────────────────────────────────┐    ┃  │  │
│  │  ┃  │ 🔴 URGENT • Documentation                   │    ┃  │  │
│  │  ┃  │ Document correct build commands             │    ┃  │  │
│  │  ┃  │ 85% confident • Could reduce failures 80%   │    ┃  │  │
│  │  ┃  │ ───────────────────────────────────────────  │    ┃  │  │
│  │  ┃  │ Action Items:                                │    ┃  │  │
│  │  ┃  │ 1. Create .claude/CLAUDE.md                  │    ┃  │  │
│  │  ┃  │ 2. Add: Build: `yarn run tsc -b`            │    ┃  │  │
│  │  ┃  │ 3. Document when to use each command         │    ┃  │  │
│  │  ┃  │                                              │    ┃  │  │
│  │  ┃  │ [✓ Mark as Applied]  [✗ Dismiss]            │    ┃  │  │
│  │  ┃  └─────────────────────────────────────────────┘    ┃  │  │
│  │  ┃                                                       ┃  │  │
│  │  ┃  ┌─────────────────────────────────────────────┐    ┃  │  │
│  │  ┃  │ 🟠 HIGH • Optimization                      │    ┃  │  │
│  │  ┃  │ Reduce repeated file reads                   │    ┃  │  │
│  │  ┃  │ ...                                          │    ┃  │  │
│  │  ┃  └─────────────────────────────────────────────┘    ┃  │  │
│  │  ┃                                                       ┃  │  │
│  │  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛  │  │
│  │                                                               │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Analysis Trigger
```
User clicks "Run Analysis"
    ↓
POST /api/analytics/analyze
    ↓
AnalyticsService.runAnalysis()
    ↓
    ├─→ PatternDetector.detectAll()
    │   ├─→ Query telemetry.db for failures
    │   ├─→ Query for context waste
    │   ├─→ Query for repeated ops
    │   ├─→ Query for missing docs
    │   └─→ Store patterns in analytics.db
    │
    └─→ RecommendationEngine.generateRecommendations()
        ├─→ Load active patterns
        ├─→ Generate specific recommendations
        └─→ Store in analytics.db
```

### 2. View Recommendations
```
Component mounts / Project selected
    ↓
GET /api/analytics/projects/:path/recommendations
    ↓
AnalyticsService.getProjectRecommendations()
    ↓
Query analytics.db
    ↓
Return recommendations with action items
    ↓
Render in expandable cards
```

### 3. Apply Recommendation
```
User clicks "Mark as Applied"
    ↓
POST /api/analytics/recommendations/:id/apply
    ↓
AnalyticsService.applyRecommendation()
    ↓
    ├─→ Update recommendation status → 'applied'
    └─→ Update associated pattern status → 'resolved'
    ↓
Refresh recommendations list
```

## Key Algorithms

### Tool Failure Detection
```sql
SELECT
  project_path,
  tool_name,
  error_type,
  COUNT(*) as failure_count
FROM tool_calls
WHERE result = 'error'
  AND timestamp >= (NOW - 30 days)
GROUP BY project_path, tool_name, error_type
HAVING failure_count >= 3
ORDER BY failure_count DESC
```

### Context Waste Detection
```sql
SELECT
  s.session_id,
  SUM(p.input_tokens + p.output_tokens) as total_tokens,
  COUNT(DISTINCT CASE WHEN t.tool_name IN ('Edit', 'Write') THEN t.id END) as edits
FROM sessions s
JOIN prompts p ON p.session_id = s.session_id
LEFT JOIN tool_calls t ON t.prompt_id = p.id
GROUP BY s.session_id
HAVING total_tokens > 100000 AND edits <= 2
```

### Repeated Operations Detection
```sql
SELECT
  session_id,
  json_extract(arguments, '$.file_path') as file_path,
  COUNT(*) as read_count
FROM tool_calls
WHERE tool_name = 'Read'
  AND file_path IS NOT NULL
GROUP BY session_id, file_path
HAVING read_count >= 8
```

## Metrics

### Pattern Metrics
- **Frequency**: How many times this pattern occurred
- **Severity**: critical / high / medium / low
- **First/Last Seen**: Time range of pattern
- **Status**: active / resolved / ignored

### Recommendation Metrics
- **Priority**: urgent / high / medium / low
- **Confidence Score**: 0.0 - 1.0 (how sure we are)
- **Impact Estimate**: Projected improvement
- **Status**: pending / applied / dismissed / archived

### Project Health Metrics
- **Task Success Rate**: % sessions without errors
- **Tool Rejection Rate**: % tool calls rejected
- **Context Efficiency**: tokens per file edited
- **Redo Rate**: % edits that get reverted

## Extension Points

### Adding a New Pattern Detector

```javascript
// In pattern-detector.js
async detectNewPattern({ projectPath, daysBack }) {
  const query = `
    SELECT ... your SQL query ...
    WHERE ... your conditions ...
    GROUP BY ...
    HAVING ... your threshold ...
  `;
  
  const results = this.telemetryDb.prepare(query).all(...params);
  
  return results.map(item => ({
    pattern_type: 'your_pattern_type',
    project_path: item.project_path,
    severity: calculateSeverity(item),
    title: 'Pattern Title',
    description: 'What this pattern means',
    frequency: item.count,
    metadata: JSON.stringify(item)
  }));
}
```

### Adding a New Recommendation Type

```javascript
// In recommendation-engine.js
generateNewRecommendation(pattern) {
  const metadata = JSON.parse(pattern.metadata);
  
  return {
    pattern_id: pattern.id,
    project_path: pattern.project_path,
    category: 'your_category',
    priority: determinePriority(pattern),
    title: 'What to do',
    description: 'Why this matters',
    action_items: JSON.stringify([
      { step: 1, action: 'First step', details: 'How to do it' },
      { step: 2, action: 'Second step', details: 'Details...' }
    ]),
    impact_estimate: 'Could improve X by Y%',
    confidence_score: 0.8
  };
}
```

## Performance Considerations

- **Indexes**: All queries use indexed columns (project_path, timestamp, session_id)
- **Aggregation**: Pattern detection runs on pre-aggregated data
- **Caching**: Consider caching dashboard summary for 1 hour
- **Background**: Heavy analysis runs in background, not blocking user requests
- **Incremental**: Only analyze new data since last run

## Future Enhancements

1. **Machine Learning**: Train model on your acceptance patterns
2. **Real-time**: Detect patterns as sessions complete
3. **Auto-fix**: Generate CLAUDE.md automatically
4. **Integrations**: GitHub issues, Slack notifications
5. **Team Analytics**: Cross-user insights
6. **Cost Optimization**: Recommend cheaper models for specific tasks
