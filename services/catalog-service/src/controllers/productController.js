const mongoose = require('mongoose');
const Product = require('../models/Product');
const asyncHandler = require('../utils/asyncHandler');
const {
  listProductsSchema,
  createProductSchema,
  updateProductSchema,
} = require('../utils/validationSchemas');

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

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function assertValidId(id) {
  if (!/^[0-9a-fA-F]{24}$/.test(id) || !mongoose.isValidObjectId(id)) {
    throw httpError(400, 'ID de produto inválido');
  }
}

const listProducts = asyncHandler(async (req, res) => {
  const {
    page,
    limit,
    category,
    search,
    includeInactive,
  } = parseInput(listProductsSchema, req.query);

  if (includeInactive && (!req.auth || req.auth.role !== 'ADMIN')) {
    throw httpError(403, 'Acesso restrito a administradores');
  }

  const filter = includeInactive ? {} : { active: true };

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
  assertValidId(req.params.id);

  const product = await Product.findById(req.params.id);

  if (!product) {
    throw httpError(404, 'Produto não encontrado');
  }

  res.json({ product });
});

const createProduct = asyncHandler(async (req, res) => {
  const data = parseInput(createProductSchema, req.body);
  const product = await Product.create(data);

  res.status(201).json({ product });
});

const updateProduct = asyncHandler(async (req, res) => {
  assertValidId(req.params.id);
  const data = parseInput(updateProductSchema, req.body);

  const filter = { _id: req.params.id };
  if (data.stock !== undefined) {
    // O estoque físico nunca pode ficar abaixo do que já está reservado
    // por pedidos em andamento na Saga.
    filter.$expr = { $lte: [{ $ifNull: ['$reserved', 0] }, data.stock] };
  }

  const product = await Product.findOneAndUpdate(filter, { $set: data }, {
    new: true,
    runValidators: true,
  });

  if (!product) {
    const existing = await Product.findById(req.params.id);
    if (!existing) {
      throw httpError(404, 'Produto não encontrado');
    }
    throw httpError(
      409,
      `O estoque não pode ser menor que as unidades reservadas (${existing.reserved || 0})`,
    );
  }

  res.json({ product });
});

module.exports = {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
};
