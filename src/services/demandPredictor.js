/**
 * Demand Predictor Service
 * Retrieves and classifies demand for a product category in a region.
 */

/**
 * Gets demand score and classification for a category+region pair.
 * @param {string} category - Product category
 * @param {string} region - Seller's region
 * @param {Array} demandData - Regional demand records from db.json
 * @returns {{demandScore: number, classification: "high"|"low"}}
 */
function getDemandScore(category, region, demandData) {
  const entry = demandData.find(
    (record) => record.category === category && record.region === region
  );

  if (entry) {
    const score = entry.demand_score;
    return {
      demandScore: score,
      classification: score >= 60 ? 'high' : 'low',
    };
  }

  // No matching entry — default to score 0, classification "low"
  return {
    demandScore: 0,
    classification: 'low',
  };
}

module.exports = { getDemandScore };
