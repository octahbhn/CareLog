// backend/controllers/examinationController.js
// Phase 2 – Examination controller implementation
// Provides CRUD‑like operations for examinations with strict RBAC & scope checks.

const pool = require('../config/db');
const { parsePositiveSafeInteger } = require('../middleware/scopeMiddleware');

// -------------------------------------------------------------------
// Validation helpers
// -------------------------------------------------------------------
function isValidISODate(d) {
  if (typeof d !== 'string') return false;
  // strict YYYY‑MM‑DD
  const isoRegex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
  if (!isoRegex.test(d)) return false;
  const date = new Date(d);
  return !isNaN(date.getTime()) && date.toISOString().slice(0, 10) === d;
}

function isFirstDayOfMonth(d) {
  // New implementation: rely on strict ISO format and day = 01
  return isValidISODate(d) && d.endsWith('-01');
}


// -------------------------------------------------------------------
// Helper to build response envelopes
// -------------------------------------------------------------------
function success(res, data, message = 'Berhasil') {
  return res.status(200).json({ status: 'success', message, data });
}
function error(res, statusCode, message) {
  return res.status(statusCode).json({ status: 'error', message });
}

// -------------------------------------------------------------------
// 1. listExaminations – visible to Kader & Puskesmas
// -------------------------------------------------------------------
async function listExaminations(req, res) {
  const { role, posyandu_id, id: userId } = req.user;
  try {
    let query = '';
    let params = [];
    if (role === 'kader') {
      // Only examinations belonging to the kader's posyandu
      query = `SELECT * FROM examinations WHERE posyandu_id = $1 ORDER BY period DESC`;
      params = [posyandu_id];
    } else if (role === 'puskesmas') {
      // All examinations of posyandu(s) supervised by this puskesmas
      query = `SELECT e.* FROM examinations e
               JOIN posyandu p ON e.posyandu_id = p.id
               WHERE p.puskesmas_id = $1
               ORDER BY e.period DESC`;
      params = [userId]; // userId is the puskesmas users.id
    } else {
      // warga role should never reach this endpoint (blocked by role middleware)
      return error(res, 403, 'Akses ditolak');
    }
    const { rows } = await pool.query(query, params);
    return success(res, rows, 'Daftar pemeriksaan berhasil diambil');
  } catch (err) {
    console.error('listExaminations error:', err);
    return error(res, 500, 'Terjadi kesalahan server saat mengambil daftar pemeriksaan');
  }
}

// -------------------------------------------------------------------
// 2. getExaminationById – scoped by route middleware
// -------------------------------------------------------------------
async function getExaminationById(req, res) {
  const examId = parsePositiveSafeInteger(req.params.id);
  if (examId === null) {
    return error(res, 400, 'Parameter id tidak valid');
  }
  try {
    const query = `SELECT * FROM examinations WHERE id = $1`;
    const { rows } = await pool.query(query, [examId]);
    if (rows.length === 0) {
      return error(res, 404, 'Pemeriksaan tidak ditemukan');
    }
    return success(res, rows[0], 'Detail pemeriksaan berhasil diambil');
  } catch (err) {
    console.error('getExaminationById error:', err);
    return error(res, 500, 'Terjadi kesalahan server saat mengambil data pemeriksaan');
  }
}

// -------------------------------------------------------------------
// 3. createExamination – only Kader may create
// -------------------------------------------------------------------
async function createExamination(req, res) {
  // Validate that request body exists and is a plain object (not array/null)
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return error(res, 400, 'Bad request body');
  }

  const { warga_id, period, exam_date } = req.body;

  // Ensure mandatory fields are present
  if (warga_id === undefined || period === undefined || exam_date === undefined) {
    return error(res, 400, 'Field wajib tidak lengkap');
  }

  // Defensive re‑validation of IDs (middleware already scoped)
  const wargaId = parsePositiveSafeInteger(warga_id);
  if (wargaId === null) {
    return error(res, 400, 'warga_id tidak valid');
  }

  // period must be a valid ISO date and the first day of its month
  if (!isValidISODate(period) || !isFirstDayOfMonth(period)) {
    return error(res, 400, 'period harus berupa tanggal pertama tiap bulan (YYYY‑MM‑01)');
  }

  // exam_date must be a valid ISO date
  if (!isValidISODate(exam_date)) {
    return error(res, 400, 'exam_date tidak valid atau bukan format YYYY‑MM‑DD');
  }

  // Server‑side assignment of examiner and posyandu
  const examinerId = req.user.id; // real users.id
  const posyanduId = parsePositiveSafeInteger(req.user.posyandu_id);
  if (posyanduId === null) {
    return error(res, 400, 'Posyandu tidak valid pada akun Anda');
  }

  const insertQuery = `INSERT INTO examinations (warga_id, examiner_id, posyandu_id, period, exam_date)
                       VALUES ($1, $2, $3, $4, $5)
                       RETURNING *`;
  const values = [wargaId, examinerId, posyanduId, period, exam_date];
  try {
    const { rows } = await pool.query(insertQuery, values);
    return res.status(201).json({ status: 'success', message: 'Pemeriksaan berhasil ditambahkan', data: rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      // UNIQUE (warga_id, period, posyandu_id) violation
      return error(res, 409, 'Pemeriksaan untuk warga pada periode ini sudah ada');
    }
    console.error('createExamination error:', err);
    return error(res, 500, 'Terjadi kesalahan server saat menambah pemeriksaan');
  }
}

// -------------------------------------------------------------------
// 4. listExaminationsByWarga – riwayat pemeriksaan warga
// -------------------------------------------------------------------
async function listExaminationsByWarga(req, res) {
  const wargaId = parsePositiveSafeInteger(req.params.id);
  if (wargaId === null) {
    return error(res, 400, 'Parameter id tidak valid');
  }
  // Scope middleware already ensured that the caller may access this warga.
  try {
    const query = `SELECT * FROM examinations WHERE warga_id = $1 ORDER BY period DESC`;
    const { rows } = await pool.query(query, [wargaId]);
    return success(res, rows, 'Riwayat pemeriksaan warga berhasil diambil');
  } catch (err) {
    console.error('listExaminationsByWarga error:', err);
    return error(res, 500, 'Terjadi kesalahan server saat mengambil riwayat pemeriksaan');
  }
}

module.exports = {
  listExaminations,
  getExaminationById,
  createExamination,
  listExaminationsByWarga,
};
