const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');
const asyncHandler = require('../utils/asyncHandler');
const createToken = require('../utils/createToken');
const { registerSchema, loginSchema } = require('../utils/validationSchemas');

const publicUserFields = {
  id: true,
  name: true,
  email: true,
  role: true,
  createdAt: true,
  updatedAt: true,
};

const register = asyncHandler(async (req, res) => {
  const result = registerSchema.safeParse(req.body);

  if (!result.success) {
    const error = new Error('Dados inválidos');
    error.status = 400;
    error.details = result.error.issues;
    throw error;
  }

  const { name, email, password } = result.data;
  const existingUser = await prisma.user.findUnique({ where: { email } });

  if (existingUser) {
    const error = new Error('Email já cadastrado');
    error.status = 409;
    throw error;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { name, email, passwordHash },
    select: publicUserFields,
  });

  res.status(201).json({ user, token: createToken(user) });
});

const login = asyncHandler(async (req, res) => {
  const result = loginSchema.safeParse(req.body);

  if (!result.success) {
    const error = new Error('Dados inválidos');
    error.status = 400;
    error.details = result.error.issues;
    throw error;
  }

  const { email, password } = result.data;
  const user = await prisma.user.findUnique({ where: { email } });
  const passwordMatches = user
    ? await bcrypt.compare(password, user.passwordHash)
    : false;

  if (!passwordMatches) {
    const error = new Error('Credenciais inválidas');
    error.status = 401;
    throw error;
  }

  const publicUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };

  res.json({ user: publicUser, token: createToken(user) });
});

const getMe = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.auth.userId },
    select: publicUserFields,
  });

  if (!user) {
    const error = new Error('Usuário não encontrado');
    error.status = 404;
    throw error;
  }

  res.json({ user });
});

module.exports = { register, login, getMe };
