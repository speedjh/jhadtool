-- invoices
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- transfers
CREATE TABLE IF NOT EXISTS transfers (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- clients
CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  org TEXT NOT NULL DEFAULT '',
  bizno TEXT NOT NULL DEFAULT '',
  rep TEXT DEFAULT '',
  email TEXT DEFAULT '',
  tax_email TEXT DEFAULT '',
  address TEXT DEFAULT '',
  biz_type TEXT DEFAULT '',
  biz_item TEXT DEFAULT '',
  contact_name TEXT DEFAULT '',
  contact_title TEXT DEFAULT '',
  contact_tel TEXT DEFAULT '',
  memo TEXT DEFAULT '',
  created_at TEXT NOT NULL
);

-- receivables
CREATE TABLE IF NOT EXISTS receivables (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- users
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  pw TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'user',
  tel TEXT DEFAULT '',
  created_at TEXT NOT NULL
);

-- settings
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- outsources
CREATE TABLE IF NOT EXISTS outsources (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- files
CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_invoices_updated ON invoices(updated_at);
CREATE INDEX IF NOT EXISTS idx_transfers_updated ON transfers(updated_at);
CREATE INDEX IF NOT EXISTS idx_clients_org ON clients(org);
