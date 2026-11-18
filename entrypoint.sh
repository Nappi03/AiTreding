#!/bin/sh
set -e

echo "=========================================================="
echo " Starting AiTrading - Revolut AI Hedge Fund Analyst"
echo "=========================================================="

# Ensure data directory exists
mkdir -p /app/data

# Sync Prisma SQLite schema (skip-generate prevents generator errors in production)
echo "[DATABASE] Synchronizing SQLite database at /app/data/trading.db..."
prisma db push --skip-generate || true

# Seed initial settings if DB is new
if [ -f "/app/prisma/seed.js" ]; then
  echo "[DATABASE] Running seed script to ensure initial settings..."
  node /app/prisma/seed.js || true
fi

echo "[SERVER] Starting Next.js standalone server on port ${PORT:-3000}..."
exec node server.js
