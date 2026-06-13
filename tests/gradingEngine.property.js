'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fc = require('fast-check');
const { gradeItem, validateUpload } = require('../src/services/gradingEngine');

describe('AI Grading Engine - Property Tests', () => {
  /**
   * Property 1: Grading Output Invariant
   * For any valid upload params, gradeItem returns exactly one grade from {A,B,C}
   * and explanation ≤ 200 chars.
   *
   * **Validates: Requirements 1.3, 1.4**
   */
  it('Property 1: gradeItem always returns a valid grade and explanation ≤ 200 chars', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),             // imageCount (1-10 valid range)
        fc.integer({ min: 1, max: 50000000 }),       // totalFileSize in bytes
        fc.constantFrom('image', 'video'),            // fileType
        (imageCount, totalFileSize, fileType) => {
          const result = gradeItem({ imageCount, totalFileSize, fileType });

          // Must return exactly one grade from the set {A, B, C}
          assert.ok(
            ['A', 'B', 'C'].includes(result.grade),
            `Expected grade to be one of A, B, C but got "${result.grade}"`
          );

          // Explanation must be a string
          assert.equal(typeof result.explanation, 'string');

          // Explanation must be at most 200 characters
          assert.ok(
            result.explanation.length <= 200,
            `Expected explanation length ≤ 200, got ${result.explanation.length}`
          );

          // Explanation must not be empty
          assert.ok(
            result.explanation.length > 0,
            'Expected explanation to be non-empty'
          );
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * Property 2: Upload Validation Rejects Invalid Formats
   * For any invalid format string (not in {jpeg, png, mp4}), validator rejects with error.
   *
   * **Validates: Requirements 1.5**
   */
  it('Property 2: validateUpload rejects any invalid file format', () => {
    const validFormats = ['jpeg', 'png', 'mp4'];

    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 30 }).filter(
          s => !validFormats.includes(s.toLowerCase().trim())
        ),
        fc.integer({ min: 1, max: 5000000 }),   // fileSize (valid range)
        fc.integer({ min: 1, max: 10 }),          // imageCount (valid range)
        (invalidFormat, fileSize, imageCount) => {
          const result = validateUpload({
            fileType: invalidFormat,
            fileSize,
            imageCount,
          });

          // Must be rejected (valid === false)
          assert.equal(
            result.valid,
            false,
            `Expected invalid format "${invalidFormat}" to be rejected`
          );

          // Must include an error message
          assert.equal(typeof result.error, 'string');
          assert.ok(
            result.error.length > 0,
            'Expected error message to be non-empty'
          );
        }
      ),
      { numRuns: 200 }
    );
  });
});
