#!/bin/bash

# Raspberry Pi Server start script
# Builds (if needed) and launches the unified CLI

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Check and build backend if needed
if [ ! -f "dist/unified-cli.js" ]; then
    echo "[start] Backend build not found. Building backend..."
    npm run build || exit 1
fi

echo "[start] Starting unified CLI..."
node dist/unified-cli.js
