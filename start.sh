#!/bin/bash

echo "🚀 Starting Claude Usage Dashboard..."
echo ""
echo "This will:"
echo "  - Build Docker containers for frontend and backend"
echo "  - Mount ~/.claude/projects/ (read-only)"
echo "  - Start the dashboard on http://localhost:3000"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if ~/.claude/projects exists
if [ ! -d "$HOME/.claude/projects" ]; then
    echo "⚠️  Warning: ~/.claude/projects directory not found."
    echo "   The dashboard will run but may not show any data."
    echo ""
fi

echo "Building and starting containers..."
docker-compose up --build -d

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Dashboard is running!"
    echo ""
    echo "📊 Open http://localhost:3000 in your browser"
    echo "🔧 API available at http://localhost:3001"
    echo ""
    echo "To view logs:"
    echo "  docker-compose logs -f"
    echo ""
    echo "To stop:"
    echo "  docker-compose down"
    echo ""
else
    echo ""
    echo "❌ Failed to start containers. Check the error messages above."
    exit 1
fi
