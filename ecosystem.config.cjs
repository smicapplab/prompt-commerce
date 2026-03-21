// ─────────────────────────────────────────────────────────────────────────────
// PM2 Ecosystem — Prompt Commerce Seller
//
// Single process serves everything on port 3000:
//   /sse  /messages   — MCP SSE for the gateway
//   /admin  /api/*    — SvelteKit admin panel + REST API
//
// First-time setup:
//   ./start.sh                        (installs, migrates, builds, starts)
//
// Update / redeploy:
//   npm run db:migrate                (apply any new schema changes)
//   npm run build                     (rebuild the app)
//   pm2 reload prompt-commerce        (zero-downtime reload)
//
// Useful PM2 commands:
//   pm2 list                          see all processes
//   pm2 logs                          tail all logs
//   pm2 logs prompt-commerce          tail this service
//   pm2 restart prompt-commerce       hard restart
//   pm2 reload prompt-commerce        zero-downtime reload
//   pm2 stop prompt-commerce          stop without removing
//   pm2 delete prompt-commerce        stop and remove
//   pm2 save && pm2 startup           survive reboots (run once)
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  apps: [
    {
      name: 'prompt-commerce',
      script: 'build/index.js',    // adapter-node production entry
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '400M',
      env: {
        NODE_ENV: 'production',
        PORT: '3000',
      },
    },
  ],
};
