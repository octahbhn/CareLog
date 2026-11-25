// backend/controllers/wargaController.js

// Warga controller – Phase 1 implementation
// Provides list, get, create, update, delete handlers.
// All queries are parameterised and respect the current schema.
// Role / scope logic is enforced by the router middleware (requireAuth, requireRole, requireWargaScope).

const pool = require('../config/db');
const { parsePositiveSafeInteger } = require('../middleware/scopeMiddleware');

// -------------------------------------------------------------------
// Validation helpers
// -------------------------------------------------------------------
function isValidNik(nik) {
  return typeof nik === 'string' && /^\d{16}$/.test(nik);
}
function isValidGender(g) {
  return typeof g === 'string' && g.length > 0;
}
function isValidTargetGroup(tg) {
  const allowed = ['bayi_balita','remaja','usia_produktif','lansia','ibu_hamil'];
  return typeof tg === 'string' && allowed.includes(tg);
}
function isValidDate(d) {
  return typeof d === 'string' && !isNaN(Date.parse(d));
}
async function familyExists(familyId) {
  const res = await pool.query('SELECT 1 FROM families WHERE id = $1', [familyId]);
  return res.rowCount > 0;
}

/** Helper to build a JSON success envelope */
function success(res, data, message = 'Berhasil') {
  return res.status(200).json({ status: 'success', message, data });
}

/** Helper to build an error envelope */
function error(res, statusCode, message) {
  return res.status(statusCode).json({ status: 'error', message });
}

/** GET /api/warga – list warga according to role */
async function listWarga(req, res) {
  const { role, posyandu_id, user_id } = req.user; // user_id holds real users.id
  try {
    let query = '';
    let params = [];
    if (role === 'kader') {
      query = `SELECT * FROM warga WHERE posyandu_id = $1 ORDER BY id ASC`;
      params = [posyandu_id];
    } else if (role === 'puskesmas') {
      // Puskesmas can see all warga under his/her puskesmas via join
      query = `SELECT w.* FROM warga w
               JOIN posyandu p ON w.posyandu_id = p.id
               WHERE p.puskesmas_id = $1
               ORDER BY w.id ASC`;
      params = [user_id];
    } else {
      // warga role not allowed to list
      return error(res, 403, 'Akses ditolak: tidak dapat mengakses daftar warga.');
    }
    const { rows } = await pool.query(query, params);
    return success(res, rows, 'Daftar warga berhasil diambil');
  } catch (err) {
    console.error('listWarga error:', err);
    return error(res, 500, 'Terjadi kesalahan server saat mengambil daftar warga');
  }
}

/** GET /api/warga/:id – return single warga (scope already checked) */
async function getWargaById(req, res) {
  const targetId = parsePositiveSafeInteger(req.params.id);
  if (targetId === null) {
    return error(res, 400, 'Parameter id tidak valid.');
  }
  try {
    const { rows } = await pool.query('SELECT * FROM warga WHERE id = $1', [targetId]);
    if (rows.length === 0) {
      return error(res, 404, 'Warga tidak ditemukan');
    }
    return success(res, rows[0], 'Detail warga berhasil diambil');
  } catch (err) {
    console.error('getWargaById error:', err);
    return error(res, 500, 'Terjadi kesalahan server saat mengambil data warga');
  }
}

/** POST /api/warga – create new warga (kader only) */
async function createWarga(req, res) {
  const { nik, full_name, birth_date, gender, address, rt_rw, phone, target_group, family_id } = req.body;
  const posyanduId = req.user.posyandu_id;

  // Basic validation
  if (!nik || !full_name || !birth_date || !gender || !address || !target_group) {
    return error(res, 400, 'Field wajib tidak lengkap');
  }
  if (!isValidNik(nik)) {
    return error(res, 400, 'NIK harus 16 digit angka');
  }
  if (!isValidGender(gender)) {
    return error(res, 400, 'Gender tidak valid');
  }
  if (!isValidDate(birth_date)) {
    return error(res, 400, 'birth_date tidak valid');
  }
  if (!isValidTargetGroup(target_group)) {
    return error(res, 400, 'target_group tidak valid');
  }
  if (family_id !== undefined && family_id !== null) {
    const famId = parseInt(family_id, 10);
    if (!Number.isSafeInteger(famId) || famId <= 0) {
      return error(res, 400, 'family_id tidak valid');
    }
    const exists = await familyExists(famId);
    if (!exists) {
      return error(res, 400, 'family_id tidak ditemukan');
    }
  }

  try {
    const insertQuery = `INSERT INTO warga (nik, full_name, birth_date, gender, address, rt_rw, phone, target_group, family_id, posyandu_id)
                         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
                         RETURNING *`;
    const values = [nik, full_name, birth_date, gender, address, rt_rw || null, phone || null, target_group, family_id || null, posyanduId];
    const { rows } = await pool.query(insertQuery, values);
    return res.status(201).json({ status: 'success', message: 'Warga berhasil ditambahkan', data: rows[0] });
  } catch (err) {
    // Handle unique violation for NIK
    if (err.code === '23505') {
      return error(res, 409, 'NIK sudah terdaftar');
    }
    console.error('createWarga error:', err);
    return error(res, 500, 'Terjadi kesalahan server saat menambah warga');
  }
}

/** PUT /api/warga/:id – update warga (kader only, scope validated) */
async function updateWarga(req, res) {
  const targetId = parsePositiveSafeInteger(req.params.id);
  if (targetId === null) {
    return error(res, 400, 'Parameter id tidak valid.');
  }
  const { nik, full_name, birth_date, gender, address, rt_rw, phone, target_group, family_id } = req.body;
  const posyanduId = req.user.posyandu_id;

  // Validation of supplied fields
  if (nik !== undefined && !isValidNik(nik)) {
    return error(res, 400, 'NIK harus 16 digit angka');
  }
  if (gender !== undefined && !isValidGender(gender)) {
    return error(res, 400, 'Gender tidak valid');
  }
  if (birth_date !== undefined && !isValidDate(birth_date)) {
    return error(res, 400, 'birth_date tidak valid');
  }
  if (target_group !== undefined && !isValidTargetGroup(target_group)) {
    return error(res, 400, 'target_group tidak valid');
  }
  if (family_id !== undefined && family_id !== null) {
    const famId = parseInt(family_id, 10);
    if (!Number.isSafeInteger(famId) || famId <= 0) {
      return error(res, 400, 'family_id tidak valid');
    }
    const exists = await familyExists(famId);
    if (!exists) {
      return error(res, 400, 'family_id tidak ditemukan');
    }
  }

  // Build dynamic SET clause – only include provided fields
  const fields = [];
  const values = [];
  let idx = 1;
  if (nik !== undefined) { fields.push(`nik = $${idx++}`); values.push(nik); }
  if (full_name !== undefined) { fields.push(`full_name = $${idx++}`); values.push(full_name); }
  if (birth_date !== undefined) { fields.push(`birth_date = $${idx++}`); values.push(birth_date); }
  if (gender !== undefined) { fields.push(`gender = $${idx++}`); values.push(gender); }
  if (address !== undefined) { fields.push(`address = $${idx++}`); values.push(address); }
  if (rt_rw !== undefined) { fields.push(`rt_rw = $${idx++}`); values.push(rt_rw); }
  if (phone !== undefined) { fields.push(`phone = $${idx++}`); values.push(phone); }
  if (target_group !== undefined) { fields.push(`target_group = $${idx++}`); values.push(target_group); }
  if (family_id !== undefined) { fields.push(`family_id = $${idx++}`); values.push(family_id); }

  if (fields.length === 0) {
    return error(res, 400, 'Tidak ada field yang akan diubah');
  }

  // Append filter values (id and posyandu)
  values.push(targetId);
  values.push(posyanduId);
  const setClause = fields.join(', ');
  const query = `UPDATE warga SET ${setClause} WHERE id = $${idx++} AND posyandu_id = $${idx} RETURNING *`;
  try {
    const { rows } = await pool.query(query, values);
    if (rows.length === 0) {
      return error(res, 404, 'Warga tidak ditemukan atau tidak berada dalam posyandu Anda');
    }
    return success(res, rows[0], 'Warga berhasil diperbarui');
  } catch (err) {
    if (err.code === '23505') {
      return error(res, 409, 'NIK sudah terdaftar');
    }
    console.error('updateWarga error:', err);
    return error(res, 500, 'Terjadi kesalahan server saat memperbarui warga');
  }
}

/** DELETE /api/warga/:id – delete warga (kader only, scope validated) */
async function deleteWarga(req, res) {
  const targetId = parsePositiveSafeInteger(req.params.id);
  if (targetId === null) {
    return error(res, 400, 'Parameter id tidak valid.');
  }
  const posyanduId = req.user.posyandu_id;
  try {
    const { rows } = await pool.query('DELETE FROM warga WHERE id = $1 AND posyandu_id = $2 RETURNING *', [targetId, posyanduId]);
    if (rows.length === 0) {
      return error(res, 404, 'Warga tidak ditemukan atau tidak berada dalam posyandu Anda');
    }
    return success(res, rows[0], 'Warga berhasil dihapus');
  } catch (err) {
    console.error('deleteWarga error:', err);
    return error(res, 500, 'Terjadi kesalahan server saat menghapus warga');
  }
}

module.exports = {
  listWarga,
  getWargaById,
  createWarga,
  updateWarga,
  deleteWarga,
};
