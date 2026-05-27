# AI Recommendations Feature

## Overview

The Recommendations feature transforms the Claude Dashboard from a **passive monitoring tool** into an **active AI management platform**. It analyzes your telemetry data to detect patterns and generate actionable recommendations that help you improve AI effectiveness across projects.

## Key Concept

**Learn from patterns** → **Generate recommendations** → **Take action** → **Improve AI workflow**

Example: Claude fails to use `yarn tsc -b` in your SASE project 8 times → System detects pattern → Recommends adding proper commands to CLAUDE.md → You apply → Failures drop to zero.

## Architecture

### 1. Database Layer (`analytics.db`)

**Location:** `backend/src/database/analytics.db.js`

Four main tables:

- **patterns**: Detected problematic patterns (tool failures, context waste, repeated reads, etc.)
- **recommendations**: Actionable suggestions based on patterns
- **project_health**: Per-project effectiveness metrics
- **session_analysis**: Detailed analysis per Claude session
- **cross_project_insights**: Learnings from comparing multiple projects

### 2. Pattern Detection Engine

**Location:** `backend/src/domains/analytics/pattern-detector.js`

Detects five types of patterns:

#### a) Tool Failure Patterns
- **What it detects**: Claude repeatedly uses wrong commands
- **Example**: Using `npm build` when project needs `yarn tsc -b`
- **Threshold**: 3+ failures of same type
- **Recommendation**: Document correct commands in CLAUDE.md

#### b) Context Waste Patterns
- **What it detects**: High token usage (>100K) with minimal output (≤2 files modified)
- **Example**: Session uses 180K tokens but only edits 1 file
- **Threshold**: 2+ such sessions
- **Recommendation**: Improve task clarity, add project structure docs

#### c) Repeated Operations
- **What it detects**: Same file read 8+ times in one session
- **Example**: Reading `config.json` 12 times
- **Threshold**: 8+ reads of same file
- **Recommendation**: Document file purpose, provide context upfront

#### d) Missing Documentation
- **What it detects**: Projects with 3+ sessions and 5+ errors but no CLAUDE.md
- **Example**: Active project with many errors, never reads CLAUDE.md
- **Threshold**: 3+ sessions AND 5+ errors AND no CLAUDE.md reads
- **Recommendation**: Create CLAUDE.md with project structure, commands, workflow

#### e) Permission Denial Patterns
- **What it detects**: Frequent permission prompts for same operations
- **Status**: Placeholder (requires denial tracking in telemetry)
- **Recommendation**: Configure permission allowlist

### 3. Recommendation Engine

**Location:** `backend/src/domains/analytics/recommendation-engine.js`

Generates specific, actionable recommendations for each pattern:

**Recommendation Structure:**
```json
{
  "priority": "urgent|high|medium|low",
  "category": "documentation|permissions|optimization|tooling",
  "title": "Short, clear title",
  "description": "Context and impact",
  "action_items": [
    {
      "step": 1,
      "action": "What to do",
      "details": "How to do it"
    }
  ],
  "impact_estimate": "Could reduce failures by 80%",
  "confidence_score": 0.85
}
```

### 4. API Layer

**Location:** `backend/src/domains/analytics/analytics.routes.js`

#### Endpoints:

**POST `/api/analytics/analyze`**
- Run pattern detection + recommendation generation
- Body: `{ projectPath?, daysBack: 30, force: false }`
- Returns: `{ patterns_detected, recommendations_generated }`

**GET `/api/analytics/dashboard`**
- Get overall summary across all projects
- Query: `?limit=10`
- Returns: Top patterns, urgent projects, stats

**GET `/api/analytics/projects/:projectPath/recommendations`**
- Get recommendations for a specific project
- Query: `?status=pending&includePattern=true`
- Returns: List of recommendations with action items

**GET `/api/analytics/projects/:projectPath/patterns`**
- Get detected patterns for a project
- Query: `?status=active`
- Returns: List of patterns with metadata

**POST `/api/analytics/recommendations/:id/apply`**
- Mark recommendation as applied
- Also resolves the associated pattern

**POST `/api/analytics/recommendations/:id/dismiss`**
- Dismiss a recommendation
- Body: `{ reason: "why dismissed" }`

**GET `/api/analytics/insights`**
- Get cross-project insights
- Query: `?limit=5`
- Returns: Best practices learned from comparing projects

### 5. Frontend Component

**Location:** `frontend/src/components/Recommendations.jsx`

Features:
- ✅ List recommendations by priority (urgent → low)
- ✅ Filter by priority/category
- ✅ Expandable cards showing action items
- ✅ One-click "Mark as Applied" or "Dismiss"
- ✅ Run analysis button
- ✅ Stats overview (pending, active patterns, applied)

### 6. Background Analyzer

**Location:** `backend/src/scripts/analyze-patterns.js`

CLI tool for automated analysis:

```bash
# Analyze all projects
node backend/src/scripts/analyze-patterns.js

# Analyze specific project
node backend/src/scripts/analyze-patterns.js --project=/Users/you/project-name

# Custom time range
node backend/src/scripts/analyze-patterns.js --days=60
```

**Cron setup** (run daily):
```bash
# Add to crontab
0 2 * * * cd /path/to/claude-dashboard && node backend/src/scripts/analyze-patterns.js
```

## Usage Flow

### 1. Initial Setup

1. System is already integrated (routes added to `routes.js`)
2. Analytics database auto-creates on first API call
3. Run analysis: `POST /api/analytics/analyze` or click button in UI

### 2. Daily Workflow

1. **Automatic** (if cron configured): Analysis runs nightly
2. **Manual**: Click "Run Analysis" in dashboard
3. Review recommendations by project
4. Expand recommendation to see action items
5. Take action (e.g., update CLAUDE.md)
6. Mark as applied

### 3. Example Scenario

**Before:**
- SASE UI project: Claude fails with build commands 8 times in 2 weeks
- You keep correcting it manually each time

**After Recommendations Feature:**
1. System detects: 8 failures, all `Bash` tool, all "command not found"
2. Creates pattern: "tool_failure", severity: "high"
3. Generates recommendation:
   - **Title**: "Document correct build commands in CLAUDE.md"
   - **Priority**: High
   - **Action Items**:
     1. Create `.claude/CLAUDE.md`
     2. Add section: "Build: `yarn run tsc -b`"
     3. Add context about when to use each command
   - **Impact**: "Could reduce Bash failures by 80%"
4. You click "Mark as Applied" after updating CLAUDE.md
5. Future sessions: Claude reads CLAUDE.md, uses correct command, zero failures

## Metrics You Can Track

### Project Health
- Task success rate (% sessions without errors)
- Tool rejection rate
- Context efficiency (tokens per file edited)
- Redo rate (% edits that get reverted)

### Recommendation Effectiveness
- How many recommendations applied
- Impact of applied recommendations (before/after metrics)
- Most common pattern types
- Projects with most issues vs. best practices

### Cross-Project Learning
- "React projects with CLAUDE.md see 2.3x faster completion"
- "Projects that document build commands have 80% fewer tool failures"

## Future Enhancements

### Phase 2: Advanced Patterns
- **Agent overuse detection**: Spawning agents when not needed
- **Context boundary issues**: Sessions hitting context limits
- **Skill misuse**: Using wrong skills for tasks
- **Cost anomalies**: Unusually expensive sessions

### Phase 3: Predictive Recommendations
- "This project is similar to X, which had Y issue. Preemptively recommend Z"
- "You're about to start session, here are 3 tips based on this project's history"

### Phase 4: Integration
- Auto-create CLAUDE.md drafts
- GitHub integration: Create issues for recommendations
- Slack notifications for urgent recommendations
- One-click apply (auto-edit CLAUDE.md)

### Phase 5: Learning
- Track recommendation acceptance rate
- Fine-tune confidence scores based on outcomes
- Personalized recommendations based on your patterns
- Team insights (if multi-user)

## Technical Notes

### Query Performance
- All queries use indexed columns
- Pattern detection runs on aggregated data
- Recommendation generation is fast (rule-based, not AI)

### Data Privacy
- All data stays local (same as existing dashboard)
- No external API calls
- Analytics DB stored in `backend/data/analytics.db`

### Extensibility
- Easy to add new pattern detectors (add method to `pattern-detector.js`)
- Easy to add new recommendation types (add method to `recommendation-engine.js`)
- Database schema supports custom metadata per pattern

## Integration Checklist

- [x] Database schema created (`analytics.db.js`)
- [x] Pattern detector implemented
- [x] Recommendation engine implemented
- [x] Analytics service orchestration
- [x] REST API routes
- [x] Frontend component
- [x] Background analyzer script
- [x] Routes integrated into main app
- [ ] Test with real telemetry data
- [ ] Add to main dashboard navigation
- [ ] Deploy and run initial analysis
- [ ] Set up cron for automated analysis

## Files Created

### Backend
```
backend/src/
├── database/
│   └── analytics.db.js                    # Analytics database schema
├── domains/analytics/
│   ├── pattern-detector.js                 # Pattern detection engine
│   ├── recommendation-engine.js            # Recommendation generation
│   ├── analytics.service.js                # Service orchestration
│   └── analytics.routes.js                 # REST API routes
└── scripts/
    └── analyze-patterns.js                 # Background analyzer CLI
```

### Frontend
```
frontend/src/components/
└── Recommendations.jsx                     # React component
```

### Documentation
```
RECOMMENDATIONS_FEATURE.md                  # This file
```

## Summary

You now have a **pattern-based recommendation system** that:
1. ✅ Analyzes telemetry to find problems
2. ✅ Generates specific, actionable recommendations
3. ✅ Tracks which recommendations you've applied
4. ✅ Shows impact estimates
5. ✅ Can run automatically in the background
6. ✅ Learns from cross-project patterns

This transforms your dashboard from "here's what happened" to "here's what you should do to improve."

**Next step**: Integrate the Recommendations component into your main dashboard and run your first analysis!
