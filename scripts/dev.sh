#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Prompt Commerce — Seller Dev Launcher
#
# Starts a single process on port 3000:
#   Express  — MCP/SSE endpoint for the gateway
#   Vite     — Admin UI with hot reload (mounted as Express middleware)
#
# Usage: ./dev.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"

G='\033[0;32m'
R='\033[0;31m'
N='\033[0m'

PREFIX="${G}[seller]${N} "

pids=()
cleanup() {
  echo ""
  echo "Stopping seller…"
  for pid in "${pids[@]}"; do kill "$pid" 2>/dev/null || true; done
  wait 2>/dev/null || true
  echo "Done."
}
trap cleanup EXIT INT TERM

run_prefix() {
  local prefix="$1"; shift
  "$@" 2>&1 | while IFS= read -r line; do echo -e "${prefix}${line}"; done &
  pids+=($!)
}

echo ""
echo "  Prompt Commerce — Seller Dev"
echo "  ─────────────────────────────"
echo ""

# ── Bootstrap .env ────────────────────────────────────────────────────────────
if [ ! -f "$DIR/.env" ]; then
  echo -e "  ${R}[warn]${N} .env not found — copying from .env.example"
  cp "$DIR/.env.example" "$DIR/.env"
fi

# ── Clear port ────────────────────────────────────────────────────────────────
# SEC-10: Dynamically detect port from .env to ensure robust process cleanup
TARGET_PORT=$(grep "^PORT=" "$DIR/.env" | cut -d'=' -f2 | grep -oE "[0-9]+" || echo 3000)
PIDS=$(lsof -ti :$TARGET_PORT 2>/dev/null || true)
if [ -n "$PIDS" ]; then
  echo "  Clearing port $TARGET_PORT…"
  echo "$PIDS" | xargs kill -9 2>/dev/null || true
  sleep 1
fi

# ── Install deps if needed ────────────────────────────────────────────────────
if [ ! -d "$DIR/node_modules" ]; then
  echo "  Installing dependencies…"
  cd "$DIR" && npm install
fi

# ── Run migrations (safe, idempotent) ─────────────────────────────────────────
echo "  Running DB migrations…"
cd "$DIR" && npm run db:migrate --silent

# ── Start server (Express + Vite middleware) ──────────────────────────────────
run_prefix "$PREFIX" bash -c "cd '$DIR' && npm run dev:server"

echo ""
echo -e "  ${G}Admin UI${N}   → http://localhost:3000/admin"
echo -e "  ${G}MCP / SSE${N}  → http://localhost:3000/sse/:store-slug"
echo ""
echo "  Press Ctrl+C to stop."
echo ""

wait
