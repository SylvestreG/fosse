#!/bin/bash

echo "🧪 Running all tests..."

# Run backend tests
echo "Testing backend..."
cd backend && cargo test --all
if [ $? -ne 0 ]; then
    echo "❌ Backend tests failed"
    exit 1
fi

echo "✅ All tests passed!"

