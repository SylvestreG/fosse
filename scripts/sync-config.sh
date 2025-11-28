#!/bin/bash

# Script to sync config.json to frontend .env
# This keeps the frontend in sync with the backend config

CONFIG_FILE="../config.json"
ENV_FILE="../frontend/.env"

if [ ! -f "$CONFIG_FILE" ]; then
    echo "❌ Error: config.json not found at $CONFIG_FILE"
    exit 1
fi

# Extract values from config.json using jq (or basic grep if jq not available)
if command -v jq &> /dev/null; then
    CLIENT_ID=$(jq -r '.google_oauth.client_id' "$CONFIG_FILE")
    REDIRECT_URI=$(jq -r '.magic_link.base_url' "$CONFIG_FILE")/login
    API_URL="http://localhost:$(jq -r '.server.port' "$CONFIG_FILE")"
else
    # Fallback to grep/sed if jq not available
    CLIENT_ID=$(grep -o '"client_id"[[:space:]]*:[[:space:]]*"[^"]*"' "$CONFIG_FILE" | sed 's/.*"client_id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')
    BASE_URL=$(grep -o '"base_url"[[:space:]]*:[[:space:]]*"[^"]*"' "$CONFIG_FILE" | sed 's/.*"base_url"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')
    SERVER_PORT=$(grep -o '"port"[[:space:]]*:[[:space:]]*[0-9]*' "$CONFIG_FILE" | head -1 | sed 's/.*:[[:space:]]*\([0-9]*\)/\1/')
    REDIRECT_URI="${BASE_URL:-http://localhost:8080}/login"
    API_URL="http://localhost:${SERVER_PORT:-8080}"
fi

# Write .env file
cat > "$ENV_FILE" << EOF
# OAuth Configuration
# Auto-generated from config.json by scripts/sync-config.sh
# DO NOT EDIT MANUALLY - Edit config.json instead and run: npm run sync-config

VITE_GOOGLE_CLIENT_ID=$CLIENT_ID
VITE_REDIRECT_URI=$REDIRECT_URI
VITE_API_URL=$API_URL
EOF

echo "✅ Frontend .env synced from config.json"
echo "   Client ID: ${CLIENT_ID:0:20}..."
echo "   Redirect URI: $REDIRECT_URI"
echo "   API URL: $API_URL"

