# Development Environment Setup

## Prerequisites

- Docker and Docker Compose v2+
- Node.js LTS (20+) and pnpm 9+
- Python 3.12+
- Git
- PostgreSQL 16, Redis 7, MinIO (for stage environment)

## Quick Start

```bash
# Install dependencies
pnpm install

# Copy environment template
cp .env.example .env
# Edit .env with your local values

# Start production-like environment
docker compose up -d

# Verify
docker compose ps
```

## Monorepo Structure

```
rentiq/
├── apps/
│   ├── api/              # NestJS API
│   ├── admin-panel/      # Next.js admin
│   └── telegram-bot/     # Python bot
├── packages/
│   ├── config/           # Shared env validation (Zod)
│   └── i18n/             # Locale files (uk, en)
├── docker/               # Postgres init scripts
├── systemd/              # Stage service units
└── scripts/              # Backup scripts
```

## Available Commands

| Command | Description |
|---------|-------------|
| `pnpm lint` | Run ESLint across all workspaces |
| `pnpm typecheck` | Run TypeScript type checking |
| `pnpm test:unit` | Run unit tests |
| `pnpm test:e2e` | Run NestJS e2e tests |
| `pnpm format` | Format code with Prettier |

## Stage Environment (Host-Native)

Stage runs services directly on the host (not Docker) to minimize operational friction.

**Required ports:**
- PostgreSQL: 5433
- Redis: 6380
- MinIO API: 9002
- MinIO Console: 9003
- API: 3002
- Admin Panel: 3003

**Setup:**
```bash
cp .env.stage.example .env.stage
# Edit .env.stage with your values

# Create stage database
psql -p 5433 -c 'CREATE DATABASE "rentiq-stage";'

# Create stage MinIO bucket
mc mb local/rentiq-stage

# Start stage services
sudo systemctl start rentiq-api-stage
sudo systemctl start rentiq-bot-stage
```

## Database Migrations

```bash
cd apps/api

# Generate migration from schema changes
npx drizzle-kit generate --name <migration_name>

# Apply migrations
npx drizzle-kit migrate
```

Production applies migrations automatically on startup. Stage requires manual migration.

## CI Pipeline

Every PR must pass 5 gates before merge:
1. **Lint** - ESLint + Nx boundary rules
2. **Typecheck** - TypeScript compilation
3. **Unit Tests** - Jest
4. **E2E Tests** - NestJS e2e against containerized Postgres/Redis
5. **Secret Scan** - Detects credential-shaped values

## Troubleshooting

**Port conflicts in stage:**
```bash
# Check what's using the port
lsof -i :5433
# Adjust ports in .env.stage
```

**Migration fails in production:**
```bash
# Check migration status
cd apps/api
npx drizzle-kit migrate --help
```
