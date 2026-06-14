const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fc = require('fast-check');
const { routeReturn } = require('../src/services/returnRouter');

describe('Return Router - Property Tests', () => {
  it('Property 6: Routing follows strict 3-tier rules', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),           // qualityScore
        fc.constantFrom('A', 'B', 'C'),             // grade
        fc.integer({ min: 199, max: 50000 }),       // productPrice (INR)
        fc.integer({ min: 0, max: 100 }),           // trustScore
        fc.boolean(),                               // fraudDetected
        (qualityScore, grade, productPrice, trustScore, fraudDetected) => {
          const result = routeReturn({ qualityScore, grade, productPrice, trustScore, fraudDetected });

          // 1. Fraud Override
          if (fraudDetected) {
            assert.equal(result.decision, 'fraud_rejected');
            assert.equal(result.tier, 0);
            assert.equal(result.rule, 'fraud_detected');
            assert.equal(result.partialRefundAmount, 0);
          }
          // 2. Low Trust Override
          else if (trustScore < 40) {
            assert.equal(result.decision, 'standard_return');
            assert.equal(result.tier, 3);
            assert.equal(result.rule, 'low_trust_score');
            assert.equal(result.partialRefundAmount, 0);
          }
          // 3. Tier 1: Keep Item (quality >= 70)
          else if (qualityScore >= 70) {
            assert.equal(result.decision, 'keep_item');
            assert.equal(result.tier, 1);
            assert.equal(result.rule, 'tier1_keep_item');
            
            let expectedPercent = 0;
            if (qualityScore >= 85) expectedPercent = 15;
            else if (qualityScore >= 75) expectedPercent = 22;
            else expectedPercent = 30;

            assert.equal(result.partialRefundPercent, expectedPercent);
            assert.equal(result.partialRefundAmount, Math.round(productPrice * expectedPercent / 100));
          }
          // 4. Tier 2: Second Life (quality 50-69)
          else if (qualityScore >= 50) {
            assert.equal(result.decision, 'second_life');
            assert.equal(result.tier, 2);
            assert.equal(result.rule, 'tier2_second_life');
            assert.equal(result.partialRefundPercent, 100);
            assert.equal(result.partialRefundAmount, productPrice);
          }
          // 5. Tier 3: Standard Return (quality < 50)
          else {
            assert.equal(result.decision, 'standard_return');
            assert.equal(result.tier, 3);
            assert.equal(result.rule, 'tier3_standard_return');
            assert.equal(result.partialRefundPercent, 0);
            assert.equal(result.partialRefundAmount, 0);
          }

          // Structural invariant: response always includes required fields
          assert.ok('decision' in result);
          assert.ok('tier' in result);
          assert.ok('qualityScore' in result);
          assert.ok('partialRefundPercent' in result);
          assert.ok('partialRefundAmount' in result);
          assert.ok('rule' in result);
        }
      ),
      { numRuns: 500 }
    );
  });
});
