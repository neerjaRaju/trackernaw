/**
 * Face verification service.
 *
 * Production path: AWS Rekognition CompareFaces — pass the enrolled reference image
 * (stored in S3) and the just-captured selfie. If similarity ≥ threshold, accept.
 *
 * Dev / stub path: if AWS creds are not configured, returns { verified: true } so
 * the rest of the flow can be exercised locally. Real verification kicks in once
 * AWS_REGION + AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY are set.
 */
const logger = require('../utils/logger');

let rekognitionClient = null;
function getClient() {
  if (rekognitionClient) return rekognitionClient;
  if (!process.env.AWS_ACCESS_KEY_ID) return null;
  try {
    const { RekognitionClient } = require('@aws-sdk/client-rekognition');
    rekognitionClient = new RekognitionClient({ region: process.env.AWS_REGION || 'us-east-1' });
    return rekognitionClient;
  } catch (e) {
    logger.warn('AWS Rekognition SDK not installed — face verification will stub. Run: npm install @aws-sdk/client-rekognition');
    return null;
  }
}

/**
 * @param {Buffer|string} enrolled  - reference image (Buffer) or S3 URL
 * @param {Buffer|string} candidate - just-captured selfie (Buffer) or S3 URL
 * @returns {Promise<{ verified: boolean, similarity: number|null, mode: 'stub'|'live' }>}
 */
async function compareFaces(enrolled, candidate, threshold = 90) {
  const client = getClient();
  if (!client) {
    // Hard refusal in production — we will NOT silently pretend verification passed.
    if (process.env.NODE_ENV === 'production') {
      const err = new Error('Face verification is required but AWS Rekognition is not configured');
      err.status = 503;
      err.code = 'FACE_SERVICE_UNAVAILABLE';
      throw err;
    }
    logger.warn('faceService: AWS Rekognition not configured — DEV-ONLY stub returning verified=true');
    return { verified: true, similarity: null, mode: 'stub' };
  }
  try {
    const { CompareFacesCommand } = require('@aws-sdk/client-rekognition');
    const cmd = new CompareFacesCommand({
      SimilarityThreshold: threshold,
      SourceImage: toImageInput(enrolled),
      TargetImage: toImageInput(candidate),
    });
    const res = await client.send(cmd);
    const match = res.FaceMatches?.[0];
    return {
      verified: !!match,
      similarity: match?.Similarity ?? null,
      mode: 'live',
    };
  } catch (e) {
    logger.error('faceService.compareFaces failed', e);
    return { verified: false, similarity: null, mode: 'live', error: e.message };
  }
}

function toImageInput(src) {
  if (Buffer.isBuffer(src)) return { Bytes: src };
  if (typeof src === 'string' && src.startsWith('s3://')) {
    const [, bucket, ...rest] = src.replace('s3://', '').split('/');
    return { S3Object: { Bucket: bucket, Name: rest.join('/') } };
  }
  // Plain string treated as S3 key in default bucket
  return { S3Object: { Bucket: process.env.S3_BUCKET, Name: src } };
}

module.exports = { compareFaces };
