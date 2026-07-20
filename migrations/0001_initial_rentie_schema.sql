PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  subdomain TEXT NOT NULL UNIQUE,
  outlet TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  booking_deposit_amount INTEGER NOT NULL DEFAULT 0,
  booking_deposit_policy TEXT NOT NULL CHECK (booking_deposit_policy IN ('non_refundable', 'refundable')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'cashier', 'fitting')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);

CREATE TABLE IF NOT EXISTS inventory_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  inventory_code TEXT NOT NULL,
  size_label TEXT NOT NULL,
  model TEXT NOT NULL,
  color TEXT NOT NULL,
  wear_style TEXT NOT NULL CHECK (wear_style IN ('hijab', 'non-hijab')),
  includes_json TEXT NOT NULL DEFAULT '[]',
  occasions_json TEXT NOT NULL DEFAULT '[]',
  rent_condition TEXT NOT NULL CHECK (rent_condition IN ('in-town', 'shipping', 'both')),
  bust INTEGER NOT NULL,
  waist INTEGER NOT NULL,
  length INTEGER NOT NULL,
  sleeve INTEGER NOT NULL,
  rental_price INTEGER NOT NULL DEFAULT 0,
  cost INTEGER NOT NULL DEFAULT 0,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('available', 'rented', 'maintenance')),
  condition_grade TEXT NOT NULL CHECK (condition_grade IN ('A', 'B', 'C')),
  qr_code TEXT NOT NULL,
  photos_json TEXT NOT NULL DEFAULT '[]',
  date_added TEXT NOT NULL,
  times_rented INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, inventory_code)
);

CREATE INDEX IF NOT EXISTS idx_inventory_items_tenant_id ON inventory_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_status ON inventory_items(tenant_id, status);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  normalized_whatsapp TEXT NOT NULL,
  instagram TEXT,
  email TEXT,
  event_type TEXT,
  event_date TEXT,
  total_rentals INTEGER NOT NULL DEFAULT 0,
  last_rental TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, normalized_whatsapp)
);

CREATE INDEX IF NOT EXISTS idx_customers_tenant_id ON customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customers_whatsapp ON customers(tenant_id, normalized_whatsapp);

CREATE TABLE IF NOT EXISTS customer_measurements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  bust INTEGER NOT NULL,
  waist INTEGER NOT NULL,
  hip INTEGER NOT NULL,
  recorded_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_customer_measurements_customer_id ON customer_measurements(customer_id);

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('confirmed', 'active', 'returned', 'late', 'cancelled')),
  total INTEGER NOT NULL DEFAULT 0,
  deposit INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bookings_tenant_id ON bookings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bookings_dates ON bookings(tenant_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(tenant_id, status);

CREATE TABLE IF NOT EXISTS booking_items (
  booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  PRIMARY KEY (booking_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_booking_items_item_id ON booking_items(item_id);

CREATE TABLE IF NOT EXISTS booking_requests (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  customer_name TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  event_type TEXT,
  event_date TEXT,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  deposit_amount INTEGER NOT NULL DEFAULT 0,
  deposit_policy TEXT NOT NULL CHECK (deposit_policy IN ('non_refundable', 'refundable')),
  payment_status TEXT NOT NULL CHECK (payment_status IN ('unpaid', 'paid', 'waived')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  expires_at TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_booking_requests_tenant_id ON booking_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_booking_requests_status ON booking_requests(tenant_id, status);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
  transaction_type TEXT CHECK (transaction_type IN ('open', 'close')),
  date TEXT NOT NULL,
  deposit INTEGER NOT NULL DEFAULT 0,
  late_fee INTEGER NOT NULL DEFAULT 0,
  damage_fee INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  method TEXT NOT NULL CHECK (method IN ('QRIS', 'GoPay', 'OVO', 'DANA', 'Cash', 'Card')),
  payment_status TEXT NOT NULL CHECK (payment_status IN ('paid', 'partial', 'refunded', 'pending')),
  customer_name TEXT,
  customer_whatsapp TEXT,
  cashier_name TEXT,
  rental_total INTEGER,
  base_rental INTEGER,
  extra_day_fee INTEGER,
  notes TEXT,
  return_notes TEXT,
  deposit_returned INTEGER,
  amount_due INTEGER,
  evidence_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_transactions_tenant_id ON transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_transactions_booking_id ON transactions(booking_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(tenant_id, date);

CREATE TABLE IF NOT EXISTS transaction_items (
  transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  PRIMARY KEY (transaction_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_transaction_items_item_id ON transaction_items(item_id);

CREATE TABLE IF NOT EXISTS monthly_revenue (
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  revenue INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, month)
);

INSERT OR IGNORE INTO tenants (
  id,
  name,
  subdomain,
  outlet,
  whatsapp,
  booking_deposit_amount,
  booking_deposit_policy
) VALUES
  ('melati', 'Griya Kebaya Melati', 'melati.rentie.id', 'Kemang, Jakarta Selatan', '+62 812-0000-1234', 150000, 'non_refundable'),
  ('ayu', 'Ayu Rental', 'ayurental.rentie.id', 'Denpasar, Bali', '+62 813-0000-8899', 100000, 'refundable');

INSERT OR IGNORE INTO users (id, tenant_id, name, role) VALUES
  ('U01', 'melati', 'Ayu Lestari', 'owner'),
  ('U02', 'melati', 'Budi Santoso', 'cashier'),
  ('U03', 'melati', 'Citra Dewi', 'fitting'),
  ('U04', 'melati', 'Dian Permata', 'cashier'),
  ('U05', 'ayu', 'Rani Wijaya', 'owner'),
  ('U06', 'ayu', 'Komang Sri', 'cashier');
