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

    // Check education scope & retrieve grounded context
    const eduResult = await EducationSearchService.retrieveContext(userMessage);
    if (!eduResult.isEducation && eduResult.redirectMessage) {
      return eduResult.redirectMessage;
    }

    if (!apiKey) {
      console.warn('[GeminiService] GEMINI_API_KEY is not set. Returning default companion message.');
      return `Hi there! I am FellowGrad, your education and student companion. How can I help with your studies, colleges, courses, or admissions today? (Note: Set GEMINI_API_KEY in .env to activate live Gemini AI responses).`;
    }

    const url = `${baseUrl}${model}:generateContent`;

    const effectivePrompt = eduResult.groundedContext
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

      console.warn('[GeminiService] Gemini API unreachable or model not found, using companion fallback reply:', err.message);
      return `I'm here for you! To prepare effectively for your goals, focus on structured practice, building core problem-solving intuition, and keeping a positive mindset. How else can I help?`;
    }
  }
}

module.exports = GeminiService;
