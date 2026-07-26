# SADAAR API

Express + PostgreSQL backend for the SADAAR marketplace: brands, products, orders,
commission calculation, and order routing (each order line is tagged with the brand
that must fulfill it).

## Local setup

1. Install Node.js 18+ and PostgreSQL (or use a hosted Postgres — see below).
2. `cd backend && npm install`
3. Copy `.env.example` to `.env` and fill in:
   - `DATABASE_URL` — your Postgres connection string
   - `JWT_SECRET` — any long random string (used to sign brand-dashboard login tokens)
4. Create the schema and load sample data:
   ```
   psql "$DATABASE_URL" -f src/db/schema.sql
   psql "$DATABASE_URL" -f src/db/seed.sql
   ```
5. `npm run dev` — API runs on `http://localhost:4000`
6. Check it's alive: `curl http://localhost:4000/api/health`

## Hosting a real Postgres for free/cheap

You don't need to manage a Postgres server yourself. Any of these give you a
`DATABASE_URL` in a few minutes:
- **Supabase** (supabase.com) — free tier, includes a dashboard to browse tables
- **Railway** (railway.app) — one-click Postgres, easy to pair with a deployed API
- **Render** (render.com) — free Postgres + can host the API itself

## Deploying the API

- **Render / Railway**: point them at the `backend/` folder, build command `npm install`,
  start command `npm start`, and set the same environment variables from `.env.example`.
- After deploying, run the schema/seed SQL against the hosted database once (same
  `psql` commands above, pointed at the hosted `DATABASE_URL`).

## API overview

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/brands` | List active brands (`?category=`) |
| GET | `/api/brands/:slug` | Brand detail |
| POST | `/api/brands/apply` | New brand applies to join (status starts `pending`) |
| POST | `/api/brands/login` | Brand dashboard login → JWT |
| GET | `/api/products` | List products (`?category=&brandId=&sort=price-asc`) |
| GET | `/api/products/:id` | Product detail with size variants and stock |
| POST | `/api/products` | Brand adds a product (requires `Authorization: Bearer <token>`) |
| POST | `/api/orders` | Place an order — see body shape below |
| GET | `/api/orders/:id` | Order detail with line items |
| GET | `/api/orders/brand/mine` | Brand's own order line items (requires auth) |
| PATCH | `/api/orders/items/:itemId/ship` | Brand marks a line item shipped (requires auth) |

### Placing an order

```
POST /api/orders
{
  "customer": { "fullName": "Sara A.", "email": "sara@example.com", "phone": "0501234567", "city": "Riyadh", "address": "..." },
  "items": [ { "variantId": 2, "quantity": 1 } ]
}
```

Each line item snapshots the brand's commission rate at order time, computes
`commission_amount` (SADAAR's cut) and `brand_payout` (what the brand is owed),
and decrements stock inside one transaction — so two customers can't oversell the
same last unit.

## What's not wired up yet (by design, for this stage)

- **Payment gateway** — `payment_status` stays `unpaid` until you connect Moyasar,
  HyperPay, or another provider. The order table already has `payment_ref` ready
  for that provider's transaction ID once it's added.
- **Brand notifications on new orders** — `placeOrder` logs which brands an order
  routed to; swap that `console.log` for a real email/webhook call when ready.
- **Customer accounts / login** — orders currently just capture a name/email/phone
  per order rather than requiring signup, to keep checkout friction-free at launch.
