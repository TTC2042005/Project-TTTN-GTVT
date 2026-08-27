const dotenv = require('dotenv');
dotenv.config();
const db = require('./models');

async function seed() {
  await db.sequelize.sync({ force: true });

  const owner = await db.User.create({
    email: 'labowner@example.com',
    passwordHash: '$2b$12$5KA6w3Q9F3V5PqHDoP6Iw.3PqV94dQ2rL4fJvTwD2qKJY7A4R0eT2',
    name: 'Minh Lab Owner',
    role: 'lab_owner',
    location: 'Hà Nội',
  });

  const photographer = await db.User.create({
    email: 'photographer@example.com',
    passwordHash: '$2b$12$5KA6w3Q9F3V5PqHDoP6Iw.3PqV94dQ2rL4fJvTwD2qKJY7A4R0eT2',
    name: 'An Photographer',
    role: 'photographer',
    location: 'Hà Nội',
  });

  const admin = await db.User.create({
    email: 'admin@example.com',
    passwordHash: '$2b$12$5KA6w3Q9F3V5PqHDoP6Iw.3PqV94dQ2rL4fJvTwD2qKJY7A4R0eT2',
    name: 'Admin',
    role: 'admin',
    location: 'Vietnam',
  });

  const lab = await db.FilmLab.create({
    ownerId: owner.id,
    name: 'Hanoi Film Lab',
    description: 'Trusted lab for development, scanning, and printing.',
    address: '123 Hoang Hoa Tham',
    city: 'Hà Nội',
    country: 'Vietnam',
    rating: 4.8,
    priceRange: '120k-250k',
    serviceQuality: 'Excellent',
    photoUrl: '/film-camera.jpg',
  });

  await db.LabService.bulkCreate([
    { labId: lab.id, name: 'C41 Development', serviceType: 'Development', price: 120000, durationMinutes: 240, description: 'Standard color development' },
    { labId: lab.id, name: 'Scanning', serviceType: 'Scanning', price: 80000, durationMinutes: 180, description: 'High-resolution scanning' },
    { labId: lab.id, name: 'Printing', serviceType: 'Printing', price: 90000, durationMinutes: 120, description: 'Fine art printing' },
  ]);

  await db.LabPackage.bulkCreate([
    { labId: lab.id, title: 'Scan & Print', description: 'Scanning plus one print', price: 180000 },
    { labId: lab.id, title: 'Full C41 + Scan', description: 'Development and scanning', price: 220000 },
  ]);

  await db.RagDocument.bulkCreate([
    { source: 'knowledge-base', title: 'Choosing film for portraits', content: 'Kodak Portra 400 is a popular choice for portrait photography because it offers soft skin tones and fine grain.', metadata: { topic: 'film stock' } },
    { source: 'knowledge-base', title: 'Scanning tips', content: 'Using a high-resolution scan and careful dust removal produces the best results for analog negatives.', metadata: { topic: 'scanning' } },
  ]);

  await db.Order.create({
    userId: photographer.id,
    labId: lab.id,
    status: 'processing',
    totalPrice: 180000,
    paymentMethod: 'Card',
    trackingCode: 'FL-1001',
  });

  // Add a marketplace product for the uploaded Canon image
  await db.Product.create({
    sellerId: photographer.id,
    title: 'Canon EOS Rebel T5 (EOS 1200D)',
    category: 'Cameras',
    condition: 'Used',
    price: 280.00,
    description: 'A reliable entry-level DSLR, great for film photographers moving into DSLR photography.',
    imageUrl: '/Cameras/Canon%20EOS%20Rebel%20T5%20%28EOS%201200D%29.jpg',
    stock: 1,
  });

  console.log('Seed completed');
  process.exit(0);
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
