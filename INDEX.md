# Claude Usage Dashboard - Index

Welcome to the Claude Usage Dashboard! This index will help you navigate all the documentation and resources.

## 🚀 Getting Started (Start Here!)

1. **[QUICKSTART.md](QUICKSTART.md)** - Get up and running in 3 steps
2. **[INSTALL.md](INSTALL.md)** - Detailed installation guide
3. **[README.md](README.md)** - Complete project documentation

## 📚 Documentation

### For Users
- **[QUICKSTART.md](QUICKSTART.md)** - Quick reference guide (3-minute read)
- **[FEATURES.md](FEATURES.md)** - Complete feature list and explanations
- **[INSTALL.md](INSTALL.md)** - Step-by-step installation instructions

### For Developers
- **[PROJECT_SUMMARY.md](PROJECT_SUMMARY.md)** - Technical overview and architecture
- **[README.md](README.md)** - Full documentation with API details
- **[.env.example](.env.example)** - Environment variable reference

## 🎯 What This Dashboard Does

### Core Features
- ✅ Project-wise statistics and analytics
- ✅ Tool usage tracking and visualization
- ✅ Time spent analysis per project
- ✅ Token usage and cache metrics
- ✅ Model distribution analytics
- ✅ Interactive charts and graphs
- ✅ Real-time data refresh

### What You'll See
1. **Summary Cards** - 4 key metrics at a glance
2. **Tool Usage Chart** - Bar chart of top 10 tools
3. **Model Distribution** - Pie chart of model usage
4. **Project Table** - Detailed per-project statistics

## 🛠️ Quick Commands

```bash
# Start the dashboard
./start.sh

# Stop the dashboard
./stop.sh

# Test backend locally
./test-backend.sh

# View logs
docker-compose logs -f

# Rebuild containers
docker-compose up --build -d
```

## 📁 Project Structure

```
claude-dashboard/
│
├── 📄 Documentation
│   ├── INDEX.md              ← You are here
│   ├── README.md             ← Main documentation
│   ├── QUICKSTART.md         ← Quick start guide
│   ├── INSTALL.md            ← Installation guide
│   ├── FEATURES.md           ← Feature documentation
│   ├── PROJECT_SUMMARY.md    ← Technical summary
│   └── LOGO.txt              ← ASCII logo
│
├── 🚀 Scripts
│   ├── start.sh              ← Start dashboard
│   ├── stop.sh               ← Stop dashboard
│   └── test-backend.sh       ← Test backend
│
├── 🐳 Docker
│   ├── docker-compose.yml    ← Container orchestration
│   ├── .dockerignore         ← Docker ignore rules
│   └── .env.example          ← Environment variables
│
├── 🔧 Backend (Node.js/Express)
│   ├── backend/
│   │   ├── server.js         ← API + stats parser
│   │   ├── package.json      ← Dependencies
│   │   └── Dockerfile        ← Backend container
│
├── 🎨 Frontend (React/Vite)
│   ├── frontend/
│   │   ├── src/
│   │   │   ├── App.jsx       ← Dashboard UI
│   │   │   ├── main.jsx      ← Entry point
│   │   │   └── index.css     ← Styles
│   │   ├── index.html        ← HTML template
│   │   ├── package.json      ← Dependencies
│   │   ├── vite.config.js    ← Vite config
│   │   ├── tailwind.config.js← Tailwind config
│   │   ├── postcss.config.js ← PostCSS config
│   │   ├── nginx.conf        ← Nginx config
│   │   └── Dockerfile        ← Frontend container
│
└── 📦 Configuration
    ├── package.json          ← Root scripts
    └── .gitignore            ← Git ignore rules
```

## 🎓 Learning Path

### Beginner
1. Read [QUICKSTART.md](QUICKSTART.md)
2. Run `./start.sh`
3. Open http://localhost:3000
4. Explore the dashboard

### Intermediate
1. Read [FEATURES.md](FEATURES.md)
2. Understand the metrics
3. Analyze your usage patterns
4. Use data for optimization

### Advanced
1. Read [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md)
2. Explore the code (`backend/server.js`, `frontend/src/App.jsx`)
3. Customize and extend features
4. Contribute improvements

## 📊 Data Source

The dashboard reads session files from:
```
~/.claude/projects/
```

File format: JSONL (JSON Lines)
Access: Read-only
Privacy: Fully local, no external calls

## 🔧 Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + Vite |
| Styling | Tailwind CSS |
| Charts | Recharts |
| Backend | Node.js + Express |
| Container | Docker + Docker Compose |
| Server | Nginx (production) |

## 🌐 URLs

Once started:
- **Dashboard**: http://localhost:3000
- **API Health**: http://localhost:3001/api/health
- **API Stats**: http://localhost:3001/api/stats

## ❓ Common Questions

### Q: How do I start the dashboard?
**A:** Run `./start.sh` in the project directory.

### Q: Where is the data coming from?
**A:** From `~/.claude/projects/` - your local Claude session files.

### Q: Is my data sent anywhere?
**A:** No! Everything runs locally, no external API calls.

### Q: Can I customize it?
**A:** Yes! It's open source. Edit the code as needed.

### Q: How do I stop it?
**A:** Run `./stop.sh` or `docker-compose down`.

### Q: How do I update the data?
**A:** Click the "Refresh Data" button in the dashboard.

## 🆘 Troubleshooting

| Issue | Solution |
|-------|----------|
| No data showing | Check `~/.claude/projects/` exists |
| Port in use | Change ports in `docker-compose.yml` |
| Docker error | Ensure Docker Desktop is running |
| Build fails | Check Docker has enough resources |
| Backend error | View logs: `docker logs claude-dashboard-backend` |

## 📈 Metrics Explained

### Time Spent
Total duration of all Claude sessions in a project.

### Tool Calls
Number of times you used tools (Read, Write, Edit, Bash, etc.).

### Tokens
- **Input**: Your prompts
- **Output**: Claude's responses
- **Cache Created**: New cached content
- **Cache Read**: Reused cached content

### Models
Distribution of Claude models used (Sonnet, Opus, Haiku).

## 🎯 Use Cases

### Personal
- Track productivity
- Optimize workflow
- Monitor token usage
- Review project activity

### Team
- Compare project engagement
- Identify tool preferences
- Share best practices
- Track Claude adoption

## 🔮 Future Ideas

See [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md#-future-enhancement-ideas) for a full list of potential enhancements.

## 📝 Quick Links

| Topic | File |
|-------|------|
| Quick Start | [QUICKSTART.md](QUICKSTART.md) |
| Installation | [INSTALL.md](INSTALL.md) |
| Features | [FEATURES.md](FEATURES.md) |
| Full Docs | [README.md](README.md) |
| Technical | [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md) |
| Logo | [LOGO.txt](LOGO.txt) |

## ✅ Pre-flight Checklist

Before starting:
- [ ] Docker Desktop installed
- [ ] Docker is running
- [ ] Ports 3000 and 3001 available
- [ ] `~/.claude/projects/` exists
- [ ] Navigate to project directory

Then run:
```bash
./start.sh
```

## 🎉 You're All Set!

Everything is documented and ready to use. Start with [QUICKSTART.md](QUICKSTART.md) and you'll be analyzing your Claude usage in minutes!

---

**Need Help?** Check the docs in this order:
1. QUICKSTART.md (fastest)
2. INSTALL.md (detailed setup)
3. README.md (complete reference)
4. PROJECT_SUMMARY.md (technical deep-dive)

**Happy Analyzing! 📊✨**
