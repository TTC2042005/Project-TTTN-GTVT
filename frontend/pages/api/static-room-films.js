import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
  try {
    const roomFilmsDir = path.join(process.cwd(), 'public', 'Room-Flim');
    if (!fs.existsSync(roomFilmsDir)) return res.status(200).json([]);

    const files = fs.readdirSync(roomFilmsDir)
      .filter((file) => /\.(avif|jpg|jpeg|png|webp|gif)$/i.test(file));

    const items = files.map((file) => ({
      id: `room-film-${file}`,
      title: path.parse(file).name.replace(/^[0-9]+_/, '').replace(/_/g, ' '),
      imageUrl: `/Room-Flim/${encodeURIComponent(file)}`,
    }));

    res.status(200).json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
