const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Models to try in order — different models have separate quota pools
const GEMINI_MODELS = ['gemini-2.0-flash-lite', 'gemini-2.5-flash', 'gemini-2.0-flash'];
let currentModelIndex = 0;

function getModel() {
  return GEMINI_MODELS[currentModelIndex] || GEMINI_MODELS[0];
}

// Retry helper: tries current model with retries, then falls back to next model
async function callWithRetry(fn, maxRetries = 1) {
  for (let modelAttempt = 0; modelAttempt < GEMINI_MODELS.length; modelAttempt++) {
    const model = GEMINI_MODELS[(currentModelIndex + modelAttempt) % GEMINI_MODELS.length];
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn(model);
      } catch (err) {
        if (err.status === 429 || err.status === 404 || err.status === 503) {
          if (err.status !== 429 || attempt >= maxRetries) {
            console.log(`[VisionAI] ${model} ${err.status === 429 ? 'quota exhausted' : err.status === 404 ? 'not found' : 'unavailable'}. Trying next model...`);
            break; // try next model
          }
          const waitSec = Math.min(10, 3 * (attempt + 1));
          console.log(`[VisionAI] ${model} rate limited. Waiting ${waitSec}s (retry ${attempt + 1}/${maxRetries})...`);
          await new Promise(r => setTimeout(r, waitSec * 1000));
        } else {
          throw err;
        }
      }
    }
  }
  // All models exhausted
  console.error('[VisionAI] All models quota exhausted.');
  return null;
}

const crypto = require('crypto');

// Caches for the vision endpoints
const cacheAnalyzeImage = new Map();
const cacheAnalyzeBill = new Map();
const cacheValidateReason = new Map();

// Helper to generate a cache key
function getCacheKey(...args) {
  return crypto.createHash('md5').update(args.join('|')).digest('hex');
}

/**
 * Analyzes a base64 image against an expected product category.
 */
async function analyzeImage(base64Image, mimeType, expectedCategory, productName, productPrice) {
  if (!process.env.GEMINI_API_KEY) {
    console.warn('[VisionAI] No GEMINI_API_KEY found. Falling back to mock grading.');
    return null;
  }

  const cacheKey = getCacheKey('analyzeImage', base64Image, expectedCategory, productName);
  if (cacheAnalyzeImage.has(cacheKey)) {
    console.log('[VisionAI] CACHE HIT: analyzeImage');
    return cacheAnalyzeImage.get(cacheKey);
  }

  try {
    const prompt = `
      You are an expert Amazon Returns Inspector with authority to determine the best return outcome.
      The customer is returning a product described as: "${productName}" (Category: ${expectedCategory}).
      Original purchase price: ₹${productPrice || 'unknown'}.
      
      Carefully examine the provided image of the returned item.
      
      STEP 1 — FRAUD CHECK:
      Does the item in the image reasonably match the expected product?
      Example: If the product is "Wireless Bluetooth Earbuds" but the image shows a book, set isValid=false.
      
      STEP 2 — QUALITY GRADING (only if isValid=true):
      Assign a letter grade AND a precise quality_score (0–100):
      - Grade A / quality_score 85–100: Like new, original packaging or perfectly intact. No signs of use.
      - Grade B / quality_score 50–84: Lightly used, minor signs of wear (small scratches, slight discolouration). Fully functional.
      - Grade C / quality_score 0–49: Heavily used, visible damage, missing parts, cracked/broken, or non-functional.
      
      STEP 3 — SUSTAINABILITY ESTIMATE:
      Estimate how many kg of CO₂ would be saved if the customer KEEPS this item instead of shipping it back to the warehouse.
      Consider: the item's category, weight, and shipping distance (~500km avg). Typical ranges:
      - Small electronics (earbuds, cables): 0.5–2.0 kg CO₂
      - Medium electronics (phones, tablets): 1.5–3.5 kg CO₂
      - Clothing: 0.3–1.2 kg CO₂
      - Large electronics: 3.0–8.0 kg CO₂
      
      Respond ONLY with a valid JSON object matching this exact schema (no markdown, no extra text):
      {
        "isValid": boolean,
        "grade": "A" | "B" | "C",
        "quality_score": number,
        "explanation": "string — 1-2 professional sentences describing the condition and reasoning",
        "carbon_saved_kg": number
      }
    `;

    const response = await callWithRetry((model) => ai.models.generateContent({
      model,
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                data: base64Image,
                mimeType: mimeType
              }
            }
          ]
        }
      ],
      config: {
        responseMimeType: 'application/json',
      }
    }));

    if (!response) return null; // All models exhausted
    const resultText = response.text;
    const jsonResult = JSON.parse(resultText);

    const result = {
      isValid: jsonResult.isValid,
      grade: jsonResult.grade || 'B',
      quality_score: typeof jsonResult.quality_score === 'number' ? jsonResult.quality_score : 70,
      explanation: jsonResult.explanation || 'Analyzed by AI Vision.',
      carbon_saved_kg: typeof jsonResult.carbon_saved_kg === 'number' ? jsonResult.carbon_saved_kg : 1.5
    };
    
    cacheAnalyzeImage.set(cacheKey, result);
    return result;

  } catch (error) {
    console.error('[VisionAI] Error analyzing image:', error);
    return null;
  }
}

/**
 * Analyzes a bill/receipt image to verify it's legitimate.
 */
async function analyzeBill(base64Image, mimeType, expectedProduct) {
  if (!process.env.GEMINI_API_KEY) {
    console.warn('[VisionAI] No GEMINI_API_KEY found. Falling back to mock bill verification.');
    return null;
  }

  const cacheKey = getCacheKey('analyzeBill', base64Image, expectedProduct);
  if (cacheAnalyzeBill.has(cacheKey)) {
    console.log('[VisionAI] CACHE HIT: analyzeBill');
    return cacheAnalyzeBill.get(cacheKey);
  }

  try {
    const prompt = `
      You are an expert Amazon Returns Bill Inspector.
      The customer claims to be returning: "${expectedProduct || 'unknown product'}".
      
      Examine the uploaded image carefully.
      
      STEP 1 — IS THIS A BILL/RECEIPT?
      Check if the image is actually a purchase bill, invoice, or receipt.
      If it's a random photo (selfie, landscape, meme, etc.), set isBill=false.
      
      STEP 2 — PRODUCT MATCH (only if isBill=true):
      Does the bill mention a product that reasonably matches "${expectedProduct}"?
      Be lenient — "Cotton Kurta Set" matches "Kurta", "Women's Cotton Set", etc.
      
      STEP 3 — DATE CHECK (only if isBill=true):
      Can you read a purchase date? If yes, is it within the last 30 days from today (June 2026)?
      If the date is unreadable, set dateReadable=false but don't reject.
      
      STEP 4 — LEGITIMACY:
      Does this look like a real commercial receipt (printed or digital)?
      Check for: store name, amounts, itemization, formatting.
      Handwritten notes or screenshots of text are suspicious.
      
      Respond ONLY with valid JSON (no markdown):
      {
        "isBill": boolean,
        "productMatch": boolean,
        "dateReadable": boolean,
        "withinReturnWindow": boolean,
        "confidence": number (0-100),
        "explanation": "string — 1-2 sentences explaining your assessment"
      }
    `;

    const response = await callWithRetry((model) => ai.models.generateContent({
      model,
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                data: base64Image,
                mimeType: mimeType || 'image/jpeg'
              }
            }
          ]
        }
      ],
      config: {
        responseMimeType: 'application/json',
      }
    }));

    if (!response) return null;
    const resultText = response.text;
    const resultJson = JSON.parse(resultText);

    const result = {
      isBill: resultJson.isBill === true,
      productMatch: resultJson.productMatch === true,
      withinReturnWindow: resultJson.withinReturnWindow !== false,
      dateReadable: resultJson.dateReadable !== false,
      confidence: typeof resultJson.confidence === 'number' ? resultJson.confidence : 50,
      explanation: resultJson.explanation || 'Analyzed by AI Vision.',
      isValid: resultJson.isBill === true && resultJson.productMatch === true
    };
    
    cacheAnalyzeBill.set(cacheKey, result);
    return result;

  } catch (error) {
    console.error('[VisionAI] Error analyzing bill:', error);
    return null;
  }
}

/**
 * Validates if the uploaded photo matches the customer's stated return reason.
 */
async function validateReason(base64Image, mimeType, expectedProduct, reason, customReason, description) {
  if (!process.env.GEMINI_API_KEY) {
    console.warn('[VisionAI] No GEMINI_API_KEY found. Falling back to mock reason validation.');
    return null;
  }

  const cacheKey = getCacheKey('validateReason', base64Image, expectedProduct, reason, description);
  if (cacheValidateReason.has(cacheKey)) {
    console.log('[VisionAI] CACHE HIT: validateReason');
    return cacheValidateReason.get(cacheKey);
  }

  try {
    const prompt = `
      You are an expert Amazon Returns Inspector.
      The customer is returning: "${expectedProduct || 'unknown product'}".
      
      Stated Reason: "${reason}"
      Custom Reason: "${customReason}"
      Detailed Description: "${description}"
      
      Examine the provided image of the returned item.
      
      STEP 1: Check if the photo is relevant. Does it show the product or the issue described? If it's a random photo (like a selfie or landscape), it does NOT match.
      STEP 2: Evaluate if the visual evidence in the photo supports the customer's stated reason and description.
      - If they claim it's "damaged", can you see damage?
      - If they claim "wrong item", does it look different from the expected product?
      - If they claim "doesn't fit" (for clothes), does the photo show the clothing item?
      
      Respond ONLY with valid JSON (no markdown):
      {
        "match": boolean,
        "confidence": number (0-100),
        "explanation": "string — 1-2 professional sentences explaining if the photo supports the reason and why."
      }
    `;

    const response = await callWithRetry((model) => ai.models.generateContent({
      model,
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                data: base64Image,
                mimeType: mimeType || 'image/jpeg'
              }
            }
          ]
        }
      ],
      config: {
        responseMimeType: 'application/json',
      }
    }));

    if (!response) return null;
    const resultText = response.text;
    const resultJson = JSON.parse(resultText);

    const result = {
      match: resultJson.match === true,
      confidence: typeof resultJson.confidence === 'number' ? resultJson.confidence : 50,
      explanation: resultJson.explanation || 'Analyzed by AI Vision.'
    };
    
    cacheValidateReason.set(cacheKey, result);
    return result;

  } catch (error) {
    console.error('[VisionAI] Error validating reason:', error);
    return null;
  }
}

/**
 * Predicts if a clothing item will fit the user based on an uploaded photo.
 * @param {string} base64Image - Base64 encoded image of the user
 * @param {string} mimeType - The mime type
 * @param {string} productName - The product name
 * @param {string} category - Category (e.g. 'clothing')
 * @param {string} size - The selected size (e.g. 'M')
 * @returns {Promise<Object|null>} - { isFitGood, confidence, explanation }
 */
async function predictFit(base64Image, mimeType, productName, category, size) {
  if (!process.env.GEMINI_API_KEY) {
    console.warn('[VisionAI] No GEMINI_API_KEY found. Falling back to mock fit prediction.');
    return null;
  }

  try {
    const prompt = `
      You are an expert Amazon AR Size & Fit Assistant.
      The customer is interested in buying: "${productName}" (Category: ${category}) in Size: "${size}".
      
      Examine the provided image of the customer.
      
      Evaluate how this specific item and size would fit them based on their visible body shape and proportions.
      Be constructive and helpful. If the size seems wrong, gently suggest a better size.
      
      Respond ONLY with valid JSON (no markdown):
      {
        "isFitGood": boolean,
        "confidence": number (0-100),
        "explanation": "string — 1-2 friendly sentences explaining the fit prediction and any sizing advice."
      }
    `;

    const response = await callWithRetry((model) => ai.models.generateContent({
      model,
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                data: base64Image,
                mimeType: mimeType || 'image/jpeg'
              }
            }
          ]
        }
      ],
      config: {
        responseMimeType: 'application/json',
      }
    }));

    if (!response) return null;
    const resultText = response.text;
    const result = JSON.parse(resultText);

    return {
      isFitGood: result.isFitGood,
      confidence: typeof result.confidence === 'number' ? result.confidence : 70,
      explanation: result.explanation || 'Fit predicted by AI Vision.'
    };

  } catch (error) {
    console.error('[VisionAI] Error predicting fit:', error);
    return null;
  }
}

module.exports = { analyzeImage, analyzeBill, validateReason, predictFit };
