const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
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
    });

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

module.exports = { analyzeImage };
