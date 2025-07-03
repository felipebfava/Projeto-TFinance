const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'SUA_CHAVE_SECRETA';

function authenticateToken(req, res, next) {
  // O token deverá ser enviado no cabeçalho Authorization no formato "Bearer <token>"
  const authHeader = req.headers['authorization'];
  // const token = authHeader && authHeader.split(' ')[1];

  const token = req.cookies.token; // pega token do cookie
  console.log(`Token recebido: ${token}`);


  if (!token) {
    return res.status(401).json({ error: 'Token não fornecido.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token inválido ou expirado.' });
    req.user = user;
    next();
  });
}

module.exports = authenticateToken;
