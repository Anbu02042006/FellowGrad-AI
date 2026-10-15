const { GoogleGenAI } = require('@google/genai');
const geminiConfig = require('../config/gemini');
const EducationSearchService = require('./education/educationSearchService');

class GeminiService {
  /**
   * Request response from Google Gemini via Google Cloud Vertex AI
   * @param {string} userMessage
   * @returns {Promise<string>} AI text reply
   */
  static async getAiResponse(userMessage) {
    if (!userMessage || typeof userMessage !== 'string' || !userMessage.trim()) {
      const err = new Error('Message is required');
      err.statusCode = 400;
      throw err;
    }

    const { project, location, useVertexAI, model, systemPrompt } = geminiConfig;

    if (!project) {
      const err = new Error('GOOGLE_CLOUD_PROJECT is not configured for Vertex AI');
      err.statusCode = 500;
      throw err;
    }

    // Check education scope & retrieve grounded context if educational
    let effectivePrompt = systemPrompt;
    try {
      const eduResult = await EducationSearchService.retrieveContext(userMessage);
      if (eduResult && eduResult.isEducation && eduResult.groundedContext) {
        effectivePrompt = `${systemPrompt}\n\n${eduResult.groundedContext}`;
      }
    } catch (searchErr) {
      console.warn('[GeminiService] Grounded search context retrieval note:', searchErr.message);
    }

    const ai = new GoogleGenAI({
      vertexai: useVertexAI,
      project,
      location,
    });

    try {
      console.log(`[GeminiService] Requesting Vertex AI text generation (Model: ${model}, Location: ${location})`);

      // 30-second timeout safety
      const timeoutPromise = new Promise((_, reject) => {
        const timer = setTimeout(() => {
          const timeoutErr = new Error('Vertex AI request timed out after 30000ms');
          timeoutErr.statusCode = 504;
          reject(timeoutErr);
        }, 30000);
        timer.unref?.();
      });

      const generatePromise = ai.models.generateContent({
        model,
        contents: userMessage,
        config: {
          systemInstruction: effectivePrompt,
        },
      });

      const response = await Promise.race([generatePromise, timeoutPromise]);
      const replyText = response?.text || response?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!replyText || !replyText.trim()) {
        const emptyErr = new Error('Empty response received from Vertex AI model');
        emptyErr.statusCode = 502;
        throw emptyErr;
      }

      return replyText;
    } catch (err) {
      console.error('[GeminiService] Vertex AI text generation error:', err.message);

      // Preserve status code if already set (e.g. timeout), else categorize upstream error
      if (!err.statusCode) {
        const msg = (err.message || '').toLowerCase();
        if (msg.includes('not found') || msg.includes('404')) {
          err.statusCode = 404;
        } else if (msg.includes('quota') || msg.includes('rate limit') || msg.includes('429')) {
          err.statusCode = 429;
        } else if (msg.includes('unauthenticated') || msg.includes('permission') || msg.includes('403') || msg.includes('401')) {
          err.statusCode = 502;
        } else {
          err.statusCode = 502;
        }
      }
      throw err;
    }
  }
}

module.exports = GeminiService;

