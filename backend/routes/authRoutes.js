const express = require('express');
const router = express.Router();
const { login, me, logout } = require('../controllers/authController');
const { requireAuth } = require('../middleware/authMiddleware');

// Public login endpoint
router.post('/login', login);

// Protected endpoints
router.get('/me', requireAuth, me);
router.post('/logout', requireAuth, logout);

module.exports = router;
