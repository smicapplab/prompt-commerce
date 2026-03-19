// ─────────────────────────────────────────────────────────────────────────────
// PM2 Ecosystem — Prompt Commerce Seller (EC2)
//
// First-time setup:
//   npm install && npm run build          (in prompt-commerce/)
//   cd admin && npm install && npm run build && cd ..
//   pm2 start ecosystem.config.js
//   pm2 save
//   pm2 startup    (copy-paste the command it prints to enable reboot survival)
//
// Useful commands:
//   pm2 list                see all processes
//   pm2 logs                tail all logs
//   pm2 logs mcp-server     tail one service
//   pm2 restart all         restart everything
//   pm2 reload all          zero-downtime reload
//   pm2 stop all            stop without removing
//   pm2 delete all          stop and remove from pm2
// ─────────────────────────────────────────────────────────────────────────────

const path = require('path');
const ROOT = __dirname;

module.exports = {
  apps: [
    // ── MCP Server (port 3001) ──────────────────────────────────────────────
    {
      name: 'mcp-server',
      script: 'dist/index.js',
      cwd: ROOT,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
      },
    },

    // ── Admin Panel (port 3000) ─────────────────────────────────────────────
    {
      name: 'admin',
      script: 'dist/server.js',
      cwd: path.join(ROOT, 'admin'),
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
