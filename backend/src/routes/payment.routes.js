const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');
const auth = require('../middleware/auth.middleware');

const { body } = require('express-validator');
const validate = require('../middleware/validate.middleware');

router.post('/mpesa/stkpush', 
  auth, 
  [
    body('phoneNumber').matches(/^(2547|2541|07|01)\d{8}$/).withMessage('Invalid Safaricom phone number'),
    body('amount').isNumeric({ min: 1 }).withMessage('Amount must be at least 1'),
    body('saleId').isUUID().withMessage('Invalid sale ID'),
  ],
  validate,
  paymentController.initiateStkPush
);
router.post('/mpesa/callback', paymentController.mpesaCallback);
router.get('/mpesa/status/:checkoutRequestId', auth, paymentController.checkPaymentStatus);

module.exports = router;
