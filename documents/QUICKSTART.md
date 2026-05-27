# Quick Start Guide

## 🚀 Get Started in 3 Steps

### Step 1: Start the Dashboard
```bash
cd ~/Personal/claude-dashboard
./start.sh
```

### Step 2: Open Browser
Visit: **http://localhost:3000**

### Step 3: View Your Stats
Click "Refresh Data" to load the latest statistics!

---

## 🎯 Common Commands

| Action | Command |
|--------|---------|
| Start dashboard | `./start.sh` |
| Stop dashboard | `./stop.sh` |
| View logs | `docker-compose logs -f` |
| Restart | `docker-compose restart` |
| Rebuild | `docker-compose up --build -d` |

---

## 📊 What You'll See

### At a Glance
- **4 Summary Cards**: Projects, Conversations, Tool Calls, Time Spent
- **2 Charts**: Tool Usage (Bar) & Model Distribution (Pie)
- **1 Table**: Detailed per-project statistics

### Key Metrics
- ⏱️ **Time**: How long you've worked with Claude
- 🛠️ **Tools**: Which tools you use most (Read, Write, Edit, Bash, etc.)
- 🤖 **Models**: Distribution of Sonnet, Opus, Haiku usage
- 🔢 **Tokens**: Input/output tokens and cache statistics

---

## 🔧 Troubleshooting

### Issue: No data showing
**Solution**: 
- Ensure `~/.claude/projects/` exists
- Check if it contains `.jsonl` files
- Click "Refresh Data" button

### Issue: Port already in use
**Solution**:
```bash
# Change ports in docker-compose.yml
ports:
  - "3030:3000"  # Frontend
  - "3031:3001"  # Backend
```

### Issue: Docker not running
**Solution**:
```bash
# Start Docker Desktop
open -a Docker
# Then retry: ./start.sh
```

---

## 💡 Pro Tips

1. **Refresh Regularly**: Click "Refresh Data" after new Claude sessions
2. **Check Token Usage**: Monitor cache hits to optimize costs
3. **Track Time**: See which projects take most of your time
4. **Identify Patterns**: Use tool usage data to improve workflow
5. **Compare Projects**: Sort by different columns to find insights

---

## 📁 Project Structure

```
claude-dashboard/
├── start.sh           ← Use this to start
├── stop.sh            ← Use this to stop
├── docker-compose.yml ← Container configuration
├── backend/           ← API server (Node.js)
└── frontend/          ← Dashboard UI (React)
```

---

## 🌐 URLs

- **Dashboard**: http://localhost:3000
- **API Health**: http://localhost:3001/api/health
- **API Stats**: http://localhost:3001/api/stats

---

## 📚 More Help

- Detailed features: See `FEATURES.md`
- Installation guide: See `INSTALL.md`
- Full documentation: See `README.md`

---

## 🎨 Dashboard Preview

The dashboard shows:
```
┌─────────────────────────────────────────────┐
│  Claude Usage Dashboard       [Refresh]     │
├─────────────────────────────────────────────┤
│  📊 Summary Cards (4 metrics)               │
├──────────────────┬──────────────────────────┤
│  Tool Usage      │  Model Distribution      │
│  (Bar Chart)     │  (Pie Chart)             │
├──────────────────┴──────────────────────────┤
│  📋 Project Statistics Table                │
│  (All projects with detailed metrics)       │
└─────────────────────────────────────────────┘
```

---

## ✅ Checklist

Before first use:
- [ ] Docker Desktop installed and running
- [ ] Claude Code has created session files
- [ ] Ports 3000 and 3001 are available
- [ ] Run `./start.sh`
- [ ] Open http://localhost:3000

---

## 🆘 Need Help?

Check these in order:
1. Docker running: `docker ps`
2. Containers status: `docker-compose ps`
3. Logs: `docker-compose logs`
4. Session files: `ls ~/.claude/projects/`

Still stuck? Check the full README.md or INSTALL.md
