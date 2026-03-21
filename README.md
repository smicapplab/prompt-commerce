# Prompt Commerce — Seller

Prompt Commerce is an open-source MCP server that lets small retailers manage their product catalog through AI chat. It is designed for independent retailers and social media sellers who prefer a conversational interface over complex inventory software.

This package is the **seller service** — the admin panel, MCP server, and per-store databases. It pairs with the **Prompt Commerce Gateway** (private, managed separately) which handles customer-facing operations.

---

## Architecture

```
<root>/
  prompt-commerce/           ← THIS REPO — Seller admin (SvelteKit + Express + MCP)
  prompt-commerce-gateway/   ← Gateway — private, managed separately (NestJS + Prisma + Postgres)
  _data/                     ← Runtime data (gitignored at root level)
    catalog.db               ← Registry DB: users, stores list
    stores/
      <slug>.db              ← One SQLite file per store (products, orders, etc.)
    uploads/                 ← Product images (shared across all stores)
```

### Services

| Service | Port | Description |
|---------|------|-------------|
| Seller (Express + SvelteKit) | 3000 | Admin UI + MCP SSE server |
| Gateway (NestJS) | 3002 | Customer-facing API (Postgres via Docker) |

### Database design

Two kinds of SQLite files live outside both repos in `_data/`:

- **Registry** (`catalog.db`) — users, settings, and the stores list. Shared across all stores.
- **Per-store** (`stores/<slug>.db`) — products, categories, promotions, reviews, orders, conversations, and per-store settings. One file per store; no `store_id` columns — the file itself is the scope.

---

## Key Features

### Multi-Store Admin Panel
- **Store picker flow** — on login you see all connected stores as cards. Select one and all subsequent pages are scoped to that store. No more per-page dropdowns.
- **Store registration via gateway** — paste the platform key from the gateway and the system auto-fetches the store slug, name, and MCP server URL. No manual typing, no typos.
- **Per-store settings** — each store has its own AI API keys (Claude, Gemini, Serper), display settings, and Telegram integration. Server-wide settings (gateway URL) are separate.

### AI Assistant with Live Store Tools
- **Store-aware AI** — the assistant has direct access to the store's SQLite database via a set of built-in tools. It queries real data rather than guessing.
- **Agentic tool-use loop** — Claude uses the Anthropic tool-use API; Gemini uses function declarations. The server runs a loop (up to 10 rounds) until the model produces a final text response, automatically executing any tool calls along the way.
- **Preview-before-save** — all write tools (`add_product`, `update_product`, `create_category`, `create_promotion`, etc.) return a diff preview by default and require `confirm: true` to commit. This prevents accidental changes.
- **File upload** — attach images (for analysis), CSV, or Excel files in the chat. Images are sent as base64 to the AI vision API; CSV/text files are decoded and injected as text context.
- **Chat history** — conversation history is persisted per store in `localStorage` so it survives page refreshes.
- **Dual provider** — switch between Claude (claude-opus-4-6, claude-sonnet-4-6, claude-haiku-4-5) and any available Gemini model. Models are loaded dynamically based on which API keys are configured for the store.

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
| `delete_category` | Remove a category (products become uncategorized) |
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
- Docker (for the gateway's Postgres database, set up alongside the gateway)

### 1. Clone this repo

```bash
git clone https://github.com/smicapplab/prompt-commerce.git
```

Place it alongside the gateway under the same parent folder:

```
<root>/
  prompt-commerce/
  prompt-commerce-gateway/   ← set up separately
```

### 2. Install dependencies

```bash
cd prompt-commerce && npm install
```

### 3. Configure environment

Copy `.env.example` to `.env` and edit the values:

```env
DATA_DIR=../  # _data/ is created here — outside both repos
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

`dev.sh` at the root:
1. Kills anything on ports 3000 and 3002
2. Bootstraps `.env` files from `.env.example` if missing
3. Runs seller DB migrations (`npm run db:migrate`)
4. Starts the gateway's Postgres via Docker Compose
5. Starts both services with colour-prefixed log output

**Admin panel:** http://localhost:3000
Default credentials: `admin` / `admin123`

---

## Connecting a Store

Stores are provisioned in the **gateway** by the platform administrator, then connected to the seller by the store owner:

1. Receive your **platform key** from the administrator.
2. In the seller admin → **Stores** → **Add Store**, paste the platform key.
3. The seller auto-fetches the store name and slug from the gateway — no manual typing required.
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

The app is packaged as a single Node.js process via `adapter-node`. A PM2 ecosystem file is included:

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
| Gateway (private) | NestJS + Prisma + PostgreSQL |

---

## License

MIT — free for commercial and personal use.
