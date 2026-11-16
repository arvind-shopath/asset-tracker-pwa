-- ============================================================================
-- Asset & Installation Tracking Web App (PWA) - Cloudflare D1 Database Schema
-- ============================================================================

-- 1. Users Table (Admin & Employees)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    pin TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'employee')),
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Products Table (Primary Master Record)
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    serial_number TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    model TEXT,
    supplier TEXT,
    current_status TEXT NOT NULL DEFAULT 'received' 
        CHECK(current_status IN ('received', 'in_storage', 'handed_over', 'installed', 'rejected', 'picked_up')),
    storage_location TEXT,
    assigned_to_phone TEXT,
    assigned_to_name TEXT,
    customer_name TEXT,
    customer_phone TEXT,
    customer_address TEXT,
    gps_lat REAL,
    gps_lng REAL,
    installed_photo_key TEXT,
    rejected_reason TEXT,
    rejected_remarks TEXT,
    rejected_photo_key TEXT,
    pickup_person_name TEXT,
    pickup_person_phone TEXT,
    pickup_vehicle_no TEXT,
    pickup_remarks TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Audit Trail Table (Complete Immutable Timeline Log)
CREATE TABLE IF NOT EXISTS audit_trail (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    serial_number TEXT NOT NULL,
    action TEXT NOT NULL,
    actor_name TEXT NOT NULL,
    actor_phone TEXT NOT NULL,
    actor_role TEXT NOT NULL,
    details_json TEXT,
    photo_key TEXT,
    gps_lat REAL,
    gps_lng REAL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- Indexes for lightning-fast queries
CREATE INDEX IF NOT EXISTS idx_products_serial ON products(serial_number);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(current_status);
CREATE INDEX IF NOT EXISTS idx_audit_product ON audit_trail(product_id);
CREATE INDEX IF NOT EXISTS idx_audit_serial ON audit_trail(serial_number);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

-- 4. Initial Seed: Super Admin Account
-- Phone: 9876543210 | PIN: 1234
INSERT OR IGNORE INTO users (id, name, phone, pin, role) 
VALUES (1, 'System Administrator', '9876543210', '1234', 'admin');
