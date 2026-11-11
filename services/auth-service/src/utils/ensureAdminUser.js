const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');

/**
 * Garante que exista um administrador inicial quando ADMIN_EMAIL e
 * ADMIN_PASSWORD estão definidos. Se o email já existir, apenas promove a
 * conta para ADMIN; a senha existente nunca é sobrescrita.
 */
async function ensureAdminUser({ email, password, name = 'Administrador' } = {}) {
  if (!email || !password) {
    return null;
  }

  const normalizedEmail = email.trim();
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  if (existing) {
    if (existing.role === 'ADMIN') {
      return { action: 'unchanged', email: normalizedEmail };
    }
    await prisma.user.update({ where: { id: existing.id }, data: { role: 'ADMIN' } });
    return { action: 'promoted', email: normalizedEmail };
  }

  try {
    await prisma.user.create({
      data: {
        name,
        email: normalizedEmail,
        passwordHash: await bcrypt.hash(password, 10),
        role: 'ADMIN',
      },
    });
  } catch (error) {
    // Outra instância criou o admin ao mesmo tempo.
    if (error.code === 'P2002') {
      return { action: 'unchanged', email: normalizedEmail };
    }
    throw error;
  }
  return { action: 'created', email: normalizedEmail };
}

module.exports = ensureAdminUser;
