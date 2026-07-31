# Quickstart Validation Guide

Proves the Environment & Infrastructure Setup works end-to-end.

## Prerequisites

- Docker and Docker Compose v2+
- Node.js LTS and pnpm
- Python 3.12+
- PostgreSQL 17, Redis 7, MinIO installed on host (for stage)
- DBeaver (or any PostgreSQL client)
- Redis CLI or Redis Insight
- Git

## Stage Service Management

### Creating systemd services

#### PostgreSQL stage (port 5433)

```bash
# Create cluster if not exists
sudo LC_ALL=C pg_createcluster 17 stage
sudo sed -i 's/#port = 5432/port = 5433/' /etc/postgresql/17/stage/postgresql.conf
sudo sed -i 's/^port = 5432/port = 5433/' /etc/postgresql/17/stage/postgresql.conf
sudo sed -i "s/timezone = 'Europe\/Kiev'/timezone = 'Europe\/Kyiv'/" /etc/postgresql/17/stage/postgresql.conf
sudo sed -i "s/log_timezone = 'Europe\/Kiev'/log_timezone = 'Europe\/Kyiv'/" /etc/postgresql/17/stage/postgresql.conf

# Create systemd service
sudo tee /etc/systemd/system/postgresql-stage.service << 'EOF'
[Unit]
Description=PostgreSQL Stage (port 5433)
After=network.target

[Service]
Type=forking
User=postgres
ExecStart=/usr/lib/postgresql/17/bin/pg_ctl -D /var/lib/postgresql/17/stage -l /var/log/postgresql/postgresql-17-stage.log start
ExecStop=/usr/lib/postgresql/17/bin/pg_ctl -D /var/lib/postgresql/17/stage stop
ExecReload=/usr/lib/postgresql/17/bin/pg_ctl -D /var/lib/postgresql/17/stage reload
TimeoutSec=120

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable postgresql-stage
sudo systemctl start postgresql-stage

# Create user and database
sudo -u postgres psql -p 5433 -c "CREATE USER rentiq WITH PASSWORD '<password>';"
sudo -u postgres psql -p 5433 -c "CREATE DATABASE rentiq-stage OWNER rentiq;"
```

#### Redis stage (port 6380)

```bash
# Create config
sudo tee /etc/redis/redis-stage.conf << 'EOF'
port 6380
daemonize yes
dir /var/lib/redis-stage
logfile /var/log/redis/redis-stage.log
EOF

sudo mkdir -p /var/lib/redis-stage /var/log/redis
sudo chown redis:redis /var/lib/redis-stage /var/log/redis

# Create systemd service
sudo tee /etc/systemd/system/redis-stage.service << 'EOF'
[Unit]
Description=Redis Stage (port 6380)
After=network.target

[Service]
Type=forking
User=redis
ExecStart=/usr/bin/redis-server /etc/redis/redis-stage.conf
ExecStop=/usr/bin/redis-cli -p 6380 shutdown
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable redis-stage
sudo systemctl start redis-stage
```

#### MinIO stage (ports 9002/9003)

```bash
# Create data directory
mkdir -p /home/andrii/minio-data

# Create systemd service
sudo tee /etc/systemd/system/minio.service << 'EOF'
[Unit]
Description=MinIO Stage
After=network.target

[Service]
User=andrii
Environment=MINIO_ROOT_USER=rentiq
Environment=MINIO_ROOT_PASSWORD=<password>
ExecStart=/usr/local/bin/minio server /home/andrii/minio-data --address :9002 --console-address :9003
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable minio
sudo systemctl start minio
```

### Starting services

```bash
# PostgreSQL stage (port 5433)
sudo systemctl start postgresql-stage
# — or manually —
sudo -u postgres /usr/lib/postgresql/17/bin/pg_ctl -D /var/lib/postgresql/17/stage start

# Redis stage (port 6380)
sudo systemctl start redis-stage
# — or manually —
redis-server /etc/redis/redis-stage.conf

# MinIO stage (ports 9002 API / 9003 console)
sudo systemctl start minio
# — or manually —
MINIO_ROOT_USER=rentiq MINIO_ROOT_PASSWORD="<password>" minio server /home/andrii/minio-data --address :9002 --console-address :9003
```

### Stopping services

```bash
sudo systemctl stop postgresql-stage
sudo systemctl stop redis-stage
sudo systemctl stop minio
```

### Accessing services

| Service | Port | Access Method |
|---------|------|---------------|
| PostgreSQL | 5433 | DBeaver: `jdbc:postgresql://localhost:5433/rentiq-stage` with user `rentiq` |
| Redis | 6380 | Redis CLI: `redis-cli -p 6380` or Redis Insight GUI |
| MinIO API | 9002 | S3-compatible API at `http://localhost:9002` |
| MinIO Console | 9003 | Web UI at `http://localhost:9003` (user: `rentiq`) |

### Creating stage database and user

```bash
sudo -u postgres psql -p 5433 -c "CREATE USER rentiq WITH PASSWORD '<password>';"
sudo -u postgres psql -p 5433 -c "CREATE DATABASE rentiq-stage OWNER rentiq;"
```

### Creating MinIO bucket

```bash
# Via mc CLI
mc alias set local http://localhost:9002 rentiq "<password>"
mc mb local/rentiq-stage

# — or via web console —
# Open http://localhost:9003, login, create bucket "rentiq-stage"
```

### Connecting with DBeaver

1. New Connection → PostgreSQL
2. Host: `localhost` (or Tailscale IP)
3. Port: `5433`
4. Database: `rentiq-stage`
5. User: `rentiq`
6. Password: (from `.env.stage`)
7. If timezone error: add `?options=-c%20timezone=Europe/Kyiv` to JDBC URL

### Connecting with Redis CLI

```bash
redis-cli -p 6380
> PING
PONG
```

### Connecting with Redis Insight (GUI)

1. Download from [redis.io/insight](https://redis.io/insight/)
2. Add database: Host `localhost`, Port `6380`
3. Connect

## V1: Production environment starts

```bash
cp .env.example .env
# Edit .env with dummy values for local validation
docker compose up -d
docker compose ps
```

**Expected**: All 6 services (`api`, `admin-panel`, `telegram-bot`, `postgres`, `redis`, `minio`) are `Up`. Postgres accessible at `localhost:5432`. MinIO console at `localhost:9001`.

## V2: Stage environment starts

```bash
cp .env.stage.example .env.stage
# Edit .env.stage with real values

# Start stage services
sudo systemctl start postgresql-stage
sudo systemctl start redis-stage
sudo systemctl start minio

# Verify PostgreSQL
sudo -u postgres psql -p 5433 -c "SELECT version();"

# Verify Redis
redis-cli -p 6380 PING

# Verify MinIO (open console)
# http://localhost:9003
```

**Expected**: Stage Postgres accessible at `localhost:5433`. Redis at `localhost:6380`. MinIO console at `localhost:9003`.

## V3: Both environments coexist without cross-contamination

```bash
# Write marker to stage
psql -p 5433 -d rentiq-stage -c 'CREATE TABLE test_marker (id int); INSERT INTO test_marker VALUES (42);'

# Verify production does NOT have it
docker compose exec postgres psql -U rentiq -d rentiq -c 'SELECT * FROM test_marker;'
```

**Expected**: Production query returns error (relation does not exist). No cross-contamination.

## V4: CI passes on empty commit

```bash
git commit --allow-empty -m "ci: validate pipeline on empty commit"
git push origin 002-env-infra-setup
# Open PR — all 5 gates should be green
```

**Expected**: Lint, typecheck, unit tests, e2e tests, and secret scan all pass. PR is mergeable.

## V5: Missing env var fails startup

```bash
DATABASE_URL= node apps/api/dist/main.js
```

**Expected**: Process exits non-zero. Error message identifies `DATABASE_URL` as missing or invalid. Process does not start in a degraded state.

## V6: Migration tooling works

```bash
cd apps/api
npx drizzle-kit generate --name test_migration
ls src/infra/database/migrations/  # Generated migration file present
npx drizzle-kit migrate            # Applies cleanly (or reports no pending migrations)
```

**Expected**: Migration file generated. `drizzle-kit migrate` runs without error. File is reviewable in `git diff`.
