#!/usr/bin/env bash
# Usage: RENDER_API_KEY=... RENDER_SERVICE_ID=... ./scripts/deploy_backend_render.sh
if [ -z "$RENDER_API_KEY" ] || [ -z "$RENDER_SERVICE_ID" ]; then
  echo "Set RENDER_API_KEY and RENDER_SERVICE_ID environment variables before running." >&2
  exit 1
fi

curl -X POST \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $RENDER_API_KEY" \
  "https://api.render.com/v1/services/$RENDER_SERVICE_ID/deploys" \
  -d '{"clearCache":false}'
