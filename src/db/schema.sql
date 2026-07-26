-- SADAAR marketplace schema (PostgreSQL)

CREATE TABLE IF NOT EXISTS brands (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(120) NOT NULL,
  slug            VARCHAR(140) NOT NULL UNIQUE,
  description     TEXT,
  category        VARCHAR(60) NOT NULL,
  contact_email   VARCHAR(160) NOT NULL,
  contact_phone   VARCHAR(30),
  password_hash   VARCHAR(255) NOT NULL,           -- brand dashboard login
  commission_rate NUMERIC(5,2) NOT NULL DEFAULT 20.00, -- percent SADAAR takes
  status          VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | active | suspended
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id            SERIAL PRIMARY KEY,
  brand_id      INTEGER NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name          VARCHAR(160) NOT NULL,
  description   TEXT,
  category      VARCHAR(60) NOT NULL,
  price         NUMERIC(10,2) NOT NULL,   -- SAR
  status        VARCHAR(20) NOT NULL DEFAULT 'active', -- active | draft | archived
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS product_variants (
  id            SERIAL PRIMARY KEY,
  product_id    INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  size          VARCHAR(20) NOT NULL,
  sku           VARCHAR(60) UNIQUE,
  stock_qty     INTEGER NOT NULL DEFAULT 0,
  UNIQUE (product_id, size)
);

CREATE TABLE IF NOT EXISTS customers (
  id            SERIAL PRIMARY KEY,
  full_name     VARCHAR(160) NOT NULL,
  email         VARCHAR(160) UNIQUE,
  phone         VARCHAR(30),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  id              SERIAL PRIMARY KEY,
  customer_id     INTEGER REFERENCES customers(id),
  status          VARCHAR(20) NOT NULL DEFAULT 'placed', -- placed | paid | fulfilling | completed | cancelled
  subtotal        NUMERIC(10,2) NOT NULL,
  total           NUMERIC(10,2) NOT NULL,
  shipping_name   VARCHAR(160),
  shipping_phone  VARCHAR(30),
  shipping_city   VARCHAR(80),
  shipping_address TEXT,
  payment_status  VARCHAR(20) NOT NULL DEFAULT 'unpaid', -- unpaid | paid | failed  (mock until gateway wired)
  payment_ref     VARCHAR(120),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per brand-fulfilled line item. This is what enables order routing:
-- each brand only ever sees the order_items that belong to them.
CREATE TABLE IF NOT EXISTS order_items (
  id                SERIAL PRIMARY KEY,
  order_id          INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id        INTEGER NOT NULL REFERENCES products(id),
  variant_id        INTEGER NOT NULL REFERENCES product_variants(id),
  brand_id          INTEGER NOT NULL REFERENCES brands(id),
  quantity          INTEGER NOT NULL,
  unit_price        NUMERIC(10,2) NOT NULL,
  commission_rate   NUMERIC(5,2) NOT NULL,   -- snapshot of brand's rate at order time
  commission_amount NUMERIC(10,2) NOT NULL,  -- SADAAR's cut for this line
  brand_payout      NUMERIC(10,2) NOT NULL,  -- what the brand is owed for this line
  fulfillment_status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | shipped | delivered
  tracking_number   VARCHAR(80),
  shipped_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand_id);
CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_brand ON order_items(brand_id);
