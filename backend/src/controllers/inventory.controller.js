const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.getProducts = async (req, res) => {
  try {
    const { branchId } = req.user;
    const products = await prisma.product.findMany({
      where: { branchId },
    });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getProductByBarcode = async (req, res) => {
  try {
    const { barcode } = req.params;
    const { branchId } = req.user;
    const product = await prisma.product.findFirst({
      where: { barcode, branchId },
    });
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.upsertProduct = async (req, res) => {
  try {
    const { name, barcode, price, costPrice, stockLevel, branchId, sku, category, lowStockThreshold } = req.body;
    
    const product = await prisma.product.upsert({
      where: { barcode },
      update: { name, price, costPrice, stockLevel, branchId, sku, category, lowStockThreshold },
      create: { name, barcode, price, costPrice, stockLevel, branchId, sku, category, lowStockThreshold },
    });
    
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { branchId } = req.user;
    const updateData = req.body;

    // Ensure user can only update products in their branch unless they are ADMIN
    const product = await prisma.product.updateMany({
      where: { id, branchId: req.user.role === 'ADMIN' ? undefined : branchId },
      data: updateData,
    });

    if (product.count === 0) return res.status(404).json({ message: 'Product not found or unauthorized' });
    
    res.json({ message: 'Product updated successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { branchId } = req.user;

    // Only allow deletion if user is ADMIN or owner of the branch
    if (req.user.role !== 'ADMIN') {
        const product = await prisma.product.findFirst({ where: { id, branchId } });
        if (!product) return res.status(404).json({ message: 'Product not found or unauthorized' });
    }

    await prisma.product.delete({
      where: { id },
    });
    
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

