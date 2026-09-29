const { Op } = require('sequelize');
const { getStaticMarketplaceCatalog } = require('./marketplaceCatalogService');
const KNOWLEDGE_CACHE_TTL_MS = 15_000;
let knowledgeCache = { expiresAt: 0, promise: null };

const stopWords = new Set([
  'la', 'gi', 'nao', 'nhung', 'cac', 'co', 'tren', 'trong', 'cua', 'toi', 'website', 'du', 'an', 'nay',
  'the', 'a', 'an', 'is', 'are', 'what', 'which', 'how', 'do', 'does', 'on', 'in', 'my', 'your', 'the',
  'cho', 'voi', 'va', 'hay', 'giup', 'minh', 'toi', 'ban', 'nen', 'can', 'mot', 'nhat',
]);

function normalizeText(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .toLowerCase();
}

function tokenize(value = '') {
  return normalizeText(value).match(/[a-z0-9]+/g)?.filter((token) => token.length > 1 && !stopWords.has(token)) || [];
}

function queryTerms(question) {
  const normalized = normalizeText(question);
  const terms = new Set(tokenize(question));
  const addIfContains = (phrases, synonyms) => {
    if (phrases.some((phrase) => normalized.includes(phrase))) synonyms.forEach((word) => terms.add(word));
  };

  addIfContains(['may anh', 'camera'], ['camera', 'cameras', 'mayanh']);
  addIfContains(['ong kinh', 'lens'], ['lens', 'lenses', 'ongkinh']);
  addIfContains(['film lab', 'phong lab', 'trang phim', 'film lab'], ['lab', 'film', 'dichvu']);
  addIfContains(['workshop', 'photowalk', 'su kien', 'event'], ['event', 'workshop', 'photowalk']);
  addIfContains(['bai viet', 'cong dong', 'community', 'post'], ['post', 'community', 'baiviet']);
  addIfContains(['goi dich vu', 'package', 'combo'], ['package', 'combo', 'goi']);
  addIfContains(['dich vu', 'service', 'scan', 'trang', 'in anh'], ['service', 'dichvu', 'scan', 'printing']);
  addIfContains(['gia', 'price', 'bao nhieu', 'dat nhat'], ['price', 'gia']);
  addIfContains(['cong nghe', 'tech stack', 'technology', 'framework'], ['technology', 'tech', 'stack', 'frontend', 'backend', 'database']);
  addIfContains(['tinh nang', 'chuc nang', 'features', 'website lam duoc gi'], ['features', 'functionality', 'booking', 'marketplace', 'community', 'ai']);
  addIfContains(['thanh toan', 'payment'], ['payment', 'checkout', 'stripe', 'bank']);
  addIfContains(['san pham', 'product', 'marketplace', 'hang hoa', 'danh muc'], ['product', 'marketplace', 'cameras', 'lenses', 'film']);
  addIfContains(['don hang', 'order', 'tracking', 'theo doi'], ['order', 'orders', 'tracking', 'sse', 'status']);
  addIfContains(['dang nhap', 'dang ky', 'tai khoan', 'authentication', 'login', 'register'], ['auth', 'authentication', 'jwt', 'account', 'login']);
  addIfContains(['kho anh', 'luu anh', 'upload', 'anh cua toi', 'digital archive'], ['upload', 'storage', 'archive', 'image', 'photo', 'quality']);
  addIfContains(['goi y', 'recommendation', 'de xuat'], ['recommendation', 'ai', 'lab', 'film']);
  addIfContains(['danh gia', 'review', 'rating'], ['review', 'rating', 'stars', 'score']);
  addIfContains(['bao mat', 'security', 'jwt'], ['security', 'jwt', 'auth', 'token']);
  return terms;
}

function rankProjectKnowledge(question, records = [], limit = 8) {
  const terms = queryTerms(question);
  if (!terms.size) return [];

  return records
    .map((record) => {
      const titleTokens = new Set(tokenize(record.title));
      const bodyTokens = new Set(tokenize(`${record.searchText || ''} ${record.summary || ''}`));
      let score = 0;
      for (const term of terms) {
        if (titleTokens.has(term)) score += 3;
        else if (bodyTokens.has(term)) score += 1;
      }
      return { record, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.record.title.localeCompare(b.record.title))
    .slice(0, limit)
    .map(({ record, score }) => ({ ...record, score }));
}

function asPlain(value) {
  return value && typeof value.toJSON === 'function' ? value.toJSON() : value;
}

function makeRecord(type, title, summary, extra = {}) {
  return { type, title, summary, searchText: `${type} ${title} ${summary} ${extra.searchText || ''}`, ...extra };
}

async function buildProjectKnowledgeFresh(models) {
  const {
    FilmLab, LabService, LabPackage, Product, Workshop, Photowalk, Post, RagDocument,
  } = models;
  const now = new Date();
  const [labsRaw, productsRaw, workshopsRaw, photowalksRaw, postsRaw, documentsRaw, staticCatalog] = await Promise.all([
    FilmLab.findAll({
      include: [
        { model: LabService, as: 'services', attributes: ['id', 'name', 'serviceType', 'price', 'durationMinutes', 'description'] },
        { model: LabPackage, as: 'packages', attributes: ['id', 'title', 'price', 'description'] },
      ],
      order: [['rating', 'DESC']],
      limit: 30,
    }),
    Product.findAll({
      include: [{ association: 'seller', attributes: ['id', 'name'] }],
      order: [['createdAt', 'DESC']],
      limit: 60,
    }),
    Workshop.findAll({ where: { publishedAt: { [Op.ne]: null }, eventDate: { [Op.gte]: now } }, order: [['eventDate', 'ASC']], limit: 10 }),
    Photowalk.findAll({ where: { publishedAt: { [Op.ne]: null }, eventDate: { [Op.gte]: now } }, order: [['eventDate', 'ASC']], limit: 10 }),
    Post.findAll({ where: { visibility: 'public', publishedAt: { [Op.ne]: null } }, order: [['publishedAt', 'DESC']], limit: 15 }),
    RagDocument.findAll({ attributes: ['id', 'source', 'title', 'content', 'metadata'], order: [['updatedAt', 'DESC']], limit: 30 }),
    getStaticMarketplaceCatalog(),
  ]);

  const records = [makeRecord(
    'project-overview',
    'Film Lab Ecosystem website features and technology',
    'Nền tảng dùng Next.js React, Node.js Express, PostgreSQL Sequelize, JWT; có tìm kiếm film lab, đặt dịch vụ tráng scan in, theo dõi đơn SSE, thanh toán tích hợp, kho ảnh, marketplace máy ảnh ống kính film, cộng đồng bài viết workshop photowalk, recommendation và chatbot RAG. Computer vision hiện là heuristic đánh giá ảnh, chưa phải mô hình ML đã huấn luyện.',
    { searchText: 'technology tech stack frontend backend database architecture feature security ai computer vision semantic search rag' },
  )];

  for (const value of labsRaw) {
    const lab = asPlain(value);
    records.push(makeRecord(
      'film-lab',
      lab.name,
      `${lab.city}, ${lab.country}; địa chỉ ${lab.address}; đánh giá ${lab.rating}/5.`,
      { searchText: `lab film lab phòng tráng phim ${lab.city} ${lab.country} ${lab.services.map((s) => `${s.name} ${s.serviceType}`).join(' ')} ${lab.packages.map((p) => p.title).join(' ')}` },
    ));
    for (const service of lab.services || []) {
      records.push(makeRecord(
        'lab-service',
        `${service.name} - ${lab.name}`,
        `${service.serviceType}; giá ${service.price} VND; thời gian ${service.durationMinutes || 'chưa công bố'} phút. ${service.description || ''}`,
        { searchText: `service dich vu ${service.serviceType} scan scanning development tráng phim printing in ảnh ${lab.city} ${lab.name}` },
      ));
    }
    for (const pack of lab.packages || []) {
      records.push(makeRecord(
        'lab-package',
        `${pack.title} - ${lab.name}`,
        `Giá ${pack.price} VND. ${pack.description || ''}`,
        { searchText: `package combo goi dich vu lab ${lab.city} ${lab.name}` },
      ));
    }
  }

  const catalogByTitle = new Map();
  for (const value of staticCatalog) catalogByTitle.set(`${value.category}:${value.title}`.toLowerCase(), value);
  for (const value of productsRaw) {
    const product = asPlain(value);
    const item = {
      id: product.id,
      title: product.title,
      category: product.category,
      condition: product.condition,
      price: Number(product.price),
      currency: 'USD',
      stock: product.stock,
      imageUrl: product.imageUrl,
      seller: product.seller?.name || null,
      description: product.description || '',
    };
    catalogByTitle.set(`${item.category}:${item.title}`.toLowerCase(), item);
  }
  for (const item of catalogByTitle.values()) {
    const aliases = item.category === 'Cameras' ? 'camera cameras máy ảnh máy anh' : item.category === 'Lenses' ? 'lens lenses ống kính ong kinh' : 'film phim movie';
    records.push(makeRecord(
      `marketplace-${String(item.category).toLowerCase()}`,
      item.title,
      `${item.category}; giá ${item.price} ${item.currency}; tình trạng ${item.condition || 'chưa nêu'}; còn ${item.stock ?? 1}. ${item.description || ''}${item.seller ? ` Người bán ${item.seller}.` : ''}`,
      { item, searchText: `${aliases} marketplace product listing ${item.category} ${item.title} ${item.condition} ${item.seller || ''}` },
    ));
  }

  for (const [eventType, values] of [['workshop', workshopsRaw], ['photowalk', photowalksRaw]]) {
    for (const value of values) {
      const event = asPlain(value);
      records.push(makeRecord(
        eventType,
        event.title,
        `${event.location || 'Chưa công bố địa điểm'}; thời gian ${new Date(event.eventDate).toLocaleString('vi-VN')}; sức chứa ${event.capacity}. ${event.description || ''}`,
        { searchText: `event sự kiện workshop photowalk ${event.location || ''}` },
      ));
    }
  }

  for (const value of postsRaw) {
    const post = asPlain(value);
    records.push(makeRecord(
      'community-post',
      post.title,
      `${(post.body || '').slice(0, 500)}; chủ đề ${(post.tags || []).join(', ')}`,
      { searchText: `community cộng đồng bài viết post guide hướng dẫn ${(post.tags || []).join(' ')}` },
    ));
  }

  for (const value of documentsRaw) {
    const document = asPlain(value);
    records.push(makeRecord(
      'knowledge-document',
      document.title || 'Photography knowledge',
      (document.content || '').slice(0, 1200),
      { source: document.source, searchText: `knowledge photography nhiếp ảnh film stock ${document.source || ''}` },
    ));
  }

  return records;
}

function buildLocalProjectAnswer(question, records = []) {
  const normalizedQuestion = normalizeText(question);
  if (/(loai san pham|danh muc|what products|product categories|marketplace co nhung)/.test(normalizedQuestion)) {
    const categoryCounts = new Map();
    for (const record of records) {
      if (!record.type.startsWith('marketplace-')) continue;
      const category = record.item?.category || record.type.replace('marketplace-', '');
      categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
    }
    if (categoryCounts.size) {
      return {
        answer: `Marketplace hiện có các danh mục: ${[...categoryCounts.entries()].map(([category, count]) => `${category} (${count})`).join(', ')}. Số lượng dựa trên catalog công khai hiện tại.`,
        source: 'website-data',
        items: [],
        documents: [],
      };
    }
  }
  const matches = rankProjectKnowledge(question, records, 5);
  if (!matches.length) return null;
  const lines = matches.map((record) => `• ${record.title}: ${record.summary}`);
  const items = matches.filter((record) => record.item).slice(0, 4).map((record) => record.item);
  return {
    answer: `Theo dữ liệu hiện có trên website:\n${lines.join('\n')}\n\nGiá và trạng thái có thể thay đổi theo catalog hiện tại.`,
    source: 'website-data',
    items,
    documents: matches.filter((record) => record.type === 'knowledge-document').map((record) => ({ title: record.title, source: record.source })),
  };
}

function buildProjectKnowledge(models) {
  if (knowledgeCache.promise && knowledgeCache.expiresAt > Date.now()) return knowledgeCache.promise;
  const promise = buildProjectKnowledgeFresh(models).catch((error) => {
    if (knowledgeCache.promise === promise) knowledgeCache = { expiresAt: 0, promise: null };
    throw error;
  });
  knowledgeCache = { expiresAt: Date.now() + KNOWLEDGE_CACHE_TTL_MS, promise };
  return promise;
}

function buildProjectContext(question, records = [], limit = 12) {
  const overview = records.find((record) => record.type === 'project-overview');
  const ranked = rankProjectKnowledge(question, records.filter((record) => record !== overview), limit);
  return [overview, ...ranked].filter(Boolean).map((record) => `[${record.type}] ${record.title}: ${record.summary}`).join('\n');
}

module.exports = { buildProjectKnowledge, rankProjectKnowledge, buildLocalProjectAnswer, buildProjectContext };
