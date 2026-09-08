#!/usr/bin/env bash
# Usage: VERCEL_TOKEN=... NEXT_PUBLIC_API_BASE=https://api.example.com ./scripts/deploy_frontend_vercel.sh
if [ -z "$VERCEL_TOKEN" ]; then
  echo "Set VERCEL_TOKEN and NEXT_PUBLIC_API_BASE environment variables before running." >&2
  exit 1
fi
if [ -z "$NEXT_PUBLIC_API_BASE" ]; then
  echo "Set NEXT_PUBLIC_API_BASE to your backend base URL." >&2
  exit 1
fi
npx vercel --prod --token $VERCEL_TOKEN --confirm --env NEXT_PUBLIC_API_BASE=$NEXT_PUBLIC_API_BASE
