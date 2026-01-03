#!/bin/bash
# Smart CLI launcher - only rebuilds if dist doesn't exist

if [ -f "dist/cli.js" ]; then
    node dist/cli.js
else
    npm run build && node dist/cli.js
fi
