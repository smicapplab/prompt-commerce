<p align="left">
  <img src="screenshots/logo.png" alt="Prompt Commerce logo" width="100">
</p>

# Prompt Commerce — AI-Native Seller Admin & MCP Server

**Prompt Commerce** is a conversational e-commerce platform that empowers independent retailers to manage their stores and engage customers through AI. Designed for modern merchants, it replaces complex legacy inventory software with a streamlined, AI-first administrative experience that powers automated shopping channels on Telegram and WhatsApp.

This repository contains the **Seller Admin Service** — a high-performance SvelteKit dashboard, an integrated [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server, and a multi-database SQLite architecture.

---

## 🚀 Live Demo

- ⚡ **Admin Dashboard**: [https://admin.13.212.57.92.nip.io/](https://admin.13.212.57.92.nip.io/)
- 🛒 **Customer Gateway**: [https://gateway.13.212.57.92.nip.io/](https://gateway.13.212.57.92.nip.io/)

---

## 📱 AI-Powered Customer Experience

Prompt Commerce provides a premium, automated shopping experience for your customers across multiple channels.

### Automated Messaging Bots (Telegram & WhatsApp)
Your customers can browse, search, and checkout entirely through AI-driven chat interfaces.
- **Rich Product Discovery**: AI-generated **semantic tags** ensure search results are highly relevant (e.g., "basketball shoes" finds your "Nike Air Jordan" listings).
- **Visual Shopping**: Results are rendered as **rich interactive photo cards** with one-tap "Add to Cart" and "Details" buttons.
- **Natural Language Checkout**: Customers can chat naturally with your store's custom AI assistant (powered by Claude, Gemini, or OpenAI) to get recommendations and answers to product questions.
- **Seamless Human Handover**: If the AI cannot fulfill a request, it automatically notifies your staff to take over the chat.

### Smart Logistics & Checkout
- **Google Places Address Picker**: A built-in mini app for precise, structured delivery address collection including lat/lng coordinates.
- **Real-Time Notifications**: Customers receive instant Telegram or WhatsApp updates for every status change, from "Payment Received" to "Out for Delivery".
- **One-Tap Reordering**: Saved profiles and addresses allow for lightning-fast repeat purchases.

---

##  Gallery & Screenshots

### Interactive Dashboard
*Track revenue and order health with real-time KPI visualization.*
<img src="screenshots/dashboard.png" alt="Seller Dashboard" width="800">

### Catalog Management
*Effortlessly manage your products and categories with a clean, responsive interface.*
<div style="display: flex; gap: 10px;">
  <img src="screenshots/products.png" alt="Product Management" width="400">
  <img src="screenshots/category.png" alt="Category Management" width="400">
</div>

### AI-Powered Cataloging
*Chat with your AI Assistant to bulk-import inventory or update stock using natural language.*
<img src="screenshots/ai-assitant.png" alt="AI Assistant" width="800">

### Intelligent Configuration
*Configure Claude, Gemini, or OpenAI models and customize your store's AI persona.*
<img src="screenshots/ai-settings.png" alt="AI Settings" width="800">

### Customer Bot Interfaces
<div style="display: flex; flex-wrap: wrap; gap: 10px;">
  <img src="screenshots/TG-1.jpg" alt="Telegram Storefront" width="200">
  <img src="screenshots/TG-2.jpg" alt="Telegram Product Search" width="200">
  <img src="screenshots/TG-3.jpg" alt="Telegram Shopping Cart" width="200">
  <img src="screenshots/TG-4.jpg" alt="Telegram Checkout" width="200">
</div>

---

## 📺 Video Demos

Experience the full journey of Prompt Commerce, from conversational ordering to administrative fulfillment.

### 🟢 WhatsApp Integration
| Customer Ordering Experience | Admin Order Tracking & Logistics |
| :--- | :--- |
| [![WhatsApp Order](https://img.youtube.com/vi/Mfg_ycp5vWI/0.jpg)](https://www.youtube.com/watch?v=Mfg_ycp5vWI) | [![WhatsApp Tracking](https://img.youtube.com/vi/i97QXhYbc9Y/0.jpg)](https://www.youtube.com/watch?v=i97QXhYbc9Y) |
| *Browsing & Checkout via WhatsApp* | *Fulfillment & Map Coordination* |

### 🔵 Telegram Integration
| Customer Ordering Experience | Admin Order Tracking & Logistics |
| :--- | :--- |
| [![Telegram Order](https://img.youtube.com/vi/Kh1RxYtABXE/0.jpg)](https://www.youtube.com/watch?v=Kh1RxYtABXE) | [![Telegram Tracking](https://img.youtube.com/vi/g65nxIKT1KM/0.jpg)](https://www.youtube.com/watch?v=g65nxIKT1KM) |
| *AI-Powered Search & Payments* | *Merchant Dashboard Management* |

> **Try it now!** Search for **Prompt-Commerce** or **@prompt_comm_bot** on Telegram to explore our test channel.

---

##  Features at a Glance

### Conversational AI & MCP Tools
- **Conversational CRUD**: Add, update, and manage products, categories, and promotions using natural language via the AI Assistant.
- **Vision-Powered Search**: Attach product images in chat; the AI uses vision to extract details, identify categories, and suggest descriptions.
- **Agentic Workflows**: A multi-round tool-use loop executes complex tasks (e.g., "Import these 50 products from this spreadsheet") with a single prompt.
- **Semantic Auto-Tagging**: Gateway automatically generates semantic metadata for your products upon sync to improve customer search accuracy.

### Collaborative Order Fulfillment
- **State-Machine Workflow**: Robust order status lifecycle (`pending` → `picking` → `packing` → `in_transit` → `delivered`) with specific flows for **Store Pickup**.
- **Internal Timeline**: A collaborative note system for order-level communication among staff with full history and soft-delete support.
- **Order Attachments**: Securely upload and manage receipts, shipping labels, and documents (PDF, Excel, Images up to 20MB).
- **Shipping Integration**: Capture tracking numbers and courier details at the point of fulfillment, automatically notified to the buyer via Telegram or WhatsApp.

### Universal Payment Integration
- **Multi-Provider Support**: Enable any combination of **Stripe**, **PayMongo**, **Cash on Delivery (COD)**, **Assisted Payments** (offline bank transfers), and **Mock** (for testing) simultaneously.
- **Dynamic Selection**: Bots automatically offer a choice screen when multiple methods are enabled.
- **Custom Instructions**: Define provider-specific payment instructions shown directly to customers in-chat.

### Enterprise-Grade Security
- **RBAC (Role-Based Access Control)**: Granular permissions for Super Admins, Store Admins, Merchandisers, and Operations staff.
- **Persistent Rate Limiting**: Intelligent brute-force protection for both merchant logins and customer order placement.
- **Sanitized Communications**: Automated XSS and prompt-injection guards for customer-to-merchant messages.

### High-Performance Architecture
- **Per-Store SQLite Containers**: Dedicated database files per store ensuring total data isolation and zero-latency queries.
- **Product Types & Variants**: Support for complex product structures (Wearables, Food, Devices, Travel) with per-variant price and inventory tracking.
- **Delta Sync Engine**: Optimized batch syncing ensures your gateway catalog is always up to date with minimal bandwidth usage.
---

## Architecture Overview

```
<root>/
  prompt-commerce/           ← THIS REPO — Seller Admin (SvelteKit + MCP)
  data/                      ← Runtime data (gitignored)
    catalog.db               ← Registry DB: Users, Settings, Global Store Registry
    stores/
      <slug>.db              ← One high-performance SQLite file per store
    uploads/                 ← Shared product image repository
```

---

## Getting Started

### Prerequisites

- **Node.js 20+**
- **npm**

### Standalone (Seller Admin only)

```bash
# 1. Clone and enter the repo
git clone https://github.com/smicapplab/prompt-commerce.git
cd prompt-commerce/prompt-commerce

# 2. Install dependencies
npm install

# 3. Start development server
npm run dev
```

The server auto-creates `.env` from `.env.example`, initializes databases, and starts at [http://localhost:3000](http://localhost:3000). Default login: `admin` / `XnR9XxiI5WizHJkj`.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Admin UI** | SvelteKit 5 (Svelte 5 Runes) + Tailwind CSS |
| **Server** | Express + Custom SSE / MCP Handler |
| **Databases** | Better-SQLite3 (Multi-file / Per-store) |
| **AI (LLMs)** | Anthropic Claude, Google Gemini, OpenAI |
| **Payments** | Stripe, PayMongo, COD, Assisted (offline), Mock (testing) |

---

## License

MIT — Open for everyone. Built with ❤️ by the Prompt Commerce Team.
