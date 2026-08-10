-- SADAAR marketplace schema (PostgreSQL)
-- Rebuilt from the actual live production database structure.

CREATE TABLE IF NOT EXISTS brands (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(120) NOT NULL,
  slug            VARCHAR(140) NOT NULL UNIQUE,
  description     TEXT,
  category        VARCHAR(60) NOT NULL,
  contact_email   VARCHAR(160) NOT NULL,
  contact_phone   VARCHAR(30),
  password_hash   VARCHAR(255) NOT NULL,
  reset_token     VARCHAR(64),
  reset_token_expires TIMESTAMPTZ,
  commission_rate NUMERIC(5,2) NOT NULL DEFAULT 20.00,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',
  founder_story   TEXT,
  brand_philosophy TEXT,
  origin_city     VARCHAR(100),
  instagram_url   VARCHAR(255),
  tiktok_url      VARCHAR(255),
  snapchat_url    VARCHAR(255),
  x_url           VARCHAR(255),
  whatsapp_url    VARCHAR(255),
  website_url     VARCHAR(255),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id            SERIAL PRIMARY KEY,
  brand_id      INTEGER NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name          VARCHAR(160) NOT NULL,
  description   TEXT,
  category      VARCHAR(60) NOT NULL,
  subcategory   VARCHAR(60),
  product_type  VARCHAR(60),
  price         NUMERIC(10,2) NOT NULL,
  is_signature  BOOLEAN NOT NULL DEFAULT false,
  status        VARCHAR(20) NOT NULL DEFAULT 'active',
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

CREATE TABLE IF NOT EXISTS product_images (
  id            SERIAL PRIMARY KEY,
  product_id    INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url           TEXT NOT NULL,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customers (
  id            SERIAL PRIMARY KEY,
  full_name     VARCHAR(160) NOT NULL,
  email         VARCHAR(160) UNIQUE,
  phone         VARCHAR(30),
  password_hash VARCHAR(255),
  reset_token   VARCHAR(64),
  reset_token_expires TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customer_addresses (
  id            SERIAL PRIMARY KEY,
  customer_id   INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  label         VARCHAR(60),
  full_name     VARCHAR(160) NOT NULL,
  phone         VARCHAR(30),
  city          VARCHAR(80) NOT NULL,
  address       TEXT NOT NULL,
  is_default    BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customer_wishlist (
  id            SERIAL PRIMARY KEY,
  customer_id   INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  product_id    INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (customer_id, product_id)
);

CREATE TABLE IF NOT EXISTS orders (
  id              SERIAL PRIMARY KEY,
  customer_id     INTEGER REFERENCES customers(id),
  status          VARCHAR(20) NOT NULL DEFAULT 'placed',
  subtotal        NUMERIC(10,2) NOT NULL,
  shipping_fee    NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_code   VARCHAR(40),
  discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  total           NUMERIC(10,2) NOT NULL,
  shipping_name   VARCHAR(160),
  shipping_phone  VARCHAR(30),
  shipping_city   VARCHAR(80),
  shipping_address TEXT,
  payment_status  VARCHAR(20) NOT NULL DEFAULT 'unpaid',
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
  commission_rate   NUMERIC(5,2) NOT NULL,
  commission_amount NUMERIC(10,2) NOT NULL,
  brand_payout      NUMERIC(10,2) NOT NULL,
  fulfillment_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  tracking_number   VARCHAR(80),
  shipped_at        TIMESTAMPTZ,
  payout_status     VARCHAR(20) NOT NULL DEFAULT 'pending',
  payout_date       TIMESTAMPTZ,
  payout_reference  VARCHAR(120),
  cancellation_status VARCHAR(20) NOT NULL DEFAULT 'none',
  return_status     VARCHAR(20) NOT NULL DEFAULT 'none',
  return_type       VARCHAR(20),
  return_reason     TEXT,
  exchange_variant_id INTEGER REFERENCES product_variants(id)
);

CREATE TABLE IF NOT EXISTS discount_codes (
  id            SERIAL PRIMARY KEY,
  code          VARCHAR(40) UNIQUE NOT NULL,
  type          VARCHAR(10) NOT NULL, -- 'percent' | 'fixed'
  value         NUMERIC(10,2) NOT NULL,
  min_subtotal  NUMERIC(10,2) NOT NULL DEFAULT 0,
  max_uses      INTEGER,
  uses_count    INTEGER NOT NULL DEFAULT 0,
  active        BOOLEAN NOT NULL DEFAULT true,
  expires_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS spotlight_slots (
  id            SERIAL PRIMARY KEY,
  brand_id      INTEGER NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  duration_days INTEGER NOT NULL,
  price         NUMERIC(10,2) NOT NULL,
  payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid',
  payment_ref   VARCHAR(120),
  starts_at     TIMESTAMPTZ,
  ends_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS support_messages (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(160) NOT NULL,
  email         VARCHAR(160) NOT NULL,
  subject       VARCHAR(200),
  message       TEXT NOT NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'new',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand_id);
CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_images_product ON product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_brand ON order_items(brand_id);
CREATE INDEX IF NOT EXISTS idx_addresses_customer ON customer_addresses(customer_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_customer ON customer_wishlist(customer_id);
CREATE INDEX IF NOT EXISTS idx_spotlight_brand ON spotlight_slots(brand_id);