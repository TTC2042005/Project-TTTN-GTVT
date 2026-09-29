const test = require('node:test');
const assert = require('node:assert/strict');
const { buildLocalRecommendation, buildLocalRagAnswer, buildProjectCatalogAnswer } = require('../src/services/aiService');
const { buildLocalProjectAnswer, rankProjectKnowledge } = require('../src/services/projectKnowledgeService');

test('buildLocalRecommendation returns the best matching lab and package', () => {
  const labs = [
    {
      id: 'lab-1',
      name: 'Hanoi Film Lab',
      city: 'Hà Nội',
      country: 'Vietnam',
      rating: 4.8,
      priceRange: '120k-250k',
      services: [{ serviceType: 'Scanning' }],
      packages: [{ id: 'pkg-1', title: 'Scanning & Print', description: 'High quality scan', price: 180000 }],
    },
    {
      id: 'lab-2',
      name: 'Saigon Film House',
      city: 'TP. Hồ Chí Minh',
      country: 'Vietnam',
      rating: 4.6,
      priceRange: '150k-300k',
      services: [{ serviceType: 'Development' }],
      packages: [{ id: 'pkg-2', title: 'Development', description: 'C41', price: 200000 }],
    },
  ];

  const result = buildLocalRecommendation({
    labs,
    location: { city: 'Hà Nội', country: 'Vietnam' },
    price: { minPrice: 100000, maxPrice: 250000 },
    preferences: { serviceType: 'Scanning', filmStyle: 'Color', budget: 250000 },
  });

  assert.equal(result.recommendations.filmLab.name, 'Hanoi Film Lab');
  assert.equal(result.recommendations.package.title, 'Scanning & Print');
});

test('buildLocalRagAnswer returns a helpful answer for photography questions', () => {
  const answer = buildLocalRagAnswer('How do I choose film for portraits?');
  assert.match(answer.toLowerCase(), /portrait|portra|film/i);
});

test('project chat identifies the most expensive listed camera from the current catalog', () => {
  const result = buildProjectCatalogAnswer('Máy ảnh nào có giá trị cao nhất trên website?', [
    { title: 'Camera A', category: 'Cameras', price: 180 },
    { title: 'Camera B', category: 'Cameras', price: 350 },
    { title: 'Lens A', category: 'Lenses', price: 2499 },
  ]);

  assert.match(result.answer, /Camera B/);
  assert.match(result.answer, /350/);
  assert.equal(result.items[0].title, 'Camera B');
});

test('project chat compares prices within the requested Marketplace category', () => {
  const result = buildProjectCatalogAnswer('Ống kính nào đắt nhất trên website?', [
    { title: 'Camera A', category: 'Cameras', price: 350 },
    { title: 'Lens A', category: 'Lenses', price: 999 },
    { title: 'Lens B', category: 'Lenses', price: 2499 },
  ]);

  assert.match(result.answer, /Lens B/);
  assert.equal(result.items[0].price, 2499);
});

test('project chat distinguishes film recommendations from live marketplace stock', () => {
  const result = buildProjectCatalogAnswer('Phim nào hay nhất?', []);

  assert.match(result.answer, /Kodak Portra 400/);
  assert.match(result.answer, /không khẳng định.*đang được bán/i);
  assert.equal(result.source, 'photography-knowledge');
});

test('project chat does not confuse film catalog listing questions with film advice', () => {
  assert.equal(buildProjectCatalogAnswer('Có những phim nào đang có trên website?', []), null);
});

test('project retrieval answers questions about labs and their services', () => {
  const records = [
    { type: 'film-lab', title: 'Hanoi Film Lab', summary: 'Hà Nội, Vietnam; rating 4.8/5.', searchText: 'lab film lab phòng tráng phim Hà Nội' },
    { type: 'lab-service', title: 'Scanning - Hanoi Film Lab', summary: 'Giá 80000 VND; thời gian 180 phút.', searchText: 'service dich vu scanning scan Hà Nội Hanoi Film Lab' },
    { type: 'marketplace-cameras', title: 'Canon EOS Rebel T6', summary: 'Cameras; giá 350 USD.', searchText: 'camera cameras máy ảnh marketplace' },
  ];

  const answer = buildLocalProjectAnswer('Ở Hà Nội có lab nào và có dịch vụ scan không?', records);

  assert.match(answer.answer, /Hanoi Film Lab/);
  assert.match(answer.answer, /Scanning/);
  assert.equal(answer.source, 'website-data');
});

test('project retrieval finds the website technology summary', () => {
  const records = [
    { type: 'project-overview', title: 'Film Lab Ecosystem website features and technology', summary: 'Nền tảng dùng Next.js React, Node.js Express, PostgreSQL Sequelize, JWT.', searchText: 'technology tech stack frontend backend database architecture' },
  ];

  const results = rankProjectKnowledge('Website của tôi dùng công nghệ gì?', records);

  assert.equal(results[0].type, 'project-overview');
  assert.match(buildLocalProjectAnswer('Website của tôi dùng công nghệ gì?', records).answer, /Next.js React/);
});

test('project retrieval understands order tracking questions without preset wording', () => {
  const records = [
    { type: 'project-overview', title: 'Film Lab Ecosystem features', summary: 'Theo dõi đơn hàng qua Server-Sent Events (SSE).', searchText: 'orders tracking status realtime sse' },
  ];
  const answer = buildLocalProjectAnswer('Làm thế nào xem film lab đã nhận cuộn phim của tôi chưa?', records);

  assert.match(answer.answer, /Server-Sent Events/);
});

test('project retrieval returns no fabricated response for unrelated/unmatched data', () => {
  assert.equal(buildLocalProjectAnswer('Câu hỏi không có từ khóa khớp', []), null);
});
