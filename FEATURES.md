# Dashboard Features

## 📊 Overview Statistics

### Summary Cards
- **Total Projects**: Count of all Claude Code projects in `~/.claude/projects/`
- **Total Conversations**: Number of unique Claude sessions across all projects
- **Total Tool Calls**: Sum of all tool invocations (Read, Write, Edit, Bash, Agent, etc.)
- **Total Time Spent**: Cumulative time spent in Claude sessions with formatted duration

## 📈 Visualizations

### Tool Usage Bar Chart
- Top 10 most frequently used tools
- Interactive tooltips showing exact counts
- Sorted by usage frequency
- Helps identify your workflow patterns

### Model Distribution Pie Chart
- Visual breakdown of Claude model usage
- Shows distribution across Sonnet, Opus, and Haiku models
- Percentage labels for easy comparison
- Color-coded for clarity

## 📋 Project-Level Analytics

### Detailed Project Table
Each project row shows:

1. **Project Name**: Cleaned path (e.g., `~/Personal/my-project`)
2. **Conversations**: Number of Claude sessions in this project
3. **Tool Calls**: Total tool invocations for this project
4. **Time Spent**: Formatted duration (hours, minutes, seconds)
5. **Token Usage**:
   - Input tokens
   - Output tokens
6. **Cache Statistics**:
   - Cache creation tokens (new cached content)
   - Cache read tokens (reused cached content)
7. **Last Activity**: Timestamp of most recent Claude interaction

### Table Features
- Sorted by last activity (most recent first)
- Hover effects for better readability
- Formatted numbers with thousand separators
- Responsive layout for different screen sizes

## 🔄 Data Management

### Refresh Functionality
- Manual refresh button in header
- Reloads all statistics from session files
- No page reload required
- Loading states with smooth transitions

### Real-time Parsing
- Parses all `.jsonl` files in `~/.claude/projects/`
- Aggregates data from multiple sessions per project
- Handles malformed JSON gracefully
- Sorts and filters automatically

## 🎨 User Interface

### Design Features
- Dark theme optimized for developer comfort
- Responsive grid layout (works on all screen sizes)
- Color-coded elements for visual hierarchy
- Professional data visualization with Recharts
- Smooth transitions and hover effects

### Color Scheme
- Blue: Primary actions and project names
- Purple: Conversation counts
- Pink: Tool call counts
- Amber: Time metrics
- Slate: Background and borders

## 📊 Metrics Tracked

### Time Metrics
- Session duration (from first to last event)
- Turn duration (individual Claude responses)
- Cumulative time across all projects
- Formatted display (hours, minutes, seconds)

### Tool Metrics
- Individual tool usage counts
- Per-project tool distribution
- Overall tool popularity
- All tools tracked: Read, Write, Edit, Bash, Agent, WebFetch, WebSearch, etc.

### Token Metrics
- Input tokens (your prompts)
- Output tokens (Claude's responses)
- Cache creation tokens (new prompt caching)
- Cache read tokens (prompt cache hits)
- Useful for cost estimation and optimization

### Model Metrics
- Distribution across Claude models
- Per-project model preferences
- Model version tracking
- Helps understand usage patterns

## 🔒 Privacy & Security

### Local-Only Operation
- No external API calls
- No data transmission to external servers
- All processing happens locally
- Session files mounted read-only in Docker

### Data Access
- Only reads from `~/.claude/projects/`
- No write access to session files
- No sensitive data exposed
- Safe to run on production machines

## 🚀 Performance

### Optimizations
- Efficient JSONL parsing
- In-memory data aggregation
- Minimal file system access
- Fast chart rendering
- Responsive user interface

### Scalability
- Handles hundreds of session files
- Processes thousands of events
- Smooth performance with large datasets
- Efficient memory usage

## 🔧 Technical Features

### Session File Parsing
Extracts data from:
- User messages and prompts
- Assistant responses
- Tool use events
- System events (turn duration)
- Timestamps and metadata
- Permission modes
- Git branch information

### Data Aggregation
Calculates:
- Sum of tool calls per project
- Total time per project
- Token usage totals
- Model distribution
- Activity timelines
- Conversation counts

### Error Handling
- Graceful handling of malformed JSON
- Missing file handling
- Network error recovery
- User-friendly error messages
- Retry functionality

## 📱 Browser Compatibility

Works on:
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (responsive design)

## 🎯 Use Cases

### For Developers
- Track time spent on different projects
- Identify most-used tools
- Optimize workflow based on tool usage
- Monitor token consumption for cost control

### For Teams
- Compare project activity
- Understand collaboration patterns
- Identify knowledge sharing opportunities
- Track Claude adoption

### For Individuals
- Personal productivity insights
- Project time tracking
- Learning pattern identification
- Historical activity review

## 🔮 Future Enhancements

Potential additions:
- Date range filtering
- Export to CSV/JSON
- Cost estimation calculator
- Project comparison view
- Time-series activity graphs
- Custom dashboard layouts
- Search and filter capabilities
- Tool efficiency metrics
- Session replay viewer
- Custom metric definitions
