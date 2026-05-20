# Installation Guide

## Quick Install (2 minutes)

### Prerequisites
- Docker Desktop installed and running
- Claude Code with session files in `~/.claude/projects/`

### Steps

1. **Navigate to the project directory:**
   ```bash
   cd ~/Personal/claude-dashboard
   ```

2. **Start the dashboard:**
   ```bash
   ./start.sh
   ```

3. **Open in your browser:**
   - Visit: http://localhost:3000

That's it! The dashboard will automatically read your Claude session files and display statistics.

### To stop the dashboard:
```bash
./stop.sh
```

## Manual Installation

If you prefer to run without Docker:

### Backend Setup
```bash
cd backend
npm install
npm start
```
Backend runs on: http://localhost:3001

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Frontend runs on: http://localhost:3000

## Verification

After starting, you should see:
- ✅ Dashboard at http://localhost:3000
- ✅ API health check at http://localhost:3001/api/health
- ✅ Stats endpoint at http://localhost:3001/api/stats

## Troubleshooting

### Docker not running
```bash
# Start Docker Desktop
open -a Docker
```

### Port already in use
```bash
# Check what's using port 3000 or 3001
lsof -i :3000
lsof -i :3001

# Kill the process or change ports in docker-compose.yml
```

### No data showing
- Ensure `~/.claude/projects/` exists and contains `.jsonl` files
- Click "Refresh Data" button in the dashboard
- Check backend logs: `docker logs claude-dashboard-backend`

### Permission issues
```bash
# Ensure session files are readable
ls -la ~/.claude/projects/
```

## Updating

To update the dashboard after making changes:

```bash
# Rebuild and restart containers
docker-compose up --build -d

# Or restart without rebuilding
docker-compose restart
```

## Uninstalling

```bash
# Stop and remove containers
docker-compose down

# Remove images (optional)
docker rmi claude-dashboard-frontend claude-dashboard-backend

# Delete the project directory (optional)
rm -rf ~/Personal/claude-dashboard
```

## Next Steps

- Explore the dashboard features
- Click on different projects to see details
- Use the refresh button to update statistics
- Check the README.md for advanced configuration

## Support

If you encounter issues:
1. Check Docker logs: `docker-compose logs`
2. Verify Docker is running: `docker ps`
3. Ensure ports 3000 and 3001 are available
4. Check `~/.claude/projects/` directory permissions
