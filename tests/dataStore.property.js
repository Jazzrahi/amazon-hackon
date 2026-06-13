const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fc = require('fast-check');
const fs = require('fs');
const path = require('path');
const { readDB, writeDB, getUserById, updateUserCredits, markItemAsAmazonOwned, getProductById } = require('../src/services/dataStore');

const DB_PATH = path.join(__dirname, '../data/db.json');
let originalContent;

beforeEach(() => {
  originalContent = fs.readFileSync(DB_PATH, 'utf-8');
});

afterEach(() => {
  fs.writeFileSync(DB_PATH, originalContent, 'utf-8');
});

describe('Data Store - Property Tests', () => {
  /**
   * Property 7: Green Credits Balance Update
   * For any user balance B and credit C, balance becomes B + C and item becomes amazon-owned.
   * **Validates: Requirements 4.1, 4.3, 4.5**
   */
  it('Property 7: Green Credits balance update is correct', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 5000 }),   // credit amount to add
        (creditAmount) => {
          // Reset to clean state
          fs.writeFileSync(DB_PATH, originalContent, 'utf-8');

          const userBefore = getUserById('user_001');
          const balanceBefore = userBefore.green_credits;

          updateUserCredits('user_001', creditAmount);

          const userAfter = getUserById('user_001');
          assert.equal(userAfter.green_credits, balanceBefore + creditAmount);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 7b: markItemAsAmazonOwned sets inventory_owner to "amazon"
   * **Validates: Requirements 4.5**
   */
  it('Property 7b: markItemAsAmazonOwned sets inventory_owner to amazon', () => {
    // Reset to clean state
    fs.writeFileSync(DB_PATH, originalContent, 'utf-8');

    // prod_002 starts with inventory_owner = "seller"
    const result = markItemAsAmazonOwned('prod_002');
    assert.equal(result.inventory_owner, 'amazon');

    // Verify persistence
    const product = getProductById('prod_002');
    assert.equal(product.inventory_owner, 'amazon');
  });

  /**
   * Property 8: Data Persistence Round-Trip
   * For any valid mutation, subsequent read reflects written values.
   * **Validates: Requirements 10.7**
   */
  it('Property 8: Data persistence round-trip', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 5000 }),   // value to write
        (value) => {
          // Reset
          fs.writeFileSync(DB_PATH, originalContent, 'utf-8');

          const db = readDB();
          db.users[0].green_credits = value;
          writeDB(db);

          const readBack = readDB();
          assert.equal(readBack.users[0].green_credits, value);
        }
      ),
      { numRuns: 50 }
    );
  });
});
