const jwt = require('jsonwebtoken');

function unauthorized(res) {
  return res.status(401).json({ message: 'Token não fornecido ou inválido' });
}

function authenticateToken(req, res, next) {
  const authorization = req.get('Authorization');
  const [scheme, token] = authorization ? authorization.split(' ') : [];

  if (scheme !== 'Bearer' || !token) {
    return unauthorized(res);
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });

    if (typeof payload !== 'object' || !payload.sub || !payload.role) {
      return unauthorized(res);
    }

    req.auth = { userId: payload.sub, role: payload.role };
    return next();
  } catch {
    return unauthorized(res);
  }
}

function requireAdmin(req, res, next) {
  if (!req.auth || req.auth.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Acesso restrito a administradores' });
  }
  return next();
}

module.exports = { authenticateToken, requireAdmin };
