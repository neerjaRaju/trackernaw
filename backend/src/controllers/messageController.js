const prisma = require('../utils/prisma');
const { emitToUser } = require('../sockets');

// List conversations for the current user — one row per peer with last message + unread count
exports.conversations = async (req, res, next) => {
  try {
    const me = req.user.sub;
    const rows = await prisma.$queryRaw`
      WITH paired AS (
        SELECT
          CASE WHEN "senderId" = ${me} THEN "recipientId" ELSE "senderId" END AS peer_id,
          id, body, "createdAt", "readAt", "senderId"
        FROM "Message"
        WHERE "companyId" = ${req.user.companyId}
          AND (${me} IN ("senderId", "recipientId"))
      ),
      ranked AS (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY peer_id ORDER BY "createdAt" DESC) AS rn
        FROM paired
      )
      SELECT
        r.peer_id,
        r.body         AS last_body,
        r."createdAt"  AS last_at,
        u."fullName"   AS peer_name,
        u."avatarUrl"  AS peer_avatar,
        (SELECT COUNT(*)::int FROM "Message" m
           WHERE m."recipientId" = ${me}
             AND m."senderId" = r.peer_id
             AND m."readAt" IS NULL) AS unread
      FROM ranked r
      JOIN "User" u ON u.id = r.peer_id
      WHERE r.rn = 1
      ORDER BY r."createdAt" DESC`;
    res.json(rows);
  } catch (e) { next(e); }
};

// Full message history with one peer (most recent first, paginated)
exports.history = async (req, res, next) => {
  try {
    const me = req.user.sub;
    const peer = req.params.peerId;
    const take = Math.min(Number(req.query.take) || 50, 200);
    const before = req.query.before ? new Date(req.query.before) : new Date();

    const msgs = await prisma.message.findMany({
      where: {
        companyId: req.user.companyId,
        OR: [
          { senderId: me, recipientId: peer },
          { senderId: peer, recipientId: me },
        ],
        createdAt: { lt: before },
      },
      orderBy: { createdAt: 'desc' },
      take,
    });

    // Mark inbound messages as read
    await prisma.message.updateMany({
      where: { senderId: peer, recipientId: me, readAt: null },
      data:  { readAt: new Date() },
    });

    res.json(msgs.reverse());
  } catch (e) { next(e); }
};

// Send a message — body: { recipientId, body }
exports.send = async (req, res, next) => {
  try {
    const { recipientId, body } = req.body;
    if (!recipientId || !body || !body.trim()) {
      return res.status(400).json({ error: 'recipientId and body required' });
    }
    // Verify recipient is in the same company (tenant isolation)
    const peer = await prisma.user.findFirst({
      where: { id: recipientId, companyId: req.user.companyId, isActive: true },
      select: { id: true },
    });
    if (!peer) return res.status(404).json({ error: 'Recipient not found in this company' });

    const msg = await prisma.message.create({
      data: {
        companyId: req.user.companyId,
        senderId: req.user.sub,
        recipientId,
        body: body.trim(),
      },
    });

    // Push to recipient in real time
    emitToUser(recipientId, 'chat:new', msg);
    // Echo to sender's other devices so all of their sessions stay in sync
    emitToUser(req.user.sub, 'chat:sent', msg);

    res.status(201).json(msg);
  } catch (e) { next(e); }
};

exports.markRead = async (req, res, next) => {
  try {
    await prisma.message.updateMany({
      where: { senderId: req.params.peerId, recipientId: req.user.sub, readAt: null },
      data:  { readAt: new Date() },
    });
    res.json({ ok: true });
  } catch (e) { next(e); }
};
