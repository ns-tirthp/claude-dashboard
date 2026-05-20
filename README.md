# Claude Usage Dashboard

A beautiful, comprehensive dashboard to visualize and analyze your Claude Code usage statistics.

## Features

- **Project Statistics**: View detailed stats for each project including conversations, tool calls, time spent, and token usage
- **Tool Usage Analytics**: See which tools (Read, Write, Edit, Bash, etc.) you use most frequently
- **Model Distribution**: Visualize which Claude models you use across projects
- **Token Tracking**: Monitor input/output tokens and cache usage for cost optimization
- **Time Analytics**: Track total time spent with Claude on each project
- **Activity Timeline**: See your recent Claude activity across projects
- **Real-time Refresh**: Manually refresh data to see latest statistics
- **Live OTel Telemetry** *(new)*: Real cost in USD, active time, tool reliability,
  and per-prompt drilldown via Claude Code's OpenTelemetry exporter. See
  [SETUP_TELEMETRY.md](./SETUP_TELEMETRY.md).
- **Chat History Viewer** *(new)*: Browse and view all past Claude Code conversations
  from JSONL session files. Full conversation reconstruction with tool call details,
  search/filter, and project context. See [CHAT_HISTORY_FEATURE.md](./CHAT_HISTORY_FEATURE.md).

## Tech Stack

- **Frontend**: React 18 + Vite + Tailwind CSS + Recharts
- **Backend**: Node.js + Express
- **Deployment**: Docker + Docker Compose
- **Data Source**: `~/.claude/projects/` session files (JSONL format)

## Prerequisites

- Docker and Docker Compose installed
- Claude Code session files in `~/.claude/projects/`

## Quick Start

### Option 1: Using Docker (Recommended)

1. Clone or navigate to this directory:
```bash
cd claude-dashboard
```

2. Build and start the containers:
```bash
docker-compose up --build
```

3. Open your browser and visit:
   - Dashboard: http://localhost:3000
   - API: http://localhost:3001

4. To stop the containers:
```bash
docker-compose down
```

### Option 2: Local Development

#### Backend Setup
```bash
cd backend
npm install
npm start
```

Backend will run on http://localhost:3001

#### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

Frontend will run on http://localhost:3000

## Project Structure

```
claude-dashboard/
├── backend/
│   ├── server.js          # Express server with stats parsing
│   ├── package.json
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.jsx        # Main dashboard component
│   │   ├── main.jsx       # React entry point
│   │   └── index.css      # Tailwind styles
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── nginx.conf
│   └── Dockerfile
├── docker-compose.yml
└── README.md
```

## API Endpoints

### `GET /api/stats`
Returns comprehensive statistics including:
- Total projects, conversations, tool calls, and time spent
- Per-project breakdown with tool usage, model usage, tokens, and last activity
- Overall tool usage distribution
- Model usage distribution
- Activity timeline

### `GET /api/health`
Health check endpoint

### Telemetry (live OTel) endpoints
- `POST /v1/metrics`, `/v1/logs`, `/v1/traces` — OTLP/HTTP+JSON ingest
- `GET /api/telemetry/summary?days=N` — top-level totals
- `GET /api/telemetry/cost?days=N` — cost by model/skill/agent/plugin/day
- `GET /api/telemetry/time?days=N` — active time + API/tool durations
- `GET /api/telemetry/reliability?days=N` — tool success rates, errors, retries
- `GET /api/telemetry/prompts?days=N&limit=N` — recent prompts
- `GET /api/telemetry/prompts/:id` — full event timeline for one prompt
- `GET /api/telemetry/sessions?days=N` — session-level rollup
- `GET /api/telemetry/health` — receiver liveness

## Dashboard Features Explained

### Summary Cards
- **Total Projects**: Number of unique project directories
- **Total Conversations**: Number of Claude sessions across all projects
- **Total Tool Calls**: Sum of all tool invocations (Read, Write, Edit, Bash, etc.)
- **Total Time Spent**: Cumulative time spent in Claude sessions

### Charts
- **Top 10 Tools Used**: Bar chart showing most frequently used tools
- **Model Distribution**: Pie chart of Claude model usage (Sonnet, Opus, Haiku)

### Project Table
Detailed breakdown per project with:
- Conversation count
- Tool call count
- Time spent
- Token usage (input/output)
- Cache usage (creation/read)
- Last activity timestamp

## Data Privacy

- All data is read from your local `~/.claude/projects/` directory
- No external API calls or data transmission
- Dashboard runs entirely on your local machine
- Session files are mounted read-only in Docker

## Customization

### Change Ports
Edit `docker-compose.yml`:
```yaml
ports:
  - "YOUR_PORT:3000"  # Frontend
  - "YOUR_PORT:3001"  # Backend
```

### Styling
The dashboard uses Tailwind CSS with a dark theme. Modify `frontend/src/App.jsx` and `frontend/src/index.css` to customize colors and styling.

### Add More Stats
Extend `backend/server.js` `getStatistics()` function to parse additional data from session files.

## Troubleshooting

### No data showing
- Ensure `~/.claude/projects/` directory exists and contains session files
- Check Docker container has read access to the directory
- Verify session files are in JSONL format

### Port already in use
- Change ports in `docker-compose.yml`
- Or stop other services using ports 3000/3001

### Backend connection error
- Ensure backend container is running: `docker ps`
- Check backend logs: `docker logs claude-dashboard-backend`

## Development

### Hot Reload (Local Dev)
Both frontend and backend support hot reload during local development:
- Frontend: Vite automatically reloads on file changes
- Backend: Use `npm run dev` (requires Node 18+ for `--watch` flag)

### Adding Dependencies
```bash
# Frontend
cd frontend && npm install <package>

# Backend
cd backend && npm install <package>
```

## Future Enhancements

Possible features to add:
- Date range filtering
- Export statistics to CSV/JSON
- Cost estimation based on token usage
- Comparison between projects
- Time-series graphs for activity trends
- Search and filter capabilities
- Per-tool detailed analytics

## License

MIT

## Contributing

Feel free to submit issues and enhancement requests!
