const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fc = require('fast-check');
const { calculateResalePrice } = require('../src/services/pricingEngine');

/**
 * Pricing Engine - Property-Based Tests
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7
 */
describe('Pricing Engine - Property Tests', () => {
  /**
   * Property 3: Pricing Calculation Correctness
   * For any positive price and valid grade, resalePrice = Math.round(price * (1 - rate))
   * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5
   */
  it('Property 3: For any positive price and valid grade, resalePrice = Math.round(price * (1 - rate))', () => {
    const rates = { A: 0.15, B: 0.30, C: 0.50 };
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50000 }),
        fc.constantFrom('A', 'B', 'C'),
        (price, grade) => {
          const result = calculateResalePrice(price, grade);
          const expectedResale = Math.round(price * (1 - rates[grade]));
          assert.equal(result.resalePrice, expectedResale);
          assert.equal(result.markdownPercent, rates[grade] * 100);
          assert.equal(result.markdownAmount, price - expectedResale);
        }
      )
    );
  });

  /**
   * Property 4: Pricing Rejects Invalid Inputs
   * For price <= 0 or invalid grade, throws error
   * Validates: Requirements 2.6, 2.7
   */
  it('Property 4: For price <= 0 or invalid grade, throws error', () => {
    // Invalid prices with valid grades
    fc.assert(
      fc.property(
        fc.integer({ min: -10000, max: 0 }),
        fc.constantFrom('A', 'B', 'C'),
        (price, grade) => {
          assert.throws(() => calculateResalePrice(price, grade));
        }
      )
    );
    // Invalid grades with valid prices
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50000 }),
        fc.string({ minLength: 1 }).filter(s => !['A', 'B', 'C'].includes(s)),
        (price, grade) => {
          assert.throws(() => calculateResalePrice(price, grade));
        }
      )
    );
  });
});
