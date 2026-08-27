const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { Upload } = require('../models');
const { authenticateToken } = require('../middleware/auth');
const { uploadFileToStorage } = require('../services/storageService');

const uploadDir = path.resolve(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

const upload = multer({ storage });
const router = express.Router();

async function computeImageQuality(filePath) {
  const base = sharp(filePath).resize({ width: 512, height: 512, fit: 'inside' });
  const [{ data: grayData, info: grayInfo }, { data: blurData }, { data: rgbData, info: rgbInfo }] = await Promise.all([
    base.clone().greyscale().raw().toBuffer({ resolveWithObject: true }),
    base.clone().greyscale().blur(1).raw().toBuffer(),
    base.clone().raw().toBuffer({ resolveWithObject: true }),
  ]);

  const width = grayInfo.width;
  const height = grayInfo.height;
  const pixelCount = width * height;

  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < pixelCount; i += 1) {
    const value = grayData[i];
    sum += value;
    sumSq += value * value;
  }
  const mean = sum / pixelCount;
  const variance = sumSq / pixelCount - mean * mean;
  const brightness = mean / 255;
  const contrast = Math.sqrt(Math.max(0, variance)) / 255;

  let lapSum = 0;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const idx = y * width + x;
      const center = grayData[idx];
      const neighbors =
        grayData[idx - width - 1] + grayData[idx - width] + grayData[idx - width + 1] +
        grayData[idx - 1] + grayData[idx + 1] +
        grayData[idx + width - 1] + grayData[idx + width] + grayData[idx + width + 1];
      const lap = Math.abs(center * 8 - neighbors);
      lapSum += lap;
    }
  }
  const sharpness = lapSum / ((width - 2) * (height - 2) * 255);

  let diffSqSum = 0;
  for (let i = 0; i < pixelCount; i += 1) {
    const diff = grayData[i] - blurData[i];
    diffSqSum += diff * diff;
  }
  const noise = Math.sqrt(diffSqSum / pixelCount) / 255;

  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let sumRg = 0;
  let sumYb = 0;
  let sumRgSq = 0;
  let sumYbSq = 0;
  const rgbPixelCount = rgbInfo.width * rgbInfo.height;
  const channels = rgbInfo.channels;
  for (let i = 0; i < rgbPixelCount; i += 1) {
    const r = rgbData[i * channels];
    const g = rgbData[i * channels + 1];
    const b = rgbData[i * channels + 2];
    const rg = r - g;
    const yb = 0.5 * (r + g) - b;
    sumR += r;
    sumG += g;
    sumB += b;
    sumRg += rg;
    sumYb += yb;
    sumRgSq += rg * rg;
    sumYbSq += yb * yb;
  }
  const meanRg = sumRg / rgbPixelCount;
  const meanYb = sumYb / rgbPixelCount;
  const stdRg = Math.sqrt(Math.max(0, sumRgSq / rgbPixelCount - meanRg * meanRg));
  const stdYb = Math.sqrt(Math.max(0, sumYbSq / rgbPixelCount - meanYb * meanYb));
  const colorfulness = Math.sqrt(stdRg * stdRg + stdYb * stdYb) + 0.3 * Math.sqrt(meanRg * meanRg + meanYb * meanYb);

  const quality = {
    brightness,
    contrast,
    sharpness,
    noise,
    colorfulness,
    labels: {
      brightness: brightness < 0.35 ? 'dark' : brightness > 0.65 ? 'bright' : 'balanced',
      contrast: contrast < 0.08 ? 'low' : contrast > 0.18 ? 'high' : 'normal',
      sharpness: sharpness < 0.02 ? 'blurry' : sharpness > 0.08 ? 'sharp' : 'moderate',
      noise: noise > 0.08 ? 'high' : noise > 0.04 ? 'moderate' : 'low',
      colorfulness: colorfulness > 35 ? 'vivid' : colorfulness < 18 ? 'muted' : 'natural',
    },
  };

  return quality;
}

router.post('/', authenticateToken, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Photo file is required' });
    const filePath = path.join(uploadDir, req.file.filename);
    const quality = await computeImageQuality(filePath);
    const storageResult = await uploadFileToStorage(req.file, req.file.originalname);
    const record = await Upload.create({
      userId: req.user.id,
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      url: storageResult.url,
      quality,
      metadata: storageResult,
    });
    res.status(201).json(record);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/', authenticateToken, async (req, res) => {
  try {
    const uploads = await Upload.findAll({ where: { userId: req.user.id }, order: [['createdAt', 'DESC']] });
    res.json(uploads);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const uploadRecord = await Upload.findByPk(req.params.id);
    if (!uploadRecord || uploadRecord.userId !== req.user.id) {
      return res.status(404).json({ error: 'Upload not found' });
    }
    fs.unlinkSync(path.join(uploadDir, uploadRecord.filename));
    await uploadRecord.destroy();
    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id/share', authenticateToken, async (req, res) => {
  try {
    const uploadRecord = await Upload.findByPk(req.params.id);
    if (!uploadRecord || uploadRecord.userId !== req.user.id) {
      return res.status(404).json({ error: 'Upload not found' });
    }
    uploadRecord.shared = !uploadRecord.shared;
    await uploadRecord.save();
    res.json(uploadRecord);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
