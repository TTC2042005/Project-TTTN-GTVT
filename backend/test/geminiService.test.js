const test = require('node:test');
const assert = require('node:assert/strict');
const { generateGeminiAnswer } = require('../src/services/geminiService');

test('generateGeminiAnswer sends conversation history and returns Gemini text', async () => {
  let requestUrl;
  let requestOptions;
  const answer = await generateGeminiAnswer({
    apiKey: 'test-key',
    model: 'gemini-test',
    systemInstruction: 'Answer from the supplied context.',
    history: [
      { role: 'user', content: 'Recommend a film.' },
      { role: 'assistant', content: 'What kind of photos?' },
    ],
    question: 'Portraits.',
    fetchImpl: async (url, options) => {
      requestUrl = url;
      requestOptions = options;
      return {
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'Try Portra 400.' }] } }],
        }),
      };
    },
  });

  assert.equal(requestUrl, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent');
  assert.equal(requestOptions.headers['x-goog-api-key'], 'test-key');
  const body = JSON.parse(requestOptions.body);
  assert.equal(body.systemInstruction.parts[0].text, 'Answer from the supplied context.');
  assert.deepEqual(body.contents.map((message) => message.role), ['user', 'model', 'user']);
  assert.equal(body.contents[2].parts[0].text, 'Portraits.');
  assert.equal(answer, 'Try Portra 400.');
});

test('generateGeminiAnswer reports API failures without exposing response content', async () => {
  await assert.rejects(
    generateGeminiAnswer({
      apiKey: 'test-key',
      question: 'Question',
      systemInstruction: 'Instruction',
      fetchImpl: async () => ({ ok: false, status: 401 }),
    }),
    /Gemini API request failed with status 401/,
  );
});

test('generateGeminiAnswer rejects responses without text', async () => {
  await assert.rejects(
    generateGeminiAnswer({
      apiKey: 'test-key',
      question: 'Question',
      systemInstruction: 'Instruction',
      fetchImpl: async () => ({ ok: true, json: async () => ({ candidates: [] }) }),
    }),
    /Gemini returned no text/,
  );
});
