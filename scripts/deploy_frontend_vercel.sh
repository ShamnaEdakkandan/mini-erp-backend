#!/usr/bin/env bash
# Usage: VERCEL_TOKEN=... DJANGO_API_ORIGIN=https://api.example.com ./scripts/deploy_frontend_vercel.sh
set -euo pipefail
if [ -z "${VERCEL_TOKEN:-}" ]; then
  echo "Set VERCEL_TOKEN and DJANGO_API_ORIGIN environment variables before running." >&2
  exit 1
fi
if [ -z "${DJANGO_API_ORIGIN:-}" ]; then
  echo "Set DJANGO_API_ORIGIN to your backend origin (without /api)." >&2
  exit 1
fi
npx vercel --prod --token "$VERCEL_TOKEN" --yes --build-env "DJANGO_API_ORIGIN=$DJANGO_API_ORIGIN" --env "DJANGO_API_ORIGIN=$DJANGO_API_ORIGIN"
