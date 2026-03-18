#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Prompt Commerce — Seller Dev Launcher
# Starts MCP Server (3001) and Admin Panel (3000) with colour-coded output.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"

# ANSI colours
G='\033[0;32m'  # green
B='\033[0;34m'  # blue
R='\033[0;31m'  # red
N='\033[0m'     # reset

PREFIX_MCP="${G}[mcp-server] ${N}"
PREFIX_ADMIN="${B}[admin]      ${N}"

pids=()

cleanup() {
  echo ""
  echo "Stopping seller services…"
  for pid in "${pids[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
  echo "Done."
}
trap cleanup EXIT INT TERM

run_with_prefix() {
  local prefix="$1"
  shift
  "$@" 2>&1 | while IFS= read -r line; do
    echo -e "${prefix}${line}"
  done &
  pids+=($!)
}

echo ""
echo "  Prompt Commerce — Seller Launcher"
echo "  ──────────────────────────────────"
echo ""

if [ ! -f "$DIR/.env" ]; then
  echo -e "${R}[warn] .env not found — copying from .env.example${N}"
  cp "$DIR/.env.example" "$DIR/.env"
fi

# Install deps if needed
if [ ! -d "$DIR/node_modules" ]; then
  echo "Installing MCP server dependencies…"
  npm install
fi
if [ ! -d "$DIR/admin/node_modules" ]; then
  echo "Installing admin dependencies…"
  (cd admin && npm install)
fi

run_with_prefix "$PREFIX_MCP"   bash -c "npm run dev"
run_with_prefix "$PREFIX_ADMIN" bash -c "cd admin && npm run dev"

echo ""
echo -e "  ${G}MCP Server${N}  → http://localhost:3001"
echo -e "  ${B}Admin Panel${N} → http://localhost:3000"
echo ""
echo "  Press Ctrl+C to stop everything."
echo ""

wait
