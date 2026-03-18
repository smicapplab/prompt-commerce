# Prompt Commerce

> **An open-source Model Context Protocol (MCP) server that lets small retailers build and manage their e-commerce catalogs entirely through AI chat—no complex dashboards required.**

Prompt Commerce is designed specifically for independent e-commerce retailers, sari-sari stores, and social media sellers. It bypasses the steep learning curve of traditional inventory management systems by allowing merchants to manage their product databases directly through AI assistants like Claude, ChatGPT, or custom Telegram bots. 

Simply send a product photo via chat, and the AI generates the SEO content, suggests pricing, and pushes the listing live to your local database.

## Why This Exists
Most e-commerce tools are built for large teams with technical resources. Small retailers often struggle with writing product copy, researching competitive pricing, and navigating complex software interfaces. 

**This project flips the model:**
1. **The LLM is the UI:** No complicated forms to fill out. Just chat naturally to add, edit, or search products.
2. **You Own Your Data:** Runs locally using a zero-config SQLite database.
3. **Zero Infrastructure Costs:** Use your own LLM API keys. No monthly SaaS subscriptions required to manage your catalog.

---

## Features

* **AI-First Catalog Management:** Exposes read/write tools to any MCP-compatible LLM.
* **Zero-Config Local Database:** Powered by SQLite (better-sqlite3). Just run it; no Docker or separate database servers required.
* **Standardized Protocol:** Built on the official @modelcontextprotocol/sdk using SSE (Server-Sent Events) for seamless remote or local connections.
* **Minimal Admin UI:** A lightweight, built-in Express web interface strictly for managing local settings and API keys.

---

## Included MCP Tools

The server exposes the following tools to the connected LLM:

### Read Tools (Customer/Agent Queries)
* `search_products`: Natural language product search (by keyword, category, filters).
* `get_product`: Fetch single product details by ID or slug.
* `list_categories`: Browse the product taxonomy.
* `get_promotions`: Check active deals and vouchers.

### Write Tools (Retailer Management)
* `add_product`: Pushes an AI-generated product (title, description, tags, price) into the catalog.
* `update_product`: Edits an existing listing based on chat instructions.

---

## Architecture & Tech Stack

This project is intentionally lean to ensure anyone can run it on a basic machine or cheap VPS.

* **Core Language:** TypeScript / Node.js
* **Web Server (Admin UI & SSE):** Express.js
* **Database:** SQLite (better-sqlite3)
* **Protocol:** @modelcontextprotocol/sdk

**Directory Structure:**
```text
prompt-commerce/
├── src/
│   ├── mcp-core/       # Tools, prompts, and SSE transport logic
│   ├── admin-ui/       # Express routes for the minimal settings UI
│   ├── db/             # SQLite schema and query functions
│   └── index.ts        # Main application entry point
├── data/
│   └── catalog.db      # Auto-generated SQLite database (git-ignored)
├── package.json
└── README.md
```

## Getting Started
### Prerequisites
- Node.js (v18 or higher)
- Git

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/smicapplab/prompt-commerce.git
   cd prompt-commerce
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your specific port preferences (default: 3000)
   ```
4. Start the server:
   ```bash
   npm start
   ```

The local Admin UI will be available at http://localhost:3000 to configure your keys, and the MCP SSE endpoint will be active and ready to connect to your preferred AI agent.

## Roadmap
- [x] Phase 1: Core MCP Server with SQLite schema and read/write tools.
- [ ] Phase 2: Open-source Telegram Bot integration for mobile-first catalog management.
- [ ] Phase 3: Managed Gateway integration for secure, remote API key issuance and rotation.

## Contributing
Contributions are welcome! Whether it's adding support for new tools (like connecting to PayMongo for payments), improving the AI prompts, or optimizing the SQLite queries, feel free to open a PR.

## License
MIT License - completely free and open for small businesses to use and modify.