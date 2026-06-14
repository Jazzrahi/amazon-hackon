const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const dataStore = require('../src/services/dataStore');
const initDB = require('../src/services/dbInit');

beforeEach(async () => {
  await initDB();
});

describe('dataStore', () => {
  describe('readDB() and writeDB() deprecation', () => {
    it('should throw error since readDB is deprecated', () => {
      assert.throws(() => dataStore.readDB(), /deprecated/);
    });

    it('should throw error since writeDB is deprecated', () => {
      assert.throws(() => dataStore.writeDB({}), /deprecated/);
    });
  });

  describe('getUserById()', () => {
    it('should return the user when ID exists', async () => {
      const user = await dataStore.getUserById('user_001');
      assert.notEqual(user, null);
      assert.equal(user.id, 'user_001');
      assert.equal(user.name, 'Priya Sharma');
    });

    it('should return undefined when ID does not exist', async () => {
      const user = await dataStore.getUserById('nonexistent');
      assert.equal(user, undefined);
    });
  });

  describe('getProductById()', () => {
    it('should return the product when ID exists', async () => {
      const product = await dataStore.getProductById('prod_001');
      assert.notEqual(product, null);
      assert.equal(product.id, 'prod_001');
      assert.equal(product.name, 'Cotton Kurta Set - Women\'s M');
    });

    it('should return undefined when ID does not exist', async () => {
      const product = await dataStore.getProductById('nonexistent');
      assert.equal(product, undefined);
    });
  });

  describe('getSecondLifeItems()', () => {
    it('should return only items with inventory_owner = "amazon"', async () => {
      const items = await dataStore.getSecondLifeItems();
      assert.ok(Array.isArray(items));
      assert.ok(items.length > 0);
      items.forEach(item => {
        assert.equal(item.inventory_owner, 'amazon');
      });
    });
  });

  describe('getOrdersByUserId()', () => {
    it('should return orders for the given user within last 30 days', async () => {
      const orders = await dataStore.getOrdersByUserId('user_001');
      assert.ok(Array.isArray(orders));
      orders.forEach(order => {
        assert.equal(order.user_id, 'user_001');
        const orderDate = new Date(order.order_date);
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        assert.ok(orderDate >= thirtyDaysAgo);
      });
    });

    it('should return empty array for user with no recent orders', async () => {
      const orders = await dataStore.getOrdersByUserId('nonexistent');
      assert.ok(Array.isArray(orders));
      assert.equal(orders.length, 0);
    });
  });

  describe('updateUserCredits()', () => {
    it('should add amount to user green_credits and persist', async () => {
      const userBefore = await dataStore.getUserById('user_001');
      const before = userBefore.green_credits;
      const result = await dataStore.updateUserCredits('user_001', 150);

      assert.notEqual(result, null);
      assert.equal(result.green_credits, before + 150);

      // Verify persistence
      const afterRead = await dataStore.getUserById('user_001');
      assert.equal(afterRead.green_credits, before + 150);
    });
  });

  describe('markItemAsAmazonOwned()', () => {
    it('should set inventory_owner to "amazon" and persist', async () => {
      const result = await dataStore.markItemAsAmazonOwned('prod_001');

      assert.notEqual(result, null);
      assert.equal(result.inventory_owner, 'amazon');

      // Verify persistence
      const afterRead = await dataStore.getProductById('prod_001');
      assert.equal(afterRead.inventory_owner, 'amazon');
    });
  });
});
