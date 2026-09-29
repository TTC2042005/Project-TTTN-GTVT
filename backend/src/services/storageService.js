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
  const safeName = path.basename(originalName);

  if (!s3) {
    const destPath = path.join(uploadDir, safeName);
    if (path.resolve(file.path) !== destPath) fs.copyFileSync(file.path, destPath);
    return {
      provider: 'local',
      url: null,
      key: safeName,
      bucket: null,
    };
  }

  const uploadResult = await s3.upload({
    Bucket: process.env.AWS_S3_BUCKET,
    Key: `${Date.now()}-${safeName}`,
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

async function storeBufferToStorage(buffer, filename, contentType) {
  const safeName = path.basename(filename);
  if (!s3) {
    await fs.promises.writeFile(path.join(uploadDir, safeName), buffer);
    return { provider: 'local', url: null, key: safeName, bucket: null };
  }

  const key = `${Date.now()}-${safeName}`;
  await s3.upload({
    Bucket: process.env.AWS_S3_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }).promise();
  return { provider: 's3', url: null, key, bucket: process.env.AWS_S3_BUCKET };
}

async function getStoredFileBuffer(metadata, filename) {
  if (metadata?.provider === 's3' && s3 && metadata.key) {
    const result = await s3.getObject({
      Bucket: metadata.bucket || process.env.AWS_S3_BUCKET,
      Key: metadata.key,
    }).promise();
    return result.Body;
  }
  return fs.promises.readFile(path.join(uploadDir, path.basename(filename)));
}

function getSignedReadUrl(key) {
  if (!s3) return null;
  return s3.getSignedUrl('getObject', {
    Bucket: process.env.AWS_S3_BUCKET,
    Key: key,
    Expires: 300,
  });
}

async function deleteStoredFile(metadata, filename) {
  if (metadata?.provider === 's3' && s3 && metadata.key) {
    await s3.deleteObject({ Bucket: metadata.bucket || process.env.AWS_S3_BUCKET, Key: metadata.key }).promise();
    return;
  }
  const localPath = path.join(uploadDir, path.basename(filename));
  if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
}

module.exports = { uploadFileToStorage, storeBufferToStorage, getStoredFileBuffer, getSignedReadUrl, deleteStoredFile };