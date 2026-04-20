const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

const { body } = require('express-validator');
const validate = require('../middleware/validate.middleware');

router.post('/register', 
  [
    body('username').isAlphanumeric().isLength({ min: 3 }).trim().escape(),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('name').notEmpty().trim().escape(),
    body('branchId').isUUID(),
  ], 
  validate,
  authController.register
);

router.post('/login', 
  [
    body('username').notEmpty().trim().escape(),
    body('password').notEmpty(),
  ], 
  validate,
  authController.login
);

module.exports = router;
