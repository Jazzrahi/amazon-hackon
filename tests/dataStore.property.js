const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fc = require('fast-check');
const { getUserById, updateUserCredits, markItemAsAmazonOwned, getProductById } = require('../src/services/dataStore');
const initDB = require('../src/services/dbInit');

beforeEach(async () => {
  await initDB();
});

describe('Data Store - Property Tests', () => {
  /**
   * Property 7: Green Credits Balance Update
   * For any user balance B and credit C, balance becomes B + C.
   * **Validates: Requirements 4.1, 4.3, 4.5**
   */
  it('Property 7: Green Credits balance update is correct', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 5000 }),   // credit amount to add
        async (creditAmount) => {
          // Reset database state for clean run
          await initDB();

          const userBefore = await getUserById('user_001');
          const balanceBefore = userBefore.green_credits;

          await updateUserCredits('user_001', creditAmount);

          const userAfter = await getUserById('user_001');
          assert.equal(userAfter.green_credits, balanceBefore + creditAmount);
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Property 7b: markItemAsAmazonOwned sets inventory_owner to "amazon"
   * **Validates: Requirements 4.5**
   */
  it('Property 7b: markItemAsAmazonOwned sets inventory_owner to amazon', async () => {
    await initDB();

    // prod_002 starts with inventory_owner = "seller"
    const result = await markItemAsAmazonOwned('prod_002');
    assert.equal(result.inventory_owner, 'amazon');

    // Verify persistence
    const product = await getProductById('prod_002');
    assert.equal(product.inventory_owner, 'amazon');
  });

  /**
   * Property 8: Data Persistence Round-Trip
   * For any valid mutation, subsequent read reflects written values.
   * **Validates: Requirements 10.7**
   */
  it('Property 8: Data persistence round-trip', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 5000 }),   // value to write
        async (value) => {
          await initDB();

          // Set user credits to a specific value directly and read back
          const userBefore = await getUserById('user_001');
          const diff = value - userBefore.green_credits;
          
          await updateUserCredits('user_001', diff);

          const readBack = await getUserById('user_001');
          assert.equal(readBack.green_credits, value);
        }
      ),
      { numRuns: 30 }
    );
  });
});
