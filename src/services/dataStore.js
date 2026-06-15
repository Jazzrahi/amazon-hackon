const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');

const DB_PATH = path.join(__dirname, '../../data/database.sqlite');

let dbPromise = null;

async function getDB() {
  if (!dbPromise) {
    dbPromise = open({
      filename: DB_PATH,
      driver: sqlite3.Database
    });
  }
  return dbPromise;
}

// Deprecated functions that previously used fs
function readDB() {
  throw new Error('readDB is deprecated. Use async database methods instead.');
}

function writeDB(data) {
  throw new Error('writeDB is deprecated. Use async database methods instead.');
}

async function getUserById(userId) {
  const db = await getDB();
  return db.get(`SELECT * FROM users WHERE id = ?`, [userId]);
}

async function getProductById(productId) {
  const db = await getDB();
  const product = await db.get(`SELECT * FROM products WHERE id = ?`, [productId]);
  if (product) {
      product.high_return_risk = !!product.high_return_risk;
      product.graded = !!product.graded;
  }
  return product;
}

async function getAllProducts() {
  const db = await getDB();
  const products = await db.all(`SELECT * FROM products`);
  products.forEach(p => {
      p.high_return_risk = !!p.high_return_risk;
      p.graded = !!p.graded;
  });
  return products;
}

async function getSecondLifeItems() {
  const db = await getDB();
  const products = await db.all(`SELECT * FROM products WHERE inventory_owner = 'amazon' OR inventory_owner LIKE 'seller_%'`);
  products.forEach(p => {
      p.high_return_risk = !!p.high_return_risk;
      p.graded = !!p.graded;
  });
  return products;
}

async function getOrdersByUserId(userId) {
  const db = await getDB();
  const orders = await db.all(`SELECT * FROM orders WHERE user_id = ? AND date(order_date) >= date('now', '-30 days') ORDER BY date(order_date) DESC`, [userId]);
  orders.forEach(o => o.returned = !!o.returned);
  return orders;
}

async function updateUserCredits(userId, amount) {
  const db = await getDB();
  await db.run(`UPDATE users SET green_credits = green_credits + ? WHERE id = ?`, [amount, userId]);
  return getUserById(userId);
}

async function markItemAsAmazonOwned(productId) {
  const db = await getDB();
  await db.run(`UPDATE products SET inventory_owner = 'amazon', graded = 1 WHERE id = ?`, [productId]);
  return getProductById(productId);
}

async function getAllDemand() {
  const db = await getDB();
  return db.all(`SELECT * FROM demand`);
}

async function getAllDeliveryRoutes() {
  const db = await getDB();
  const routes = await db.all(`SELECT * FROM delivery_routes`);
  routes.forEach(r => r.time_windows = JSON.parse(r.time_windows));
  return routes;
}

async function getOrder(userId, productId) {
    const db = await getDB();
    return db.get(`SELECT * FROM orders WHERE user_id = ? AND product_id = ?`, [userId, productId]);
}

async function markOrderReturned(orderId, returnType) {
    const db = await getDB();
    await db.run(`UPDATE orders SET returned = 1, status = ? WHERE order_id = ?`, [returnType, orderId]);
}

async function updateProductResale(productId, grade, resalePrice, userId) {
    const db = await getDB();
    const owner = userId ? `seller_${userId}` : 'amazon';
    await db.run(`UPDATE products SET inventory_owner = ?, graded = 1, grade = ?, resale_price = ? WHERE id = ?`, [owner, grade, resalePrice, productId]);
}

async function getTopUsers(limit = 5) {
    const db = await getDB();
    return db.all(`SELECT id, name, green_credits, area, region FROM users ORDER BY green_credits DESC LIMIT ?`, [limit]);
}

async function createOrder(orderId, userId, productId, orderDate, status) {
    const db = await getDB();
    await db.run(
        `INSERT INTO orders (order_id, user_id, product_id, order_date, status, returned) VALUES (?, ?, ?, ?, ?, 0)`,
        [orderId, userId, productId, orderDate, status]
    );
    return getOrder(userId, productId);
}

async function getAllOrders() {
    const db = await getDB();
    return db.all(`SELECT * FROM orders`);
}

async function getAllUsers() {
    const db = await getDB();
    return db.all(`SELECT * FROM users`);
}

async function buySecondLifeItem(userId, productId) {
    const db = await getDB();
    
    const item = await getProductById(productId);
    let deliveryType = 'delivered';

    if (item && item.inventory_owner && item.inventory_owner.startsWith('seller_')) {
        const sellerId = item.inventory_owner.replace('seller_', '');
        if (sellerId !== userId) {
            const seller = await getUserById(sellerId);
            const buyer = await getUserById(userId);
            if (seller && buyer && seller.area === buyer.area) {
                deliveryType = 'p2p_local_delivery';
                await updateUserCredits(sellerId, 100);
            }
        }
    }

    // Set inventory_owner to user to remove from Amazon stocks
    await db.run(`UPDATE products SET inventory_owner = ? WHERE id = ?`, [userId, productId]);
    
    // Create an order
    const orderId = 'ord_' + Math.floor(Math.random() * 1000000);
    const orderDate = new Date().toISOString().split('T')[0];
    await db.run(
        `INSERT INTO orders (order_id, user_id, product_id, order_date, status, returned) VALUES (?, ?, ?, ?, ?, 0)`,
        [orderId, userId, productId, orderDate, deliveryType]
    );
    return getProductById(productId);
}

async function updateProductRegion(productId, region) {
    const db = await getDB();
    await db.run(`UPDATE products SET current_region = ? WHERE id = ?`, [region, productId]);
}

async function checkoutCart(userId, items, creditsUsed) {
    const db = await getDB();
    
    // Deduct credits
    if (creditsUsed > 0) {
        await db.run(`UPDATE users SET green_credits = green_credits - ? WHERE id = ?`, [creditsUsed, userId]);
    }
    
    const orderDate = new Date().toISOString().split('T')[0];
    const results = [];
    
    for (const item of items) {
        const orderId = 'ord_' + Math.floor(Math.random() * 1000000);
        let deliveryType = 'delivered';
        
        // If it's a second life item currently owned by amazon or seller, transfer ownership
        if (item.inventory_owner === 'amazon' || (item.inventory_owner && item.inventory_owner.startsWith('seller_'))) {
            
            // P2P Check
            if (item.inventory_owner && item.inventory_owner.startsWith('seller_')) {
                const sellerId = item.inventory_owner.replace('seller_', '');
                if (sellerId !== userId) {
                    const seller = await getUserById(sellerId);
                    const buyer = await getUserById(userId);
                    if (seller && buyer && seller.area === buyer.area) {
                        deliveryType = 'p2p_local_delivery';
                        // Award seller 100 green credits for local dropoff
                        await updateUserCredits(sellerId, 100);
                    }
                }
            }

            await db.run(`UPDATE products SET inventory_owner = ? WHERE id = ?`, [userId, item.id]);
        }
        
        await db.run(
            `INSERT INTO orders (order_id, user_id, product_id, order_date, status, returned) VALUES (?, ?, ?, ?, ?, 0)`,
            [orderId, userId, item.id, orderDate, deliveryType]
        );
        
        results.push(await getProductById(item.id));
    }
    
    return results;
}

module.exports = {
  readDB,
  writeDB,
  getUserById,
  getProductById,
  getAllProducts,
  getSecondLifeItems,
  getOrdersByUserId,
  updateUserCredits,
  markItemAsAmazonOwned,
  getAllDemand,
  getAllDeliveryRoutes,
  getOrder,
  markOrderReturned,
  updateProductResale,
  updateProductRegion,
  createOrder,
  getAllOrders,
  getAllUsers,
  buySecondLifeItem,
  checkoutCart,
  getTopUsers
};
