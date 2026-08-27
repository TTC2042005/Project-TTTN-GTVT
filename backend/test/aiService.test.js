const test = require('node:test');
const assert = require('node:assert/strict');
const { buildLocalRecommendation, buildLocalRagAnswer } = require('../src/services/aiService');

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
