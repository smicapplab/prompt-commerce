# Prompt Commerce — Costing Analysis

> Estimated operational costs at **40,000 transactions/month**.
> Last updated: April 2026.

---

## Assumptions

- Primary channels: Telegram and/or WhatsApp
- Customers always initiate conversations (not business-initiated)
- ~20% of transactions involve AI chat (~8,000 sessions)
- Average AI session: ~2,000 input tokens + 500 output tokens
- Order status notifications sent within 24hr window where possible
- Self-hosted on a single VPS (Hetzner) with PostgreSQL on same box

---

## Infrastructure

### Compute

Both services (Gateway + Seller Admin) run on a single VPS.

| Service | Description |
|---------|-------------|
| Gateway (NestJS) | Telegram/WhatsApp webhooks, REST API, frontend server |
| Seller Admin (SvelteKit + Express) | Admin UI, MCP server, SQLite |

**Must be 24/7** — Telegram and WhatsApp webhooks require instant response. No sleep/pause tier viable.

#### VPS Options

| Provider | Spec | Monthly | Notes |
|----------|------|---------|-------|
| **Hetzner CX22** | 2 vCPU, 4GB RAM | **~$6** | Best value, EU/US/SG regions |
| **Hetzner CX32** | 4 vCPU, 8GB RAM | **~$15** | Recommended headroom for 40k/mo |
| DigitalOcean Basic | 2 vCPU, 4GB RAM | $24 | More expensive, comparable spec |
| Render | 512MB | $7 | Underpowered for this stack |
| Railway | Usage-based | $15–25 | Convenient but costs scale |

**Recommendation: Hetzner CX32 at ~$15/mo.**

---

### Database

SQLite (seller app) is embedded — no separate server needed.
PostgreSQL (gateway) options:

| Option | Monthly | Notes |
|--------|---------|-------|
| **Self-hosted on same VPS** | **$0** | Simplest, no egress fees, manual backups |
| Neon (serverless Postgres) | $0–19 | Good free tier, auto-scales, managed backups |
| Supabase Pro | $25 | Full dashboard, pooler, auto-backups, extras unused |
| Supabase Free | $0 | **Not viable** — pauses after 1 week inactivity |
| Railway Postgres | $5–10 | Usage-based, simple setup |

#### Supabase vs Self-Hosted

| Feature | Self-hosted | Neon | Supabase Pro |
|---------|-------------|------|--------------|
| Cost | $0 | $0–19 | $25 |
| Managed backups | Manual | Auto | Auto |
| Connection pooling | Manual (pgBouncer) | Built-in | Built-in |
| Dashboard / GUI | None | Basic | Full |
| Auth / Storage extras | No | No | Yes (unused) |

**Recommendation: Self-hosted PostgreSQL on same Hetzner box.**
Upgrade to Neon or Supabase Pro when managed backups become a priority.

---

### Domain & SSL

| Item | Monthly | Notes |
|------|---------|-------|
| .com domain (Cloudflare Registrar) | ~$0.83 (~$10/yr) | At-cost pricing |
| SSL certificate | $0 | Let's Encrypt via Caddy or Nginx |
| Cloudflare CDN / DDoS proxy | $0 | Free tier sufficient |

---

### Infrastructure Subtotal

| Component | Monthly |
|-----------|---------|
| Hetzner CX32 (compute + DB) | $15 |
| Domain | $1 |
| SSL + CDN | $0 |
| **Total** | **~$16/mo** |

---

## Messaging Channels

### Telegram

| Item | Cost |
|------|------|
| Bot API | Free |
| Per message | Free |
| Per transaction | Free |

No per-message or per-conversation charges. All bot interactions are free regardless of volume.

---

### WhatsApp (Meta Cloud API)

Meta moved to conversation-based pricing in 2024. **Service conversations (customer-initiated) are free since November 2024.**

| Conversation Type | Who Initiates | Cost |
|------------------|--------------|------|
| **Service** | Customer messages first | **Free** |
| Utility | Business sends order update outside 24hr window | ~$0.02/conversation |
| Marketing | Business sends promotional blast | ~$0.06/conversation |
| Authentication | OTP / verification | ~$0.02/conversation |

#### For This Use Case

Customer opens WhatsApp → messages the number → browses, adds to cart, checks out — all within the same 24-hour session window → **entirely free**.

You only pay for utility messages if you send order status updates **after** the 24-hour window has closed (e.g., shipping update the next day).

| Scenario | Monthly |
|----------|---------|
| All orders complete within 24hr window | $0 |
| 15k status notifications outside window | ~$300 |
| Marketing blasts (optional, not in current flow) | $0 |

**WhatsApp number itself: free.** Meta does not charge for the phone number or API access.

---

## AI Chat (Claude API)

Used for natural language product search and customer chat sessions.

| Model | Input | Output |
|-------|-------|--------|
| Claude Sonnet 4.6 | $3.00 / 1M tokens | $15.00 / 1M tokens |

#### Calculation (20% AI adoption = 8,000 sessions/mo)

| Item | Tokens | Cost |
|------|--------|------|
| Input (system prompt + context + user message) | 16M | $48 |
| Output (AI response) | 4M | $60 |
| **Total** | | **~$108/mo** |

Scales linearly with AI adoption rate:
- 10% adoption (~4k sessions): ~$54/mo
- 30% adoption (~12k sessions): ~$162/mo

---

## Payment Processing

Payment fees are typically passed to the buyer or absorbed as cost of sale. Not an infrastructure cost, but included for completeness.

| Gateway | Fee per Transaction | Notes |
|---------|-------------------|-------|
| PayMongo | 3.5% + ₱15 | PH-local, fast onboarding |
| Stripe | 3.4% + $0.50 | International cards |
| COD / Assisted | Free | No processing fee |
| Mock Gateway | Free | Dev/demo only |

At ₱1,000 average order × 40,000 orders = ₱40M GMV:
- PayMongo: ~₱1.9M in fees (~$34k) — usually passed to buyer

---

## Monthly Cost Summary

### Recommended Setup (Self-hosted, Hetzner + Telegram-primary)

| Category | Monthly |
|----------|---------|
| Hetzner CX32 + domain | $16 |
| AI chat (20% adoption) | $108 |
| WhatsApp (if used, service only) | $0 |
| WhatsApp utility notifications (optional) | $0–300 |
| **Total** | **$124–424/mo** |

### Scenario Comparison at 40k Transactions/Month

| Scenario | Infra | AI | WhatsApp | **Total** |
|----------|-------|----|----------|-----------|
| Telegram-only, low AI (10%) | $16 | $54 | $0 | **~$70** |
| Telegram-only, moderate AI (20%) | $16 | $108 | $0 | **~$124** |
| WhatsApp-primary, no notifications | $16 | $108 | $0 | **~$124** |
| WhatsApp + next-day status updates | $16 | $108 | $300 | **~$424** |
| Upgrade to Supabase Pro | +$25 | — | — | **+$25** |

---

## Cost Per Transaction

| Scenario | Monthly | Cost per Transaction |
|----------|---------|---------------------|
| Telegram, low AI | ~$70 | **$0.0018** |
| Telegram, moderate AI | ~$124 | **$0.0031** |
| WhatsApp + notifications | ~$424 | **$0.0106** |

---

## Development Environment

A separate dev/staging environment mirrors production for safe testing without risking live data.

### What Dev Needs

| Service | Dev requirement |
|---------|----------------|
| Gateway (NestJS) | Always-on preferred (webhook testing with ngrok or dev domain) |
| Seller Admin | Can be local-only or dev VPS |
| PostgreSQL | Separate DB from prod — never share |
| Telegram/WhatsApp bot | Separate bot token for dev (free to create) |

### Local Development (Free)

Run everything on your own machine — no cloud cost. Use `dev.sh` to start both services.

| Item | Cost |
|------|------|
| Local compute | $0 |
| Docker (local Postgres) | $0 |
| ngrok (webhook tunneling) | $0–$10/mo |

**Limitation:** Webhooks only work while your machine is on. Fine for active development, not for shared staging or QA.

### Cloud Dev/Staging Server

| Option | Spec | Monthly | Notes |
|--------|------|---------|-------|
| **Hetzner CX11** | 1 vCPU, 2GB RAM | **~$4** | Enough for dev load |
| Hetzner CX22 | 2 vCPU, 4GB RAM | ~$6 | More comfortable |
| Render free tier | 512MB | $0 | Spins down after 15min — ok for dev |
| Railway dev | Usage-based | ~$5 | Simple, auto-sleep when idle |

**Recommendation: Hetzner CX11 (~$4/mo)** for a persistent staging environment.

### Dev Database

| Option | Monthly | Notes |
|--------|---------|-------|
| **Self-hosted on dev VPS** | **$0** | Same box as dev gateway |
| Neon free tier | $0 | 1GB, auto-suspends when idle — fine for dev |
| Supabase free | $0 | Pauses after 1 week — acceptable for dev (manually resume) |

**Recommendation: Neon free tier** — zero cost, auto-suspend saves resources, separate from prod.

### Dev Environment Subtotal

| Scenario | Monthly |
|----------|---------|
| Local-only dev | **$0** |
| Hetzner CX11 + Neon free | **~$4** |
| Hetzner CX11 + self-hosted PG | **~$4** |

---

## Scaling Considerations

| Monthly Orders | Recommended Spec | Est. Infra Cost |
|----------------|-----------------|-----------------|
| 0–10k | Hetzner CX22 + self-hosted PG | ~$7/mo |
| 10k–50k | Hetzner CX32 + self-hosted PG | ~$16/mo |
| 50k–150k | Hetzner CX42 (8 vCPU, 16GB) + Neon | ~$50/mo |
| 150k+ | Multi-server + managed DB | $100+/mo |

AI costs scale with usage regardless of infrastructure tier.

---

## Recommendations

1. **Start on Hetzner CX32 (~$15/mo)** — enough headroom for 40k orders, upgrade path is clear.
2. **Self-host PostgreSQL** on the same box until you need managed backups or a separate DB server.
3. **Use Telegram as primary channel** — identical capability to WhatsApp, zero messaging cost.
4. **Add WhatsApp** for reach — free for your use case (customer-initiated).
5. **Monitor AI adoption rate** — it's the most variable cost driver at scale.
6. **Upgrade to Supabase Pro or Neon** when you want managed backups without maintaining pgBackup yourself.
