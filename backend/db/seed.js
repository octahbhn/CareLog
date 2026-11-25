/*
  seed.js – Populate CareLog demo data (idempotent)
  ----------------------------------------------------
  Usage (PowerShell Windows):
      node backend\db\seed.js

  Prasyarat:
    - .env berada di folder backend/ (path absolut dihitung otomatis)
    - npm i bcryptjs pg dotenv
*/

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const pool = require('../config/db');
const { hashPin } = require('../utils/pinUtils');




/* ---------- Upsert utilities (idempotent) ---------- */
async function upsertRole(client, name) {
  const res = await client.query(
    `INSERT INTO roles (name) VALUES ($1)
     ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [name]
  );
  return res.rows[0].id;
}

async function upsertUser(client, { nik, pin, roleId, wargaId = null, posyanduId = null }) {
  const pinHash = await hashPin(pin);
  const res = await client.query(
    `INSERT INTO users (nik, pin_hash, role_id, warga_id, posyandu_id)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (nik) DO UPDATE
        SET pin_hash = EXCLUDED.pin_hash,
            role_id  = EXCLUDED.role_id,
            warga_id = EXCLUDED.warga_id,
            posyandu_id = EXCLUDED.posyandu_id
     RETURNING id`,
    [nik, pinHash, roleId, wargaId, posyanduId]
  );
  return res.rows[0].id;
}

async function upsertFamily(client, { name, address }) {
  // Cari dulu berdasarkan nama + alamat; kalau ada, gunakan id itu.
  const sel = await client.query(
    `SELECT id FROM families WHERE name = $1 AND address = $2`,
    [name, address]
  );
  if (sel.rows.length > 0) return sel.rows[0].id;
  // Insert baru
  const ins = await client.query(
    `INSERT INTO families (name, address) VALUES ($1,$2) RETURNING id`,
    [name, address]
  );
  return ins.rows[0].id;
}

async function upsertPosyandu(client, { name, address, puskesmasId }) {
  // Cari Posyandu berdasarkan kombinasi name+address (bisnis tidak harus unik, tapi untuk demo kami gunakan ini)
  const sel = await client.query(
    `SELECT id FROM posyandu WHERE name = $1 AND address = $2`,
    [name, address]
  );
  if (sel.rows.length > 0) {
    // Pastikan puskesmas_id tetap sinkron
    await client.query(
      `UPDATE posyandu SET puskesmas_id = $2 WHERE id = $1`,
      [sel.rows[0].id, puskesmasId]
    );
    return sel.rows[0].id;
  }
  const ins = await client.query(
    `INSERT INTO posyandu (name, address, puskesmas_id) VALUES ($1,$2,$3) RETURNING id`,
    [name, address, puskesmasId]
  );
  return ins.rows[0].id;
}

async function upsertWarga(client, {
  nik, fullName, birthDate, gender, address,
  targetGroup, familyId, posyanduId
}) {
  const res = await client.query(
    `INSERT INTO warga (nik, full_name, birth_date, gender, address, target_group, family_id, posyandu_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (nik) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        birth_date = EXCLUDED.birth_date,
        gender = EXCLUDED.gender,
        address = EXCLUDED.address,
        target_group = EXCLUDED.target_group,
        family_id = EXCLUDED.family_id,
        posyandu_id = EXCLUDED.posyandu_id
     RETURNING id`,
    [nik, fullName, birthDate, gender, address, targetGroup, familyId, posyanduId]
  );
  return res.rows[0].id;
}

/* ---------- Main ---------- */
(async () => {
  const client = await pool.connect();
  // No need to call client.connect() when using a Pool



  try {
    await client.query('BEGIN');

    // 1. Roles ---------------------------------------------------
    const roleIds = {
      warga:    await upsertRole(client, 'warga'),
      kader:    await upsertRole(client, 'kader'),
      puskesmas:await upsertRole(client, 'puskesmas')
    };

    // 2. Akun Puskesmas (supervisor) ---------------------------
    const puskesmasUserId = await upsertUser(client, {
      nik: '9999888877776666',
      pin: '111111',
      roleId: roleIds.puskesmas
    });

    // 3. Posyandu demo (terhubung ke puskesmas) ---------------
    const posyanduId = await upsertPosyandu(client, {
      name: 'Posyandu Mangunsari',
      address: 'Jl. Mangunsari No.12, Kota X',
      puskesmasId: puskesmasUserId
    });

    // 4. Keluarga demo ------------------------------------------
    const familyId = await upsertFamily(client, {
      name: 'Keluarga Sumarno',
      address: 'Jl. Mangunsari No.12, Kota X'
    });

    // 5. Profil Warga demo --------------------------------------
    const wargaId = await upsertWarga(client, {
      nik: '1234567890123456',
      fullName: 'Budi Sumarno',
      birthDate: '2022-03-15',
      gender: 'Laki‑laki',
      address: 'Jl. Mangunsari No.12, Kota X',
      targetGroup: 'bayi_balita',
      familyId,
      posyanduId
    });

    // 6. Hubungkan akun warga ke profil (idempotent) -----------
    await upsertUser(client, {
      nik: '1234567890123456',
      pin: '123456',
      roleId: roleIds.warga,
      wargaId
    });

    // 7. Anggota keluarga – sumber kebenaran utama -------------
    await client.query(
      `INSERT INTO family_members (family_id, warga_id, relation)
       VALUES ($1,$2,$3)
       ON CONFLICT (family_id, warga_id) DO NOTHING`,
      [familyId, wargaId, 'anak']
    );

    // 8. Akun Kader – terhubung ke Posyandu yang sama -----------
    const kaderUserId = await upsertUser(client, {
      nik: '1111222233334444',
      pin: '654321',
      roleId: roleIds.kader,
      posyanduId: posyanduId
    });

    // 9. Pemeriksaan bulanan (periode = tanggal pertama bulan ini) -----
    const now = new Date();
    const period = new Date(now.getFullYear(), now.getMonth(), 1); // first day of current month
    const examDate = now.toISOString().split('T')[0]; // hari ini

    const examRes = await client.query(
      `INSERT INTO examinations (warga_id, examiner_id, posyandu_id, period, exam_date)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (warga_id, period, posyandu_id) DO UPDATE
          SET examiner_id = EXCLUDED.examiner_id,
              exam_date   = EXCLUDED.exam_date
       RETURNING id`,
      [wargaId, kaderUserId, posyanduId, period, examDate]
    );
    const examId = examRes.rows[0].id;

    // 10. Detail pemeriksaan (demo) ---------------------------------
    const demoMetrics = [
      { key: 'berat_badan', numeric: 13.5 },
      { key: 'tinggi_badan', numeric: 95 },
      { key: 'status_imunisasi', text: 'Lengkap' }
    ];
    for (const m of demoMetrics) {
      await client.query(
        `INSERT INTO examination_details (examination_id, metric_key, value_numeric, value_text, value_boolean)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (examination_id, metric_key) DO UPDATE
            SET value_numeric = EXCLUDED.value_numeric,
                value_text    = EXCLUDED.value_text,
                value_boolean = EXCLUDED.value_boolean`,
        [examId, m.key, m.numeric ?? null, m.text ?? null, m.boolean ?? null]
      );
    }

    await client.query('COMMIT');
    console.log('✅ Seed selesai – tidak ada duplikasi.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seed gagal:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }

})();
