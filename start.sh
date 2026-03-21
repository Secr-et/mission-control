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
exec node .next/standalone/server.js
