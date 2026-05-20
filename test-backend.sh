#!/bin/bash

echo "🧪 Testing Claude Dashboard Backend..."
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

echo "✅ Node.js found: $(node --version)"
echo ""

# Navigate to backend
cd backend

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing backend dependencies..."
    npm install
    echo ""
fi

echo "🚀 Starting backend server for testing..."
echo "   Press Ctrl+C to stop"
echo ""
echo "Once started, open another terminal and run:"
echo "   curl http://localhost:3001/api/health"
echo "   curl http://localhost:3001/api/stats"
echo ""

npm start
