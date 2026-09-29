const fs = require('fs/promises');
const path = require('path');

const cameraPrices = {
  'Canon EOS Rebel T5 (EOS 1200D)': 280,
  'Canon EOS Rebel T6 (1300D)': 350,
  'Canon PowerShot SX620 HS': 180,
  'Nikon Coolpix B500': 220,
  'Nikon COOLPIX P610': 260,
};
const lensPrices = {
  'FE 100 mm F2.8 Macro GM OSS': 999,
  'FE 400–800 mm F6.3–8 G OSS': 2399,
  'FE 50-150 mm F2 GM': 1599,
  'Ống kính FE 100-400 mm F4.5 GM OSS': 2499,
  'Ống kính FE 100-400 mm F5.6-8 OSS': 1299,
};
const classicFilmTitles = [
  '12 người đàn ông giận dữ – 12 angry men (1975)',
  'Bố già 2 – The godfather (1974)',
  'Bố già – The godfather (1972)',
  'Kỵ sĩ bóng đêm – The dark knight (2008)',
  'Nhà tù Shawshank – The shawshank redemption (1994)',
];

async function readStaticItems(directoryName, category, prices = {}, defaultPrice = 0, description = '', fallbackTitles = []) {
  const candidates = category === 'Film' ? ['Film', 'Flim'] : [directoryName];
  for (const candidate of candidates) {
    const directory = path.resolve(__dirname, '..', '..', '..', 'frontend', 'public', candidate);
    try {
      const files = await fs.readdir(directory);
      const items = files
        .filter((file) => /\.(avif|jpg|jpeg|png|webp|gif)$/i.test(file))
        .map((file) => {
          const title = path.parse(file).name;
          return {
            id: `static-${category.toLowerCase()}-${file}`,
            title,
            category,
            condition: category === 'Film' ? 'Available' : 'New',
            price: prices[title] ?? defaultPrice,
            currency: 'USD',
            description,
            imageUrl: `/${candidate}/${encodeURIComponent(file)}`,
            stock: 1,
          };
        });
      if (items.length) return items;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  return fallbackTitles.map((title) => ({
    id: `static-${category.toLowerCase()}-${title}`,
    title,
    category,
    condition: category === 'Film' ? 'Available' : 'New',
    price: prices[title] ?? defaultPrice,
    currency: 'USD',
    description,
    imageUrl: null,
    stock: 1,
  }));
}

async function getStaticCameraCatalog() {
  const camerasDir = path.resolve(__dirname, '..', '..', '..', 'frontend', 'public', 'Cameras');
  try {
    const files = await fs.readdir(camerasDir);
    const catalog = files
      .filter((file) => /\.(jpg|jpeg|png|webp|gif)$/i.test(file))
      .map((file) => {
        const title = path.parse(file).name;
        return {
          id: `static-${file}`,
          seller: null,
          title,
          category: 'Cameras',
          condition: 'Used',
          price: cameraPrices[title] || 0,
          description: '',
          imageUrl: `/Cameras/${encodeURIComponent(file)}`,
          stock: 1,
        };
      });
    if (catalog.length) return catalog;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  // The backend container is built with backend/ as its context, so frontend public assets aren't mounted there.
  return Object.entries(cameraPrices).map(([title, price]) => ({
    id: `static-${title}`,
    seller: null,
    title,
    category: 'Cameras',
    condition: 'Used',
    price,
    description: '',
    imageUrl: `/Cameras/${encodeURIComponent(`${title}.jpg`)}`,
    stock: 1,
  }));
}

async function getStaticMarketplaceCatalog() {
  const [cameras, lenses, films] = await Promise.all([
    getStaticCameraCatalog(),
    readStaticItems('Lenses', 'Lenses', lensPrices, 0, 'Lens from the website catalog.', Object.keys(lensPrices)),
    readStaticItems('Flim', 'Film', {}, 10, 'Movie ticket from the classic film catalog.', classicFilmTitles),
  ]);
  return [...cameras, ...lenses, ...films];
}

module.exports = { cameraPrices, lensPrices, getStaticCameraCatalog, getStaticMarketplaceCatalog };