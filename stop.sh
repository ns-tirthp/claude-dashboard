#!/bin/bash

echo "🛑 Stopping Claude Usage Dashboard..."

docker-compose down

if [ $? -eq 0 ]; then
    echo "✅ Dashboard stopped successfully!"
else
    echo "❌ Failed to stop containers."
    exit 1
fi
