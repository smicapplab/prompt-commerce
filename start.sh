#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Prompt Commerce Seller — Build & Start with PM2
# Run from inside prompt-commerce/
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "  Prompt Commerce — Build & Start"
echo "  ────────────────────────────────"
echo ""

# ── Build MCP server ──────────────────────────────────────────────────────────
echo "→  Installing & building MCP server..."
cd "$DIR"
npm install
npm run build
echo "✔  MCP server built"

# ── Build Admin panel ─────────────────────────────────────────────────────────
echo "→  Installing & building Admin panel..."
cd "$DIR/admin"
npm install
npm run build
echo "✔  Admin panel built"

# ── Start with PM2 ────────────────────────────────────────────────────────────
echo "→  Starting services with PM2..."
cd "$DIR"
pm2 start ecosystem.config.cjs

echo ""
echo "✔  Services started. Useful commands:"
echo "   pm2 list          — see status"
echo "   pm2 logs          — tail all logs"
echo "   pm2 restart all   — restart everything"
echo ""
echo "   Run once to survive reboots:"
echo "   pm2 save && pm2 startup"
echo ""
