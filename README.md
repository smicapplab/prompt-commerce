<p align="left">
  <img src="screenshots/logo.png" alt="Prompt Commerce logo" width="100">
</p>

# Prompt Commerce — Seller

Prompt Commerce is an open-source MCP server that lets small retailers manage their product catalog through AI chat. It is designed for independent retailers and social media sellers who prefer a conversational interface over complex inventory software.

This repo is the **seller service** — the admin panel, MCP server, and per-store SQLite databases. It pairs with the [Prompt Commerce Gateway](../prompt-commerce-gateway) which handles customer-facing operations, the Telegram shopping bot, and the retailer registry.

---

## Screenshots

### Seller Dashboard
<img src="screenshots/dashboard.png" alt="Seller Dashboard" width="800">

*Central overview of store performance and onboarding checklist.*

### Product & Category Management
| ![Category Page](screenshots/category.png) | ![Product Page](screenshots/products.png) |
| :---: | :---: |
| *Category Taxonomy* | *Product Listings & Sync Status* |

### AI Assistant Chat
| ![AI Assistant Chat](screenshots/ai-assitant.png) | ![AI Settings](screenshots/ai-settings.png) |
| :---: | :---: |
| *Conversational interface for managing the store via MCP tools.* | *Fine-tune your LLM provider, model, and system prompt.* |

---

## Architecture

```
<root>/
  prompt-commerce/           ← THIS REPO — Seller admin (SvelteKit + Express + MCP)
  prompt-commerce-gateway/   ← Gateway — NestJS + Prisma + PostgreSQL
  data/                      ← Runtime data (gitignored at root level)
    catalog.db               ← Registry DB: users, settings, stores list
    stores/
      <slug>.db              ← One SQLite file per store
    uploads/                 ← Product images (shared across all stores)
  seller.config.json         ← Non-technical seller config (gatewayUrl, sellerPublicUrl)
  dev.sh / dev.bat           ← Master launcher — starts both services
```

### Services

| Service | Port | Description |
|---------|------|-------------|
| Seller (Express + SvelteKit) | 3000 | Admin UI + MCP SSE server |
| Gateway (NestJS) | 3002 | Customer-facing API, Telegram bot, retailer registry |

### Database design

Two kinds of SQLite files live outside both repos in `data/`:

- **Registry** (`catalog.db`) — users, settings, and the stores list. Shared across all stores.
- **Per-store** (`stores/<slug>.db`) — products, categories, promotions, reviews, orders, conversations, and per-store settings. One file per store; no `store_id` columns — the file itself is the scope.

Products and categories carry two sync-tracking columns: `is_synced` (dirty flag) and `deleted_at` (soft-delete). These drive the delta sync to the gateway.

---

## Features

### Zero-Config First Launch

Designed for non-technical store owners — no manual `.env` editing required:

- **Auto `.env` creation** — if `.env` is missing on first run, it is created from `.env.example` automatically.
- **JWT secret auto-generation** — if the JWT secret is absent or weak (< 32 characters), a cryptographically secure 64-character hex secret is generated and written to `.env` at startup. No manual step needed.
- **`seller.config.json`** — a plain JSON file committed to the repo for setting `gatewayUrl` and `sellerPublicUrl`. Non-technical sellers edit this file instead of `.env`. Comments (`_readme`, `_comment` keys) explain each field in plain English.
- **Forced password change** — the default admin account (`admin` / `admin123`) is flagged at seed time. On first login, the system detects this and presents an inline step-2 form to set a new password before proceeding. There is no way to skip it.

### Multi-Store Admin Panel

- **Store picker** — on login you see all connected stores as cards. Select one and all subsequent pages are scoped to that store.
- **Store switching** — click "Switch" in the sidebar to return to the store picker at any time.
- **Store registration** — paste the platform key from the gateway; the system auto-fetches the store slug and name.
- **Per-store settings** — each store has its own AI provider (Claude, Gemini, or OpenAI), API keys, model override, Telegram integration config, and payment provider config. Server-wide settings (gateway URL, public URL) are separate.

### Security

- **RBAC** — five roles enforced on every API route and MCP call. See [User Management](#user-management--rbac) below.
- **MCP authentication** — `x-gateway-key` header is mandatory. Access is blocked if missing or invalid.
- **Temporary access tokens** — users generate expiring tokens (1–24h) from Settings → AI for use in Claude Desktop or other MCP clients. Tokens inherit the user's role and store-access constraints.
- **Brute-force protection** — login endpoint enforces per-IP rate limiting: 5 failures triggers a 15-minute lockout with `HTTP 429` + `Retry-After` header.
- **Image upload validation** — MIME type, file extension (jpeg/png/gif/webp/avif/svg), and 10 MB size cap enforced before writing to disk.
- **`import_products` path validation** — only `.xlsx`/`.csv` files accepted; path traversal blocked via `path.resolve()` + allowedDirs check.
- **SSRF protection** — `downloadAndCacheImages` resolves hostnames via DNS and rejects any URL that resolves to a private/loopback/link-local IP (10.x, 172.16–31.x, 192.168.x, 127.x, 169.254.x, CGNAT).

### AI Assistant with Live Store Tools

- **Store-aware AI** — the assistant has direct access to the store's SQLite database via MCP tools. It queries real data rather than guessing.
- **Agentic tool-use loop** — the server runs a loop (up to 10 rounds) until the model produces a final text response, automatically executing any tool calls along the way.
- **Preview-before-save** — all write tools return a diff preview by default and require `confirm: true` to commit. This prevents accidental changes.
- **File upload** — attach images, CSV, or Excel files in chat. Images are sent as base64 to the AI vision API; CSV/text files are injected as context.
- **Chat history** — conversation history persisted per store.
- **Dual provider** — switch between Claude, Gemini, and OpenAI per store.
- **Image auto-caching** — when adding products via AI, the system automatically downloads and caches images from URLs to `data/uploads` with SSRF protection on every fetch.

### Order Management & Lifecycle

- **Standardized lifecycle** — orders follow a strict progression: `pending` → `paid` → `picking` → `packing` → `ready_for_pickup` → `in_transit` → `delivered`. Supports `cancelled` and `refunded` states.
- **Visual status timeline** — each order detail page shows a clear progress indicator.
- **Quick actions** — advance orders with a single click (e.g., "Mark as Packed", "Ship Order") based on their current status.
- **Manual order creation** — create orders directly from the admin panel.
- **Filtering & search** — find orders by status, buyer reference, or notes.
- **Seller order notifications** — when a customer places an order via Telegram, the seller receives an instant Telegram message with item breakdown, total, and buyer details (configurable via Settings → Telegram → Notification Chat ID).

### Delta Sync & Config Push

- Every create/update sets `is_synced = 0` (dirty); deletes are soft (`deleted_at` stamped, `is_synced = 0`).
- A **sync banner** appears on Products and Categories pages whenever dirty rows exist.
- **Image URL absolutization** — `/uploads/…` paths are prefixed with `SELLER_PUBLIC_URL` at sync time so Telegram can display product images correctly.
- **AI config push** — AI provider/key/model/system prompt auto-pushed to gateway on every save.
- **Payment config push** — payment provider settings auto-pushed on every save.
- **Telegram config push** — `telegram_notify_chat_id` pushed to gateway on save.

### User Management & RBAC

| Role | Scope | Permissions |
|------|-------|-------------|
| `super_admin` | Global | Full access; manage all stores and all users |
| `admin` | Global | Full access; cannot manage other high-level admins |
| `store_admin` | Store | Full access to assigned store(s); can manage store users |
| `merchandising` | Store | View store; manage products, categories, promotions |
| `ops` | Store | View store; manage orders and reviews |

### MCP Server (for external AI agents)

- Each store gets its own SSE endpoint: `GET /sse/<slug>`
- Old `/sse` 301-redirects to `/sse/main-store` for backward compatibility.
- **Mandatory `x-gateway-key`** — access is blocked immediately if missing.
- **Temporary user tokens** — generate from Settings → AI tab; inherit user RBAC; configurable expiry 1–24h.

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
| `add_product` | Create a new listing with optional SSRF-protected image download |
| `update_product` | Modify title, price, stock, category, active status |
| `update_inventory` | Quick stock-level update by ID or SKU |
| `import_products` | Bulk import/update from CSV or XLSX (extension + path-traversal validated) |
| `create_category` | Create a new category (supports parent hierarchy) |
| `update_category` | Rename or re-parent an existing category |
| `delete_category` | Soft-delete a category |
| `batch_add_categories` | Create multiple categories at once |
| `create_promotion` | Create discount codes with percentage or fixed value |
| `update_promotion` | Modify an existing promotion |
| `delete_promotion` | Remove a promotion |
| `download_image` | Download an image from a URL and attach to a product |
| `add_review` | Register customer feedback |
| `create_order` | Place an order programmatically (used by Telegram checkout) |

---

## Installation

### Prerequisites

- Node.js 20+
- Docker (for the gateway's Postgres, managed via `dev.sh`)

### 1. Clone both repos

```bash
git clone https://github.com/smicapplab/prompt-commerce.git
git clone https://github.com/smicapplab/prompt-commerce-gateway.git
```

Place them under the same parent folder:

```
<root>/
  prompt-commerce/
  prompt-commerce-gateway/
```

### 2. (Optional) Configure `seller.config.json`

Edit `prompt-commerce/seller.config.json` if you need to set a custom gateway URL or public URL. For local dev the defaults work out of the box.

```json
{
  "gatewayUrl": "http://localhost:3002",
  "sellerPublicUrl": ""
}
```

### 3. Start everything

```bash
# From the root parent folder:
./dev.sh        # Linux / macOS
dev.bat         # Windows
```

`dev.sh` handles everything automatically:
1. Clears ports 3000 and 3002
2. Creates `.env` files from `.env.example` if missing
3. Runs seller DB migrations — auto-generates JWT secret if missing/weak
4. Starts gateway Postgres via Docker Compose
5. Waits for Postgres to be ready
6. Runs Prisma migrations and regenerates the client
7. Starts both services with colour-prefixed log output

**Admin panel:** http://localhost:3000
Default credentials: `admin` / `admin123`
You will be prompted to change the default password on first login.

---

## Connecting a Store

1. Receive your **platform key** from the gateway administrator.
2. In the seller admin → **Stores** → **Add Store**, paste the platform key.
3. The seller auto-fetches the store slug and name from the gateway.
4. The per-store SQLite file (`data/stores/<slug>.db`) is created automatically on first access.

---

## Production Deployment

### Environment

Set `SELLER_PUBLIC_URL` to your public domain so Telegram can display product images:

```env
SELLER_PUBLIC_URL=https://shop.example.com
```

Or set it in `seller.config.json` — same effect.

### Deploy

```bash
npm run build
pm2 start ecosystem.config.cjs
pm2 save && pm2 startup   # survive reboots
```

Zero-downtime updates:

```bash
npm run db:migrate && npm run build && pm2 reload prompt-commerce
```

### Claude Desktop / MCP Client Config

```json
{
  "mcpServers": {
    "my-store": {
      "url": "https://shop.example.com/sse/my-store-slug",
      "headers": {
        "x-gateway-key": "<your-temp-token-from-settings>"
      }
    }
  }
}
```

Generate temp tokens from **Settings → AI → Temporary Access Token** in the admin panel.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Admin UI | SvelteKit 5 (Svelte 5 runes) + Tailwind CSS |
| Server | Express + custom SSE handler |
| MCP | `@modelcontextprotocol/sdk` |
| AI (Claude) | `@anthropic-ai/sdk` — tool-use agentic loop |
| AI (Gemini) | `@google/generative-ai` — function declarations |
| AI (OpenAI) | `openai` SDK — function calling |
| Database | SQLite via `better-sqlite3` (multi-file, per-store) |
| Build | Vite + `@sveltejs/adapter-node` |

---

## Roadmap

- [ ] **Vector / semantic search** — product embeddings via HuggingFace (`all-MiniLM-L6-v2`) stored in pgvector. Enables `"apple laptop"` → `"Apple MacBook Pro"` without exact tag matches.
- [ ] **Telegram webhook mode** — replace long-polling with proper webhooks for production.
- [ ] Multi-language product descriptions.

---

## License

MIT — free for commercial and personal use.
