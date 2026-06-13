const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { calculateResalePrice } = require('../src/services/pricingEngine');

describe('Pricing Engine - calculateResalePrice', () => {
  describe('Grade A (15% markdown)', () => {
    it('should apply 15% markdown for Grade A', () => {
      const result = calculateResalePrice(1000, 'A');
      assert.deepStrictEqual(result, {
        resalePrice: 850,
        markdownPercent: 15,
        markdownAmount: 150,
      });
    });

    it('should round correctly for Grade A with odd price', () => {
      const result = calculateResalePrice(1299, 'A');
      assert.strictEqual(result.resalePrice, Math.round(1299 * 0.85));
      assert.strictEqual(result.markdownPercent, 15);
      assert.strictEqual(result.markdownAmount, 1299 - result.resalePrice);
    });
  });

  describe('Grade B (30% markdown)', () => {
    it('should apply 30% markdown for Grade B', () => {
      const result = calculateResalePrice(1000, 'B');
      assert.deepStrictEqual(result, {
        resalePrice: 700,
        markdownPercent: 30,
        markdownAmount: 300,
      });
    });

    it('should round correctly for Grade B with odd price', () => {
      const result = calculateResalePrice(999, 'B');
      assert.strictEqual(result.resalePrice, Math.round(999 * 0.70));
      assert.strictEqual(result.markdownPercent, 30);
      assert.strictEqual(result.markdownAmount, 999 - result.resalePrice);
    });
  });

  describe('Grade C (50% markdown)', () => {
    it('should apply 50% markdown for Grade C', () => {
      const result = calculateResalePrice(1000, 'C');
      assert.deepStrictEqual(result, {
        resalePrice: 500,
        markdownPercent: 50,
        markdownAmount: 500,
      });
    });

    it('should round correctly for Grade C with odd price', () => {
      const result = calculateResalePrice(199, 'C');
      assert.strictEqual(result.resalePrice, Math.round(199 * 0.50));
      assert.strictEqual(result.markdownPercent, 50);
      assert.strictEqual(result.markdownAmount, 199 - result.resalePrice);
    });
  });

  describe('Error cases', () => {
    it('should throw for price of 0', () => {
      assert.throws(() => calculateResalePrice(0, 'A'), { message: 'Invalid original price' });
    });

    it('should throw for negative price', () => {
      assert.throws(() => calculateResalePrice(-100, 'B'), { message: 'Invalid original price' });
    });

    it('should throw for null price', () => {
      assert.throws(() => calculateResalePrice(null, 'A'), { message: 'Invalid original price' });
    });

    it('should throw for undefined price', () => {
      assert.throws(() => calculateResalePrice(undefined, 'A'), { message: 'Invalid original price' });
    });

    it('should throw for NaN price', () => {
      assert.throws(() => calculateResalePrice(NaN, 'A'), { message: 'Invalid original price' });
    });

    it('should throw for string price', () => {
      assert.throws(() => calculateResalePrice('1000', 'A'), { message: 'Invalid original price' });
    });

    it('should throw for unrecognized grade', () => {
      assert.throws(() => calculateResalePrice(1000, 'D'), { message: 'Unrecognized grade' });
    });

    it('should throw for lowercase grade', () => {
      assert.throws(() => calculateResalePrice(1000, 'a'), { message: 'Unrecognized grade' });
    });

    it('should throw for empty string grade', () => {
      assert.throws(() => calculateResalePrice(1000, ''), { message: 'Unrecognized grade' });
    });

    it('should throw for null grade', () => {
      assert.throws(() => calculateResalePrice(1000, null), { message: 'Unrecognized grade' });
    });
  });
});
