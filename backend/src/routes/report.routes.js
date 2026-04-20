const express = require('express');
const router = express.Router();
const reportController = require('../controllers/report.controller');
const auth = require('../middleware/auth.middleware');
const checkRole = require('../middleware/role.middleware');

router.get('/dashboard', auth, checkRole(['ADMIN']), reportController.getDashboardStats);

module.exports = router;
