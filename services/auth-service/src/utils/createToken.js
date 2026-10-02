const jwt = require('jsonwebtoken');

function createToken(user) {
  return jwt.sign(
    { role: user.role },
    process.env.JWT_SECRET,
    {
      subject: user.id,
      expiresIn: process.env.JWT_EXPIRES_IN,
    }
  );
}

module.exports = createToken;
