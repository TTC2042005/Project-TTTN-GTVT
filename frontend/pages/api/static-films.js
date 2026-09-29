import fs from 'fs';
import path from 'path';

const ticketPrice = 10;

export default function handler(req, res) {
  try {
    const publicDir = path.join(process.cwd(), 'public');
    const filmsDir = fs.existsSync(path.join(publicDir, 'Film'))
      ? path.join(publicDir, 'Film')
      : path.join(publicDir, 'Flim');
    if (!fs.existsSync(filmsDir)) return res.status(200).json([]);

    const files = fs.readdirSync(filmsDir)
      .filter((file) => /\.(avif|jpg|jpeg|png|webp|gif)$/i.test(file));
    const items = files.map((file) => ({
      id: `static-film-${file}`,
      seller: null,
      title: path.parse(file).name,
      category: 'Film',
      condition: 'Available',
      price: ticketPrice,
      description: 'Movie ticket for a classic film screening.',
      imageUrl: `/Flim/${encodeURIComponent(file)}`,
      stock: 1,
    }));

    res.status(200).json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
