# Prompt Commerce

> **An open-source MCP server that lets small retailers manage their entire product catalog through AI chat — no dashboards, no coding, no monthly SaaS fees.**

Prompt Commerce is built for independent retailers, sari-sari stores, and social media sellers across Southeast Asia. Instead of learning complex inventory software, merchants simply chat with an AI assistant to add products, update listings, and manage promotions.

**Send a product photo → AI writes the content → listing goes live. That's it.**

---

## Why This Exists

Most e-commerce tools are designed for teams with technical resources. Small retailers are left juggling spreadsheets, writing their own product copy, and paying for software they barely understand.

Prompt Commerce flips that model:

- **The LLM is the interface.** No forms. No dashboards. Just describe your product in chat and the AI handles the rest — title, description, tags, SEO, and pricing suggestions.
- **You own your data.** Everything runs locally on a zero-config SQLite database. No cloud lock-in.
- **Zero infrastructure costs.** Bring your own LLM API key (Claude, OpenAI, or any compatible provider). No subscriptions required to manage your catalog.

---

## How It Works

```
Retailer sends photo + brief description via chat
                    ↓
AI generates title, description, tags, price suggestion
                    ↓
MCP write tool pushes product to local SQLite catalog
                    ↓
Catalog is live and queryable by any AI agent ✅
```

The MCP server exposes your catalog as a set of tools that any MCP-compatible AI (Claude, ChatGPT, custom Telegram bots) can read from and write to — in real time, through natural conversation.

---

## MCP Tools

### Read Tools — for customer queries and AI agents
| Tool | Description |
|---|---|
| `search_products` | Natural language search by keyword, category, or price range |
| `get_product` | Fetch full product details by ID or SKU |
| `list_categories` | Browse product taxonomy |
| `get_promotions` | List active deals and vouchers |
| `get_reviews` | Fetch customer reviews for a product |

### Write Tools — for retailer catalog management
| Tool | Description |
|---|---|
| `add_product` | Push AI-generated product content into the catalog |
| `update_product` | Edit an existing listing via chat |
| `add_category` | Create a new product category |
| `add_promotion` | Create a promotion or voucher |
| `add_review` | Add a customer review |

---

## Tech Stack

Intentionally lean so any retailer can run it on a basic machine or cheap VPS.

| Layer | Technology |
|---|---|
| Language | TypeScript / Node.js |
| MCP Protocol | `@modelcontextprotocol/sdk` (SSE transport) |
| Database | SQLite via `better-sqlite3` |
| Admin API | NestJS |
| Admin UI | Lightweight HTML (no JS framework) |

---

## Project Structure

```
prompt-commerce/
├── packages/
│   ├── mcp-server/           # Core MCP server
│   │   └── src/
│   │       ├── tools/        # All MCP tool definitions
│   │       ├── db/           # SQLite schema and client
│   │       ├── types/        # Shared TypeScript types
│   │       └── index.ts      # MCP server + SSE entry point
│   └── admin/                # Local admin panel (NestJS)
│       └── src/
│           ├── auth/         # Login, JWT, local user management
│           ├── keys/         # LLM API key + gateway key settings
│           └── catalog/      # Admin CRUD for products/categories
├── data/
│   └── catalog.db            # Auto-generated SQLite DB (git-ignored)
├── .env.example
└── README.md
```

---

## Getting Started

### Prerequisites
- Node.js v18 or higher
- Git

### Installation

```bash
# 1. Clone the repo
git clone https://github.com/smicapplab/prompt-commerce.git
cd prompt-commerce

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env with your LLM API key and preferred ports

# 4. Start both packages
npm run dev
```

- **Admin UI:** `http://localhost:3000` — manage keys, users, and gateway settings
- **MCP SSE endpoint:** `http://localhost:3001/sse` — connect your AI agent here

### First Login
A default admin account is created on first run:
- Username: `admin`
- Password: `admin123`

> ⚠️ Change this immediately after your first login.

### Connecting to Claude Desktop

Add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "prompt-commerce": {
      "url": "http://localhost:3001/sse",
      "headers": {
        "x-gateway-key": "your-gateway-key-here"
      }
    }
  }
}
```

---

## Roadmap

- [x] Phase 1 — Core MCP server: SQLite schema, SSE transport, read/write tools
- [ ] Phase 2 — Telegram bot integration for mobile-first catalog management
- [ ] Phase 3 — Managed gateway: API key issuance, validation, rate limiting
- [ ] Phase 4 — Business permit validation for retailer onboarding
- [ ] Phase 5 — Payment gateway MCP (PayMongo / Maya Business)

---

## Contributing

Contributions are very welcome. Whether it's adding a new tool, improving AI prompts, supporting a new messaging platform (Telegram, FB Messenger, Viber), or adding payment gateway support — feel free to open a PR or start a discussion.

This project is built for small retailers. If you know one who could benefit, that's the best contribution of all.

---

## License

MIT — free for any small business to use, modify, and build on.