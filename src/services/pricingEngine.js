/**
 * Pricing Engine
 * Calculates resale prices based on AI condition grades.
 */

const MARKDOWN_RATES = {
  A: 0.15,
  B: 0.30,
  C: 0.50,
};

/**
 * Calculates the resale price for a graded item.
 * @param {number} originalPrice - Original price in INR (positive integer)
 * @param {"A"|"B"|"C"} grade - AI-assigned condition grade
 * @returns {{resalePrice: number, markdownPercent: number, markdownAmount: number}}
 * @throws {Error} If originalPrice <= 0 or grade is unrecognized
 */
function calculateResalePrice(originalPrice, grade) {
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

  const markdownRate = MARKDOWN_RATES[grade];
  const markdownPercent = markdownRate * 100;
  const resalePrice = Math.round(originalPrice * (1 - markdownRate));
  const markdownAmount = originalPrice - resalePrice;

  return {
    resalePrice,
    markdownPercent,
    markdownAmount,
  };
}

module.exports = { calculateResalePrice };
