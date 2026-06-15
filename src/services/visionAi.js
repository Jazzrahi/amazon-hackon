const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Use gemini-2.0-flash (1500 req/day free). Change here to switch all calls.
const GEMINI_MODEL = 'gemini-2.0-flash';

// Retry helper: waits and retries on 429 rate limit errors
async function callWithRetry(fn, maxRetries = 2) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (err.status === 429 && attempt < maxRetries) {
        const waitSec = Math.min(15, 5 * (attempt + 1));
        console.log(`[VisionAI] Rate limited. Waiting ${waitSec}s before retry ${attempt + 1}/${maxRetries}...`);
        await new Promise(r => setTimeout(r, waitSec * 1000));
      } else {
        throw err;
      }
    }
  }
}

/**
 * Analyzes a base64 image against an expected product category.
 * @param {string} base64Image - Base64 encoded image string (without the data URL prefix)
 * @param {string} mimeType - The mime type of the image (e.g., 'image/jpeg')
 * @param {string} expectedCategory - The category of the product (e.g., 'clothing', 'electronics')
 * @param {string} productName - The name of the product
 * @param {number} productPrice - Original product price in INR (for refund calc context)
 * @returns {Promise<Object>} - Object containing { isValid, grade, quality_score, explanation, carbon_saved_kg }
 */
async function analyzeImage(base64Image, mimeType, expectedCategory, productName, productPrice) {
  if (!process.env.GEMINI_API_KEY) {
    console.warn('[VisionAI] No GEMINI_API_KEY found. Falling back to mock grading.');
    return null; // Signals the route to use mock grading
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

    const response = await callWithRetry(() => ai.models.generateContent({
      model: GEMINI_MODEL,
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

    const resultText = response.text;
    const jsonResult = JSON.parse(resultText);

    return {
      isValid: jsonResult.isValid,
      grade: jsonResult.grade || 'B',
      quality_score: typeof jsonResult.quality_score === 'number' ? jsonResult.quality_score : 70,
      explanation: jsonResult.explanation || 'Analyzed by AI Vision.',
      carbon_saved_kg: typeof jsonResult.carbon_saved_kg === 'number' ? jsonResult.carbon_saved_kg : 1.5
    };

  } catch (error) {
    console.error('[VisionAI] Error analyzing image:', error);
    return null;
  }
}

/**
 * Analyzes a bill/receipt image to verify it's legitimate.
 * @param {string} base64Image - Base64 encoded bill image
 * @param {string} mimeType - The mime type (e.g., 'image/jpeg')
 * @param {string} expectedProduct - The product name being returned
 * @returns {Promise<Object|null>} - { isValid, productMatch, withinReturnWindow, confidence, explanation }
 */
async function analyzeBill(base64Image, mimeType, expectedProduct) {
  if (!process.env.GEMINI_API_KEY) {
    console.warn('[VisionAI] No GEMINI_API_KEY found. Falling back to mock bill verification.');
    return null;
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

    const response = await callWithRetry(() => ai.models.generateContent({
      model: GEMINI_MODEL,
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

    const resultText = response.text;
    const result = JSON.parse(resultText);

    return {
      isBill: result.isBill !== false,
      productMatch: result.productMatch !== false,
      withinReturnWindow: result.withinReturnWindow !== false,
      dateReadable: result.dateReadable !== false,
      confidence: typeof result.confidence === 'number' ? result.confidence : 50,
      explanation: result.explanation || 'Analyzed by AI Vision.',
      isValid: result.isBill && (result.productMatch !== false)
    };

  } catch (error) {
    console.error('[VisionAI] Error analyzing bill:', error);
    return null;
  }
}

/**
 * Validates if the uploaded photo matches the customer's stated return reason.
 * @param {string} base64Image - Base64 encoded image string
 * @param {string} mimeType - The mime type
 * @param {string} expectedProduct - The product name
 * @param {string} reason - The main reason selected from dropdown
 * @param {string} customReason - Any custom reason text
 * @param {string} description - Detailed description provided by the user
 * @returns {Promise<Object|null>} - { match, confidence, explanation }
 */
async function validateReason(base64Image, mimeType, expectedProduct, reason, customReason, description) {
  if (!process.env.GEMINI_API_KEY) {
    console.warn('[VisionAI] No GEMINI_API_KEY found. Falling back to mock reason validation.');
    return null;
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

    const response = await callWithRetry(() => ai.models.generateContent({
      model: GEMINI_MODEL,
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

    const resultText = response.text;
    const result = JSON.parse(resultText);

    return {
      match: result.match !== false,
      confidence: typeof result.confidence === 'number' ? result.confidence : 50,
      explanation: result.explanation || 'Analyzed by AI Vision.'
    };

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

    const response = await callWithRetry(() => ai.models.generateContent({
      model: GEMINI_MODEL,
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
