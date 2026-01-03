#!/bin/bash

# Raspberry Pi Server start script
# Builds (if needed) and launches the Node server from dist/index.js

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

if [ ! -f "dist/index.js" ]; then
    echo "[start] Build not found. Building..."
    npm run build || exit 1
fi

echo "[start] Starting server..."
npm start
