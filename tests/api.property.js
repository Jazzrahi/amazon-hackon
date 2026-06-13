const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fc = require('fast-check');
const http = require('http');
const app = require('../server');

const TEST_PORT = 3099;

/**
 * Helper to make HTTP requests to the test server.
 */
function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: TEST_PORT,
      path,
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// Known product IDs from the data store
const EXISTING_PRODUCT_IDS = [
  'prod_001', 'prod_002', 'prod_003', 'prod_004', 'prod_005',
  'prod_006', 'prod_007', 'prod_008', 'prod_009'
];

// Required fields for a product response per Requirement 9.1
const REQUIRED_PRODUCT_FIELDS = [
  'id', 'name', 'price', 'return_shipping_cost',
  'high_return_risk', 'category', 'return_rate', 'sizing_advice'
];

let testServer;

describe('API Endpoints - Property Tests', () => {
  before(() => {
    return new Promise((resolve) => {
      testServer = app.listen(TEST_PORT, () => resolve());
    });
  });

  after(() => {
    return new Promise((resolve) => {
      testServer.close(() => resolve());
    });
  });

  /**
   * Property 9: Product API Response Structure
   *
   * For any existing product ID, GET /api/product/:id returns HTTP 200
   * with a JSON body containing all required fields with correct types.
   *
   * Validates: Requirements 9.1, 9.3
   */
  it('Property 9: For any existing product ID, GET returns 200 with all required fields', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...EXISTING_PRODUCT_IDS),
        async (productId) => {
          const res = await request('GET', `/api/product/${productId}`);

          // Must return HTTP 200
          assert.equal(res.status, 200,
            `Expected 200 for existing product ${productId}, got ${res.status}`);

          // Must contain all required fields
          for (const field of REQUIRED_PRODUCT_FIELDS) {
            assert.ok(field in res.body,
              `Response for ${productId} missing required field: ${field}`);
          }

          // Type checks per Requirement 9.1
          assert.equal(typeof res.body.id, 'string', 'id must be a string');
          assert.equal(typeof res.body.name, 'string', 'name must be a string');
          assert.equal(typeof res.body.price, 'number', 'price must be a number');
          assert.equal(typeof res.body.return_shipping_cost, 'number', 'return_shipping_cost must be a number');
          assert.equal(typeof res.body.high_return_risk, 'boolean', 'high_return_risk must be a boolean');
          assert.equal(typeof res.body.category, 'string', 'category must be a string');
          assert.equal(typeof res.body.return_rate, 'number', 'return_rate must be a number');
          assert.ok(
            res.body.sizing_advice === null || typeof res.body.sizing_advice === 'string',
            'sizing_advice must be string or null'
          );

          // The returned id must match the requested id
          assert.equal(res.body.id, productId, 'Returned product id must match requested id');
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 10: Product API 404 for Missing IDs
   *
   * For any product ID string that does not match any product in the data store,
   * GET /api/product/:id returns HTTP 404 with a JSON body containing "error" field.
   *
   * Validates: Requirements 9.4
   */
  it('Property 10: For any non-existent ID, GET returns 404 with error field', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter(
          id => !EXISTING_PRODUCT_IDS.includes(id)
        ),
        async (nonExistentId) => {
          const res = await request('GET', `/api/product/${encodeURIComponent(nonExistentId)}`);

          // Must return HTTP 404
          assert.equal(res.status, 404,
            `Expected 404 for non-existent product "${nonExistentId}", got ${res.status}`);

          // Must contain error field
          assert.ok('error' in res.body,
            `Response for non-existent ID must contain "error" field`);
          assert.equal(typeof res.body.error, 'string',
            'error field must be a string');
          assert.equal(res.body.error, 'Product not found',
            'error message must be "Product not found"');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 11: Process-Return API Validation
   *
   * For any request body missing user_id or product_id,
   * POST /api/process-return returns HTTP 400 with a JSON body containing "error" field.
   *
   * Validates: Requirements 9.6
   */
  it('Property 11: For any request missing user_id or product_id, POST returns 400 with error', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          'missing_user_id',
          'missing_product_id',
          'missing_both'
        ),
        fc.string({ minLength: 1, maxLength: 20 }),
        async (scenario, randomValue) => {
          let body;

          switch (scenario) {
            case 'missing_user_id':
              // Has product_id but no user_id
              body = { product_id: randomValue };
              break;
            case 'missing_product_id':
              // Has user_id but no product_id
              body = { user_id: randomValue };
              break;
            case 'missing_both':
              // Neither field present
              body = {};
              break;
          }

          const res = await request('POST', '/api/process-return', body);

          // Must return HTTP 400
          assert.equal(res.status, 400,
            `Expected 400 for ${scenario}, got ${res.status}`);

          // Must contain error field
          assert.ok('error' in res.body,
            `Response for ${scenario} must contain "error" field`);
          assert.equal(typeof res.body.error, 'string',
            'error field must be a string');

          // Error message should mention the missing fields
          if (scenario === 'missing_user_id') {
            assert.ok(res.body.error.includes('user_id'),
              'Error should mention missing user_id');
          } else if (scenario === 'missing_product_id') {
            assert.ok(res.body.error.includes('product_id'),
              'Error should mention missing product_id');
          } else {
            // missing_both: should mention at least one missing field
            assert.ok(
              res.body.error.includes('user_id') || res.body.error.includes('product_id'),
              'Error should mention at least one missing field'
            );
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});
