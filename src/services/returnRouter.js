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
function routeReturn({ trustScore, returnShippingCost, productPrice, demandClassification, grade, category, highReturnRisk }) {
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

  // Priority 3: Grade C electronics — route to e-waste recycling
  if (grade === 'C' && category === 'electronics') {
    return {
      decision: 'recycle',
      rule: 'ewaste_recycling',
      trustScore,
      shippingRatio,
      offerAmount: 30,
    };
  }

  // Priority 4: Grade C low value items — route to charity donation
  if (grade === 'C' && productPrice < 2000) {
    return {
      decision: 'donate',
      rule: 'charity_donation',
      trustScore,
      shippingRatio,
      offerAmount: 50,
    };
  }

  // Priority 5: High return risk clothing — offer direct exchange
  if (highReturnRisk && category === 'clothing') {
    return {
      decision: 'exchange',
      rule: 'sizing_exchange',
      trustScore,
      shippingRatio,
      offerAmount: null,
    };
  }

  // Priority 6: High demand — route to P2P resale
  if (demandClassification === 'high') {
    return {
      decision: 'p2p_resale',
      rule: 'high_demand',
      trustScore,
      shippingRatio,
      offerAmount: null,
    };
  }

  // Priority 7: Default — standard return (low demand warehouse liquidation)
  return {
    decision: 'standard_return',
    rule: 'low_demand',
    trustScore,
    shippingRatio,
    offerAmount: null,
  };
}

module.exports = { routeReturn };
