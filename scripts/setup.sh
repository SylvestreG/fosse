#!/bin/bash

echo "🚀 Setting up Fosse project..."

# Check if Rust is installed
if ! command -v cargo &> /dev/null; then
    echo "❌ Cargo not found. Please install Rust: https://rustup.rs/"
    exit 1
fi

# Check if Node is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js: https://nodejs.org/"
    exit 1
fi

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd backend && cargo build
if [ $? -ne 0 ]; then
    echo "❌ Backend installation failed"
    exit 1
fi

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd ../frontend && npm install
if [ $? -ne 0 ]; then
    echo "❌ Frontend installation failed"
    exit 1
fi

cd ..

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Update backend/config.json with your configuration"
echo "  2. Update frontend/src/lib/auth.ts with your Google OAuth client ID"
echo "  3. Run 'make dev' to start the development servers"

