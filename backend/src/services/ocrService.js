/**
 * Receipt OCR via AWS Textract AnalyzeExpense.
 *
 * Returns normalized fields the expense form can prefill:
 *   { vendor, total, currency, date, raw }
 *
 * Dev stub: when AWS creds are missing, returns null so the UI keeps working
 * with the user's manual entry.
 */
const logger = require('../utils/logger');

let client = null;
function getClient() {
  if (client) return client;
  if (!process.env.AWS_ACCESS_KEY_ID) return null;
  try {
    const { TextractClient } = require('@aws-sdk/client-textract');
    client = new TextractClient({ region: process.env.AWS_REGION || 'us-east-1' });
    return client;
  } catch (e) {
    logger.warn('AWS Textract SDK not installed — OCR disabled');
    return null;
  }
}

/**
 * @param {string} s3Key  - object key in S3_BUCKET
 * @returns {Promise<null|{vendor,total,currency,date,raw}>}
 */
async function analyzeReceipt(s3Key) {
  const c = getClient();
  if (!c) {
    if (process.env.NODE_ENV === 'production') {
      const err = new Error('Receipt OCR is required but AWS Textract is not configured');
      err.status = 503;
      err.code = 'OCR_SERVICE_UNAVAILABLE';
      throw err;
    }
    logger.warn('ocrService: AWS Textract not configured — DEV-ONLY stub returning null');
    return null;
  }
  try {
    const { AnalyzeExpenseCommand } = require('@aws-sdk/client-textract');
    const cmd = new AnalyzeExpenseCommand({
      Document: {
        S3Object: { Bucket: process.env.S3_BUCKET || 'fieldforce-uploads', Name: s3Key },
      },
    });
    const res = await c.send(cmd);
    const fields = {};
    for (const doc of res.ExpenseDocuments || []) {
      for (const sf of doc.SummaryFields || []) {
        const type = sf.Type?.Text;
        const value = sf.ValueDetection?.Text;
        if (type && value && !fields[type]) fields[type] = value;
      }
    }
    return {
      vendor:   fields.VENDOR_NAME || fields.RECEIVER_NAME || null,
      total:    parseAmount(fields.TOTAL || fields.AMOUNT_DUE),
      currency: fields.CURRENCY || null,
      date:     fields.INVOICE_RECEIPT_DATE || null,
      raw:      fields,
    };
  } catch (e) {
    logger.error('Textract analyzeReceipt failed', e);
    return null;
  }
}

function parseAmount(s) {
  if (!s) return null;
  const m = String(s).replace(/[, ]/g, '').match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}

module.exports = { analyzeReceipt };
