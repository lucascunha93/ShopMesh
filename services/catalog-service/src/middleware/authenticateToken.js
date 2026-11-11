const jwt = require('jsonwebtoken');

function unauthorized(res) {
  return res.status(401).json({ message: 'Token não fornecido ou inválido' });
}

function readAuth(req) {
  const authorization = req.get('Authorization');
  if (!authorization) {
    return { present: false };
  }

  const [scheme, token] = authorization.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return { present: true, valid: false };
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    if (typeof payload !== 'object' || !payload.sub || !payload.role) {
      return { present: true, valid: false };
    }
    return { present: true, valid: true, auth: { userId: payload.sub, role: payload.role } };
  } catch {
    return { present: true, valid: false };
  }
}

function authenticateToken(req, res, next) {
  const result = readAuth(req);
  if (!result.valid) {
    return unauthorized(res);
  }
  req.auth = result.auth;
  return next();
}

// Rotas públicas que oferecem algo a mais para quem envia um token válido.
function optionalAuth(req, res, next) {
  const result = readAuth(req);
  if (result.present && !result.valid) {
    return unauthorized(res);
  }
  req.auth = result.auth;
  return next();
}

function requireAdmin(req, res, next) {
  if (!req.auth || req.auth.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Acesso restrito a administradores' });
  }
  return next();
}

module.exports = { authenticateToken, optionalAuth, requireAdmin };
