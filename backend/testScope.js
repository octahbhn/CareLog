
// backend/testScope.js

/**
 * CARELOG - SCOPE BASED AUTHORIZATION TEST
 *
 * Pengujian hak akses berdasarkan role:
 * 1. Warga
 * 2. Kader
 * 3. Puskesmas
 * 4. Unknown role
 *
 * Seluruh fixture dibuat menggunakan satu transaksi database.
 * Setelah pengujian selesai, transaksi akan di-ROLLBACK.
 */

const { randomInt } = require('crypto');

// Menggunakan Pool yang sama dengan aplikasi CareLog
const pool = require('./config/db');

// Mengambil helper authorization
const {
  canAccessWarga,
  canAccessExamination
} = require('./middleware/scopeMiddleware');


(async () => {

  let client = null;
  let transactionStarted = false;
  let assertionCount = 0;

  try {

    // =====================================================
    // 1. KONEKSI DATABASE
    // =====================================================

    client = await pool.connect();

    console.log('\n========================================');
    console.log(' CARELOG SCOPE AUTHORIZATION TEST');
    console.log('========================================\n');

    await client.query('BEGIN');
    transactionStarted = true;

    console.log('--- BEGIN TEST TRANSACTION ---');


    // =====================================================
    // 2. TANGGAL PEMERIKSAAN
    // =====================================================

    const now = new Date();

    const pad = (value) =>
      String(value).padStart(2, '0');

    // Period wajib menggunakan tanggal pertama bulan berjalan
    const firstDayOfMonth =
      `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;

    // Tanggal lokal untuk exam_date
    const today =
      `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;


    // =====================================================
    // 3. HELPER ASSERTION
    // =====================================================

    const assert = (description, condition) => {

      assertionCount++;

      if (!condition) {
        console.log(`✖ FAIL: ${description}`);
        throw new Error(
          `Assertion failed: ${description}`
        );
      }

      console.log(`✔ PASS: ${description}`);
    };


    // =====================================================
    // 4. HELPER NIK TEST
    // =====================================================

    const generateTestNik = () => {

      // Menghasilkan NIK numerik 16 digit
      return (
        '9' +
        Date.now().toString().slice(-12) +
        String(randomInt(100, 1000))
      );
    };


    // =====================================================
    // 5. LOAD DEMO USERS
    // =====================================================

    console.log('\n[1] LOAD DEMO USERS');

    const demoResult = await client.query(
      `
            SELECT
                u.id,
                u.nik,
                u.warga_id,
                u.posyandu_id,
                w.posyandu_id AS warga_posyandu_id,
                r.name AS role
            FROM users u
            JOIN roles r
                ON u.role_id = r.id
            LEFT JOIN warga AS w
                ON w.id = u.warga_id
            WHERE u.nik IN (
                '1234567890123456',
                '1111222233334444',
                '9999888877776666'
            )
            `
    );

    const users = {};

    for (const row of demoResult.rows) {
      users[row.role] = row;
    }


    // Memastikan akun demo tersedia
    const requiredRoles = [
      'warga',
      'kader',
      'puskesmas'
    ];

    for (const role of requiredRoles) {

      if (!users[role]) {
        throw new Error(
          `Akun demo dengan role ${role} tidak ditemukan.`
        );
      }
    }

    // Memastikan akun Warga terhubung dengan profil
    if (!users.warga.warga_id) {
      throw new Error(
        'Akun Warga belum terhubung dengan profil Warga.'
      );
    }

    // Mengambil Posyandu dari tabel warga
    if (!users.warga.warga_posyandu_id) {
      throw new Error(
        'Profil Warga belum memiliki Posyandu.'
      );
    }

    // Memastikan Kader berada pada Posyandu yang sama
    if (
      Number(users.kader.posyandu_id) !==
      Number(users.warga.warga_posyandu_id)
    ) {
      throw new Error(
        'Kader demo tidak berada pada Posyandu Warga demo.'
      );
    }

    console.log('✔ Akun Warga ditemukan');
    console.log('✔ Akun Kader ditemukan');
    console.log('✔ Akun Puskesmas ditemukan');
    console.log('✔ Relasi Warga dan Posyandu ditemukan');


    // =====================================================
    // 6. TEMPLATE DATA WARGA
    // =====================================================

    const wargaTemplateResult = await client.query(
      `
            SELECT
                gender,
                target_group
            FROM warga
            WHERE id = $1
            `,
      [users.warga.warga_id]
    );

    if (wargaTemplateResult.rows.length === 0) {
      throw new Error(
        'Data template Warga tidak ditemukan.'
      );
    }

    const wargaTemplate = wargaTemplateResult.rows[0];


    // =====================================================
    // 7. ROLE ID
    // =====================================================

    const roleResult = await client.query(
      `
            SELECT id, name
            FROM roles
            WHERE name IN ('kader', 'puskesmas')
            `
    );

    const roleIds = {};

    for (const row of roleResult.rows) {
      roleIds[row.name] = row.id;
    }

    if (!roleIds.kader || !roleIds.puskesmas) {
      throw new Error(
        'Role Kader atau Puskesmas tidak ditemukan.'
      );
    }


    // =====================================================
    // 8. HELPER MEMBUAT POSYANDU
    // =====================================================

    const createPosyandu = async (puskesmasId) => {

      const result = await client.query(
        `
                INSERT INTO posyandu (
                    name,
                    address,
                    puskesmas_id
                )
                VALUES ($1, $2, $3)
                RETURNING id
                `,
        [
          `Posyandu Test ${generateTestNik()}`,
          'Alamat Pengujian CareLog',
          puskesmasId
        ]
      );

      return result.rows[0].id;
    };


    // =====================================================
    // 9. HELPER MEMBUAT AKUN KADER
    // =====================================================

    const createKader = async (posyanduId) => {

      const result = await client.query(
        `
                INSERT INTO users (
                    nik,
                    pin_hash,
                    role_id,
                    posyandu_id
                )
                VALUES ($1, $2, $3, $4)
                RETURNING id
                `,
        [
          generateTestNik(),
          'TEST-ONLY-NOT-FOR-LOGIN',
          roleIds.kader,
          posyanduId
        ]
      );

      return result.rows[0].id;
    };


    // =====================================================
    // 10. HELPER MEMBUAT WARGA
    // =====================================================

    const createWarga = async (posyanduId) => {

      const result = await client.query(
        `
                INSERT INTO warga (
                    nik,
                    full_name,
                    birth_date,
                    gender,
                    address,
                    target_group,
                    family_id,
                    posyandu_id
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING id
                `,
        [
          generateTestNik(),
          'Warga Pengujian CareLog',
          '2020-01-01',
          wargaTemplate.gender,
          'Alamat Pengujian CareLog',
          wargaTemplate.target_group,
          null,
          posyanduId
        ]
      );

      return result.rows[0].id;
    };


    // =====================================================
    // 11. HELPER MEMBUAT PEMERIKSAAN
    // =====================================================

    const createExamination = async (
      wargaId,
      examinerId,
      posyanduId
    ) => {

      const result = await client.query(
        `
                INSERT INTO examinations (
                    warga_id,
                    examiner_id,
                    posyandu_id,
                    period,
                    exam_date
                )
                VALUES ($1, $2, $3, $4, $5)
                RETURNING id
                `,
        [
          wargaId,
          examinerId,
          posyanduId,
          firstDayOfMonth,
          today
        ]
      );

      return result.rows[0].id;
    };


    // =====================================================
    // 12. MEMBUAT FIXTURE POSYANDU KEDUA
    // =====================================================

    console.log('\n[2] CREATE TEST FIXTURES');

    // Posyandu kedua masih di bawah Puskesmas demo
    const otherPosyanduId = await createPosyandu(
      users.puskesmas.id
    );

    // Kader dan Warga pada Posyandu kedua
    const otherKaderId = await createKader(
      otherPosyanduId
    );

    const otherWargaId = await createWarga(
      otherPosyanduId
    );

    console.log('✔ Posyandu kedua dibuat');
    console.log('✔ Kader kedua dibuat');
    console.log('✔ Warga kedua dibuat');


    // =====================================================
    // 13. MEMBUAT PUSKESMAS KEDUA
    // =====================================================

    const otherPuskesmasResult = await client.query(
      `
            INSERT INTO users (
                nik,
                pin_hash,
                role_id
            )
            VALUES ($1, $2, $3)
            RETURNING id
            `,
      [
        generateTestNik(),
        'TEST-ONLY-NOT-FOR-LOGIN',
        roleIds.puskesmas
      ]
    );

    const otherPuskesmasId =
      otherPuskesmasResult.rows[0].id;

    // Posyandu di bawah Puskesmas kedua
    const otherPosyandu2Id = await createPosyandu(
      otherPuskesmasId
    );

    // Kader dan Warga milik Puskesmas kedua
    const otherKader2Id = await createKader(
      otherPosyandu2Id
    );

    const otherWarga2Id = await createWarga(
      otherPosyandu2Id
    );

    console.log('✔ Puskesmas kedua dibuat');
    console.log('✔ Posyandu Puskesmas kedua dibuat');
    console.log('✔ Kader Puskesmas kedua dibuat');
    console.log('✔ Warga Puskesmas kedua dibuat');


    // =====================================================
    // 14. MEMBUAT DATA PEMERIKSAAN
    // =====================================================

    console.log('\n[3] PREPARE EXAMINATION FIXTURES');

    // Memeriksa apakah Warga demo sudah mempunyai
    // pemeriksaan pada periode bulan berjalan
    const ownExamResult = await client.query(
      `
            SELECT id
            FROM examinations
            WHERE warga_id = $1
              AND posyandu_id = $2
              AND period = $3
            LIMIT 1
            `,
      [
        users.warga.warga_id,
        users.warga.warga_posyandu_id,
        firstDayOfMonth
      ]
    );

    let ownExamId;

    if (ownExamResult.rows.length > 0) {

      ownExamId = ownExamResult.rows[0].id;

    } else {

      ownExamId = await createExamination(
        users.warga.warga_id,
        users.kader.id,
        users.warga.warga_posyandu_id
      );
    }

    // Pemeriksaan Warga Posyandu kedua
    const otherExamId = await createExamination(
      otherWargaId,
      otherKaderId,
      otherPosyanduId
    );

    // Pemeriksaan Warga Puskesmas kedua
    const otherExam2Id = await createExamination(
      otherWarga2Id,
      otherKader2Id,
      otherPosyandu2Id
    );

    console.log('✔ Pemeriksaan Warga demo tersedia');
    console.log('✔ Pemeriksaan Posyandu kedua dibuat');
    console.log('✔ Pemeriksaan Puskesmas kedua dibuat');


    // =====================================================
    // 15. TEST WARGA
    // =====================================================

    console.log('\n[4] TEST WARGA AUTHORIZATION');

    assert(
      'Warga dapat mengakses profil sendiri',
      await canAccessWarga(
        users.warga,
        users.warga.warga_id,
        client
      )
    );

    assert(
      'Warga tidak dapat mengakses profil orang lain',
      !(await canAccessWarga(
        users.warga,
        otherWargaId,
        client
      ))
    );

    assert(
      'Warga dapat membaca pemeriksaan sendiri',
      await canAccessExamination(
        users.warga,
        ownExamId,
        client
      )
    );

    assert(
      'Warga tidak dapat membaca pemeriksaan orang lain',
      !(await canAccessExamination(
        users.warga,
        otherExamId,
        client
      ))
    );


    // =====================================================
    // 16. TEST KADER
    // =====================================================

    console.log('\n[5] TEST KADER AUTHORIZATION');

    assert(
      'Kader dapat mengakses Warga di Posyandu sendiri',
      await canAccessWarga(
        users.kader,
        users.warga.warga_id,
        client
      )
    );

    assert(
      'Kader tidak dapat mengakses Warga Posyandu lain',
      !(await canAccessWarga(
        users.kader,
        otherWargaId,
        client
      ))
    );

    assert(
      'Kader dapat mengakses pemeriksaan Posyandu sendiri',
      await canAccessExamination(
        users.kader,
        ownExamId,
        client
      )
    );

    assert(
      'Kader tidak dapat mengakses pemeriksaan Posyandu lain',
      !(await canAccessExamination(
        users.kader,
        otherExamId,
        client
      ))
    );


    // =====================================================
    // 17. TEST PUSKESMAS
    // =====================================================

    console.log('\n[6] TEST PUSKESMAS AUTHORIZATION');

    assert(
      'Puskesmas dapat mengakses Warga di bawah pengawasannya',
      await canAccessWarga(
        users.puskesmas,
        users.warga.warga_id,
        client
      )
    );

    assert(
      'Puskesmas dapat mengakses Warga Posyandu lain yang diawasi',
      await canAccessWarga(
        users.puskesmas,
        otherWargaId,
        client
      )
    );

    assert(
      'Puskesmas tidak dapat mengakses Warga Puskesmas lain',
      !(await canAccessWarga(
        users.puskesmas,
        otherWarga2Id,
        client
      ))
    );

    assert(
      'Puskesmas dapat membaca pemeriksaan di bawah pengawasannya',
      await canAccessExamination(
        users.puskesmas,
        ownExamId,
        client
      )
    );

    assert(
      'Puskesmas dapat membaca pemeriksaan Posyandu yang diawasi',
      await canAccessExamination(
        users.puskesmas,
        otherExamId,
        client
      )
    );

    assert(
      'Puskesmas tidak dapat membaca pemeriksaan Puskesmas lain',
      !(await canAccessExamination(
        users.puskesmas,
        otherExam2Id,
        client
      ))
    );


    // =====================================================
    // 18. TEST UNKNOWN ROLE
    // =====================================================

    console.log('\n[7] TEST UNKNOWN ROLE');

    const unknownUser = {
      id: 999999,
      role: 'alien',
      warga_id: null,
      posyandu_id: null
    };

    assert(
      'Unknown role tidak dapat mengakses data Warga',
      !(await canAccessWarga(
        unknownUser,
        users.warga.warga_id,
        client
      ))
    );

    assert(
      'Unknown role tidak dapat mengakses pemeriksaan',
      !(await canAccessExamination(
        unknownUser,
        ownExamId,
        client
      ))
    );


    // =====================================================
    // 19. HASIL PENGUJIAN
    // =====================================================

    console.log('\n========================================');
    console.log(' TEST RESULT');
    console.log('========================================');

    console.log(`Total assertion berhasil: ${assertionCount}`);
    console.log('Status: ALL TESTS PASSED');
    console.log('Exit code: 0');


  } catch (err) {

    console.error('\n========================================');
    console.error(' TEST FAILED');
    console.error('========================================');

    console.error('Message:', err.message);

    if (err.code) {
      console.error('PostgreSQL error code:', err.code);
    }

    process.exitCode = 1;

  } finally {

    // =====================================================
    // 20. ROLLBACK
    // =====================================================

    if (client && transactionStarted) {

      try {

        await client.query('ROLLBACK');

        console.log('\n--- TRANSACTION ROLLED BACK ---');

      } catch (rollbackError) {

        console.error(
          'Rollback gagal:',
          rollbackError.message
        );

        process.exitCode = 1;
      }
    }

    // Melepaskan client
    if (client) {
      client.release();
    }

    // Menutup Pool
    try {

      await pool.end();

    } catch (closeError) {

      console.error(
        'Gagal menutup database pool:',
        closeError.message
      );

      process.exitCode = 1;
    }

    console.log('Database connection closed.');
    console.log('========================================\n');
  }

})();