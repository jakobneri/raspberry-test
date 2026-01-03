#!/bin/bash

# Unified Raspberry Pi Server Manager
# This script runs the TypeScript-based unified CLI which handles:
# - Server starting with auto-update
# - User management
# - System monitoring
# - Build management

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Build if needed
if [ ! -f "dist/unified-cli.js" ]; then
    echo "Building project..."
    npm run build || exit 1
fi

# Run the unified CLI
node dist/unified-cli.js
