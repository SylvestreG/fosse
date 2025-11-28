#!/bin/bash

# Script de build pour servir le frontend en statique depuis le backend

set -e

echo "🏗️  Building frontend..."
cd frontend
npm run build

echo "✅ Frontend built successfully!"
echo ""
echo "🦀 Building backend..."
cd ../backend
cargo build --release

echo "✅ Backend built successfully!"
echo ""
echo "🚀 Pour lancer l'application en mode statique :"
echo "   cd backend"
echo "   ./target/release/fosse-backend"
echo ""
echo "📍 L'application sera accessible sur http://localhost:8080"
echo "   (Le backend sert les fichiers statiques du frontend)"

