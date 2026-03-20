# Prompt Commerce

Prompt Commerce is an open-source MCP server that enables small retailers to manage their product catalog through AI chat. It is designed for independent retailers and social media sellers who prefer a conversational interface over complex inventory software.

---

## Live Demo

Link: https://admin.13.212.57.92.nip.io/
- Username: admin
- Password: admin123

---

## Architecture

This package contains the retailer-side services. Each store runs its own instance on a VPS or local machine.

- Admin Panel (Port 3000): Web UI for manual catalog management.
- MCP Server (Port 3001): Interface for AI agents to connect via SSE.
- Database: Local SQLite (catalog.db).

---

## Screenshots

### Admin Panel
| | |
|---|---|
| ![Dashboard](screenshots/dashboard.png) <br> Dashboard: Store statistics and connection status. | ![Product Management](screenshots/products.png) <br> Products: Add, edit, and search the catalog. |
| ![Category Management](screenshots/categories.png) <br> Categories: Hierarchical organization of products. | ![Store Settings](screenshots/settings.png) <br> Settings: Configuration for base URL and API keys. |

### AI Management
| | |
|---|---|
| ![AI Cataloging](screenshots/add-products.png) <br> Cataloging: Add products via conversational chat. | ![Bulk Inventory](screenshots/inventory-update-1.png) <br> Inventory: Update stock via CSV, Excel, or photos. |
| ![Chat Updates](screenshots/inventory-update-2.png) <br> Natural Language: Execute multi-step inventory tasks. | |

---

## Key Features

- Hierarchical Categories: Support for parent and sub-category relationships.
- Automated Image Caching: Automatically downloads and hosts images provided by AI.
- Absolute URL Resolution: Configurable base_url for valid product image links.
- Multimodal AI Assistant: 
    - Image Analysis: Upload product photos or labels for automated data extraction.
    - File Parsing: Native support for parsing CSV and Excel files into chat context.
    - Integrated Web Search: AI can find product details and specs from the live web.
- Dynamic Model Switching: Toggle between Gemini and Claude models directly in the chat.
- Multi-round Execution: Support for complex, multi-step tool calls in a single flow.
- Secure Interface: Visibility toggles for all sensitive fields and API keys.

---

## MCP Tools

### Read Tools
- search_products: Search by keyword, category, or price.
- get_product: Fetch full details by ID or SKU.
- list_categories: Browse the product taxonomy.
- get_promotions: View active deals and voucher codes.
- get_reviews: Access customer feedback.

### Write Tools
- add_product: Create new listings with automated image caching.
- update_product: Modify existing product details and images.
- update_inventory: Quick updates for stock levels.
- import_products: Bulk data import from CSV or XLSX.
- add_category: Create single or nested categories.
- batch_add_categories: Create multiple categories at once.
- update_category: Rename or move existing categories.
- add_promotion: Create new discount codes.
- add_review: Register customer feedback.

---

## Installation

1. Clone the repository:
   git clone https://github.com/smicapplab/prompt-commerce.git

2. Configure environment:
   cp .env.example .env
   (Edit .env to set ADMIN_PASSWORD and JWT_SECRET)

3. Install dependencies:
   npm install
   cd admin && npm install

---

## Run Services

Mac / Linux:
./dev.sh

Windows:
dev.bat

Admin access: http://localhost:3000 (Default: admin / admin123)

---

## Tech Stack

- Language: TypeScript / Node.js
- Protocol: MCP (SSE transport)
- AI: Google Gemini & Anthropic Claude
- Search: Serper.dev API
- Database: SQLite (better-sqlite3)
- Web: Express / Vanilla HTML/JS

---

## License

MIT - Free for commercial and personal use.
