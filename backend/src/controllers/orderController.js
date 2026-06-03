const prisma = require('../utils/prisma');

exports.list = async (req, res, next) => {
  try {
    const where = { companyId: req.user.companyId };
    if (req.user.role === 'EMPLOYEE') where.userId = req.user.sub;
    const orders = await prisma.order.findMany({
      where,
      include: { items: { include: { product: true } }, dealer: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(orders);
  } catch (e) { next(e); }
};

exports.create = async (req, res, next) => {
  try {
    const { dealerId, items, notes } = req.body;
    if (!items || !items.length) return res.status(400).json({ error: 'items required' });

    const products = await prisma.product.findMany({
      where: { id: { in: items.map((i) => i.productId) }, companyId: req.user.companyId },
    });
    const priceMap = Object.fromEntries(products.map((p) => [p.id, Number(p.price)]));

    let total = 0;
    const lineItems = items.map((i) => {
      const price = priceMap[i.productId] || 0;
      const subtotal = price * i.quantity;
      total += subtotal;
      return { productId: i.productId, quantity: i.quantity, price, subtotal };
    });

    const order = await prisma.order.create({
      data: {
        companyId: req.user.companyId,
        userId: req.user.sub,
        dealerId,
        orderNumber: `ORD-${Date.now().toString(36).toUpperCase()}`,
        total,
        notes,
        status: 'CONFIRMED',
        items: { create: lineItems },
      },
      include: { items: true },
    });
    res.status(201).json(order);
  } catch (e) { next(e); }
};

exports.detail = async (req, res, next) => {
  try {
    const order = await prisma.order.findFirst({
      where: { id: req.params.id, companyId: req.user.companyId },
      include: { items: { include: { product: true } }, dealer: true, user: true },
    });
    if (!order) return res.status(404).json({ error: 'Not found' });
    res.json(order);
  } catch (e) { next(e); }
};

exports.updateStatus = async (req, res, next) => {
  try {
    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { status: req.body.status },
    });
    res.json(order);
  } catch (e) { next(e); }
};
