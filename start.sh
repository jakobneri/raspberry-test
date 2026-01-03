#!/bin/bash

# Raspberry Pi Server start script
# Builds (if needed) and launches the Node server from dist/index.js

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Check and build backend if needed
if [ ! -f "dist/index.js" ]; then
    echo "[start] Backend build not found. Building backend..."
    npm run build || exit 1
fi

# Check and build frontend if needed
if [ ! -f "frontend/dist/frontend/browser/index.html" ]; then
    echo "[start] Frontend build not found. Building frontend..."
    cd frontend
    npm install || exit 1
    npm run build || exit 1
    cd ..
fi

echo "[start] Starting server..."
npm start
