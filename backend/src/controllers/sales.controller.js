const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.createSale = async (req, res) => {
  const { customerId, items, paymentMethod, total, tax, discount } = req.body;
  const { userId, branchId } = req.user;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Validate stock levels first
      for (const item of items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId }
        });

        if (!product) {
          throw new Error(`Product with ID ${item.productId} not found`);
        }

        if (product.stockLevel < item.quantity) {
          throw new Error(`Insufficient stock for ${product.name}. Available: ${product.stockLevel}, Requested: ${item.quantity}`);
        }
      }

      // 2. Create the sale
      const sale = await tx.sale.create({
        data: {
          saleNumber: `S-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          total,
          tax,
          discount,
          paymentMethod,
          paymentStatus: paymentMethod === 'MPESA' ? 'PENDING' : 'PAID',
          cashierId: userId,
          branchId,
          customerId,
          items: {
            create: items.map(item => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              subtotal: item.subtotal,
            }))
          }
        }
      });

      // 3. Update stock levels
      for (const item of items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stockLevel: { decrement: item.quantity } }
        });
      }

      // 4. Update loyalty points if customer exists
      if (customerId) {
        const points = Math.floor(total / 100);
        await tx.customer.update({
          where: { id: customerId },
          data: { loyaltyPoints: { increment: points } }
        });
      }

      return sale;
    });

    res.status(201).json(result);
  } catch (error) {
    console.error('Sale Creation Error:', error.message);
    res.status(400).json({ message: error.message });
  }
};

exports.getSaleById = async (req, res) => {
  try {
    const { id } = req.params;
    const { branchId } = req.user;
    const sale = await prisma.sale.findFirst({
      where: { id, branchId },
      include: { 
        items: { include: { product: true } }, 
        cashier: { select: { name: true } },
        customer: true,
        mpesaDetails: true
      },
    });
    if (!sale) return res.status(404).json({ message: 'Sale not found' });
    res.json(sale);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getSales = async (req, res) => {
  try {
    const { branchId } = req.user;
    const sales = await prisma.sale.findMany({
      where: { branchId },
      include: { items: { include: { product: true } }, cashier: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(sales);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
