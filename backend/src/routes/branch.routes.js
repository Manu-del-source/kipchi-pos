const express = require('express');
const router = express.Router();
const branchController = require('../controllers/branch.controller');
const auth = require('../middleware/auth.middleware');

router.post('/', branchController.createBranch); // Ideally restricted to super-admin
router.get('/', auth, branchController.getBranches);

module.exports = router;
