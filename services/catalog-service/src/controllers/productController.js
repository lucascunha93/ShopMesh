const mongoose = require('mongoose');
const Product = require('../models/Product');
const asyncHandler = require('../utils/asyncHandler');
const { listProductsSchema, createProductSchema } = require('../utils/validationSchemas');

function parseInput(schema, input) {
  const result = schema.safeParse(input);

  if (!result.success) {
    const error = new Error('Dados inválidos');
    error.status = 400;
    error.details = result.error.issues;
    throw error;
  }

  return result.data;
}

const listProducts = asyncHandler(async (req, res) => {
  const { page, limit, category, search } = parseInput(listProductsSchema, req.query);
  const filter = { active: true };

  if (category !== undefined) {
    filter.category = category;
  }

  if (search !== undefined) {
    filter.$text = { $search: search };
  }

  const [total, items] = await Promise.all([
    Product.countDocuments(filter),
    Product.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
  ]);

  res.json({
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

const getProduct = asyncHandler(async (req, res) => {
  if (!/^[0-9a-fA-F]{24}$/.test(req.params.id) || !mongoose.isValidObjectId(req.params.id)) {
    const error = new Error('ID de produto inválido');
    error.status = 400;
    throw error;
  }

  const product = await Product.findById(req.params.id);

  if (!product) {
    const error = new Error('Produto não encontrado');
    error.status = 404;
    throw error;
  }

  res.json({ product });
});

const createProduct = asyncHandler(async (req, res) => {
  const data = parseInput(createProductSchema, req.body);
  const product = await Product.create(data);

  res.status(201).json({ product });
});

module.exports = { listProducts, getProduct, createProduct };
