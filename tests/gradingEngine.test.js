'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { gradeItem, validateUpload } = require('../src/services/gradingEngine');

describe('gradeItem', () => {
  it('returns grade A, B, or C for valid inputs', () => {
    const result = gradeItem({ imageCount: 3, totalFileSize: 5000000, fileType: 'image' });
    assert.ok(['A', 'B', 'C'].includes(result.grade));
    assert.ok(typeof result.explanation === 'string');
    assert.ok(result.explanation.length <= 200);
  });

  it('returns deterministic results for the same inputs', () => {
    const params = { imageCount: 2, totalFileSize: 1024000, fileType: 'image' };
    const result1 = gradeItem(params);
    const result2 = gradeItem(params);
    assert.equal(result1.grade, result2.grade);
    assert.equal(result1.explanation, result2.explanation);
  });

  it('returns correct explanation for grade A', () => {
    // Find inputs that produce grade A
    let found = false;
    for (let i = 1; i <= 10; i++) {
      const result = gradeItem({ imageCount: i, totalFileSize: 1000, fileType: 'image' });
      if (result.grade === 'A') {
        assert.equal(result.explanation, 'Item is in like-new condition with minimal cosmetic wear. Suitable for premium resale.');
        found = true;
        break;
      }
    }
    assert.ok(found, 'Should find at least one input producing grade A');
  });

  it('returns correct explanation for grade B', () => {
    let found = false;
    for (let i = 1; i <= 10; i++) {
      const result = gradeItem({ imageCount: i, totalFileSize: 1000, fileType: 'image' });
      if (result.grade === 'B') {
        assert.equal(result.explanation, 'Item shows moderate cosmetic wear but is fully functional. Good for standard resale.');
        found = true;
        break;
      }
    }
    assert.ok(found, 'Should find at least one input producing grade B');
  });

  it('returns correct explanation for grade C', () => {
    let found = false;
    for (let i = 1; i <= 10; i++) {
      const result = gradeItem({ imageCount: i, totalFileSize: 1000, fileType: 'image' });
      if (result.grade === 'C') {
        assert.equal(result.explanation, 'Item has significant wear or minor functional issues. Suitable for discounted resale.');
        found = true;
        break;
      }
    }
    assert.ok(found, 'Should find at least one input producing grade C');
  });

  it('works with video file type', () => {
    const result = gradeItem({ imageCount: 1, totalFileSize: 20000000, fileType: 'video' });
    assert.ok(['A', 'B', 'C'].includes(result.grade));
    assert.ok(result.explanation.length <= 200);
  });

  it('explanation never exceeds 200 characters', () => {
    const testCases = [
      { imageCount: 1, totalFileSize: 100, fileType: 'image' },
      { imageCount: 5, totalFileSize: 5000000, fileType: 'image' },
      { imageCount: 10, totalFileSize: 9999999, fileType: 'image' },
      { imageCount: 1, totalFileSize: 40000000, fileType: 'video' },
    ];
    for (const params of testCases) {
      const result = gradeItem(params);
      assert.ok(result.explanation.length <= 200, `Explanation too long: ${result.explanation.length} chars`);
    }
  });
});

describe('validateUpload', () => {
  it('accepts JPEG format', () => {
    const result = validateUpload({ fileType: 'jpeg', fileSize: 5000000, imageCount: 1 });
    assert.deepEqual(result, { valid: true });
  });

  it('accepts PNG format', () => {
    const result = validateUpload({ fileType: 'png', fileSize: 5000000, imageCount: 1 });
    assert.deepEqual(result, { valid: true });
  });

  it('accepts MP4 format', () => {
    const result = validateUpload({ fileType: 'mp4', fileSize: 30000000, imageCount: 1 });
    assert.deepEqual(result, { valid: true });
  });

  it('accepts format case-insensitively', () => {
    const result = validateUpload({ fileType: 'JPEG', fileSize: 5000000, imageCount: 1 });
    assert.deepEqual(result, { valid: true });
  });

  it('rejects unsupported format', () => {
    const result = validateUpload({ fileType: 'gif', fileSize: 5000000, imageCount: 1 });
    assert.equal(result.valid, false);
    assert.ok(result.error.includes('Unsupported'));
    assert.ok(result.error.includes('JPEG'));
    assert.ok(result.error.includes('PNG'));
    assert.ok(result.error.includes('MP4'));
  });

  it('rejects empty format', () => {
    const result = validateUpload({ fileType: '', fileSize: 5000000, imageCount: 1 });
    assert.equal(result.valid, false);
  });

  it('rejects image exceeding 10MB', () => {
    const result = validateUpload({ fileType: 'jpeg', fileSize: 10 * 1024 * 1024 + 1, imageCount: 1 });
    assert.equal(result.valid, false);
    assert.ok(result.error.includes('10 MB'));
  });

  it('accepts image at exactly 10MB', () => {
    const result = validateUpload({ fileType: 'jpeg', fileSize: 10 * 1024 * 1024, imageCount: 1 });
    assert.deepEqual(result, { valid: true });
  });

  it('rejects video exceeding 50MB', () => {
    const result = validateUpload({ fileType: 'mp4', fileSize: 50 * 1024 * 1024 + 1, imageCount: 1 });
    assert.equal(result.valid, false);
    assert.ok(result.error.includes('50 MB'));
  });

  it('accepts video at exactly 50MB', () => {
    const result = validateUpload({ fileType: 'mp4', fileSize: 50 * 1024 * 1024, imageCount: 1 });
    assert.deepEqual(result, { valid: true });
  });

  it('rejects image count exceeding 10', () => {
    const result = validateUpload({ fileType: 'png', fileSize: 5000000, imageCount: 11 });
    assert.equal(result.valid, false);
    assert.ok(result.error.includes('10'));
  });

  it('accepts exactly 10 images', () => {
    const result = validateUpload({ fileType: 'png', fileSize: 5000000, imageCount: 10 });
    assert.deepEqual(result, { valid: true });
  });

  it('rejects BMP format', () => {
    const result = validateUpload({ fileType: 'bmp', fileSize: 1000, imageCount: 1 });
    assert.equal(result.valid, false);
    assert.ok(result.error.includes('Unsupported'));
  });

  it('rejects TIFF format', () => {
    const result = validateUpload({ fileType: 'tiff', fileSize: 1000, imageCount: 1 });
    assert.equal(result.valid, false);
  });
});
