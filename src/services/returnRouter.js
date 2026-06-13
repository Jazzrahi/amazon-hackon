/**
 * Return Router Service
 * Determines the optimal return path based on trust score, cost analysis, and demand.
 */

/**
 * Routes a return based on priority rules.
 * @param {Object} params
 * @param {number} params.trustScore - Seller's trust score (0-100)
 * @param {number} params.returnShippingCost - Shipping cost in INR
 * @param {number} params.productPrice - Original product price in INR
 * @param {string} params.demandClassification - "high" or "low"
 * @returns {{decision: string, rule: string, trustScore: number, shippingRatio: number, offerAmount: number|null}}
 */
function routeReturn({ trustScore, returnShippingCost, productPrice, demandClassification }) {
  const shippingRatio = Math.round((returnShippingCost / productPrice) * 100) / 100;

  // Priority 1: Low trust score — short-circuit to standard return
  if (trustScore < 50) {
    return {
      decision: 'standard_return',
      rule: 'low_trust_score',
      trustScore,
      shippingRatio,
      offerAmount: null,
    };
  }

  // Priority 2: High shipping ratio — offer green credits
  if (shippingRatio > 0.40) {
    return {
      decision: 'green_credit',
      rule: 'high_shipping_ratio',
      trustScore,
      shippingRatio,
      offerAmount: Math.round(productPrice * 0.50),
    };
  }

  // Priority 3: High demand — route to P2P resale
  if (demandClassification === 'high') {
    return {
      decision: 'p2p_resale',
      rule: 'high_demand',
      trustScore,
      shippingRatio,
      offerAmount: null,
    };
  }

  // Priority 4: Default — standard return (low demand warehouse liquidation)
  return {
    decision: 'standard_return',
    rule: 'low_demand',
    trustScore,
    shippingRatio,
    offerAmount: null,
  };
}

module.exports = { routeReturn };
