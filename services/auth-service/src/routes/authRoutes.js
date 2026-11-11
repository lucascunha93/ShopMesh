const express = require('express');
const { register, login, getMe, listUsers } = require('../controllers/authController');
const authenticateToken = require('../middleware/authenticateToken');

const { requireAdmin } = authenticateToken;

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', authenticateToken, getMe);
router.get('/users', authenticateToken, requireAdmin, listUsers);

module.exports = router;
