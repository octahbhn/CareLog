// middleware/authMiddleware.js
// Verifies opaque session token and loads user information.

const crypto = require('crypto');
const pool = require('../config/db');

/** Helper to hash raw token */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/** Middleware to protect routes */
async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ status: 'error', message: 'Token tidak ditemukan.' });
    }
    const rawToken = authHeader.split(' ')[1];
    const tokenHash = hashToken(rawToken);

    const result = await pool.query(
      `SELECT s.id AS session_id,
              u.id AS user_id,
              u.nik,
              u.warga_id,
              u.posyandu_id,
              r.name AS role_name
         FROM auth_sessions s
         JOIN users u ON s.user_id = u.id
         JOIN roles r ON u.role_id = r.id
        WHERE s.token_hash = $1
          AND s.revoked_at IS NULL
          AND s.expires_at > NOW()`,
      [tokenHash]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ status: 'error', message: 'Token tidak valid atau kadaluarsa.' });
    }

    const session = result.rows[0];
    // expose both explicit user_id and legacy id for backward compatibility
    req.user = {
      id: session.user_id,      // actual user id (also kept for legacy)
      user_id: session.user_id, // explicit alias
      nik: session.nik,
      role: session.role_name,
      warga_id: session.warga_id,
      posyandu_id: session.posyandu_id
    };
    // auth_sessions.id – used by logout endpoint
    req.sessionId = session.session_id;
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    return res.status(500).json({ status: 'error', message: 'Terjadi kesalahan pada server.' });
  }
}

module.exports = { requireAuth };