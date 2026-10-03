const jwt = require('jsonwebtoken');

function authenticateToken(req, res, next) {
  const authorization = req.get('Authorization');
  const [scheme, token] = authorization ? authorization.split(' ') : [];

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ message: 'Token não fornecido ou inválido' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    if (typeof payload !== 'object' || !payload.sub || !payload.role) {
      return res.status(401).json({ message: 'Token não fornecido ou inválido' });
    }

    req.auth = { userId: payload.sub, role: payload.role };
    return next();
  } catch {
    return res.status(401).json({ message: 'Token não fornecido ou inválido' });
  }
}

module.exports = authenticateToken;
