# Chat History Feature

## Overview
Added a comprehensive chat history viewer that lets you browse and view all past Claude Code conversations stored in JSONL session files.

## Features Implemented

### Backend (`backend/chat/history-router.js`)

1. **Session Listing Endpoint** (`GET /api/history/sessions`)
   - Scans all projects in `~/.claude/projects/`
   - Returns list of sessions with metadata:
     - Session ID and project name
     - Preview text (first user message, filtered)
     - Message counts (user + assistant)
     - Created/updated timestamps
     - Git branch info
   - Filters out system/meta messages for clean previews

2. **Conversation Retrieval** (`GET /api/history/sessions/:projectDir/:sessionId`)
   - Loads full conversation from JSONL file
   - Properly processes message content:
     - Extracts text from multi-part messages
     - Identifies tool calls (Read, Write, Edit, etc.)
     - Deduplicates streaming responses using UUIDs
   - Returns structured conversation with:
     - User and assistant messages
     - Tool call details
     - Model information
     - Token usage stats
     - Timestamps

3. **Text Processing**
   - Filters out meta messages:
     - `<local-command-caveat>`
     - `<command-name>`
     - `<local-command-stdout>`
     - `<system-reminder>`
   - Extracts readable text from content arrays
   - Handles both string and structured content formats

### Frontend (`frontend/src/ChatHistory.jsx`)

1. **Two-Column Layout**
   - **Left Sidebar**: Session list with search and filtering
   - **Right Panel**: Full conversation display

2. **Session List Features**
   - Search by message content or project name
   - Filter by project
   - Shows preview, project, message count, branch
   - Visual indication of selected session
   - Sorted by most recent first

3. **Conversation Display**
   - Chat bubble interface (user on right, assistant on left)
   - Avatar icons for user/assistant
   - Expandable tool call details with syntax highlighting
   - Message timestamps
   - Model information tags
   - Token usage tooltips
   - Auto-scroll to bottom on load

4. **UI Styling**
   - Matches existing AI Assistant design
   - Same color scheme (INK: #1A1A1A, backgrounds, etc.)
   - Space Mono monospace font
   - Responsive layout
   - Smooth hover effects

### Integration

- Added new tab "CHAT HISTORY" in main App component
- Integrated with existing navigation/tab system
- Consistent with Overview, Telemetry, and AI Assistant tabs

## API Endpoints

### List All Sessions
```bash
GET /api/history/sessions
```

**Response:**
```json
{
  "sessions": [
    {
      "sessionId": "778df53f-6853-4ed1-bccd-9b972c3195c9",
      "projectName": "~/Personal/claude/dashboard",
      "preview": "from <session-id>.jsonl can we revive...",
      "messageCount": 115,
      "userMessages": 50,
      "assistantMessages": 65,
      "createdAt": "2026-05-20T09:22:47.248Z",
      "updatedAt": "2026-05-20T09:30:39.513Z",
      "gitBranch": "HEAD"
    }
  ]
}
```

### Get Conversation Details
```bash
GET /api/history/sessions/:projectDir/:sessionId
```

**Response:**
```json
{
  "sessionId": "778df53f-6853-4ed1-bccd-9b972c3195c9",
  "projectName": "~/Personal/claude/dashboard",
  "conversation": [
    {
      "role": "user",
      "content": "from <session-id>.jsonl can we revive...",
      "timestamp": "2026-05-20T09:23:27.304Z",
      "uuid": "d820e9be-b960-4244-aa25-682d67f211a1"
    },
    {
      "role": "assistant",
      "content": "Looking at your question...",
      "toolCalls": [
        {
          "name": "Read",
          "id": "toolu_...",
          "input": { "file_path": "/path/to/file" }
        }
      ],
      "model": "claude-opus-4-7",
      "timestamp": "2026-05-20T09:23:30.500Z",
      "uuid": "846747e9-f7b8-4e45-b4c3-c2ff69ef9f76",
      "usage": {
        "input_tokens": 6,
        "output_tokens": 36
      }
    }
  ],
  "metadata": {
    "gitBranch": "HEAD",
    "entrypoint": "cli",
    "cwd": "/Users/...",
    "createdAt": "2026-05-20T09:22:47.248Z",
    "updatedAt": "2026-05-20T09:30:39.513Z",
    "messageCount": 120
  }
}
```

## How It Works

1. **Data Source**: Reads directly from `~/.claude/projects/` JSONL session files
2. **Event Processing**: Parses JSONL events and filters by type (`user`, `assistant`)
3. **Deduplication**: Uses UUID tracking to handle streaming responses
4. **Content Extraction**: Processes multi-part messages (text + tool calls)
5. **Metadata Enrichment**: Adds project, branch, timestamp, token info

## Usage

1. Navigate to the "CHAT HISTORY" tab
2. Browse sessions in the sidebar (search/filter available)
3. Click a session to view the full conversation
4. Expand tool call details to see parameters
5. Hover over token tags to see usage breakdown

## Benefits

- **Session Recovery**: View any past conversation in full detail
- **Project Context**: See which project/branch each conversation was in
- **Tool Analysis**: Understand which tools were used and how
- **Token Tracking**: Review token usage for specific conversations
- **Search & Filter**: Quickly find conversations by content or project

## Technical Details

- No external dependencies (uses existing JSONL format)
- Read-only (doesn't modify session files)
- Efficient: Only loads full conversation when selected
- Scalable: Handles hundreds of sessions
- Privacy: All data stays local (no external API calls)

## Files Modified/Created

### Created:
- `backend/chat/history-router.js` - API routes for history
- `frontend/src/ChatHistory.jsx` - UI component

### Modified:
- `backend/server.js` - Added history routes
- `frontend/src/App.jsx` - Added Chat History tab

## Future Enhancements

Possible additions:
- Export conversation to markdown/JSON
- Date range filtering
- Model/entrypoint filtering
- Full-text search across all messages
- Conversation statistics (avg tokens, tools used, etc.)
- Compare conversations side-by-side
- Resume conversation in AI Assistant
