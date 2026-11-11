const { z } = require('zod');

const listProductsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  category: z.string().trim().optional(),
  search: z.string().trim().min(1).optional(),
  includeInactive: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
});

const createProductSchema = z.object({
  name: z.string().trim().min(1),
  price: z.number().min(0),
  description: z.string().optional(),
  category: z.string().optional(),
  stock: z.number().int().min(0).optional(),
  imageUrl: z.string().optional(),
});

const updateProductSchema = z.object({
  name: z.string().trim().min(1).optional(),
  price: z.number().min(0).optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  stock: z.number().int().min(0).optional(),
  imageUrl: z.string().optional(),
  active: z.boolean().optional(),
}).strict().refine((data) => Object.keys(data).length > 0, {
  message: 'Informe ao menos um campo para atualizar',
});

module.exports = { listProductsSchema, createProductSchema, updateProductSchema };
