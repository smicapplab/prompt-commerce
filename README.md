# Prompt Commerce

> **An open-source MCP server that lets small retailers manage their entire product catalog through AI chat — no dashboards, no coding, no monthly SaaS fees.**

Prompt Commerce is built for independent retailers, sari-sari stores, and social media sellers across Southeast Asia. Instead of learning complex inventory software, merchants simply chat with an AI assistant (like Claude) to add products, update listings, and manage promotions.

**Describe your product in chat → AI writes the listing → catalog goes live. That's it.**

---

## Architecture

This is the **retailer-side** package. Each store runs their own instance on a cheap VPS or local machine.

```
┌─────────────────────────────────────────┐
│          Retailer's Computer / VPS      │
│                                         │
│  ┌──────────────┐   ┌────────────────┐  │
│  │  Admin Panel │   │   MCP Server   │  │
│  │  :3000       │   │   :3001/sse    │  │
│  │  (manage     │   │   (AI agents   │  │
│  │   catalog)   │   │    connect     │  │
│  └──────┬───────┘   │    here)       │  │
│         │           └───────┬────────┘  │
│         └────────┬──────────┘           │
│                  ▼                      │
│          SQLite catalog.db              │
└─────────────────────────────────────────┘
               │
               │  x-gateway-key header
               ▼
     Prompt Commerce Gateway
     (optional — for discovery
      across multiple stores)
```

The MCP server exposes your catalog as tools that any MCP-compatible AI client can call. The admin panel is a local web UI for managing the catalog without needing to type commands.

---

## MCP Tools

### Read Tools — for customers and AI agents

| Tool | Description |
|---|---|
| `search_products` | Natural language search by keyword, category, or price range |
| `get_product` | Full product details by ID or SKU |
| `list_categories` | Browse the store's product taxonomy |
| `get_promotions` | Active deals and voucher codes |
| `get_reviews` | Customer reviews for a product |

### Write Tools — for retailers managing their catalog

| Tool | Description |
|---|---|
| `add_product` | Push a new product into the catalog |
| `update_product` | Edit an existing listing |
| `add_category` | Create a product category |
| `add_promotion` | Create a promotion or voucher code |
| `add_review` | Add a customer review |

---

## Project Structure

```
prompt-commerce/
├── src/                    # MCP server (port 3001)
│   ├── db/
│   │   ├── client.ts       # SQLite connection + WAL setup
│   │   └── schema.ts       # Table definitions (CREATE IF NOT EXISTS)
│   ├── tools/
│   │   ├── products.ts     # search_products, get_product, add_product, update_product
│   │   ├── categories.ts   # list_categories, add_category
│   │   ├── promotions.ts   # get_promotions, add_promotion
│   │   └── reviews.ts      # get_reviews, add_review
│   ├── types/
│   │   └── index.ts        # Shared TypeScript types
│   └── index.ts            # Express + SSE transport + gateway key middleware
│
├── admin/                  # Admin panel (port 3000)
│   ├── src/
│   │   └── server.ts       # Express API: auth, products, categories, promotions, reviews, settings
│   └── public/
│       └── admin.html      # Single-page admin UI
│
├── data/
│   └── catalog.db          # Auto-created SQLite database (git-ignored)
│
├── .env.example
├── package.json
└── README.md
```

---

## Getting Started

### Prerequisites

- Node.js v18+
- Git

### Installation

```bash
# 1. Clone the repo
git clone https://github.com/smicapplab/prompt-commerce.git
cd prompt-commerce

# 2. Configure environment
cp .env.example .env
# Edit .env — at minimum, review ADMIN_PASSWORD and JWT_SECRET

# 3. Install MCP server dependencies
npm install

# 4. Install admin panel dependencies
cd admin && npm install && cd ..
```

### Run in development

Open **two terminals** (or use the workspace launcher — see below):

```bash
# Terminal 1 — MCP server
npm run dev
# → http://localhost:3001/sse

# Terminal 2 — Admin panel
cd admin && npm run dev
# → http://localhost:3000
```

### Run everything with one command

From the **workspace root** (the folder containing both `prompt-commerce` and `prompt-commerce-gateway`):

```bash
### Run everything with one command

From the `prompt-commerce` directory:

```bash
# Mac / Linux
./dev.sh

# Windows
dev.bat
```

---

## Admin Panel

Open `http://localhost:3000` in your browser.

**Default credentials** (created on first startup):
- Username: `admin`
- Password: `admin123`

> Change the password immediately via **Settings → Change Password**.

The admin panel lets you:
- Add, edit, and hide products (with image upload)
- Manage categories and subcategories
- Create promotions and voucher codes
- View and moderate customer reviews
- Paste your platform key to connect to the Prompt Commerce Gateway

---

## Connecting to Claude Desktop (direct, no gateway)

If you are running this store on its own without the gateway, add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "my-store": {
      "url": "http://localhost:3001/sse"
    }
  }
}
```

No `x-gateway-key` header is needed when no key has been configured yet (first-run mode). Once you paste a platform key in the admin panel, all connections must include it.

---

## Connecting to the Prompt Commerce Gateway

The gateway lets multiple stores be discovered by a single Claude connection. After registering your store and receiving a platform key from the gateway operator:

1. Open the admin panel at `http://localhost:3000`
2. Go to **Settings → Gateway Connection**
3. Follow the on-screen instructions to paste your `gk_...` key
4. Your store is now live on the network

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_PATH` | `./data/catalog.db` | Path to the SQLite database file |
| `MCP_PORT` | `3001` | Port for the MCP SSE server |
| `ADMIN_PORT` | `3000` | Port for the admin panel |
| `JWT_SECRET` | *(change this!)* | Secret for signing admin session tokens |
| `JWT_EXPIRES_IN` | `1d` | Admin session token lifetime |
| `ADMIN_USERNAME` | `admin` | Default admin username (first run only) |
| `ADMIN_PASSWORD` | `admin123` | Default admin password (first run only) |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Language | TypeScript / Node.js |
| MCP Protocol | `@modelcontextprotocol/sdk` (SSE transport) |
| Database | SQLite via `better-sqlite3` |
| Admin API | Express |
| Admin UI | Vanilla HTML/CSS/JS (no build step) |
| Auth | JWT via `jsonwebtoken` + `bcryptjs` |

---

## Roadmap

- [x] Phase 1 — Core MCP server: SQLite schema, SSE transport, read/write tools
- [x] Phase 2 — Local admin panel: product/category/promo management, gateway key settings
- [ ] Phase 3 — Telegram bot integration for mobile-first catalog management
- [ ] Phase 4 — Payment gateway MCP (PayMongo / Maya Business)
- [ ] Phase 5 — Offline-first mobile companion app

---

## Contributing

Contributions are very welcome — new MCP tools, messaging platform integrations (Telegram, FB Messenger, Viber), payment gateway support, UI improvements, and bug fixes. Open a PR or start a discussion.

This project is built for small retailers. If you know one who could benefit, that's the best contribution of all.

---

## License

MIT — free for any small business to use, modify, and build on.
