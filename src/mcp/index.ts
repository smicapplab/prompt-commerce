import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import type { Application, Request, Response, NextFunction } from 'express';
import { registerProductTools } from './tools/products.js';
import { registerCategoryTools } from './tools/categories.js';
import { registerPromotionTools } from './tools/promotions.js';
import { registerReviewTools } from './tools/reviews.js';
import { registerOrderTools } from './tools/orders.js';
import { getRegistryDb, getStoreDb } from './db/client.js';
import { validateTempKey } from '../lib/server/auth.js';
import type Database from 'better-sqlite3';

// ─── MCP Server factory ───────────────────────────────────────────────────────
function createMcpServer(storeDb: Database.Database, storeSlug: string): McpServer {
  const mcpServer = new McpServer({
    name: `prompt-commerce/${storeSlug}`,
    version: '1.0.0',
  });

  registerProductTools(mcpServer, storeDb);
  registerCategoryTools(mcpServer, storeDb);
  registerPromotionTools(mcpServer, storeDb);
  registerReviewTools(mcpServer, storeDb);
  registerOrderTools(mcpServer, storeDb);

  return mcpServer;
}

// ─── Gateway-key middleware ───────────────────────────────────────────────────
/**
 * Validates the x-gateway-key header against the store's gateway_key in the
 * registry. If the store has no key set, all connections are allowed (useful
 * during initial setup).
 */
function makeGatewayKeyMiddleware(slug: string) {
  return function validateGatewayKey(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    const registry = getRegistryDb();
    const store = registry
      .prepare(`SELECT gateway_key FROM stores WHERE slug = ? AND active = 1`)
      .get(slug) as { gateway_key: string | null } | undefined;

    if (!store) {
      res.status(404).json({ error: `Store "${slug}" not found.` });
      return;
    }

    const provided = req.headers['x-gateway-key'] as string;
    if (!provided) {
      res.status(401).json({ error: 'Missing x-gateway-key header.' });
      return;
    }

    // 1. Check if it's the static store gateway key (used by the Telegram gateway)
    if (store.gateway_key && provided === store.gateway_key) {
      // Attach a gateway identity so req.user is always defined downstream
      (req as any).user = { sub: 0, username: 'gateway', role: 'admin', storeRole: 'admin' };
      next();
      return;
    }

    // 2. Check if it's a valid temporary user key
    const user = validateTempKey(provided);
    if (user) {
      // 1. Global admins have access to all stores
      if (user.role === 'super_admin' || user.role === 'admin') {
        (req as any).user = { ...user, storeRole: 'admin' };
        next();
        return;
      }

      // 2. Otherwise check specific store mapping
      const db = getRegistryDb();
      const mapping = db
        .prepare('SELECT role FROM user_stores WHERE user_id = ? AND store_slug = ?')
        .get(user.sub, slug) as { role: string } | undefined;

      if (mapping) {
        (req as any).user = { ...user, storeRole: mapping.role };
        next();
        return;
      }

      res.status(403).json({ error: 'User does not have access to this store.' });
      return;
    }

    res.status(401).json({ error: 'Invalid x-gateway-key.' });
    return;
  };
}

/**
 * Mount MCP SSE routes onto an existing Express app.
 *
 * Each store gets its own endpoint:
 *   GET  /sse/:slug        — MCP clients connect here (SSE stream)
 *   POST /messages/:slug   — MCP clients POST tool calls here
 *
 * Examples:
 *   http://localhost:3000/sse/main-store
 *   http://localhost:3000/sse/my-boutique
 */
export function mountMcp(app: Application): void {
  const transports = new Map<string, SSEServerTransport>();

  // SSE connection endpoint — one per store slug
  app.get('/sse/:slug', (req, res, next) => {
    makeGatewayKeyMiddleware(req.params.slug)(req, res, next);
  }, async (req, res) => {
    const slug = req.params.slug;
    const transport = new SSEServerTransport(`/messages/${slug}`, res);
    (transport as any).slug = slug; // Attach slug to transport for POST validation
    transports.set(transport.sessionId, transport);

    res.on('close', () => {
      transports.delete(transport.sessionId);
    });

    const storeDb = getStoreDb(slug);
    const mcpServer = createMcpServer(storeDb, slug);
    await mcpServer.connect(transport);
  });

  // Message endpoint — MCP clients POST tool calls here
  app.post('/messages/:slug', (req, res, next) => {
    makeGatewayKeyMiddleware(req.params.slug)(req, res, next);
  }, async (req, res) => {
    const sessionId = req.query['sessionId'] as string | undefined;
    if (!sessionId) {
      res.status(400).json({ error: 'Missing sessionId query parameter.' });
      return;
    }

    const transport = transports.get(sessionId);
    if (!transport) {
      res.status(404).json({ error: `Session "${sessionId}" not found or expired.` });
      return;
    }

    if ((transport as any).slug !== req.params.slug) {
      res.status(403).json({ error: 'Forbidden: Session does not match store slug.' });
      return;
    }

    await transport.handlePostMessage(req, res);
  });

  // Recording endpoint for gateway (authenticated via x-gateway-key)
  app.post('/api/gateway/conversations/:slug', (req, res, next) => {
    makeGatewayKeyMiddleware(req.params.slug)(req, res, next);
  }, async (req, res) => {
    const slug = req.params.slug;
    const { buyer_ref, channel, telegram_chat_id, message, sender } = req.body;

    if (!buyer_ref || !message) {
      res.status(400).json({ error: 'buyer_ref and message are required' });
      return;
    }

    const db = getStoreDb(slug);
    const now = new Date().toISOString();

    try {
      // Find or create conversation by buyer_ref + channel
      let conv = db.prepare(`SELECT * FROM conversations WHERE buyer_ref = ? AND channel = ?`)
        .get(buyer_ref, channel || 'telegram') as any;

      if (!conv) {
        const result = db.prepare(`
          INSERT INTO conversations (buyer_ref, channel, telegram_chat_id, status, created_at, updated_at)
          VALUES (?, ?, ?, 'open', ?, ?)
        `).run(buyer_ref, channel || 'telegram', telegram_chat_id, now, now);
        conv = { id: result.lastInsertRowid };
      } else if (telegram_chat_id && conv.telegram_chat_id !== telegram_chat_id) {
        // Sync the chat_id if it's new/updated
        db.prepare(`UPDATE conversations SET telegram_chat_id = ?, updated_at = ? WHERE id = ?`)
          .run(telegram_chat_id, now, conv.id);
      }

      // Record the message
      const result = db.prepare(`
        INSERT INTO messages (conversation_id, sender, body, created_at)
        VALUES (?, ?, ?, ?)
      `).run(conv.id, sender || 'buyer', message, now);

      // Update conversation timestamp
      db.prepare(`UPDATE conversations SET updated_at = ? WHERE id = ?`).run(now, conv.id);

      res.status(201).json({ conversation_id: conv.id, message_id: result.lastInsertRowid });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Backward-compat: /sse without slug → redirect to /sse/main-store ───────
  // Helps users who registered the old endpoint URL.
  app.get('/sse', (_req, res) => {
    res.redirect(301, '/sse/main-store');
  });
}
