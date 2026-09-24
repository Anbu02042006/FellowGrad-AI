const axios = require('axios');
const geminiConfig = require('../config/gemini');
const EducationSearchService = require('./education/educationSearchService');

class GeminiService {
  /**
   * Request response from Google Gemini API
   * @param {string} userMessage
   * @returns {Promise<string>} AI text reply
   */
  static async getAiResponse(userMessage) {
    const { apiKey, model, baseUrl, systemPrompt } = geminiConfig;

    // Check education scope & retrieve grounded context if educational
    const eduResult = await EducationSearchService.retrieveContext(userMessage);

    if (!apiKey) {
      console.warn('[GeminiService] GEMINI_API_KEY is not set. Returning default personal assistant message.');
      return `Hi there! I am your personal AI assistant. How can I help you today? (Note: Set GEMINI_API_KEY in .env to activate live Gemini AI responses).`;
    }

    const url = `${baseUrl}${model}:generateContent`;

    const effectivePrompt = (eduResult && eduResult.isEducation && eduResult.groundedContext)
      ? `${systemPrompt}\n\n${eduResult.groundedContext}`
      : systemPrompt;

    const requestBody = {
      systemInstruction: {
        parts: [{ text: effectivePrompt }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: userMessage }],
        },
      ],
      tools: [
        {
          googleSearch: {},
        },
      ],
    };

    try {
      console.log(`[GeminiService] Sending request to ${url} (Model: ${model})`);

      const response = await axios.post(url, requestBody, {
        headers: {
          'x-goog-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      });

      const candidate = response.data?.candidates?.[0];
      const partText = candidate?.content?.parts?.[0]?.text;

      if (partText) {
        return partText;
      }

      return "I'm sorry, I couldn't generate a response right now. How else can I help you?";
    } catch (err) {
      console.error('[GeminiService] Error calling Gemini API:', err.response?.data || err.message);

      // If googleSearch tool is not supported on certain model versions, retry without tools
      if (err.response?.status === 400 && err.response?.data?.error?.message?.includes('tool')) {
        try {
          console.log('[GeminiService] Retrying without search tool...');
          const retryBody = {
            systemInstruction: {
              parts: [{ text: systemPrompt }],
            },
            contents: [
              {
                role: 'user',
                parts: [{ text: userMessage }],
              },
            ],
          };
          const retryRes = await axios.post(url, retryBody, {
            headers: {
              'x-goog-api-key': apiKey,
              'Content-Type': 'application/json',
            },
            timeout: 30000,
          });
          const reply = retryRes.data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (reply) return reply;
        } catch (retryErr) {
          console.error('[GeminiService] Retry failed:', retryErr.message);
        }
      }

      console.warn('[GeminiService] Gemini API unreachable or model not found, using assistant fallback reply:', err.message);
      return `I'm here to help you! How can I assist you with your tasks or questions today?`;
    }
  }
}

module.exports = GeminiService;
