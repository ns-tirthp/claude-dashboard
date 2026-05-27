# Recommendations Quick Reference

## 🚀 Quick Start

```bash
# 1. Start your dashboard
docker-compose up

# 2. Run analysis (choose one method)
curl -X POST http://localhost:3001/api/analytics/analyze -H "Content-Type: application/json" -d '{"daysBack": 30}'
# OR
node backend/src/scripts/analyze-patterns.js
# OR
Click "Run Analysis" button in UI

# 3. View recommendations
# Navigate to Recommendations tab in UI
# OR
curl http://localhost:3001/api/analytics/dashboard
```

## 📊 Pattern Types

| Pattern | Detects | Threshold | Recommendation |
|---------|---------|-----------|----------------|
| **tool_failure** | Wrong commands used repeatedly | 3+ failures | Document commands in CLAUDE.md |
| **context_waste** | High tokens, low output | 100K+ tokens, ≤2 edits | Add structure docs, use agents |
| **repeated_read** | Same file read many times | 8+ reads | Document file purpose |
| **missing_docs** | No CLAUDE.md in active project | 3+ sessions, 5+ errors | Create CLAUDE.md |
| **permission_denial** | Frequent permission prompts | (TBD) | Configure allowlist |

## 🎯 Priority Levels

| Priority | When to Act | Color | Example |
|----------|-------------|-------|---------|
| 🔴 **Urgent** | Today | Red | Blocking failures (20+ errors) |
| 🟠 **High** | This week | Orange | Frequent issues (10+ occurrences) |
| 🟡 **Medium** | This month | Yellow | Optimization opportunities |
| 🔵 **Low** | When convenient | Blue | Nice-to-have improvements |

## 🔧 API Endpoints

```bash
# Run analysis
POST /api/analytics/analyze
Body: { "projectPath": "/path/to/project", "daysBack": 30 }

# Get dashboard summary
GET /api/analytics/dashboard?limit=10

# Get recommendations for project
GET /api/analytics/projects/:projectPath/recommendations?status=pending

# Get patterns for project
GET /api/analytics/projects/:projectPath/patterns?status=active

# Apply recommendation
POST /api/analytics/recommendations/:id/apply

# Dismiss recommendation
POST /api/analytics/recommendations/:id/dismiss
Body: { "reason": "Not applicable" }

# Get insights
GET /api/analytics/insights?limit=5
```

## 💾 Database Schema

```sql
-- Detected patterns
patterns (
  id, pattern_type, project_path, severity,
  title, description, frequency,
  first_seen, last_seen, status, metadata
)

-- Generated recommendations
recommendations (
  id, pattern_id, project_path,
  category, priority, title, description,
  action_items, impact_estimate, confidence_score,
  status, applied_at, dismissed_reason
)

-- Project health metrics
project_health (
  project_path, task_success_rate, tool_rejection_rate,
  context_efficiency, has_claude_md, last_analyzed
)

-- Session-level analysis
session_analysis (
  session_id, project_path, duration_seconds,
  context_wasted, tool_failures, had_git_commit
)

-- Cross-project learnings
cross_project_insights (
  insight_type, title, description,
  sample_projects, confidence_score, impact_metric
)
```

## 📁 File Structure

```
backend/src/
├── database/
│   └── analytics.db.js              # Schema + DB connection
├── domains/analytics/
│   ├── pattern-detector.js          # 5 pattern detectors
│   ├── recommendation-engine.js     # Recommendation generators
│   ├── analytics.service.js         # Orchestration
│   └── analytics.routes.js          # REST API
└── scripts/
    └── analyze-patterns.js          # CLI tool

frontend/src/components/
└── Recommendations.jsx              # UI component
```

## 🔄 Workflow

```
1. Analysis
   User action → API call → Pattern detection → Recommendation generation → Store in DB

2. View
   Component load → Fetch recommendations → Display by priority → Show action items

3. Apply
   User marks applied → Update status → Resolve pattern → Refresh UI

4. Measure
   Run analysis again → Compare before/after → See improvements
```

## 🎨 Component Props

```jsx
<Recommendations
  projectPath="/Users/tirthp/sase-ui"  // Required: which project
/>

// Internal state:
- recommendations: Array of recommendation objects
- patterns: Array of pattern objects
- loading: Boolean
- analyzing: Boolean
- expandedId: Currently expanded card ID
- filter: 'all' | 'urgent' | 'high' | 'documentation' | 'optimization'
```

## 🧮 Metrics to Track

### Input Metrics (Pattern Detection)
- Tool failure count
- Total tokens used
- Files modified count
- Read operations count
- Session error count

### Output Metrics (Recommendations)
- Patterns detected
- Recommendations generated
- Priority distribution
- Category distribution
- Confidence scores

### Impact Metrics (After Applying)
- Tool failure reduction %
- Token usage reduction %
- Time-to-completion reduction %
- Permission prompt reduction %

## 🛠️ Common Queries

```sql
-- Top patterns by severity
SELECT pattern_type, COUNT(*) as count, severity
FROM patterns
WHERE status = 'active'
GROUP BY pattern_type, severity
ORDER BY severity DESC, count DESC;

-- Pending recommendations by priority
SELECT priority, COUNT(*) as count
FROM recommendations
WHERE status = 'pending'
GROUP BY priority
ORDER BY CASE priority
  WHEN 'urgent' THEN 1
  WHEN 'high' THEN 2
  WHEN 'medium' THEN 3
  ELSE 4
END;

-- Projects with most issues
SELECT project_path, COUNT(*) as issue_count
FROM patterns
WHERE status = 'active'
GROUP BY project_path
ORDER BY issue_count DESC
LIMIT 10;

-- Applied vs dismissed recommendations
SELECT status, COUNT(*) as count
FROM recommendations
GROUP BY status;

-- Recommendation effectiveness
SELECT
  r.priority,
  COUNT(*) as total,
  SUM(CASE WHEN r.status = 'applied' THEN 1 ELSE 0 END) as applied,
  ROUND(100.0 * SUM(CASE WHEN r.status = 'applied' THEN 1 ELSE 0 END) / COUNT(*), 1) as apply_rate
FROM recommendations r
GROUP BY r.priority;
```

## 🎯 Recommendation Categories

| Category | Focus | Examples |
|----------|-------|----------|
| **documentation** | Add/improve docs | Create CLAUDE.md, document commands |
| **permissions** | Permission config | Add to allowlist, configure settings |
| **optimization** | Performance | Reduce tokens, use agents, avoid repeats |
| **tooling** | Tool issues | Fix tool config, update environment |

## ⚡ Performance Tips

```bash
# Index important columns (already done in schema)
CREATE INDEX idx_patterns_project ON patterns(project_path, status);
CREATE INDEX idx_patterns_type ON patterns(pattern_type, status);

# Analyze only changed projects
POST /api/analytics/analyze
Body: { "projectPath": "/specific/project" }

# Use background jobs for heavy analysis
node backend/src/scripts/analyze-patterns.js &

# Cache dashboard summary
# TODO: Add Redis or in-memory cache for /dashboard endpoint
```

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| No patterns detected | Check if you have telemetry data: `GET /api/telemetry/summary` |
| No recommendations | Run analysis first: `POST /api/analytics/analyze` |
| Database locked | Stop other processes accessing analytics.db |
| Module not found | Check ES module imports have `.js` extensions |
| Empty action_items | Recommendation not properly serialized, check JSON.parse |

## 🔐 Security Notes

- All data stays local (no external APIs)
- Database in `backend/data/` (add to .gitignore)
- No sensitive data in recommendations
- User can dismiss any recommendation

## 🚦 Status Values

**Pattern status:**
- `active`: Currently problematic
- `resolved`: Fixed via applied recommendation
- `ignored`: User chose to ignore

**Recommendation status:**
- `pending`: Awaiting user action
- `applied`: User marked as implemented
- `dismissed`: User chose not to implement
- `archived`: Old, no longer relevant

## 🎓 Learning Mode

```bash
# Week 1: Learn the system
- Run analysis daily
- Review all recommendations
- Don't apply yet, just observe

# Week 2: Start applying
- Apply 1-2 high-priority recommendations
- Mark as applied
- Run analysis again

# Week 3: Measure impact
- Compare before/after metrics
- Check if patterns resolved
- Apply more recommendations

# Week 4: Automate
- Set up cron for nightly analysis
- Standardize CLAUDE.md across projects
- Create team best practices
```

## 📚 Further Reading

- **Overview**: [RECOMMENDATIONS_OVERVIEW.md](./RECOMMENDATIONS_OVERVIEW.md)
- **Technical**: [RECOMMENDATIONS_FEATURE.md](./RECOMMENDATIONS_FEATURE.md)
- **Architecture**: [RECOMMENDATIONS_ARCHITECTURE.md](./RECOMMENDATIONS_ARCHITECTURE.md)
- **Integration**: [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md)

## 💬 Quick Commands

```bash
# Full analysis + summary
node backend/src/scripts/analyze-patterns.js

# Specific project
node backend/src/scripts/analyze-patterns.js --project=/Users/tirthp/sase-ui

# Last 60 days
node backend/src/scripts/analyze-patterns.js --days=60

# Check what's in DB
sqlite3 backend/data/analytics.db "SELECT COUNT(*) FROM patterns;"
sqlite3 backend/data/analytics.db "SELECT COUNT(*) FROM recommendations;"

# View patterns
sqlite3 backend/data/analytics.db "SELECT * FROM patterns WHERE status='active' LIMIT 5;"

# View recommendations
sqlite3 backend/data/analytics.db "SELECT id, priority, title FROM recommendations WHERE status='pending';"
```

---

**Remember:** The goal is not just to collect data, but to **act on insights and improve**. 🎯
