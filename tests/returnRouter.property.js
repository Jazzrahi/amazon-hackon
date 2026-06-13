const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fc = require('fast-check');
const { routeReturn } = require('../src/services/returnRouter');

/**
 * Property 6: Return Routing Priority Rules
 * 
 * For any combination of trustScore (0-100), returnShippingCost, productPrice (positive),
 * and demandClassification ("high"/"low"), the routeReturn function follows strict priority ordering.
 * 
 * Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 3.2, 3.3
 */
describe('Return Router - Property Tests', () => {
  it('Property 6: Routing follows strict priority rules', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),           // trustScore
        fc.integer({ min: 50, max: 500 }),          // returnShippingCost (INR)
        fc.integer({ min: 199, max: 50000 }),       // productPrice (INR, positive)
        fc.constantFrom('high', 'low'),             // demandClassification
        (trustScore, returnShippingCost, productPrice, demandClassification) => {
          const result = routeReturn({ trustScore, returnShippingCost, productPrice, demandClassification });

          // The implementation rounds shippingRatio to 2 decimal places
          const shippingRatio = Math.round((returnShippingCost / productPrice) * 100) / 100;

          // Priority 1: Low trust score → standard_return (short-circuit)
          if (trustScore < 50) {
            assert.equal(result.decision, 'standard_return',
              `Expected standard_return for low trust (${trustScore})`);
            assert.equal(result.rule, 'low_trust_score');
            assert.equal(result.offerAmount, null);
          }
          // Priority 2: High shipping ratio → green_credit
          else if (shippingRatio > 0.40) {
            assert.equal(result.decision, 'green_credit',
              `Expected green_credit for high shipping ratio (${shippingRatio})`);
            assert.equal(result.rule, 'high_shipping_ratio');
            assert.equal(result.offerAmount, Math.round(productPrice * 0.50));
          }
          // Priority 3: High demand → p2p_resale
          else if (demandClassification === 'high') {
            assert.equal(result.decision, 'p2p_resale',
              `Expected p2p_resale for high demand`);
            assert.equal(result.rule, 'high_demand');
            assert.equal(result.offerAmount, null);
          }
          // Priority 4: Default → standard_return (low demand)
          else {
            assert.equal(result.decision, 'standard_return',
              `Expected standard_return as default (low demand)`);
            assert.equal(result.rule, 'low_demand');
            assert.equal(result.offerAmount, null);
          }

          // Structural invariant: response always includes required fields
          assert.ok('decision' in result, 'Response must include decision');
          assert.ok('rule' in result, 'Response must include rule');
          assert.ok('trustScore' in result, 'Response must include trustScore');
          assert.ok('shippingRatio' in result, 'Response must include shippingRatio');
          assert.ok('offerAmount' in result, 'Response must include offerAmount');

          // trustScore and shippingRatio are echoed correctly
          assert.equal(result.trustScore, trustScore);
          assert.equal(result.shippingRatio, shippingRatio);
        }
      ),
      { numRuns: 500 }
    );
  });
});
