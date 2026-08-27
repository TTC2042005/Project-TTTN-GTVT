const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');

let s3 = null;
if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.AWS_S3_BUCKET) {
  s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION || 'us-east-1',
  });
}

const uploadDir = path.resolve(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

async function uploadFileToStorage(file, originalName) {
  const destPath = path.join(uploadDir, originalName);
  fs.copyFileSync(file.path, destPath);

  if (!s3) {
    return {
      provider: 'local',
      url: `/uploads/${originalName}`,
      key: originalName,
      bucket: null,
    };
  }

  const uploadResult = await s3.upload({
    Bucket: process.env.AWS_S3_BUCKET,
    Key: `${Date.now()}-${originalName}`,
    Body: fs.createReadStream(file.path),
    ContentType: file.mimetype,
  }).promise();

  return {
    provider: 's3',
    url: uploadResult.Location,
    key: uploadResult.Key,
    bucket: process.env.AWS_S3_BUCKET,
  };
}

module.exports = { uploadFileToStorage };