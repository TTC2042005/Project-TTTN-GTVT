import fs from 'fs';
import path from 'path';

const cameraPrices = {
  'Canon EOS Rebel T5 (EOS 1200D)': 280,
  'Canon EOS Rebel T6 (1300D)': 350,
  'Canon PowerShot SX620 HS': 180,
  'Nikon Coolpix B500': 220,
  'Nikon COOLPIX P610': 260,
};

export default function handler(req, res) {
  try {
    const camerasDir = path.join(process.cwd(), 'public', 'Cameras');
    if (!fs.existsSync(camerasDir)) return res.status(200).json([]);
    const files = fs.readdirSync(camerasDir).filter((f) => /\.(jpg|jpeg|png|webp|gif)$/i.test(f));
    const items = files.map((file) => ({
      id: `static-${file}`,
      title: path.parse(file).name,
      category: 'Cameras',
      condition: 'Used',
      price: cameraPrices[path.parse(file).name] || 0,
      description: '',
      imageUrl: `/Cameras/${encodeURIComponent(file)}`,
      stock: 1,
    }));
    res.status(200).json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
