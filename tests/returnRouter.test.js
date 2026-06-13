const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { routeReturn } = require('../src/services/returnRouter');

describe('returnRouter', () => {
  describe('routeReturn()', () => {
    // Priority 1: Low trust score short-circuit
    it('should return standard_return with low_trust_score rule when trustScore < 50', () => {
      const result = routeReturn({
        trustScore: 30,
        returnShippingCost: 500,
        productPrice: 1000,
        demandClassification: 'high',
      });
      assert.equal(result.decision, 'standard_return');
      assert.equal(result.rule, 'low_trust_score');
      assert.equal(result.offerAmount, null);
    });

    it('should short-circuit on low trust even if shipping ratio is high', () => {
      const result = routeReturn({
        trustScore: 10,
        returnShippingCost: 600,
        productPrice: 1000,
        demandClassification: 'high',
      });
      assert.equal(result.decision, 'standard_return');
      assert.equal(result.rule, 'low_trust_score');
    });

    it('should short-circuit at trustScore = 49', () => {
      const result = routeReturn({
        trustScore: 49,
        returnShippingCost: 100,
        productPrice: 1000,
        demandClassification: 'high',
      });
      assert.equal(result.decision, 'standard_return');
      assert.equal(result.rule, 'low_trust_score');
    });

    // Priority 2: High shipping ratio → green_credit
    it('should return green_credit when shipping ratio > 0.40 and trust >= 50', () => {
      const result = routeReturn({
        trustScore: 75,
        returnShippingCost: 500,
        productPrice: 1000,
        demandClassification: 'low',
      });
      assert.equal(result.decision, 'green_credit');
      assert.equal(result.rule, 'high_shipping_ratio');
      assert.equal(result.offerAmount, 500); // Math.round(1000 * 0.50)
    });

    it('should not trigger green_credit at exactly 0.40 ratio', () => {
      const result = routeReturn({
        trustScore: 75,
        returnShippingCost: 400,
        productPrice: 1000,
        demandClassification: 'low',
      });
      assert.notEqual(result.decision, 'green_credit');
    });

    it('should calculate offer as Math.round(productPrice * 0.50)', () => {
      const result = routeReturn({
        trustScore: 80,
        returnShippingCost: 550,
        productPrice: 1299,
        demandClassification: 'low',
      });
      // 550/1299 = 0.42 > 0.40 → green_credit
      assert.equal(result.decision, 'green_credit');
      assert.equal(result.offerAmount, Math.round(1299 * 0.50)); // 650
    });

    // Priority 3: High demand → p2p_resale
    it('should return p2p_resale when demand is high, trust >= 50, and ratio <= 0.40', () => {
      const result = routeReturn({
        trustScore: 70,
        returnShippingCost: 150,
        productPrice: 1000,
        demandClassification: 'high',
      });
      assert.equal(result.decision, 'p2p_resale');
      assert.equal(result.rule, 'high_demand');
      assert.equal(result.offerAmount, null);
    });

    // Priority 4: Default → standard_return (low demand)
    it('should return standard_return with low_demand rule as fallback', () => {
      const result = routeReturn({
        trustScore: 70,
        returnShippingCost: 150,
        productPrice: 1000,
        demandClassification: 'low',
      });
      assert.equal(result.decision, 'standard_return');
      assert.equal(result.rule, 'low_demand');
      assert.equal(result.offerAmount, null);
    });

    // Shipping ratio calculation
    it('should compute shippingRatio rounded to 2 decimal places', () => {
      const result = routeReturn({
        trustScore: 80,
        returnShippingCost: 333,
        productPrice: 1000,
        demandClassification: 'low',
      });
      assert.equal(result.shippingRatio, 0.33);
    });

    // Response structure
    it('should always include decision, rule, trustScore, shippingRatio, and offerAmount', () => {
      const result = routeReturn({
        trustScore: 60,
        returnShippingCost: 200,
        productPrice: 1000,
        demandClassification: 'low',
      });
      assert.ok('decision' in result);
      assert.ok('rule' in result);
      assert.ok('trustScore' in result);
      assert.ok('shippingRatio' in result);
      assert.ok('offerAmount' in result);
    });

    // Boundary: trustScore exactly 50 should NOT short-circuit
    it('should NOT short-circuit at trustScore = 50', () => {
      const result = routeReturn({
        trustScore: 50,
        returnShippingCost: 100,
        productPrice: 1000,
        demandClassification: 'high',
      });
      assert.notEqual(result.rule, 'low_trust_score');
      assert.equal(result.decision, 'p2p_resale');
    });
  });
});
