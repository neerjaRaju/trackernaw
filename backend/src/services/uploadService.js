/**
 * S3 presigned PUT URL generator.
 *
 * Flow:
 *   1. Client calls POST /uploads/presign with { kind, contentType, filename? }
 *   2. Backend returns { url, key, publicUrl } — client PUTs the bytes directly to S3
 *   3. Client then references publicUrl in /attendance/checkin, /expenses, etc.
 *
 * Bytes never traverse the API server — this scales to any object size and any
 * concurrency without saturating Node's event loop.
 *
 * Dev stub: if AWS creds are not set, returns a local-style URL pointing at a
 * /uploads/dev/* endpoint. Useful for local dev without S3.
 */
const crypto = require('crypto');
const logger = require('../utils/logger');

let s3Client = null;
function getClient() {
  if (s3Client) return s3Client;
  if (!process.env.AWS_ACCESS_KEY_ID) return null;
  try {
    const { S3Client } = require('@aws-sdk/client-s3');
    s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
    return s3Client;
  } catch (e) {
    logger.warn('AWS S3 SDK not available — uploads will use local dev stub');
    return null;
  }
}

const KIND_PREFIXES = {
  selfie:    'attendance/selfies',
  face:      'enrollment/face',
  receipt:   'expenses/receipts',
  sos_audio: 'sos/audio',
  chat:      'chat/attachments',
  task_proof:'tasks/proof',
  visit:     'visits/photos',
};

/**
 * @returns {Promise<{url, key, publicUrl, mode}>}
 */
async function presignUpload({ companyId, userId, kind, contentType = 'application/octet-stream', filename }) {
  const prefix = KIND_PREFIXES[kind] || 'misc';
  const ext = filename?.includes('.') ? filename.split('.').pop().toLowerCase() : '';
  const safeExt = ext && /^[a-z0-9]{1,8}$/.test(ext) ? `.${ext}` : '';
  const rand = crypto.randomBytes(8).toString('hex');
  const key = `${companyId}/${prefix}/${userId}/${Date.now()}-${rand}${safeExt}`;

  const client = getClient();
  if (!client) {
    if (process.env.NODE_ENV === 'production') {
      const err = new Error('S3 upload is required but AWS is not configured');
      err.status = 503;
      err.code = 'UPLOAD_SERVICE_UNAVAILABLE';
      throw err;
    }
    logger.warn('uploadService: AWS S3 not configured — DEV-ONLY local stub');
    // Dev stub — caller should POST the bytes to this URL on the API itself
    return {
      url: `${process.env.PUBLIC_BASE || ''}/api/v1/uploads/dev/${encodeURIComponent(key)}`,
      key,
      publicUrl: `${process.env.PUBLIC_BASE || ''}/uploads-dev/${key}`,
      mode: 'stub',
    };
  }

  const { PutObjectCommand } = require('@aws-sdk/client-s3');
  const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
  const bucket = process.env.S3_BUCKET || 'fieldforce-uploads';
  const cmd = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
    ServerSideEncryption: 'AES256',
  });
  const url = await getSignedUrl(client, cmd, { expiresIn: 300 }); // 5 min
  const publicUrl = `https://${bucket}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;
  return { url, key, publicUrl, mode: 'live' };
}

/**
 * Generate a presigned GET URL for reading a private object (e.g. server-side
 * face comparison, OCR job). Default expiry 1 hour.
 */
async function presignDownload(key, expiresIn = 3600) {
  const client = getClient();
  if (!client) return `${process.env.PUBLIC_BASE || ''}/uploads-dev/${key}`;
  const { GetObjectCommand } = require('@aws-sdk/client-s3');
  const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
  const cmd = new GetObjectCommand({
    Bucket: process.env.S3_BUCKET || 'fieldforce-uploads',
    Key: key,
  });
  return getSignedUrl(client, cmd, { expiresIn });
}

module.exports = { presignUpload, presignDownload, KIND_PREFIXES };
