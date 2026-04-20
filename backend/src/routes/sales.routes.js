const express = require('express');
const router = express.Router();
const salesController = require('../controllers/sales.controller');
const auth = require('../middleware/auth.middleware');

const { body } = require('express-validator');
const validate = require('../middleware/validate.middleware');

router.post('/', 
  auth, 
  [
    body('items').isArray({ min: 1 }).withMessage('Items must be a non-empty array'),
    body('items.*.productId').isUUID().withMessage('Invalid product ID'),
    body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
    body('items.*.unitPrice').isDecimal().withMessage('Unit price must be a decimal'),
    body('items.*.subtotal').isDecimal().withMessage('Subtotal must be a decimal'),
    body('paymentMethod').isIn(['CASH', 'MPESA', 'POINTS']).withMessage('Invalid payment method'),
    body('total').isDecimal().withMessage('Total must be a decimal'),
    body('tax').isDecimal().withMessage('Tax must be a decimal'),
  ],
  validate,
  salesController.createSale
);
router.get('/', auth, salesController.getSales);
router.get('/:id', auth, salesController.getSaleById);

module.exports = router;
