const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { getDemandScore } = require('../src/services/demandPredictor');

describe('demandPredictor', () => {
  const sampleDemandData = [
    { category: 'clothing', region: 'Mumbai', demand_score: 72 },
    { category: 'electronics', region: 'Delhi', demand_score: 45 },
    { category: 'accessories', region: 'Bangalore', demand_score: 60 },
    { category: 'clothing', region: 'Chennai', demand_score: 59 },
  ];

  describe('getDemandScore()', () => {
    it('should return high classification when score >= 60', () => {
      const result = getDemandScore('clothing', 'Mumbai', sampleDemandData);
      assert.equal(result.demandScore, 72);
      assert.equal(result.classification, 'high');
    });

    it('should return high classification at exactly 60', () => {
      const result = getDemandScore('accessories', 'Bangalore', sampleDemandData);
      assert.equal(result.demandScore, 60);
      assert.equal(result.classification, 'high');
    });

    it('should return low classification when score < 60', () => {
      const result = getDemandScore('electronics', 'Delhi', sampleDemandData);
      assert.equal(result.demandScore, 45);
      assert.equal(result.classification, 'low');
    });

    it('should return low classification at exactly 59', () => {
      const result = getDemandScore('clothing', 'Chennai', sampleDemandData);
      assert.equal(result.demandScore, 59);
      assert.equal(result.classification, 'low');
    });

    it('should default to score 0 and low when no matching entry exists', () => {
      const result = getDemandScore('clothing', 'UnknownRegion', sampleDemandData);
      assert.equal(result.demandScore, 0);
      assert.equal(result.classification, 'low');
    });

    it('should default to score 0 and low for unknown category', () => {
      const result = getDemandScore('furniture', 'Mumbai', sampleDemandData);
      assert.equal(result.demandScore, 0);
      assert.equal(result.classification, 'low');
    });

    it('should default to score 0 and low when demandData is empty', () => {
      const result = getDemandScore('clothing', 'Mumbai', []);
      assert.equal(result.demandScore, 0);
      assert.equal(result.classification, 'low');
    });

    it('should match both category AND region (not just one)', () => {
      // clothing + Delhi doesn't exist in sample data
      const result = getDemandScore('clothing', 'Delhi', sampleDemandData);
      assert.equal(result.demandScore, 0);
      assert.equal(result.classification, 'low');
    });
  });
});
