# Quick Integration Guide

## Step 1: Add Recommendations Tab to Main Dashboard

Edit `frontend/src/App.jsx` to add a new tab for recommendations:

```jsx
// Import the component
import Recommendations from './components/Recommendations';

// Add to your tabs state (around line 20-30)
const [activeTab, setActiveTab] = useState('overview'); // or your current default

// Add tab button in navigation (find where other tabs are)
<button
  onClick={() => setActiveTab('recommendations')}
  className={`tab-button ${activeTab === 'recommendations' ? 'active' : ''}`}
>
  💡 Recommendations
</button>

// Add conditional render for the component (with other tab content)
{activeTab === 'recommendations' && (
  <Recommendations projectPath={selectedProject} />
)}
```

## Step 2: Make Analytics DB Directory Writable

The analytics database needs to create files in the data directory:

```bash
mkdir -p backend/data
chmod 755 backend/data
```

Or update docker-compose.yml to mount the data directory:

```yaml
volumes:
  - ~/.claude/projects:/projects:ro
  - ./backend/data:/app/data  # Add this line for analytics DB
```

## Step 3: Test the Integration

### Start the backend and frontend:

```bash
# Terminal 1: Backend
cd backend
npm start

# Terminal 2: Frontend  
cd frontend
npm run dev
```

### Test the API manually:

```bash
# Run analysis on all projects
curl -X POST http://localhost:3001/api/analytics/analyze \
  -H "Content-Type: application/json" \
  -d '{"daysBack": 30}'

# Get recommendations for a project
curl http://localhost:3001/api/analytics/projects/Users/tirthp/sase-ui/recommendations

# Get dashboard summary
curl http://localhost:3001/api/analytics/dashboard
```

## Step 4: Run Initial Analysis

### Option A: Via API
```bash
curl -X POST http://localhost:3001/api/analytics/analyze \
  -H "Content-Type: application/json" \
  -d '{"daysBack": 30}'
```

### Option B: Via CLI Script
```bash
cd backend
node src/scripts/analyze-patterns.js --days=30
```

### Option C: Via UI
1. Go to Recommendations tab
2. Click "Run Analysis" button
3. Wait for completion
4. Review recommendations

## Step 5: Set Up Automated Analysis (Optional)

Add to crontab to run nightly at 2 AM:

```bash
crontab -e

# Add this line:
0 2 * * * cd /Users/tirthp/Personal/claude-dashboard && node backend/src/scripts/analyze-patterns.js >> /tmp/analytics.log 2>&1
```

Or use a scheduler in your Docker setup:

```yaml
# In docker-compose.yml, add a scheduler service
scheduler:
  build: ./backend
  command: node src/scripts/analyze-patterns.js
  volumes:
    - ~/.claude/projects:/projects:ro
    - ./backend/data:/app/data
  environment:
    - CLAUDE_PROJECTS_DIR=/projects
  # Run every 6 hours (managed by your container orchestration)
```

## Step 6: Verify Everything Works

1. **Check database created**:
   ```bash
   ls -la backend/data/analytics.db
   ```

2. **Check tables created**:
   ```bash
   sqlite3 backend/data/analytics.db ".tables"
   # Should show: patterns, recommendations, project_health, session_analysis, cross_project_insights
   ```

3. **Check API endpoints**:
   ```bash
   curl http://localhost:3001/api/analytics/dashboard
   ```

4. **Check UI renders**:
   - Open http://localhost:3000
   - Navigate to Recommendations tab
   - Should see "Run Analysis" button

## Troubleshooting

### Issue: "Cannot find module 'analytics.db.js'"
**Solution**: Make sure all files use ES module imports (.js extensions)

### Issue: "SQLITE_CANTOPEN: unable to open database file"
**Solution**: 
```bash
mkdir -p backend/data
chmod 755 backend/data
```

### Issue: "No recommendations showing"
**Solution**: 
1. Check if you have telemetry data: `curl http://localhost:3001/api/telemetry/summary`
2. Run analysis: Click "Run Analysis" button
3. Check backend logs for errors

### Issue: "Module not found" in frontend
**Solution**: Make sure you installed dependencies:
```bash
cd frontend
npm install lucide-react  # For icons
```

## What to Expect After First Analysis

Depending on your telemetry data, you should see:

### If you have active projects with errors:
- 5-15 recommendations per project
- Mix of priorities (some high/urgent if many failures)
- Categories: mostly documentation and optimization

### If you have minimal telemetry:
- Fewer recommendations
- Mostly "missing documentation" patterns
- Lower priority recommendations

### Example Output (CLI):
```
🔍 Starting pattern analysis...
  Project: ALL
  Time range: Last 30 days

✅ Analysis complete!
  Patterns detected: 12
  Recommendations generated: 8

📊 Summary:
  Active patterns: 12
  Pending recommendations: 8
  Affected projects: 3
```

## Next Steps

1. ✅ Run initial analysis
2. ✅ Review recommendations in UI
3. ✅ Apply top 3 recommendations
4. ✅ Mark them as applied
5. ✅ Run analysis again after a week
6. ✅ Compare before/after metrics

## Quick Command Reference

```bash
# Analyze all projects
node backend/src/scripts/analyze-patterns.js

# Analyze specific project  
node backend/src/scripts/analyze-patterns.js --project=/Users/tirthp/sase-ui

# Analyze with custom time range
node backend/src/scripts/analyze-patterns.js --days=60

# Check analytics DB
sqlite3 backend/data/analytics.db "SELECT * FROM recommendations LIMIT 5;"

# View all patterns
sqlite3 backend/data/analytics.db "SELECT pattern_type, COUNT(*) FROM patterns GROUP BY pattern_type;"
```

## Architecture Quick Reference

```
User Request
    ↓
Frontend (Recommendations.jsx)
    ↓
API Routes (analytics.routes.js)
    ↓
Analytics Service (analytics.service.js)
    ↓
    ├─→ Pattern Detector (pattern-detector.js)
    │   └─→ Queries telemetry.db + dashboard.db
    └─→ Recommendation Engine (recommendation-engine.js)
        └─→ Stores in analytics.db
```

## Ready to Ship? ✅

Once everything works:

1. Commit all files
2. Update main README.md to mention recommendations feature
3. Deploy to production
4. Set up cron job
5. Monitor adoption and effectiveness

**You've now transformed your monitoring tool into an AI management platform!** 🎉
