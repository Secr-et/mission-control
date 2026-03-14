#!/bin/bash
# Mission Control production start script for launchd
# Builds first to ensure assets are fresh, then runs production server
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
set -e
cd /Users/toddlewey/Projects/mission-control
pnpm run build
exec node node_modules/next/dist/bin/next start -p 3005 -H 0.0.0.0
