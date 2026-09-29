const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const sharp = require('sharp');
const { OpenAI } = require('openai');
const { Upload } = require('../models');
const { authenticateToken } = require('../middleware/auth');
const { uploadFileToStorage, storeBufferToStorage, getStoredFileBuffer, getSignedReadUrl, deleteStoredFile } = require('../services/storageService');

const uploadDir = path.resolve(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
});

const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/tiff', 'image/avif']);
const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!allowedImageTypes.has(file.mimetype)) return cb(new Error('Unsupported image type'));
    cb(null, true);
  },
});
const router = express.Router();
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

async function computeImageQuality(filePathOrBuffer) {
  const base = sharp(filePathOrBuffer, { limitInputPixels: 40_000_000 }).rotate().resize({ width: 512, height: 512, fit: 'inside' });
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

function buildLocalImageFeedback(subjectType, quality) {
  const focus = subjectType === 'product'
    ? 'Ảnh sản phẩm'
    : 'Ảnh scan phim';
  const suggestions = [];
  if (quality.labels.brightness === 'dark') suggestions.push('ảnh khá tối; thử tăng sáng nhẹ hoặc kiểm tra exposure của scan');
  if (quality.labels.brightness === 'bright') suggestions.push('ảnh sáng mạnh; kiểm tra vùng highlight có bị mất chi tiết không');
  if (quality.labels.sharpness === 'blurry') suggestions.push('độ nét thấp; kiểm tra lấy nét, rung máy hoặc độ phân giải file scan');
  if (quality.labels.noise === 'high') suggestions.push('nhiễu hạt/ảnh số cao; cân nhắc scan ở độ phân giải phù hợp và giảm noise vừa phải');
  if (quality.labels.contrast === 'low') suggestions.push('tương phản thấp; có thể cân chỉnh black/white point nhẹ');
  if (quality.labels.colorfulness === 'muted' && subjectType === 'film') suggestions.push('màu khá dịu; đây không nhất thiết là lỗi vì màu còn phụ thuộc film stock và ý đồ chụp');
  if (subjectType === 'product') suggestions.push('để bán hàng, chụp thêm ảnh tổng thể và chi tiết trong ánh sáng đều, nền gọn');
  if (!suggestions.length) suggestions.push('các chỉ số cơ bản đang cân bằng; đây là phân tích heuristic, không thay thế đánh giá màu phim hoặc thẩm mỹ chuyên môn');
  return `${focus}: ${suggestions.join('. ')}.`;
}

router.post('/', authenticateToken, (req, res, next) => {
  upload.single('photo')(req, res, (error) => {
    if (error) {
      const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 415;
      return res.status(status).json({ error: status === 413 ? 'Image exceeds the 15 MB limit' : 'Unsupported image upload' });
    }
    next();
  });
}, async (req, res) => {
  let filePath;
  try {
    if (!req.file) return res.status(400).json({ error: 'Photo file is required' });
    filePath = path.join(uploadDir, path.basename(req.file.filename));
    let quality;
    try {
      quality = await computeImageQuality(filePath);
    } catch (error) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return res.status(422).json({ error: 'Image could not be decoded or processed' });
    }
    const storageResult = await uploadFileToStorage(req.file, req.file.filename);
    const uploadId = crypto.randomUUID();
    const record = await Upload.create({
      id: uploadId,
      userId: req.user.id,
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      url: `/api/uploads/${uploadId}/file`,
      quality,
      metadata: storageResult,
    });
    if (storageResult.provider === 's3' && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.status(201).json(record);
  } catch (error) {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.status(503).json({ error: 'Image storage is unavailable' });
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

router.post('/:id/review', authenticateToken, async (req, res) => {
  try {
    const { question = '', subjectType = 'film', allowExternalAi = false } = req.body || {};
    if (!['film', 'product'].includes(subjectType)) return res.status(400).json({ error: 'subjectType must be film or product' });
    if (typeof question !== 'string' || question.length > 500) return res.status(400).json({ error: 'Question must be 500 characters or fewer' });

    const record = await Upload.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!record) return res.status(404).json({ error: 'Upload not found' });
    const localFeedback = buildLocalImageFeedback(subjectType, record.quality || {
      labels: { brightness: 'balanced', sharpness: 'moderate', noise: 'low', contrast: 'normal', colorfulness: 'natural' },
    });
    const canUseVision = Boolean(openai && allowExternalAi);
    if (!canUseVision) {
      return res.json({
        source: 'image-quality-heuristics',
        subjectType,
        answer: `${localFeedback}${openai ? ' Bạn có thể bật đồng ý gửi ảnh đã nén tới AI để nhận nhận xét nội dung trực quan.' : ' Nhận xét theo chỉ số ảnh; cần cấu hình OPENAI_API_KEY và đồng ý chia sẻ ảnh để nhận phân tích nội dung bằng AI.'}`,
        quality: record.quality,
        fallback: true,
      });
    }

    const originalBuffer = await getStoredFileBuffer(record.metadata, record.filename);
    const previewBuffer = await sharp(originalBuffer, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 78, mozjpeg: true })
      .toBuffer();
    const dataUrl = `data:image/jpeg;base64,${previewBuffer.toString('base64')}`;
    const context = subjectType === 'film'
      ? 'Đây là ảnh scan/phim analog. Nhận xét thận trọng về phơi sáng, màu, tương phản, độ nét và bụi/xước nếu nhìn thấy. Không đoán chắc film stock, máy ảnh, lab hay thông số chụp chỉ từ ảnh.'
      : 'Đây là ảnh sản phẩm đăng bán. Nhận xét khả năng nhìn rõ sản phẩm, ánh sáng, nền, bố cục và các góc chụp còn thiếu. Không kết luận tình trạng thật của sản phẩm từ ảnh đơn lẻ.';
    const prompt = `${context} ${question.trim() ? `Yêu cầu người dùng: ${question.trim()}.` : ''} Trả lời bằng tiếng Việt, ngắn gọn, nêu 2-4 gợi ý thực tế. Không khẳng định thay cho chuyên gia.`;
    try {
      const completion = await openai.responses.create({
        model: 'gpt-4.1-mini',
        input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }, { type: 'input_image', image_url: dataUrl }] }],
        max_output_tokens: 350,
      });
      const answer = completion.output_text || completion.output?.flatMap((entry) => entry.content || []).find((item) => item.type === 'output_text')?.text;
      return res.json({
        source: 'openai-vision',
        subjectType,
        answer: answer || localFeedback,
        quality: record.quality,
        fallback: !answer,
        imageSentToProvider: true,
      });
    } catch (error) {
      console.error('Image review provider failed:', error);
      return res.json({ source: 'image-quality-heuristics', subjectType, answer: localFeedback, quality: record.quality, fallback: true });
    }
  } catch (error) {
    console.error('Image review failed:', error);
    return res.status(503).json({ error: 'Unable to review this image right now' });
  }
});

router.post('/:id/edit', authenticateToken, async (req, res) => {
  let storedMetadata;
  let editedFilename;
  try {
    const { preset } = req.body || {};
    const presets = new Set(['auto', 'brighten', 'contrast', 'black-white', 'warm', 'cool']);
    if (!presets.has(preset)) return res.status(400).json({ error: 'Unsupported edit preset' });

    const source = await Upload.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!source) return res.status(404).json({ error: 'Upload not found' });
    const inputBuffer = await getStoredFileBuffer(source.metadata, source.filename);
    let pipeline = sharp(inputBuffer, { limitInputPixels: 40_000_000 }).rotate();
    if (preset === 'auto') pipeline = pipeline.normalize().modulate({ saturation: 1.04 }).sharpen();
    if (preset === 'brighten') pipeline = pipeline.modulate({ brightness: 1.12 });
    if (preset === 'contrast') pipeline = pipeline.linear(1.12, -10).sharpen();
    if (preset === 'black-white') pipeline = pipeline.greyscale();
    if (preset === 'warm') pipeline = pipeline.modulate({ brightness: 1.03, saturation: 1.04, hue: 8 });
    if (preset === 'cool') pipeline = pipeline.modulate({ brightness: 1.02, saturation: 0.96, hue: -8 });
    const editedBuffer = await pipeline.jpeg({ quality: 90, mozjpeg: true }).toBuffer();
    const editedQuality = await computeImageQuality(editedBuffer);
    const editId = crypto.randomUUID();
    editedFilename = `${editId}.jpg`;
    storedMetadata = await storeBufferToStorage(editedBuffer, editedFilename, 'image/jpeg');
    const editedRecord = await Upload.create({
      id: editId,
      userId: req.user.id,
      filename: editedFilename,
      originalName: `${path.parse(source.originalName).name}-${preset}.jpg`,
      mimeType: 'image/jpeg',
      size: editedBuffer.length,
      url: `/api/uploads/${editId}/file`,
      quality: editedQuality,
      metadata: { ...storedMetadata, derivedFrom: source.id, editPreset: preset },
      shared: false,
    });
    return res.status(201).json({ ...editedRecord.toJSON(), editPreset: preset, derivedFrom: source.id });
  } catch (error) {
    if (storedMetadata && editedFilename) {
      try { await deleteStoredFile(storedMetadata, editedFilename); } catch (cleanupError) { console.error('Edited image cleanup failed:', cleanupError); }
    }
    console.error('Image edit failed:', error);
    return res.status(422).json({ error: 'Unable to apply this image edit' });
  }
});

router.get('/:id/file', authenticateToken, async (req, res) => {
  try {
    const record = await Upload.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!record) return res.status(404).json({ error: 'Upload not found' });
    if (record.metadata?.provider === 's3') {
      const signedUrl = getSignedReadUrl(record.metadata.key);
      if (!signedUrl) return res.status(503).json({ error: 'Private storage is unavailable' });
      return res.redirect(302, signedUrl);
    }
    const filePath = path.join(uploadDir, path.basename(record.filename));
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Upload file not found' });
    return res.sendFile(filePath);
  } catch (error) {
    return res.status(500).json({ error: 'Unable to retrieve upload' });
  }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const uploadRecord = await Upload.findByPk(req.params.id);
    if (!uploadRecord || uploadRecord.userId !== req.user.id) {
      return res.status(404).json({ error: 'Upload not found' });
    }
    await deleteStoredFile(uploadRecord.metadata, uploadRecord.filename);
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
