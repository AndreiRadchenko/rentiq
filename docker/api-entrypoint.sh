#!/usr/bin/env bash
set -euo pipefail

echo "Running database migrations..."

cd /app
npm run db:migrate

echo "Migrations complete. Starting API..."
exec node dist/main.js
