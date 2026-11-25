// backend/middleware/scopeMiddleware.js
/**
 * Scope‑based Authorization Helpers & Middleware
 *
 * Helpers receive an explicit `user` object (populated by `authMiddleware`)
 * and never read from `req`. This makes them usable both in middleware and
 * in isolated unit‑tests where a custom database client can be supplied.
 */

const pool = require('../config/db');

/** ---------------------------------------------------------------
 * Helper to safely parse a positive safe integer from a string.
 * Returns the integer value or null if invalid.
 * --------------------------------------------------------------- */
function parsePositiveSafeInteger(value) {
  // Accept both numeric strings and numbers representing positive safe integers.
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  }
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
    return null;
  }
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/** -----------------------------------------------------------------
 * Helper: canAccessWarga(user, targetWargaId, db = pool)
 * Returns true if the supplied user is allowed to read the target warga.
 * ----------------------------------------------------------------- */
async function canAccessWarga(user, targetWargaId, db = pool) {
  if (!user || typeof targetWargaId !== 'number' || targetWargaId <= 0) {
    return false;
  }
  const { role, warga_id: userWargaId, posyandu_id: userPosyanduId, id: userId } = user;

  if (role === 'warga') {
    return userWargaId === targetWargaId;
  }
  if (role === 'kader') {
    const { rows } = await db.query(
      `SELECT id FROM warga WHERE id = $1 AND posyandu_id = $2`,
      [targetWargaId, userPosyanduId]
    );
    return rows.length > 0;
  }
  if (role === 'puskesmas') {
    const { rows } = await db.query(
      `SELECT w.id
         FROM warga w
         JOIN posyandu p ON w.posyandu_id = p.id
        WHERE w.id = $1
          AND p.puskesmas_id = $2`,
      [targetWargaId, userId]
    );
    return rows.length > 0;
  }
  return false;
}

/** -----------------------------------------------------------------
 * Helper: canAccessExamination(user, examId, db = pool)
 * Returns true if the user may read the specified examination.
 * ----------------------------------------------------------------- */
async function canAccessExamination(user, examId, db = pool) {
  if (!user || typeof examId !== 'number' || examId <= 0) {
    return false;
  }
  const { role, warga_id: userWargaId, posyandu_id: userPosyanduId, id: userId } = user;

  if (role === 'warga') {
    const { rows } = await db.query(
      `SELECT id FROM examinations WHERE id = $1 AND warga_id = $2`,
      [examId, userWargaId]
    );
    return rows.length > 0;
  }
  if (role === 'kader') {
    const { rows } = await db.query(
      `SELECT id FROM examinations WHERE id = $1 AND posyandu_id = $2`,
      [examId, userPosyanduId]
    );
    return rows.length > 0;
  }
  if (role === 'puskesmas') {
    const { rows } = await db.query(
      `SELECT e.id
         FROM examinations e
         JOIN posyandu p ON e.posyandu_id = p.id
        WHERE e.id = $1
          AND p.puskesmas_id = $2`,
      [examId, userId]
    );
    return rows.length > 0;
  }
  return false;
}

/** -----------------------------------------------------------------
 * Middleware: requireWargaScope (production)
 * ----------------------------------------------------------------- */
async function requireWargaScope(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ status: 'error', message: 'Tidak terautentikasi.' });
  }
  const targetId = parsePositiveSafeInteger(req.params.id);
  if (targetId === null) {
    return res.status(400).json({ status: 'error', message: 'Parameter id tidak valid.' });
  }
  try {
    const allowed = await canAccessWarga(req.user, targetId, pool);
    if (allowed) return next();
    return res.status(403).json({ status: 'error', message: 'Akses ditolak.' });
  } catch (err) {
    console.error('Scope middleware (warga) error:', err);
    return res.status(500).json({ status: 'error', message: 'Terjadi kesalahan server.' });
  }
}

/** -----------------------------------------------------------------
 * Middleware: requireExaminationScope (production)
 * ----------------------------------------------------------------- */
async function requireExaminationScope(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ status: 'error', message: 'Tidak terautentikasi.' });
  }
  const targetId = parsePositiveSafeInteger(req.params.id);
  if (targetId === null) {
    return res.status(400).json({ status: 'error', message: 'Parameter id tidak valid.' });
  }
  try {
    const allowed = await canAccessExamination(req.user, targetId, pool);
    if (allowed) return next();
    return res.status(403).json({ status: 'error', message: 'Akses ditolak.' });
  } catch (err) {
    console.error('Scope middleware (examination) error:', err);
    return res.status(500).json({ status: 'error', message: 'Terjadi kesalahan server.' });
  }
}

/** -----------------------------------------------------------------
 * Factory: createRequireWargaScope(db)
 * ----------------------------------------------------------------- */
function createRequireWargaScope(db = pool) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ status: 'error', message: 'Tidak terautentikasi.' });
    }
    const targetId = parsePositiveSafeInteger(req.params.id);
    if (targetId === null) {
      return res.status(400).json({ status: 'error', message: 'Parameter id tidak valid.' });
    }
    try {
      const allowed = await canAccessWarga(req.user, targetId, db);
      if (allowed) return next();
      return res.status(403).json({ status: 'error', message: 'Akses ditolak.' });
    } catch (err) {
      console.error('Scope middleware (warga) error:', err);
      return res.status(500).json({ status: 'error', message: 'Terjadi kesalahan server.' });
    }
  };
}

/** -----------------------------------------------------------------
 * Factory: createRequireExaminationScope(db)
 * ----------------------------------------------------------------- */
function createRequireExaminationScope(db = pool) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ status: 'error', message: 'Tidak terautentikasi.' });
    }
    const targetId = parsePositiveSafeInteger(req.params.id);
    if (targetId === null) {
      return res.status(400).json({ status: 'error', message: 'Parameter id tidak valid.' });
    }
    try {
      const allowed = await canAccessExamination(req.user, targetId, db);
      if (allowed) return next();
      return res.status(403).json({ status: 'error', message: 'Akses ditolak.' });
    } catch (err) {
      console.error('Scope middleware (examination) error:', err);
      return res.status(500).json({ status: 'error', message: 'Terjadi kesalahan server.' });
    }
  };
}

/** -----------------------------------------------------------------
 * Middleware for creating examinations with scope check.
 * Only a Kader may create examinations and only for warga within their posyandu.
 * The middleware validates `warga_id`, ensures the kader has a posyandu,
 * verifies the warga belongs to that posyandu, and injects `examiner_id`
 * and `posyandu_id` from the authenticated user.
 * ----------------------------------------------------------------- */
function createRequireExaminationCreateScope(db = pool) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ status: 'error', message: 'Tidak terautentikasi.' });
    }
    if (req.user.role !== 'kader') {
      return res.status(403).json({ status: 'error', message: 'Akses ditolak.' });
    }
    const rawWargaId = req.body.warga_id;
    const wargaId =
      typeof rawWargaId === 'number'
        ? rawWargaId
        : typeof rawWargaId === 'string' && /^[1-9]\d*$/.test(rawWargaId)
        ? Number(rawWargaId)
        : NaN;
    if (!Number.isSafeInteger(wargaId) || wargaId <= 0) {
      return res.status(400).json({ status: 'error', message: 'warga_id tidak valid.' });
    }
    if (!Number.isSafeInteger(Number(req.user.posyandu_id)) || Number(req.user.posyandu_id) <= 0) {
      return res.status(403).json({ status: 'error', message: 'Kader belum memiliki Posyandu.' });
    }
    try {
      const allowed = await canAccessWarga(req.user, wargaId, db);
      if (!allowed) {
        return res.status(403).json({ status: 'error', message: 'Akses ditolak.' });
      }
      req.body.warga_id = wargaId;
      req.body.examiner_id = req.user.id;
      req.body.posyandu_id = Number(req.user.posyandu_id);
      next();
    } catch (err) {
      console.error('Scope middleware (examination create) error:', err);
      return res.status(500).json({ status: 'error', message: 'Terjadi kesalahan server.' });
    }
  };
}

module.exports = {
  canAccessWarga,
  canAccessExamination,
  requireWargaScope,
  requireExaminationScope,
  createRequireWargaScope,
  createRequireExaminationScope,
  createRequireExaminationCreateScope,
  parsePositiveSafeInteger,
};
