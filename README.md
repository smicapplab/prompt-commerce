# Prompt Commerce — Seller Admin

Prompt Commerce is an AI-first e-commerce platform that allows small retailers to manage their business through natural language. This repository contains the **Seller Admin** service.

## Core Stack
- **Frontend**: SvelteKit 5 (Runes) + Tailwind CSS
- **Server**: Express + MCP SDK
- **Database**: SQLite (Multi-file, per-store isolation)
- **AI**: Claude (Anthropic) & Gemini (Google) with agentic tool-use

## Key Features
- **Multi-Store Management**: Manage multiple stores from a single dashboard.
- **AI Assistant**: A built-in chat assistant with direct access to your store's data via MCP tools.
- **Delta Sync**: Efficiently pushes only changed products/categories to the Gateway.
- **MCP Server**: Each store exposes a standard MCP SSE endpoint (`/sse/:slug`) for external AI agents.

## Quick Start
1. **Install**: `npm install`
2. **Setup**: `cp .env.example .env` (Configure `DATA_DIR`, `ADMIN_USERNAME`, etc.)
3. **Run**: `./dev.sh` (Starts both Seller and Gateway services)

Admin panel: [http://localhost:3000](http://localhost:3000)

## Project Structure
- `src/mcp/`: MCP server implementation and database tools.
- `src/routes/`: SvelteKit admin UI and API endpoints.
- `src/lib/`: Shared utilities and stores.
- `server.ts`: Express entry point wrapping Vite and MCP.

## Delta Sync
The seller tracks changes via `is_synced` and `deleted_at` columns. A sync banner appears in the UI when changes are pending. High-level AI/Payment configs are automatically pushed to the Gateway on save.

---
License: MIT
