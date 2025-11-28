#!/bin/bash

# Script de développement avec auto-rebuild
# Le backend sert les fichiers statiques qui se rebuild automatiquement

set -e

echo "🏗️  Mode développement avec auto-rebuild"
echo ""
echo "📦 Build initial du frontend..."
cd frontend
npm run build
cd ..

echo ""
echo "🚀 Démarrage de l'application..."
echo ""
echo "   Frontend: Auto-rebuild activé (surveille les changements)"
echo "   Backend:  Sert les fichiers statiques sur http://localhost:8080"
echo ""
echo "💡 Les deux processus tournent en parallèle"
echo "   Ctrl+C pour tout arrêter"
echo ""

# Fonction pour cleanup à l'arrêt
cleanup() {
    echo ""
    echo "🛑 Arrêt des processus..."
    kill $FRONTEND_PID $BACKEND_PID 2>/dev/null || true
    exit 0
}

trap cleanup INT TERM

# Lancer le frontend en mode watch (en arrière-plan)
cd frontend
npm run build:watch &
FRONTEND_PID=$!
cd ..

# Attendre un peu pour que le premier build se termine
sleep 3

# Lancer le backend
cd backend
cargo run &
BACKEND_PID=$!
cd ..

echo "✅ Application lancée !"
echo ""
echo "📍 Accédez à l'application sur: http://localhost:8080"
echo ""
echo "   Modifiez vos fichiers dans frontend/src/"
echo "   → Le frontend se rebuild automatiquement"
echo "   → Rafraîchissez le navigateur pour voir les changements"
echo ""

# Attendre que les processus se terminent
wait

