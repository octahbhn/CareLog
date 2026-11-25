// controllers/authController.js
// Handles authentication endpoints: login, me, logout

const crypto = require('crypto');
const { hashPin, verifyPin } = require('../utils/pinUtils');
const pool = require('../config/db');

// In‑memory store for login throttling: { '<ip>#<nik>' : { count, firstAttempt } }
const loginAttempts = {};
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

/** Helper to generate SHA‑256 hash of a token */
function tokenHash(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/** POST /api/auth/login */
async function login(req, res) {
  try {
    const { nik, pin } = req.body || {};
    // Basic format validation
    const nikValid = typeof nik === 'string' && /^\d{16}$/.test(nik);
    const pinValid = typeof pin === 'string' && /^\d{6}$/.test(pin);
    if (!nikValid || !pinValid) {
      return res.status(400).json({ status: 'error', message: 'NIK atau PIN tidak sesuai.' });
    }

    // Rate limiting per IP + NIK
    const key = `${req.ip}#${nik}`;
    const now = Date.now();
    const attempt = loginAttempts[key] || { count: 0, firstAttempt: now };
    if (now - attempt.firstAttempt > WINDOW_MS) {
      // reset window
      attempt.count = 0;
      attempt.firstAttempt = now;
    }
    if (attempt.count >= MAX_ATTEMPTS) {
      return res.status(429).json({ status: 'error', message: 'Terlalu banyak percobaan login. Silakan coba lagi nanti.' });
    }
    attempt.count += 1;
    loginAttempts[key] = attempt;

    // Find user and role
    const userResult = await pool.query(
      `SELECT u.id, u.nik, u.pin_hash, u.role_id, u.warga_id, u.posyandu_id, r.name AS role_name
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.nik = $1`,
      [nik]
    );
    if (userResult.rowCount === 0) {
      // keep same generic message
      return res.status(401).json({ status: 'error', message: 'NIK atau PIN tidak sesuai.' });
    }
    const user = userResult.rows[0];

    const pinMatches = await verifyPin(pin, user.pin_hash);
    if (!pinMatches) {
      return res.status(401).json({ status: 'error', message: 'NIK atau PIN tidak sesuai.' });
    }

    // Successful login – reset attempt counter
    delete loginAttempts[key];

    // Create opaque session token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hash = tokenHash(rawToken);
    const nowDate = new Date();
    const expiresAt = new Date(nowDate.getTime() + 8 * 60 * 60 * 1000); // 8h

    await pool.query(
      `INSERT INTO auth_sessions (user_id, token_hash, created_at, expires_at, revoked_at)
       VALUES ($1, $2, $3, $4, NULL)`,
      [user.id, hash, nowDate, expiresAt]
    );

    // Build user info for response (mask NIK except last 4 digits)
    const maskedNik = nik.replace(/\d{12}(?=\d{4})/, '************');
    const userInfo = {
      id: user.id,
      nik: maskedNik,
      role: user.role_name,
      warga_id: user.warga_id,
      posyandu_id: user.posyandu_id
    };

    return res.status(200).json({
      status: 'success',
      message: 'Login berhasil.',
      token: rawToken,
      expiresAt: expiresAt.toISOString(),
      user: userInfo
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ status: 'error', message: 'Terjadi kesalahan pada server.' });
  }
}

/** GET /api/auth/me */
async function me(req, res) {
  try {
    // authMiddleware attaches req.user
    const { id, nik, role, warga_id, posyandu_id, name } = req.user;
    const maskedNik = nik.replace(/\d{12}(?=\d{4})/, '************');
    const payload = { id, nik: maskedNik, role, warga_id, posyandu_id };
    if (name) payload.name = name;
    return res.status(200).json({ status: 'success', user: payload });
  } catch (err) {
    console.error('Me error:', err);
    return res.status(500).json({ status: 'error', message: 'Terjadi kesalahan pada server.' });
  }
}

/** POST /api/auth/logout */
async function logout(req, res) {
  try {
    const sessionId = req.sessionId; // set by authMiddleware
    await pool.query(
      `UPDATE auth_sessions SET revoked_at = NOW() WHERE id = $1`,
      [sessionId]
    );
    return res.status(200).json({ status: 'success', message: 'Logout berhasil.' });
  } catch (err) {
    console.error('Logout error:', err);
    return res.status(500).json({ status: 'error', message: 'Terjadi kesalahan pada server.' });
  }
}

module.exports = { login, me, logout };
