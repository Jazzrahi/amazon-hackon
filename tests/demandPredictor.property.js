'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fc = require('fast-check');
const { getDemandScore } = require('../src/services/demandPredictor');

describe('Demand Predictor - Property Tests', () => {
  /**
   * Property 5: Demand Classification Threshold
   * For any score 0-100, classify "high" when ≥ 60, "low" when < 60;
   * missing entries default to 0/"low".
   *
   * **Validates: Requirements 3.1, 3.4, 3.6**
   */
  it('Property 5: Classification is "high" when score >= 60, "low" when < 60', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),  // category
        fc.string({ minLength: 1, maxLength: 20 }),  // region
        fc.integer({ min: 0, max: 100 }),            // demand_score
        (category, region, score) => {
          const demandData = [{ category, region, demand_score: score }];
          const result = getDemandScore(category, region, demandData);

          // Score must match the entry's demand_score
          assert.equal(result.demandScore, score);

          // Classification threshold: >= 60 is "high", < 60 is "low"
          if (score >= 60) {
            assert.equal(
              result.classification,
              'high',
              `Expected "high" for score ${score}, got "${result.classification}"`
            );
          } else {
            assert.equal(
              result.classification,
              'low',
              `Expected "low" for score ${score}, got "${result.classification}"`
            );
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('Property 5b: Missing entries default to score 0 and classification "low"', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),  // category
        fc.string({ minLength: 1, maxLength: 20 }),  // region
        (category, region) => {
          // Empty demand data — no matching entry possible
          const result = getDemandScore(category, region, []);

          // Must default to score 0
          assert.equal(
            result.demandScore,
            0,
            `Expected default demandScore 0, got ${result.demandScore}`
          );

          // Must default to classification "low"
          assert.equal(
            result.classification,
            'low',
            `Expected default classification "low", got "${result.classification}"`
          );
        }
      ),
      { numRuns: 200 }
    );
  });
});
