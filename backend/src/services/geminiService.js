async function generateGeminiAnswer({
  apiKey,
  model = 'gemini-2.5-flash',
  systemInstruction,
  history = [],
  question,
  fetchImpl = fetch,
}) {
  const contents = history.map((message) => ({
    role: message.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: message.content }],
  }));
  contents.push({ role: 'user', parts: [{ text: question }] });

  const response = await fetchImpl(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents,
        generationConfig: { maxOutputTokens: 500 },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Gemini API request failed with status ${response.status}`);
  }

  const payload = await response.json();
  const answer = payload.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || '')
    .join('')
    .trim();

  if (!answer) {
    throw new Error('Gemini returned no text');
  }

  return answer;
}

module.exports = { generateGeminiAnswer };
