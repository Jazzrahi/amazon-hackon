const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { routeReturn } = require('../src/services/returnRouter');

describe('returnRouter', () => {
  describe('routeReturn()', () => {
    // 1. Fraud Detection Override
    it('should return fraud_rejected when fraud is detected', () => {
      const result = routeReturn({
        qualityScore: 90,
        grade: 'A',
        productPrice: 1000,
        trustScore: 80,
        fraudDetected: true
      });
      assert.equal(result.decision, 'fraud_rejected');
      assert.equal(result.tier, 0);
      assert.equal(result.rule, 'fraud_detected');
    });

    // 2. Low Trust Override
    it('should return standard_return with low_trust_score when trustScore < 40', () => {
      const result = routeReturn({
        qualityScore: 90,
        grade: 'A',
        productPrice: 1000,
        trustScore: 35,
        fraudDetected: false
      });
      assert.equal(result.decision, 'standard_return');
      assert.equal(result.tier, 3);
      assert.equal(result.rule, 'low_trust_score');
    });

    it('should NOT short-circuit to low trust at trustScore = 40', () => {
      const result = routeReturn({
        qualityScore: 90,
        grade: 'A',
        productPrice: 1000,
        trustScore: 40,
        fraudDetected: false
      });
      assert.notEqual(result.rule, 'low_trust_score');
    });

    // 3. Tier 1: Keep the Item (qualityScore >= 70)
    it('should return keep_item for Grade A (qualityScore >= 85) with 15% refund', () => {
      const result = routeReturn({
        qualityScore: 90,
        grade: 'A',
        productPrice: 1000,
        trustScore: 70,
        fraudDetected: false
      });
      assert.equal(result.decision, 'keep_item');
      assert.equal(result.tier, 1);
      assert.equal(result.partialRefundPercent, 15);
      assert.equal(result.partialRefundAmount, 150);
      assert.equal(result.rule, 'tier1_keep_item');
    });

    it('should return keep_item for qualityScore >= 75 with 22% refund', () => {
      const result = routeReturn({
        qualityScore: 78,
        grade: 'B',
        productPrice: 2000,
        trustScore: 70,
        fraudDetected: false
      });
      assert.equal(result.decision, 'keep_item');
      assert.equal(result.tier, 1);
      assert.equal(result.partialRefundPercent, 22);
      assert.equal(result.partialRefundAmount, 440);
      assert.equal(result.rule, 'tier1_keep_item');
    });

    it('should return keep_item for qualityScore >= 70 with 30% refund', () => {
      const result = routeReturn({
        qualityScore: 72,
        grade: 'B',
        productPrice: 1500,
        trustScore: 70,
        fraudDetected: false
      });
      assert.equal(result.decision, 'keep_item');
      assert.equal(result.tier, 1);
      assert.equal(result.partialRefundPercent, 30);
      assert.equal(result.partialRefundAmount, 450);
      assert.equal(result.rule, 'tier1_keep_item');
    });

    // 4. Tier 2: Second Life (qualityScore 50-69)
    it('should return second_life when qualityScore is 50-69', () => {
      const result = routeReturn({
        qualityScore: 60,
        grade: 'B',
        productPrice: 1000,
        trustScore: 70,
        fraudDetected: false
      });
      assert.equal(result.decision, 'second_life');
      assert.equal(result.tier, 2);
      assert.equal(result.partialRefundPercent, 100);
      assert.equal(result.partialRefundAmount, 1000);
      assert.equal(result.rule, 'tier2_second_life');
    });

    // 5. Tier 3: Standard Return (qualityScore < 50)
    it('should return standard_return when qualityScore < 50', () => {
      const result = routeReturn({
        qualityScore: 45,
        grade: 'C',
        productPrice: 1000,
        trustScore: 70,
        fraudDetected: false
      });
      assert.equal(result.decision, 'standard_return');
      assert.equal(result.tier, 3);
      assert.equal(result.partialRefundPercent, 0);
      assert.equal(result.partialRefundAmount, 0);
      assert.equal(result.rule, 'tier3_standard_return');
    });
  });
});
