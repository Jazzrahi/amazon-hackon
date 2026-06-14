/**
 * Return Router Service — 3-Tier AI-Driven Incentive System
 *
 * Tier 1 (quality_score >= 70): Keep the Item  → partial refund + carbon nudge
 * Tier 2 (quality_score >= 50): Second Life     → 100% refund via marketplace
 * Tier 3 (quality_score  < 50): Standard Return → only option shown
 *
 * Fraud always overrides to fraud_rejected.
 */

/**
 * Calculate partial refund percentage based on quality score.
 * The worse the item, the higher the refund needed to persuade the user to keep it.
 * Grade A (85-100): ~15% refund  (item is nearly perfect, small incentive)
 * Grade B (70-84):  ~25-30% refund
 * @param {number} qualityScore - 0-100
 * @returns {number} refundPercent (0-100)
 */
function calcPartialRefundPercent(qualityScore) {
  if (qualityScore >= 85) return 15;
  if (qualityScore >= 75) return 22;
  if (qualityScore >= 70) return 30;
  return 0; // below 70 → not offered
}

/**
 * Routes a return based on AI quality score (primary) with fraud override.
 * @param {Object} params
 * @param {number} params.qualityScore    - AI quality score 0-100
 * @param {string} params.grade           - "A", "B", or "C"
 * @param {number} params.productPrice    - Original product price in INR
 * @param {number} params.trustScore      - User trust score (0-100); < 40 → standard return
 * @param {boolean} params.fraudDetected  - Whether AI flagged fraud
 * @returns {{decision, tier, qualityScore, partialRefundPercent, partialRefundAmount}}
 */
function routeReturn({ qualityScore, grade, productPrice, trustScore, fraudDetected }) {
  // Hard override: fraud
  if (fraudDetected) {
    return {
      decision: 'fraud_rejected',
      tier: 0,
      qualityScore,
      partialRefundPercent: 0,
      partialRefundAmount: 0,
      rule: 'fraud_detected'
    };
  }

  // Hard override: very low trust — skip incentives, standard return only
  if (trustScore < 40) {
    return {
      decision: 'standard_return',
      tier: 3,
      qualityScore,
      partialRefundPercent: 0,
      partialRefundAmount: 0,
      rule: 'low_trust_score'
    };
  }

  // TIER 1: Keep the Item (quality >= 70)
  if (qualityScore >= 70) {
    const refundPercent = calcPartialRefundPercent(qualityScore);
    const refundAmount = Math.round(productPrice * refundPercent / 100);
    return {
      decision: 'keep_item',
      tier: 1,
      qualityScore,
      partialRefundPercent: refundPercent,
      partialRefundAmount: refundAmount,
      rule: 'tier1_keep_item'
    };
  }

  // TIER 2: List on Second Life (quality 50–69)
  if (qualityScore >= 50) {
    return {
      decision: 'second_life',
      tier: 2,
      qualityScore,
      partialRefundPercent: 100,
      partialRefundAmount: productPrice,
      rule: 'tier2_second_life'
    };
  }

  // TIER 3: Standard Return (quality < 50 — item is too degraded)
  return {
    decision: 'standard_return',
    tier: 3,
    qualityScore,
    partialRefundPercent: 0,
    partialRefundAmount: 0,
    rule: 'tier3_standard_return'
  };
}

module.exports = { routeReturn };
