#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Prompt Commerce — Production Deployment Script
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ANSI color codes
G='\033[0;32m'
B='\033[0;34m'
R='\033[0;31m'
N='\033[0m'

# Print the failed step on any error
trap 'echo -e "\n${R}❌ Deployment failed at the step above. See error output above for details.${N}\n"' ERR

echo -e "\n${B}🚀 Starting Prompt Commerce Deployment...${N}\n"

# 1. Ensure logs directory exists
mkdir -p logs

# 2. Install dependencies
echo -e "${G}Step 1/4: Installing dependencies...${N}"
npm install

# 3. Run database migrations
echo -e "${G}Step 2/4: Running database migrations...${N}"
npm run db:migrate

# 4. Build the application
echo -e "${G}Step 3/4: Building application...${N}"
npm run build

# 5. Start/Reload with PM2
echo -e "${G}Step 4/4: Launching with PM2...${N}"
if pm2 show prompt-commerce > /dev/null 2>&1; then
  echo -e "Application exists, reloading for zero-downtime..."
  pm2 reload ecosystem.config.cjs
else
  echo -e "Application not found in PM2, starting new instance..."
  pm2 start ecosystem.config.cjs
fi

# 7. Done
trap - ERR
echo -e "\n${B}✅ Deployment complete!${N}"
echo -e "To see logs:    ${G}pm2 logs prompt-commerce${N}"
echo -e "To see status: ${G}pm2 list${N}"
echo -e "\nRemember to run ${R}pm2 save${N} if you want this to persist after server reboot.\n"
