/**
 * Custom server entry point — runs MCP SSE routes + SvelteKit admin UI
 * on a single port (default 3000).
 *
 * Dev:   tsx watch server.ts     → Express + Vite middleware on :3000, hot reload included
 * Prod:  node build/index.js    → Express + SvelteKit built handler on :3000
 */
import 'dotenv/config'; // ← must be first — loads .env before DATA_DIR is evaluated
import express from 'express';
import { getRegistryDb, getUploadDir } from './src/mcp/db/client.js';
import { mountMcp } from './src/mcp/index.js';

// ─── Initialise registry DB (users, settings, stores) ─────────────────────────
const db = getRegistryDb();

// ─── Express app ──────────────────────────────────────────────────────────────
const app = express();
// Global body parser removed — SvelteKit handles its own body parsing

// Serve uploaded product images from _data/uploads/
const UPLOAD_DIR = getUploadDir();
app.use('/uploads', express.static(UPLOAD_DIR));

// ─── MCP routes (/sse/:slug, /messages/:slug) ──────────────────────────────────
mountMcp(app);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'prompt-commerce', version: '1.0.0' });
});

// ─── SvelteKit / Vite handler ─────────────────────────────────────────────────
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction) {
  // Production: serve the compiled SvelteKit build
  const { handler } = await import('./build/handler.js');
  app.use(handler);
} else {
  // Dev: mount Vite as Express middleware — hot reload on the same port as MCP
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'custom',
  });
  app.use(vite.middlewares);
}

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT ?? '3000', 10);

app.listen(PORT, () => {
  console.log(`\n🚀  Prompt Commerce`);
  console.log(`   Admin UI    : http://localhost:${PORT}/admin`);
  console.log(`   SSE (MCP)   : http://localhost:${PORT}/sse/:store-slug`);
  console.log(`   Health      : http://localhost:${PORT}/health`);
  if (!isProduction) console.log(`   Hot reload  : ✓ (Vite middleware)`);

  const stores = db
    .prepare(`SELECT slug, gateway_key FROM stores WHERE active = 1`)
    .all() as { slug: string; gateway_key: string | null }[];

  if (stores.length === 0) {
    console.log(`   Stores      : none — register a store via the gateway first`);
  } else {
    for (const s of stores) {
      const keyStatus = s.gateway_key ? 'key ✓' : '⚠️  no gateway key';
      console.log(`   Store       : /sse/${s.slug}  (${keyStatus})`);
    }
  }
  console.log('');
});
