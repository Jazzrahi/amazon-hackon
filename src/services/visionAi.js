const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * Analyzes a base64 image against an expected product category.
 * @param {string} base64Image - Base64 encoded image string (without the data URL prefix)
 * @param {string} mimeType - The mime type of the image (e.g., 'image/jpeg')
 * @param {string} expectedCategory - The category of the product (e.g., 'clothing', 'electronics')
 * @param {string} productName - The name of the product
 * @returns {Promise<Object>} - Object containing { isValid, grade, explanation }
 */
async function analyzeImage(base64Image, mimeType, expectedCategory, productName) {
  if (!process.env.GEMINI_API_KEY) {
    console.warn('[VisionAI] No GEMINI_API_KEY found. Falling back to mock grading.');
    return null; // Signals the route to use mock grading
  }

  try {
    const prompt = `
      You are an expert Amazon Returns Inspector. 
      The customer is returning a product described as: "${productName}" (Category: ${expectedCategory}).
      
      Look at the provided image of the returned item.
      
      Step 1: Does the item in the image reasonably match the expected product? 
      For example, if the product is a Cotton Kurta but the image shows a mobile phone, this is a FRAUDULENT return.
      
      Step 2: If it IS the correct item, assess its condition and assign a Grade:
      - A: Like new, original packaging or perfectly intact.
      - B: Lightly used, minor signs of wear, good condition.
      - C: Heavily used, visible damage, or missing major parts.

      Respond ONLY with a valid JSON object matching this schema:
      {
        "isValid": boolean, // true if it matches the expected product, false if it's fraudulent (wrong item)
        "grade": string, // "A", "B", or "C". If isValid is false, grade should be "C".
        "explanation": string // A short 1-2 sentence explanation of your decision. Keep it professional. If fraudulent, state that the item does not match.
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
      explanation: jsonResult.explanation || 'Analyzed by AI Vision.'
    };

  } catch (error) {
    console.error('[VisionAI] Error analyzing image:', error);
    return null;
  }
}

module.exports = { analyzeImage };
