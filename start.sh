#!/bin/bash
# MC launcher for launchd — uses standalone output mode
cd /Users/toddlewey/Projects/mission-control
export NODE_ENV=production

# Load env vars
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

# Override port to 3005 (our standard)
export PORT=3005

export PATH="/opt/homebrew/bin:$PATH"

# Standalone mode doesn't bundle static assets — copy them on each start
cp -r .next/static .next/standalone/.next/static 2>/dev/null
cp -r public .next/standalone/public 2>/dev/null

exec node .next/standalone/server.js
