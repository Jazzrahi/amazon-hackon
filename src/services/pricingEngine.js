/**
 * Pricing Engine
 * Calculates dynamic resale prices based on AI condition grades,
 * market demand, product category, and time decay.
 */

const MARKDOWN_RATES = {
  A: 0.15,  // Like new → 15% off
  B: 0.30,  // Good condition → 30% off
  C: 0.50,  // Fair / worn → 50% off
};

// Category risk multipliers — electronics depreciate faster
const CATEGORY_RISK = {
  electronics: 1.10,   // 10% extra markdown (volatile pricing)
  clothing:    0.95,    // 5% less markdown (fashion holds value in resale)
  accessories: 1.00,    // Neutral
  footwear:    1.05,    // Slight extra markdown
  home:        0.90,    // Home goods hold value well
};

/**
 * Calculates the resale price for a graded item.
 * @param {number} originalPrice - Original price in INR
 * @param {"A"|"B"|"C"} grade - AI-assigned condition grade
 * @param {number} [demandScore=50] - Demand score 0-100 (from demand predictor)
 * @param {string} [category='general'] - Product category
 * @returns {{resalePrice: number, markdownPercent: number, markdownAmount: number, demandAdjustment: string}}
 */
function calculateResalePrice(originalPrice, grade, demandScore, category) {
  if (
    originalPrice === null ||
    originalPrice === undefined ||
    typeof originalPrice !== 'number' ||
    isNaN(originalPrice) ||
    originalPrice <= 0
  ) {
    throw new Error('Invalid original price');
  }

  if (!MARKDOWN_RATES.hasOwnProperty(grade)) {
    throw new Error('Unrecognized grade');
  }

  let markdownRate = MARKDOWN_RATES[grade];

  // --- Demand adjustment ---
  // High demand = less discount (seller gets more), low demand = more discount
  let demandAdjustment = 'neutral';
  if (typeof demandScore === 'number') {
    if (demandScore >= 75) {
      markdownRate *= 0.85;   // High demand → 15% less markdown
      demandAdjustment = 'high_demand_premium';
    } else if (demandScore >= 45) {
      markdownRate *= 0.95;   // Medium demand → 5% less markdown
      demandAdjustment = 'moderate_demand';
    } else {
      markdownRate *= 1.10;   // Low demand → 10% more markdown
      demandAdjustment = 'low_demand_discount';
    }
  }

  // --- Category risk adjustment ---
  const categoryMultiplier = CATEGORY_RISK[category] || 1.0;
  markdownRate *= categoryMultiplier;

  // Clamp markdown between 5% and 70%
  markdownRate = Math.max(0.05, Math.min(0.70, markdownRate));

  const markdownPercent = Math.round(markdownRate * 100);
  const resalePrice = Math.round(originalPrice * (1 - markdownRate));
  const markdownAmount = originalPrice - resalePrice;

  return {
    resalePrice,
    markdownPercent,
    markdownAmount,
    demandAdjustment,
  };
}

module.exports = { calculateResalePrice };
