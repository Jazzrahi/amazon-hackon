'use strict';

/**
 * AI Grading Engine
 * Simulates AI-based condition assessment of returned items using
 * deterministic hash-based logic for reproducible demo results.
 */

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50 MB
const MAX_IMAGE_COUNT = 10;
const SUPPORTED_FORMATS = ['jpeg', 'png', 'mp4'];

const EXPLANATIONS = {
  A: 'Item is in like-new condition with minimal cosmetic wear. Suitable for premium resale.',
  B: 'Item shows moderate cosmetic wear but is fully functional. Good for standard resale.',
  C: 'Item has significant wear or minor functional issues. Suitable for discounted resale.',
};

/**
 * Simple deterministic hash function for grading.
 * Combines imageCount, totalFileSize, and fileType into a numeric hash.
 * @param {number} imageCount
 * @param {number} totalFileSize
 * @param {string} fileType
 * @returns {number}
 */
function computeHash(imageCount, totalFileSize, fileType) {
  const input = `${imageCount}-${totalFileSize}-${fileType}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Grades an item based on uploaded media metadata.
 * @param {Object} params
 * @param {number} params.imageCount - Number of images uploaded (1-10)
 * @param {number} params.totalFileSize - Total size of uploaded files in bytes
 * @param {string} params.fileType - "image" or "video"
 * @returns {{grade: "A"|"B"|"C", explanation: string}}
 */
function gradeItem({ imageCount, totalFileSize, fileType }) {
  const hash = computeHash(imageCount, totalFileSize, fileType);
  const gradeIndex = hash % 3;

  const grades = ['A', 'B', 'C'];
  const grade = grades[gradeIndex];

  return {
    grade,
    explanation: EXPLANATIONS[grade],
  };
}

/**
 * Validates an upload before processing.
 * @param {Object} params
 * @param {string} params.fileType - File format: "jpeg", "png", or "mp4" (case-insensitive)
 * @param {number} params.fileSize - Size of the file in bytes
 * @param {number} params.imageCount - Number of images (relevant for image uploads)
 * @returns {{valid: true} | {valid: false, error: string}}
 */
function validateUpload({ fileType, fileSize, imageCount }) {
  const normalizedType = (fileType || '').toLowerCase().trim();

  // Check supported format
  if (!SUPPORTED_FORMATS.includes(normalizedType)) {
    return {
      valid: false,
      error: `Unsupported file format "${fileType}". Accepted formats: JPEG, PNG, MP4.`,
    };
  }

  // Video constraints
  if (normalizedType === 'mp4') {
    if (fileSize > MAX_VIDEO_SIZE) {
      return {
        valid: false,
        error: `Video file exceeds maximum size of 50 MB.`,
      };
    }
    return { valid: true };
  }

  // Image constraints
  if (imageCount > MAX_IMAGE_COUNT) {
    return {
      valid: false,
      error: `Image count exceeds maximum of ${MAX_IMAGE_COUNT} images.`,
    };
  }

  if (fileSize > MAX_IMAGE_SIZE) {
    return {
      valid: false,
      error: `Image file exceeds maximum size of 10 MB per image.`,
    };
  }

  return { valid: true };
}

module.exports = { gradeItem, validateUpload };
