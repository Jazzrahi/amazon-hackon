const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../../data/db.json');

/**
 * Reads and parses the JSON data store.
 * @returns {Object} Parsed db.json contents
 */
function readDB() {
  const raw = fs.readFileSync(DB_PATH, 'utf-8');
  return JSON.parse(raw);
}

/**
 * Writes updated data to the JSON data store.
 * @param {Object} data - The full database object to persist
 */
function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Retrieves a user record by ID.
 * @param {string} userId - The user's ID
 * @returns {Object|null} User record or null if not found
 */
function getUserById(userId) {
  const db = readDB();
  return db.users.find(user => user.id === userId) || null;
}

/**
 * Retrieves a product record by ID.
 * @param {string} productId - The product's ID
 * @returns {Object|null} Product record or null if not found
 */
function getProductById(productId) {
  const db = readDB();
  return db.products.find(product => product.id === productId) || null;
}

/**
 * Returns all products with inventory_owner set to "amazon" (Second Life items).
 * @returns {Array} Array of product records owned by Amazon
 */
function getSecondLifeItems() {
  const db = readDB();
  return db.products.filter(product => product.inventory_owner === 'amazon');
}

/**
 * Returns a user's orders from the last 30 days.
 * @param {string} userId - The user's ID
 * @returns {Array} Array of order records within the last 30 days
 */
function getOrdersByUserId(userId) {
  const db = readDB();
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  return db.orders.filter(order => {
    if (order.user_id !== userId) return false;
    const orderDate = new Date(order.order_date);
    return orderDate >= thirtyDaysAgo;
  });
}

/**
 * Adds the specified amount to a user's Green_Credits balance.
 * @param {string} userId - The user's ID
 * @param {number} amount - Amount to add to green_credits
 * @returns {Object|null} Updated user record or null if user not found
 */
function updateUserCredits(userId, amount) {
  const db = readDB();
  const user = db.users.find(u => u.id === userId);
  if (!user) return null;

  user.green_credits += amount;
  writeDB(db);
  return user;
}

/**
 * Sets a product's inventory_owner to "amazon".
 * @param {string} productId - The product's ID
 * @returns {Object|null} Updated product record or null if product not found
 */
function markItemAsAmazonOwned(productId) {
  const db = readDB();
  const product = db.products.find(p => p.id === productId);
  if (!product) return null;

  product.inventory_owner = 'amazon';
  writeDB(db);
  return product;
}

module.exports = {
  readDB,
  writeDB,
  getUserById,
  getProductById,
  getSecondLifeItems,
  getOrdersByUserId,
  updateUserCredits,
  markItemAsAmazonOwned
};
