-- ============================================================================
-- Electronics & Home Appliances Service Center - Cloudflare D1 Database Schema
-- ============================================================================

-- 1. Users Table (Admin, In-House Staff, Third-Party Technicians)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    mobile TEXT UNIQUE NOT NULL,
    pin_or_password TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'in_house_staff', 'third_party_tech')),
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Categories Table (Inventory Buckets)
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name_en TEXT NOT NULL,
    name_hi TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Inventory Items Table (Spare Parts & Stock)
CREATE TABLE IF NOT EXISTS inventory_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER,
    part_name TEXT NOT NULL,
    model_number TEXT,
    serial_number TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'received' 
        CHECK(status IN ('received', 'in_storage', 'assigned_to_tech', 'installed', 'rejected_defective', 'returned_to_company')),
    current_holder_id INTEGER,
    invoice_image_url TEXT,
    challan_number TEXT,
    return_slip_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id),
    FOREIGN KEY (current_holder_id) REFERENCES users(id)
);

-- 4. Company Assets Table (Tools & Equipment assigned to staff/techs)
CREATE TABLE IF NOT EXISTS company_assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    asset_name TEXT NOT NULL,
    asset_code TEXT,
    assigned_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'returned')),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 5. Rate Cards Table (Fixed Payout Master per Service)
CREATE TABLE IF NOT EXISTS rate_cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_title_en TEXT NOT NULL,
    service_title_hi TEXT NOT NULL,
    fixed_amount REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 6. Service Calls Table (Call Assignments, Closure, Extra Collections)
CREATE TABLE IF NOT EXISTS service_calls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    complaint_number TEXT UNIQUE NOT NULL,
    customer_name TEXT NOT NULL,
    customer_mobile TEXT NOT NULL,
    customer_address TEXT,
    rate_card_id INTEGER,
    assigned_tech_id INTEGER,
    used_part_id INTEGER,
    tech_payout_amount REAL NOT NULL DEFAULT 0,
    admin_edited_amount REAL,
    admin_edit_remark TEXT,
    customer_extra_collected REAL DEFAULT 0,
    customer_extra_remark TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'completed', 'cancelled')),
    payout_status TEXT NOT NULL DEFAULT 'unpaid' CHECK(payout_status IN ('unpaid', 'paid')),
    payment_batch_id INTEGER,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (rate_card_id) REFERENCES rate_cards(id),
    FOREIGN KEY (assigned_tech_id) REFERENCES users(id),
    FOREIGN KEY (used_part_id) REFERENCES inventory_items(id)
);

-- 7. Payment Batches Table (Technician Payment Settlements)
CREATE TABLE IF NOT EXISTS payment_batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tech_id INTEGER NOT NULL,
    amount_paid REAL NOT NULL,
    payment_screenshot_url TEXT,
    remarks TEXT,
    paid_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tech_id) REFERENCES users(id)
);

-- 8. Audit Logs Table (Timeline & Real-time Notifications)
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL CHECK(entity_type IN ('part', 'call', 'payment', 'asset')),
    entity_id INTEGER NOT NULL,
    action_by_user_id INTEGER,
    assigned_to_user_id INTEGER,
    action_description_en TEXT NOT NULL,
    action_description_hi TEXT NOT NULL,
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (action_by_user_id) REFERENCES users(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_mobile ON users(mobile);
CREATE INDEX IF NOT EXISTS idx_inventory_serial ON inventory_items(serial_number);
CREATE INDEX IF NOT EXISTS idx_inventory_status ON inventory_items(status);
CREATE INDEX IF NOT EXISTS idx_calls_complaint ON service_calls(complaint_number);
CREATE INDEX IF NOT EXISTS idx_calls_tech ON service_calls(assigned_tech_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
