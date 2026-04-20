const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.getDashboardStats = async (req, res) => {
  const { branchId } = req.user;
  const { startDate, endDate } = req.query;

  const dateFilter = {};
  if (startDate && endDate) {
    dateFilter.createdAt = {
      gte: new Date(startDate),
      lte: new Date(endDate),
    };
  }

  try {
    // 1. Total Sales and Count
    const salesSummary = await prisma.sale.aggregate({
      where: { branchId, ...dateFilter },
      _sum: { total: true },
      _count: { id: true },
    });

    // 2. Popular Items
    const popularItems = await prisma.saleItem.groupBy({
      by: ['productId'],
      where: { sale: { branchId, ...dateFilter } },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 5,
    });

    // Get product names for popular items
    const popularItemsWithNames = await Promise.all(
      popularItems.map(async (item) => {
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
          select: { name: true },
        });
        return {
          name: product?.name || 'Unknown',
          quantity: item._sum.quantity,
        };
      })
    );

    // 3. Sales Trend (Daily)
    const salesTrend = await prisma.sale.groupBy({
      by: ['createdAt'],
      where: { branchId, ...dateFilter },
      _sum: { total: true },
      orderBy: { createdAt: 'asc' },
    });

    // Grouping by date string manually for simplicity in this example
    const trendMap = {};
    salesTrend.forEach(s => {
      const date = s.createdAt.toISOString().split('T')[0];
      trendMap[date] = (trendMap[date] || 0) + Number(s._sum.total);
    });
    
    const formattedTrend = Object.keys(trendMap).map(date => ({
      date,
      total: trendMap[date]
    }));

    res.json({
      summary: {
        totalRevenue: salesSummary._sum.total || 0,
        totalTransactions: salesSummary._count.id || 0,
      },
      popularItems: popularItemsWithNames,
      salesTrend: formattedTrend,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
