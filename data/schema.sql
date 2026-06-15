-- SQLite schema for Amazon Second Life

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    trust_score INTEGER NOT NULL,
    green_credits INTEGER NOT NULL DEFAULT 0,
    region TEXT NOT NULL,
    area TEXT NOT NULL,
    trees_planted INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price INTEGER NOT NULL,
    return_shipping_cost INTEGER NOT NULL,
    high_return_risk BOOLEAN NOT NULL DEFAULT 0,
    category TEXT NOT NULL,
    return_rate INTEGER NOT NULL,
    sizing_advice TEXT,
    carbon_savings_kg REAL NOT NULL,
    inventory_owner TEXT NOT NULL,
    graded BOOLEAN NOT NULL DEFAULT 0,
    grade TEXT,
    resale_price INTEGER,
    image_url TEXT,
    inventory_age_days INTEGER DEFAULT 0,
    current_region TEXT DEFAULT 'Delhi'
);

CREATE TABLE IF NOT EXISTS demand (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    region TEXT NOT NULL,
    demand_score INTEGER NOT NULL,
    UNIQUE(category, region)
);

CREATE TABLE IF NOT EXISTS delivery_routes (
    driver_id TEXT PRIMARY KEY,
    driver_name TEXT NOT NULL,
    area TEXT NOT NULL,
    time_windows TEXT NOT NULL -- stored as JSON
);

CREATE TABLE IF NOT EXISTS orders (
    order_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    order_date TEXT NOT NULL,
    status TEXT NOT NULL,
    returned BOOLEAN NOT NULL DEFAULT 0,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fraud_flags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    flagged_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved BOOLEAN DEFAULT 0
);

CREATE TABLE IF NOT EXISTS environmental_impact (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    co2_saved_kg REAL NOT NULL,
    ewaste_prevented_kg REAL NOT NULL,
    items_rescued INTEGER NOT NULL,
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
