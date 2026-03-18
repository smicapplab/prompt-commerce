import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { getDb } from './db/client.js';
import { registerProductTools } from './tools/products.js';
import { registerCategoryTools } from './tools/categories.js';
import { registerPromotionTools } from './tools/promotions.js';
import { registerReviewTools } from './tools/reviews.js';

// ─── Initialise DB ────────────────────────────────────────────────────────────
const db = getDb();

// ─── Seed default admin user if none exists ───────────────────────────────────
// (The admin package handles hashing; we just check the table is ready.)
// The admin NestJS app seeds the first user on its own startup.

// ─── MCP Server ───────────────────────────────────────────────────────────────
const mcpServer = new McpServer({
  name: 'prompt-commerce',
  version: '1.0.0',
});

registerProductTools(mcpServer, db);
registerCategoryTools(mcpServer, db);
registerPromotionTools(mcpServer, db);
registerReviewTools(mcpServer, db);

// ─── Express HTTP Layer ───────────────────────────────────────────────────────
const app = express();
app.use(express.json());

/**
 * Middleware: validate the x-gateway-key header.
 * If no gateway key has been configured yet, all connections are allowed
 * (useful during initial setup). Once a key is set via the admin panel,
 * it becomes required.
 */
function validateGatewayKey(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): void {
  const row = db
    .prepare(`SELECT value FROM settings WHERE key = 'gateway_key'`)
    .get() as { value: string } | undefined;

  if (!row || !row.value) {
    // No key configured — open access (dev/first-run mode)
    next();
    return;
  }

  const provided = req.headers['x-gateway-key'];
  if (provided !== row.value) {
    res.status(401).json({ error: 'Invalid or missing x-gateway-key header.' });
    return;
  }

  next();
}

// Track active SSE transports so POST /messages can route to the right session
const transports = new Map<string, SSEServerTransport>();

// SSE connection endpoint — MCP clients connect here
app.get('/sse', validateGatewayKey, async (req, res) => {
  const transport = new SSEServerTransport('/messages', res);
  transports.set(transport.sessionId, transport);

  res.on('close', () => {
    transports.delete(transport.sessionId);
  });

  await mcpServer.connect(transport);
});

// Message endpoint — MCP clients POST tool calls here
app.post('/messages', async (req, res) => {
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

  await transport.handlePostMessage(req, res);
});

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'prompt-commerce-mcp', version: '1.0.0' });
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.MCP_PORT ?? '3001', 10);

app.listen(PORT, () => {
  console.log(`\n🚀  Prompt Commerce MCP Server`);
  console.log(`   SSE endpoint : http://localhost:${PORT}/sse`);
  console.log(`   Health check : http://localhost:${PORT}/health`);

  const gatewayRow = db
    .prepare(`SELECT value FROM settings WHERE key = 'gateway_key'`)
    .get() as { value: string } | undefined;

  if (gatewayRow?.value) {
    console.log(`   Gateway key  : configured ✓`);
  } else {
    console.log(`   Gateway key  : ⚠️  not set — open access. Configure via admin panel.`);
  }
  console.log('');
});
