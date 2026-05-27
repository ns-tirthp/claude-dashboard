#!/bin/bash
# Setup script for Recommendations feature

echo "🔧 Setting up Recommendations feature..."

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd frontend
npm install lucide-react
cd ..

# Create data directory
echo "📁 Creating data directory..."
mkdir -p backend/data
chmod 755 backend/data

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Start backend: cd backend && npm start"
echo "2. Start frontend: cd frontend && npm run dev"
echo "3. Navigate to http://localhost:3000"
echo "4. Click on '💡 RECOMMENDATIONS' tab"
echo "5. Click 'Run Analysis' to generate recommendations"
