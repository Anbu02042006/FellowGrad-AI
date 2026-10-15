require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');

async function test() {
  const project = process.env.GOOGLE_CLOUD_PROJECT || 'fellowgrad-ai';
  const location = process.env.GOOGLE_CLOUD_LOCATION || 'global';
  console.log(`[Test] Connecting to Vertex AI with project=${project}, location=${location}`);

  const ai = new GoogleGenAI({
    vertexai: true,
    project,
    location,
  });

  const textModel = process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash';
  console.log(`[Test] Calling text model: ${textModel}...`);
  const res = await ai.models.generateContent({
    model: textModel,
    contents: 'What is 2+2? Answer in one word.',
    config: {
      systemInstruction: 'You are FellowGrad assistant.',
    },
  });
  console.log('[Test] Text Result:', res.text?.trim());

  const memoryModel = process.env.GEMINI_MEMORY_MODEL || 'gemini-2.5-flash';
  console.log(`[Test] Calling memory model: ${memoryModel} with JSON schema...`);
  const jsonRes = await ai.models.generateContent({
    model: memoryModel,
    contents: 'Extract memory in JSON: Student said they are studying computer science at PSG Tech. Return {"memories": [{"category": "academic", "content": "Student studies CS at PSG Tech", "importance": 0.9}]}',
    config: {
      responseMimeType: 'application/json',
    },
  });
  console.log('[Test] JSON Result:', jsonRes.text?.trim());
}

test().catch((err) => {
  console.error('[Test] Error:', err.message);
  process.exit(1);
});
