const express = require('express');
const {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
} = require('../controllers/productController');
const { authenticateToken, optionalAuth, requireAdmin } = require('../middleware/authenticateToken');

const router = express.Router();

router.route('/products')
  .get(optionalAuth, listProducts)
  .post(authenticateToken, requireAdmin, createProduct);
router.route('/products/:id')
  .get(getProduct)
  .patch(authenticateToken, requireAdmin, updateProduct);

module.exports = router;
