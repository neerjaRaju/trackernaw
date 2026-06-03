/**
 * Outbound webhook delivery.
 *
 * Usage from anywhere in the codebase:
 *   webhookService.emit(companyId, 'sos.triggered', { ... }).catch(() => {});
 *
 * Each matching active webhook gets:
 *   - POST <url> with JSON body
 *   - Headers:
 *       X-FieldForce-Event: <event>
 *       X-FieldForce-Delivery: <delivery-id>
 *       X-FieldForce-Signature: sha256=<HMAC over body using webhook.secret>
 *   - 8-second timeout, up to 3 attempts with exponential backoff
 *
 * Every attempt is persisted to WebhookDelivery for the admin to inspect.
 */
const crypto = require('crypto');
const prisma = require('../utils/prisma');
const logger = require('../utils/logger');

async function emit(companyId, event, payload) {
  const hooks = await prisma.webhook.findMany({
    where: { companyId, isActive: true, events: { has: event } },
  });
  if (!hooks.length) return;

  await Promise.all(hooks.map((h) => deliver(h, event, payload).catch((e) => {
    logger.warn(`webhook ${h.id} delivery threw: ${e.message}`);
  })));
}

async function deliver(hook, event, payload) {
  const body = JSON.stringify({
    event,
    deliveredAt: new Date().toISOString(),
    data: payload,
  });
  const signature = 'sha256=' + crypto
    .createHmac('sha256', hook.secret)
    .update(body)
    .digest('hex');

  let lastErr = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const delivery = await prisma.webhookDelivery.create({
      data: { webhookId: hook.id, event, payload, status: null },
    });
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(hook.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-fieldforce-event': event,
          'x-fieldforce-delivery': delivery.id,
          'x-fieldforce-signature': signature,
        },
        body,
        signal: controller.signal,
      });
      clearTimeout(t);
      const text = (await res.text()).slice(0, 1024);
      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: { status: res.status, response: text },
      });
      if (res.ok) {
        await prisma.webhook.update({
          where: { id: hook.id },
          data: { lastDeliveryAt: new Date(), failureCount: 0 },
        });
        return;
      }
      lastErr = `HTTP ${res.status}`;
    } catch (e) {
      lastErr = e.message;
      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: { status: null, response: e.message.slice(0, 1024) },
      });
    }
    // Backoff: 1s, 4s
    if (attempt < 3) await new Promise((r) => setTimeout(r, attempt * attempt * 1000));
  }
  await prisma.webhook.update({
    where: { id: hook.id },
    data: { failureCount: { increment: 1 } },
  });
  // Auto-disable after 10 consecutive failures
  const updated = await prisma.webhook.findUnique({ where: { id: hook.id }, select: { failureCount: true } });
  if (updated && updated.failureCount >= 10) {
    await prisma.webhook.update({ where: { id: hook.id }, data: { isActive: false } });
    logger.warn(`Auto-disabled webhook ${hook.id} after 10 failures (${lastErr})`);
  }
}

module.exports = { emit };
