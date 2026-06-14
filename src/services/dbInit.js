const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../../data/database.sqlite');
const SCHEMA_PATH = path.join(__dirname, '../../data/schema.sql');
const SEED_PATH = path.join(__dirname, '../../data/db.seed.json');

async function initDB() {
    // Connect to SQLite
    const db = await open({
        filename: DB_PATH,
        driver: sqlite3.Database
    });

    // Run schema
    const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf-8');
    await db.exec(schemaSql);
    console.log('Schema executed successfully.');

    // Load seed data
    if (!fs.existsSync(SEED_PATH)) {
        console.error('Seed file not found at', SEED_PATH);
        return;
    }

    const seedData = JSON.parse(fs.readFileSync(SEED_PATH, 'utf-8'));

    // Clear existing data (optional, but good for reset)
    await db.exec(`
        DELETE FROM orders;
        DELETE FROM products;
        DELETE FROM users;
        DELETE FROM demand;
        DELETE FROM delivery_routes;
    `);

    // Insert users
    for (const user of seedData.users || []) {
        await db.run(
            `INSERT INTO users (id, name, trust_score, green_credits, region, area) VALUES (?, ?, ?, ?, ?, ?)`,
            [user.id, user.name, user.trust_score, user.green_credits, user.region, user.area]
        );
    }

    // Insert products
    for (const prod of seedData.products || []) {
        await db.run(
            `INSERT INTO products (id, name, price, return_shipping_cost, high_return_risk, category, return_rate, sizing_advice, carbon_savings_kg, inventory_owner, graded, grade, resale_price, image_url)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                prod.id, prod.name, prod.price, prod.return_shipping_cost, prod.high_return_risk ? 1 : 0,
                prod.category, prod.return_rate, prod.sizing_advice, prod.carbon_savings_kg, prod.inventory_owner,
                prod.graded ? 1 : 0, prod.grade, prod.resale_price, prod.image_url
            ]
        );
    }

    // Insert demand
    for (const d of seedData.demand || []) {
        await db.run(
            `INSERT INTO demand (category, region, demand_score) VALUES (?, ?, ?)`,
            [d.category, d.region, d.demand_score]
        );
    }

    // Insert delivery routes
    for (const route of seedData.delivery_routes || []) {
        await db.run(
            `INSERT INTO delivery_routes (driver_id, driver_name, area, time_windows) VALUES (?, ?, ?, ?)`,
            [route.driver_id, route.driver_name, route.area, JSON.stringify(route.time_windows)]
        );
    }

    // Insert orders
    for (const order of seedData.orders || []) {
        await db.run(
            `INSERT INTO orders (order_id, user_id, product_id, order_date, status, returned) VALUES (?, ?, ?, ?, ?, ?)`,
            [order.order_id, order.user_id, order.product_id, order.order_date, order.status, order.returned ? 1 : 0]
        );
    }

    console.log('Database seeded successfully from JSON.');
    await db.close();
}

if (require.main === module) {
    initDB().catch(err => console.error(err));
}

module.exports = initDB;
