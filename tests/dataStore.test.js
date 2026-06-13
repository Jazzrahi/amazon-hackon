const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const dataStore = require('../src/services/dataStore');

const DB_PATH = path.join(__dirname, '../data/db.json');

// Save original DB content and restore after each test
let originalContent;

beforeEach(() => {
  originalContent = fs.readFileSync(DB_PATH, 'utf-8');
});

afterEach(() => {
  fs.writeFileSync(DB_PATH, originalContent, 'utf-8');
});

describe('dataStore', () => {
  describe('readDB()', () => {
    it('should return an object with expected keys', () => {
      const db = dataStore.readDB();
      assert.equal(typeof db, 'object');
      assert.ok(Array.isArray(db.users));
      assert.ok(Array.isArray(db.products));
      assert.ok(Array.isArray(db.demand));
      assert.ok(Array.isArray(db.delivery_routes));
      assert.ok(Array.isArray(db.orders));
    });
  });

  describe('writeDB()', () => {
    it('should persist data that can be read back', () => {
      const db = dataStore.readDB();
      db.users[0].name = 'Test User';
      dataStore.writeDB(db);

      const readBack = dataStore.readDB();
      assert.equal(readBack.users[0].name, 'Test User');
    });
  });

  describe('getUserById()', () => {
    it('should return the user when ID exists', () => {
      const user = dataStore.getUserById('user_001');
      assert.notEqual(user, null);
      assert.equal(user.id, 'user_001');
      assert.equal(user.name, 'Priya Sharma');
    });

    it('should return null when ID does not exist', () => {
      const user = dataStore.getUserById('nonexistent');
      assert.equal(user, null);
    });
  });

  describe('getProductById()', () => {
    it('should return the product when ID exists', () => {
      const product = dataStore.getProductById('prod_001');
      assert.notEqual(product, null);
      assert.equal(product.id, 'prod_001');
      assert.equal(product.name, 'Cotton Kurta Set - Women\'s M');
    });

    it('should return null when ID does not exist', () => {
      const product = dataStore.getProductById('nonexistent');
      assert.equal(product, null);
    });
  });

  describe('getSecondLifeItems()', () => {
    it('should return only items with inventory_owner = "amazon"', () => {
      const items = dataStore.getSecondLifeItems();
      assert.ok(Array.isArray(items));
      assert.ok(items.length > 0);
      items.forEach(item => {
        assert.equal(item.inventory_owner, 'amazon');
      });
    });
  });

  describe('getOrdersByUserId()', () => {
    it('should return orders for the given user within last 30 days', () => {
      const orders = dataStore.getOrdersByUserId('user_001');
      assert.ok(Array.isArray(orders));
      orders.forEach(order => {
        assert.equal(order.user_id, 'user_001');
        const orderDate = new Date(order.order_date);
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        assert.ok(orderDate >= thirtyDaysAgo);
      });
    });

    it('should return empty array for user with no recent orders', () => {
      const orders = dataStore.getOrdersByUserId('nonexistent');
      assert.ok(Array.isArray(orders));
      assert.equal(orders.length, 0);
    });
  });

  describe('updateUserCredits()', () => {
    it('should add amount to user green_credits and persist', () => {
      const before = dataStore.getUserById('user_001').green_credits;
      const result = dataStore.updateUserCredits('user_001', 150);

      assert.notEqual(result, null);
      assert.equal(result.green_credits, before + 150);

      // Verify persistence
      const afterRead = dataStore.getUserById('user_001');
      assert.equal(afterRead.green_credits, before + 150);
    });

    it('should return null for non-existent user', () => {
      const result = dataStore.updateUserCredits('nonexistent', 100);
      assert.equal(result, null);
    });
  });

  describe('markItemAsAmazonOwned()', () => {
    it('should set inventory_owner to "amazon" and persist', () => {
      const result = dataStore.markItemAsAmazonOwned('prod_001');

      assert.notEqual(result, null);
      assert.equal(result.inventory_owner, 'amazon');

      // Verify persistence
      const afterRead = dataStore.getProductById('prod_001');
      assert.equal(afterRead.inventory_owner, 'amazon');
    });

    it('should return null for non-existent product', () => {
      const result = dataStore.markItemAsAmazonOwned('nonexistent');
      assert.equal(result, null);
    });
  });
});
