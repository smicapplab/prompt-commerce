# Prompt Commerce — Seller

Prompt Commerce is an open-source MCP server that lets small retailers manage their product catalog through AI chat. It is designed for independent retailers and social media sellers who prefer a conversational interface over complex inventory software.

This repo is the **seller service** — the admin panel, MCP server, and per-store SQLite databases. It pairs with the [Prompt Commerce Gateway](../prompt-commerce-gateway) which handles customer-facing operations, the Telegram shopping bot, and the retailer registry.

---

## Architecture

```
<root>/
  prompt-commerce/           ← THIS REPO — Seller admin (SvelteKit + Express + MCP)
  prompt-commerce-gateway/   ← Gateway — NestJS + Prisma + PostgreSQL
  _data/                     ← Runtime data (gitignored at root level)
    catalog.db               ← Registry DB: users, settings, stores list
    stores/
      <slug>.db              ← One SQLite file per store
    uploads/                 ← Product images (shared across all stores)
```

### Services

| Service | Port | Description |
|---------|------|-------------|
| Seller (Express + SvelteKit) | 3000 | Admin UI + MCP SSE server |
| Gateway (NestJS) | 3002 | Customer-facing API, Telegram bot, retailer registry |

### Database design

Two kinds of SQLite files live outside both repos in `_data/`:

- **Registry** (`catalog.db`) — users, settings, and the stores list. Shared across all stores.
- **Per-store** (`stores/<slug>.db`) — products, categories, promotions, reviews, orders, conversations, and per-store settings. One file per store; no `store_id` columns — the file itself is the scope.

Products and categories carry two sync-tracking columns: `is_synced` (dirty flag) and `deleted_at` (soft-delete). These drive the delta sync to the gateway.

---

## Features

### Multi-Store Admin Panel

- **Store picker** — on login you see all connected stores as cards. Select one and all subsequent pages are scoped to that store.
- **Store switching** — click "Switch" in the sidebar to return to the store picker at any time and select a different store or add a new one.
- **Store registration** — paste the platform key from the gateway; the system auto-fetches the store slug and name. No manual typing.
- **Per-store settings** — each store has its own AI provider (Claude or Gemini), API keys, model override, and Telegram integration config. Server-wide settings (gateway URL, gateway key) are separate.

### AI Assistant with Live Store Tools

- **Store-aware AI** — the assistant has direct access to the store's SQLite database via a set of built-in MCP tools. It queries real data rather than guessing.
- **Agentic tool-use loop** — the server runs a loop (up to 10 rounds) until the model produces a final text response, automatically executing any tool calls along the way.
- **Preview-before-save** — all write tools return a diff preview by default and require `confirm: true` to commit. This prevents accidental changes.
- **File upload** — attach images, CSV, or Excel files in the chat. Images are sent as base64 to the AI vision API; CSV/text files are injected as context.
- **Chat history** — conversation history is persisted per store in `localStorage`.
- **Dual provider** — switch between Claude, Gemini, and OpenAI per store. Models are loaded dynamically based on which API keys are configured.
- **Image Auto-Caching** — when adding products via AI, the system automatically downloads and caches images from URLs to the local `data/uploads` folder for persistence.

### Order Management & Lifecycle

- **Standardized lifecycle** — orders follow a strict progression: `pending` → `paid` → `picking` → `packing` → `ready_for_pickup` → `in_transit` → `delivered`. Supports `cancelled` and `refunded` states.
- **Visual status timeline** — each order detail page shows a clear progress indicator of where the order is in the fulfillment process.
- **Quick actions** — advance orders with a single click (e.g., "Mark as Packed", "Ship Order") based on their current status.
- **Manual order creation** — create orders directly from the admin panel by searching the product catalog and specifying buyer details.
- **Filtering & Search** — find orders by status, buyer reference, or internal notes.

### Delta Sync & Config Push

Products and categories track whether they have been pushed to the gateway:

- Every create/update sets `is_synced = 0` (dirty).
- Deletes are soft: `deleted_at` is stamped and `is_synced = 0`.
- A contextual **sync banner** appears on the Products and Categories pages whenever dirty rows exist, showing the count and a "Sync now" button.
- **AI & Payment Config Push** — gateway-specific settings (AI provider/keys, Payment provider/keys) are automatically pushed to the Gateway via `PATCH` whenever saved, ensuring the Telegram bot and checkout are always in sync.
- Sync pushes only the dirty rows — upserts for active items, deletes for soft-deleted ones — then marks them clean. The gateway receives `{ upsert, delete }` and applies row-by-row upserts rather than wiping and re-inserting.

- AI config (provider, key, model) is automatically pushed to the gateway whenever you save Settings, so the Telegram bot picks up the change immediately.

### MCP Server (for external AI agents)

- Each store gets its own SSE endpoint: `GET /sse/<slug>`
- The `x-gateway-key` header is validated against the store's gateway key. If `NULL`, all connections are allowed (setup mode).
- Old single `/sse` endpoint 301-redirects to `/sse/main-store` for backward compatibility.

---

## MCP Tools

### Read Tools

| Tool | Description |
|------|-------------|
| `search_products` | Search by keyword, category, or price range |
| `get_product` | Fetch full details by ID or SKU |
| `list_categories` | Browse the product taxonomy with product counts |
| `get_promotions` | View active deals and voucher codes |
| `get_reviews` | Access customer feedback and ratings |
| `list_orders` | List recent orders with status/date filters |
| `get_order` | Fetch a single order with all line items |
| `get_store_stats` | High-level overview: revenue, stock levels, pending items |

### Write Tools (preview-first)

| Tool | Description |
|------|-------------|
| `add_product` | Create a new listing with optional image download |
| `update_product` | Modify title, price, stock, category, active status |
| `update_inventory` | Quick stock-level update by ID or SKU |
| `import_products` | Bulk import/update from CSV or XLSX file |
| `create_category` | Create a new category (supports parent hierarchy) |
| `update_category` | Rename or re-parent an existing category |
| `delete_category` | Soft-delete a category |
| `batch_add_categories` | Create multiple categories at once |
| `create_promotion` | Create discount codes with percentage or fixed value |
| `update_promotion` | Modify an existing promotion |
| `delete_promotion` | Remove a promotion |
| `download_image` | Download an image from a URL and attach to a product |
| `add_review` | Register customer feedback |

---

## Installation

### Prerequisites

- Node.js 20+
- Docker (for the gateway's Postgres, managed via `dev.sh`)

### 1. Clone

```bash
git clone https://github.com/smicapplab/prompt-commerce.git
```

Place it alongside the gateway under the same parent folder:

```
<root>/
  prompt-commerce/
  prompt-commerce-gateway/
```

### 2. Install dependencies

```bash
cd prompt-commerce && npm install
```

### 3. Configure environment

Copy `.env.example` to `.env`:

```env
DATA_DIR=../         # _data/ is created here — outside both repos
PORT=3000
JWT_SECRET=change-me-to-a-long-random-string
JWT_EXPIRES_IN=1d
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
GATEWAY_URL=http://localhost:3002
```

### 4. Start everything

```bash
# From the root parent folder:
./dev.sh        # Linux / macOS
dev.bat         # Windows
```

`dev.sh`:
1. Kills anything on ports 3000 and 3002
2. Bootstraps `.env` files from `.env.example` if missing
3. Runs seller DB migrations (`npm run db:migrate`) — adds `is_synced`/`deleted_at` to existing stores
4. Starts the gateway's Postgres via Docker Compose
5. Starts both services with colour-prefixed log output

**Admin panel:** http://localhost:3000
Default credentials: `admin` / `admin123`

---

## Connecting a Store

1. Receive your **platform key** from the gateway administrator.
2. In the seller admin → **Stores** → **Add Store**, paste the platform key.
3. The seller auto-fetches the store slug and name from the gateway.
4. The per-store SQLite file (`_data/stores/<slug>.db`) is created automatically on first access.

---

## Claude Desktop / MCP Client Config

```json
{
  "mcpServers": {
    "my-store": {
      "url": "http://localhost:3000/sse/my-store-slug",
      "headers": {
        "x-gateway-key": "<your-gateway-key>"
      }
    }
  }
}
```

---

## Production Deployment

```bash
npm run build
pm2 start ecosystem.config.cjs
pm2 save && pm2 startup   # survive reboots
```

Zero-downtime updates:

```bash
npm run db:migrate && npm run build && pm2 reload prompt-commerce
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Admin UI | SvelteKit 5 (Svelte 5 runes) + Tailwind CSS |
| Server | Express + custom SSE handler |
| MCP | `@modelcontextprotocol/sdk` |
| AI (Claude) | `@anthropic-ai/sdk` — tool-use agentic loop |
| AI (Gemini) | `@google/generative-ai` — function declarations |
| Database | SQLite via `better-sqlite3` (multi-file, per-store) |
| Build | Vite + `@sveltejs/adapter-node` |

---

## Roadmap / TODO

- [ ] **Vector search** — generate embeddings for products on sync using a Hugging Face model (`all-MiniLM-L6-v2` via `@xenova/transformers` or HF Inference API), store in pgvector, enable semantic search like "apple laptop" → "Apple MacBook Pro" without requiring exact tag matches.
- [ ] Webhook support — notify external services on product/order changes
- [ ] Multi-language product descriptions
- [ ] Reviews and ratings integration

---

## License

MIT — free for commercial and personal use.
