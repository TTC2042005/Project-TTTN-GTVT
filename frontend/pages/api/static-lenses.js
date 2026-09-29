import fs from 'fs';
import path from 'path';

const lensPrices = {
  'FE 100 mm F2.8 Macro GM OSS': 999,
  'FE 400–800 mm F6.3–8 G OSS': 2399,
  'FE 50-150 mm F2 GM': 1599,
  'Ống kính FE 100-400 mm F4.5 GM OSS': 2499,
  'Ống kính FE 100-400 mm F5.6-8 OSS': 1299,
};

export default function handler(req, res) {
  try {
    const lensesDir = path.join(process.cwd(), 'public', 'Lenses');
    if (!fs.existsSync(lensesDir)) return res.status(200).json([]);

    const files = fs.readdirSync(lensesDir)
      .filter((file) => /\.(avif|jpg|jpeg|png|webp|gif)$/i.test(file));
    const items = files.map((file) => {
      const title = path.parse(file).name;
      return {
        id: `static-lens-${file}`,
        seller: null,
        title,
        category: 'Lenses',
        condition: 'New',
        price: lensPrices[title] || 0,
        description: 'Sony lens for creative photography and video work.',
        imageUrl: `/Lenses/${encodeURIComponent(file)}`,
        stock: 1,
      };
    });

    res.status(200).json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
