const express = require('express');
const { listProducts, getProduct, createProduct } = require('../controllers/productController');

const router = express.Router();

router.route('/products')
  .get(listProducts)
  .post(createProduct);
router.get('/products/:id', getProduct);

module.exports = router;
