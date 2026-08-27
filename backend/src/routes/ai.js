const express = require('express');
const router = express.Router();
const { FilmLab, LabPackage, LabService, RagDocument } = require('../models');
const { OpenAI } = require('openai');
const { buildLocalRecommendation, buildLocalRagAnswer } = require('../services/aiService');

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

const filmStocks = [
  { name: 'Kodak Portra 400', style: 'color', bestFor: ['portrait', 'wedding', 'lifestyle'] },
  { name: 'Kodak Portra 800', style: 'color', bestFor: ['portrait', 'low-light', 'street'] },
  { name: 'Kodak Ektar 100', style: 'color', bestFor: ['landscape', 'vibrant', 'travel'] },
  { name: 'Fujifilm Pro 400H', style: 'color', bestFor: ['portrait', 'wedding', 'soft'] },
  { name: 'Fujifilm Velvia 50', style: 'color', bestFor: ['landscape', 'nature', 'vivid'] },
  { name: 'Ilford HP5 Plus', style: 'black-and-white', bestFor: ['street', 'documentary', 'portrait'] },
  { name: 'Kodak Tri-X 400', style: 'black-and-white', bestFor: ['street', 'documentary', 'classic'] },
  { name: 'Cinestill 800T', style: 'color', bestFor: ['night', 'cinematic', 'street'] },
  { name: 'Kodak Gold 200', style: 'color', bestFor: ['everyday', 'portrait', 'travel'] },
];

function scoreLab(lab, { city, country, serviceType, minPrice, maxPrice }) {
  let score = 0;
  if (city && lab.city?.toLowerCase() === city.toLowerCase()) score += 40;
  if (country && lab.country?.toLowerCase() === country.toLowerCase()) score += 20;
  if (lab.rating >= 4.5) score += 20;
  if (serviceType) {
    const matchesService = lab.services?.some((service) => service.serviceType?.toLowerCase().includes(serviceType.toLowerCase()));
    if (matchesService) score += 25;
    const packageMatch = lab.packages?.some((pkg) => pkg.title?.toLowerCase().includes(serviceType.toLowerCase()) || pkg.description?.toLowerCase().includes(serviceType.toLowerCase()));
    if (packageMatch) score += 15;
  }
  if (minPrice || maxPrice) {
    const packagePrices = lab.packages?.map((pkg) => pkg.price) || [];
    if (packagePrices.length) {
      const avg = packagePrices.reduce((sum, price) => sum + price, 0) / packagePrices.length;
      if (minPrice && avg >= minPrice) score += 10;
      if (maxPrice && avg <= maxPrice) score += 10;
    }
  }
  return score;
}

function choosePackage(packages = [], { serviceType, minPrice, maxPrice, preferenceBudget }) {
  if (!packages.length) return null;

  const priced = packages.map((pkg) => ({
    pkg,
    score: (() => {
      let score = 0;
      if (serviceType && pkg.title?.toLowerCase().includes(serviceType.toLowerCase())) score += 30;
      if (serviceType && pkg.description?.toLowerCase().includes(serviceType.toLowerCase())) score += 20;
      const price = Number(pkg.price || 0);
      if (preferenceBudget && price <= preferenceBudget) score += 20;
      if (minPrice && price >= minPrice) score += 10;
      if (maxPrice && price <= maxPrice) score += 10;
      return score;
    })(),
  }));

  priced.sort((a, b) => b.score - a.score || a.pkg.price - b.pkg.price);
  return priced[0].pkg;
}

function suggestFilmType({ filmStyle, preferences = [] }) {
  const lowerStyle = filmStyle?.toLowerCase();
  const lowerPrefs = preferences.map((item) => item.toLowerCase());

  const ranked = filmStocks.map((stock) => {
    let score = 0;
    if (lowerStyle && stock.style === lowerStyle) score += 40;
    const overlap = stock.bestFor.reduce((sum, tag) => sum + (lowerPrefs.includes(tag.toLowerCase()) ? 10 : 0), 0);
    score += overlap;
    return { stock, score };
  });

  ranked.sort((a, b) => b.score - a.score);
  return ranked[0]?.stock || filmStocks[0];
}

router.post('/recommendations', async (req, res) => {
  try {
    const {
      history = [],
      location = {},
      price = {},
      preferences = {},
    } = req.body;

    const { city, country } = location;
    const { minPrice, maxPrice } = price;
    const { serviceType, filmStyle, favoriteGenres, budget } = preferences;

    const labs = await FilmLab.findAll({
      include: [
        { model: LabService, as: 'services' },
        { model: LabPackage, as: 'packages' },
      ],
    });

    const result = buildLocalRecommendation({
      labs,
      location: { city, country },
      price: { minPrice, maxPrice },
      preferences: { serviceType, filmStyle, budget },
    });

    res.json({
      ...result,
      input: { history, location, price, preferences },
      message: 'Recommendation delivered based on preferences and available film labs',
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/semantic-search', async (req, res) => {
  const { query } = req.body;

  if (!query) {
    return res.status(400).json({ error: 'Query is required' });
  }

  if (!openai) {
    const documents = await RagDocument.findAll();
    const topResults = documents.slice(0, 5).map((doc) => ({
      id: doc.id,
      title: doc.title,
      source: doc.source,
      metadata: doc.metadata,
      similarity: 0.91,
    }));
    return res.json({ source: 'semantic-search', query, results: topResults, fallback: true });
  }

  const embeddingResponse = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: query,
  });

  const queryEmbedding = embeddingResponse.data[0].embedding;
  const documents = await RagDocument.findAll();

  const similarityScores = documents.map((doc) => {
    const docEmbedding = doc.embedding || [];
    const dotProduct = docEmbedding.reduce((sum, value, index) => sum + value * (queryEmbedding[index] || 0), 0);
    const docMagnitude = Math.sqrt(docEmbedding.reduce((sum, value) => sum + value * value, 0));
    const queryMagnitude = Math.sqrt(queryEmbedding.reduce((sum, value) => sum + value * value, 0));
    const similarity = docMagnitude && queryMagnitude ? dotProduct / (docMagnitude * queryMagnitude) : 0;
    return { doc, similarity };
  });

  similarityScores.sort((a, b) => b.similarity - a.similarity);
  const topResults = similarityScores.slice(0, 5).map((item) => ({
    id: item.doc.id,
    title: item.doc.title,
    source: item.doc.source,
    metadata: item.doc.metadata,
    similarity: item.similarity,
  }));

  res.json({ source: 'semantic-search', query, results: topResults });
});

router.post('/rag', async (req, res) => {
  try {
    const { question } = req.body;
    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    if (!openai) {
      const answer = buildLocalRagAnswer(question);
      return res.json({
        source: 'rag',
        question,
        answer,
        documents: [],
        fallback: true,
      });
    }

    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: question,
    });
    const questionEmbedding = embeddingResponse.data[0].embedding;

    const documents = await RagDocument.findAll();
    const similarityScores = documents.map((doc) => {
      const docEmbedding = doc.embedding || [];
      const dotProduct = docEmbedding.reduce((sum, value, index) => sum + value * (questionEmbedding[index] || 0), 0);
      const docMagnitude = Math.sqrt(docEmbedding.reduce((sum, value) => sum + value * value, 0));
      const questionMagnitude = Math.sqrt(questionEmbedding.reduce((sum, value) => sum + value * value, 0));
      const similarity = docMagnitude && questionMagnitude ? dotProduct / (docMagnitude * questionMagnitude) : 0;
      return { doc, similarity };
    });

    similarityScores.sort((a, b) => b.similarity - a.similarity);
    const topDocs = similarityScores.slice(0, 3).map((item) => item.doc);
    const contextText = topDocs.map((doc, index) => `Source ${index + 1}: ${doc.title}\n${doc.content}`).join('\n\n');

    const prompt = `You are a photography and Film Lab expert. Use the following document context to answer the user question.\n\nContext:\n${contextText}\n\nQuestion: ${question}\n\nAnswer:`;

    const completion = await openai.responses.create({
      model: 'gpt-4.1-mini',
      input: prompt,
      max_output_tokens: 500,
    });

    const answer = completion.output[0]?.content?.[0]?.text || 'Không tìm được câu trả lời chính xác. Vui lòng thử lại với câu hỏi khác.';

    res.json({
      source: 'rag',
      question,
      answer,
      documents: topDocs.map((doc) => ({ id: doc.id, title: doc.title, source: doc.source })),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
