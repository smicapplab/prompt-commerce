#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Prompt Commerce — Seller Database Reset Utility
#
# This script:
#   1. Finds the data directory from .env (DATA_DIR)
#   2. Deletes the entire data directory (SQLite files + uploads)
#   3. Recreates the schema and seeds the default admin user
#
# Usage: ./scripts/reset-db.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR"

# ANSI colours
G='\033[0;32m'
Y='\033[0;33m'
R='\033[0;31m'
B='\033[0;34m'
N='\033[0m'

echo ""
echo "  Prompt Commerce Seller — Database Reset"
echo "  ────────────────────────────────────────"
echo ""

# ── 1. Load Data Directory ────────────────────────────────────────────────────
if [ ! -f ".env" ]; then
  echo -e "${Y}  .env not found — using default data directory${N}"
  DATA_DIR="../data"
else
  # Find DATA_DIR in .env
  DATA_DIR=$(grep "^DATA_DIR=" .env | cut -d= -f2- | tr -d '"' | tr -d "'")
  [ -z "$DATA_DIR" ] && DATA_DIR="../data"
fi

# Resolve absolute path for safety
ABS_DATA_DIR=$(cd "$DIR" && mkdir -p "$DATA_DIR" && cd "$DATA_DIR" && pwd)

echo -e "  Target Data Dir: ${B}${ABS_DATA_DIR}${N}"
echo -e "  ${R}WARNING: This will DESTROY all databases and uploaded images!${N}"
echo ""

read -p "  Are you sure you want to proceed? (y/N) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "  Reset cancelled."
    exit 0
fi

# ── 2. Perform Reset ──────────────────────────────────────────────────────────
echo -e "\n  ${B}▶ Wiping data directory...${N}"
rm -rf "$ABS_DATA_DIR"
mkdir -p "$ABS_DATA_DIR"

echo -e "  ${B}▶ Recreating schema and seeding admin...${N}"
npm run db:migrate --silent

echo -e "\n  ${G}✔ Seller database reset and seeded successfully!${N}"
echo ""
