const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

exports.createSale = async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { items, customerId, total, tax, discount, paymentMethod } = req.body;
    const { userId, branchId } = req.user;

    const saleId = uuidv4();
    const saleNumber = `SALE-${Date.now()}`;

    // 1. Create Sale record
    const saleResult = await client.query(
      'INSERT INTO "Sale" (id, "saleNumber", total, tax, discount, "paymentStatus", "paymentMethod", "cashierId", "customerId", "branchId", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW()) RETURNING *',
      [saleId, saleNumber, total, tax, discount || 0, 'PAID', paymentMethod, userId, customerId, branchId]
    );

    // 2. Create SaleItems and update stock
    for (const item of items) {
      const saleItemId = uuidv4();
      await client.query(
        'INSERT INTO "SaleItem" (id, "saleId", "productId", quantity, "unitPrice", subtotal) VALUES ($1, $2, $3, $4, $5, $6)',
        [saleItemId, saleId, item.productId, item.quantity, item.unitPrice, item.subtotal]
      );

      // Update stock level
      await client.query(
        'UPDATE "Product" SET "stockLevel" = "stockLevel" - $1, "updatedAt" = NOW() WHERE id = $2',
        [item.quantity, item.productId]
      );
    }

    // 3. Update customer loyalty points if customer exists
    if (customerId) {
      const pointsEarned = Math.floor(total / 100); // 1 point for every 100 KES
      await client.query(
        'UPDATE "Customer" SET "loyaltyPoints" = "loyaltyPoints" + $1, "updatedAt" = NOW() WHERE id = $2',
        [pointsEarned, customerId]
      );
    }

    await client.query('COMMIT');
    res.status(201).json(saleResult.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: error.message });
  } finally {
    client.release();
  }
};

exports.getSalesHistory = async (req, res) => {
  try {
    const { branchId } = req.user;
    const result = await db.query(
      'SELECT s.*, u.name as "cashierName", c.name as "customerName" FROM "Sale" s JOIN "User" u ON s."cashierId" = u.id LEFT JOIN "Customer" c ON s."customerId" = c.id WHERE s."branchId" = $1 ORDER BY s."createdAt" DESC',
      [branchId]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getSaleById = async (req, res) => {
  try {
    const { id } = req.params;
    const saleResult = await db.query(
      'SELECT s.*, u.name as "cashierName", c.name as "customerName" FROM "Sale" s JOIN "User" u ON s."cashierId" = u.id LEFT JOIN "Customer" c ON s."customerId" = c.id WHERE s.id = $1',
      [id]
    );
    
    if (saleResult.rows.length === 0) return res.status(404).json({ message: 'Sale not found' });

    const itemsResult = await db.query(
      'SELECT si.*, p.name as "productName" FROM "SaleItem" si JOIN "Product" p ON si."productId" = p.id WHERE si."saleId" = $1',
      [id]
    );

    res.json({
      ...saleResult.rows[0],
      items: itemsResult.rows
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
