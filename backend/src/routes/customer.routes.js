const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customer.controller');
const auth = require('../middleware/auth.middleware');

const { body } = require('express-validator');
const validate = require('../middleware/validate.middleware');

router.get('/', auth, customerController.getCustomers);
router.post('/', 
  auth, 
  [
    body('name').notEmpty().trim().escape(),
    body('phone').matches(/^(2547|2541|07|01)\d{8}$/).withMessage('Invalid phone number'),
  ],
  validate,
  customerController.createCustomer
);
router.get('/:phone', auth, customerController.getCustomerByPhone);
router.patch('/:id', 
  auth, 
  [
    body('name').optional().trim().escape(),
    body('phone').optional().matches(/^(2547|2541|07|01)\d{8}$/),
  ],
  validate,
  customerController.updateCustomer
);
router.delete('/:id', auth, customerController.deleteCustomer);
router.post('/:id/redeem', 
  auth, 
  [
    body('points').isInt({ min: 1 }),
  ],
  validate,
  customerController.redeemPoints
);

module.exports = router;
