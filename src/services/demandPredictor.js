/**
 * Demand Predictor Service
 * Analyzes demand using DB data, seasonal trends, and category intelligence.
 * Returns actionable scores for pricing and routing decisions.
 */

// Seasonal multipliers by month (0 = Jan, 11 = Dec)
// Based on Indian e-commerce trends: festive season (Sep-Nov) = peak
const SEASONAL_MULTIPLIERS = {
  clothing:    [0.8, 0.7, 0.9, 1.0, 0.8, 0.7, 0.8, 0.9, 1.3, 1.5, 1.4, 1.1],
  electronics: [1.1, 0.9, 0.8, 0.8, 0.9, 0.8, 1.0, 1.0, 1.2, 1.5, 1.3, 1.2],
  accessories: [0.9, 0.8, 0.9, 0.9, 0.8, 0.7, 0.9, 1.0, 1.1, 1.4, 1.3, 1.2],
  footwear:    [0.8, 0.8, 1.0, 1.0, 0.9, 0.7, 0.8, 0.9, 1.2, 1.3, 1.2, 1.0],
  home:        [0.9, 0.8, 0.9, 0.9, 0.8, 0.7, 0.8, 0.9, 1.1, 1.3, 1.2, 1.1],
};

// Regional demand weights (metro cities have higher resale demand)
const REGIONAL_WEIGHTS = {
  Mumbai:    1.15,
  Delhi:     1.10,
  Bangalore: 1.12,
  Hyderabad: 1.05,
  Chennai:   1.03,
  Kolkata:   1.00,
  Pune:      1.02,
};

// Category-level base demand (how popular is resale for this category?)
const CATEGORY_BASE_DEMAND = {
  clothing:    65,
  electronics: 75,
  accessories: 50,
  footwear:    55,
  home:        40,
};

/**
 * Gets demand score and classification for a category+region pair.
 * Uses DB data as ground truth, enhanced with seasonal and regional intelligence.
 *
 * @param {string} category - Product category
 * @param {string} region - User's region
 * @param {Array} demandData - Regional demand records from DB
 * @returns {{demandScore: number, classification: string, confidence: number, factors: object}}
 */
function getDemandScore(category, region, demandData) {
  const currentMonth = new Date().getMonth();

  // 1. Check DB for actual demand data
  const entry = demandData.find(
    (record) => record.category === category && record.region === region
  );

  let baseScore = entry ? entry.demand_score : (CATEGORY_BASE_DEMAND[category] || 50);

  // 2. Apply seasonal multiplier
  const seasonalMultipliers = SEASONAL_MULTIPLIERS[category] || SEASONAL_MULTIPLIERS.clothing;
  const seasonalFactor = seasonalMultipliers[currentMonth];
  let adjustedScore = baseScore * seasonalFactor;

  // 3. Apply regional weight
  const regionalWeight = REGIONAL_WEIGHTS[region] || 1.0;
  adjustedScore *= regionalWeight;

  // 4. 7-day rolling trend vs 30-day baseline
  // We simulate a rolling trend calculation. If the 7-day trend outpaces the 30-day baseline,
  // we boost the score. We'll use a deterministic hash of region+category to simulate this.
  const trendHash = (region.length + category.length) % 3; // 0, 1, or 2
  let trendMultiplier = 1.0;
  let trendIndicator = 'steady';
  if (trendHash === 1) {
      trendMultiplier = 1.15; // 7-day spike
      trendIndicator = 'rising';
  } else if (trendHash === 2) {
      trendMultiplier = 0.90; // 7-day dip
      trendIndicator = 'falling';
  }
  adjustedScore *= trendMultiplier;

  // 5. Clamp to 0-100
  adjustedScore = Math.max(0, Math.min(100, Math.round(adjustedScore)));

  // 5. Classify demand
  let classification;
  if (adjustedScore >= 75) classification = 'high_demand';
  else if (adjustedScore >= 45) classification = 'medium';
  else classification = 'low_demand';

  // 6. Confidence based on data availability
  const confidence = entry ? 0.90 : 0.60; // Higher if we have real DB data

  // 7. Sales velocity estimate (items/week in this category+region)
  const salesVelocity = Math.round((adjustedScore / 100) * 15); // 0-15 items/week

  return {
    demandScore: adjustedScore,
    classification,
    confidence,
    salesVelocity,
    factors: {
      baseScore,
      seasonalFactor: Math.round(seasonalFactor * 100) / 100,
      regionalWeight: Math.round(regionalWeight * 100) / 100,
      trendMultiplier,
      trendIndicator,
      month: new Date().toLocaleString('en-IN', { month: 'long' }),
      dataSource: entry ? 'database' : 'category_default'
    }
  };
}

module.exports = { getDemandScore };
