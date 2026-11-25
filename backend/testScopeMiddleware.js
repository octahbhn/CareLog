
// backend/testScopeMiddleware.js

/**
 * CARELOG - SCOPE AUTHORIZATION MIDDLEWARE TEST
 *
 * Menguji middleware:
 * 1. createRequireWargaScope
 * 2. createRequireExaminationScope
 * 3. createRequireExaminationCreateScope
 *
 * HTTP status yang diuji:
 * 200, 201, 400, 401, 403
 *
 * Seluruh fixture menggunakan satu transaksi database.
 * Setelah selesai, semua perubahan di-ROLLBACK.
 */

const express = require('express');
const request = require('supertest');
const { randomInt } = require('crypto');

const pool = require('./config/db');

const {
    createRequireWargaScope,
    createRequireExaminationScope,
    createRequireExaminationCreateScope
} = require('./middleware/scopeMiddleware');


(async () => {

    let client = null;
    let transactionStarted = false;
    let assertionCount = 0;

    // =========================================================
    // HELPER ASSERTION
    // =========================================================

    const assert = (description, condition) => {

        assertionCount++;

        if (!condition) {
            console.log(`✖ FAIL: ${description}`);
            throw new Error(`Assertion failed: ${description}`);
        }

        console.log(`✔ PASS: ${description}`);
    };


    // =========================================================
    // HELPER HTTP ASSERTION
    // =========================================================

    const checkHttp = async (
        description,
        responsePromise,
        expectedStatus
    ) => {

        const response = await responsePromise;

        assert(
            `${description} (HTTP ${expectedStatus})`,
            response.status === expectedStatus
        );

        return response;
    };


    // =========================================================
    // HELPER NIK TEST
    // =========================================================

    const generateTestNik = () => {

        const timePart = String(Date.now()).slice(-10);
        const randomPart = String(
            randomInt(0, 1000000)
        ).padStart(6, '0');

        return `${timePart}${randomPart}`;
    };


    try {

        // =====================================================
        // 1. KONEKSI DATABASE
        // =====================================================

        client = await pool.connect();

        console.log('\n========================================');
        console.log(' CARELOG SCOPE MIDDLEWARE TEST');
        console.log('========================================\n');

        await client.query('BEGIN');
        transactionStarted = true;

        console.log('--- BEGIN TEST TRANSACTION ---');


        // =====================================================
        // 2. LOAD DEMO USERS
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
            LEFT JOIN warga w
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

        for (const role of ['warga', 'kader', 'puskesmas']) {

            if (!users[role]) {
                throw new Error(
                    `Akun demo ${role} tidak ditemukan.`
                );
            }
        }

        if (!users.warga.warga_id ||
            !users.warga.warga_posyandu_id) {

            throw new Error(
                'Profil Warga belum terhubung dengan Posyandu.'
            );
        }

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


        // =====================================================
        // 3. LOAD ROLE ID
        // =====================================================

        const rolesResult = await client.query(
            `
            SELECT id, name
            FROM roles
            WHERE name IN ('kader', 'puskesmas')
            `
        );

        const roleIds = {};

        for (const row of rolesResult.rows) {
            roleIds[row.name] = row.id;
        }

        if (!roleIds.kader || !roleIds.puskesmas) {
            throw new Error('Role Kader atau Puskesmas tidak ditemukan.');
        }


        // =====================================================
        // 4. TEMPLATE WARGA
        // =====================================================

        const templateResult = await client.query(
            `
            SELECT gender, target_group
            FROM warga
            WHERE id = $1
            `,
            [users.warga.warga_id]
        );

        if (templateResult.rows.length === 0) {
            throw new Error('Template data Warga tidak ditemukan.');
        }

        const wargaTemplate = templateResult.rows[0];


        // =====================================================
        // 5. HELPER MEMBUAT POSYANDU
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
                    `Posyandu Middleware ${generateTestNik()}`,
                    'Alamat Pengujian',
                    puskesmasId
                ]
            );

            return result.rows[0].id;
        };


        // =====================================================
        // 6. HELPER MEMBUAT KADER
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
        // 7. HELPER MEMBUAT WARGA
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
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
                RETURNING id
                `,
                [
                    generateTestNik(),
                    'Warga Test Middleware',
                    '2020-01-01',
                    wargaTemplate.gender,
                    'Alamat Test Middleware',
                    wargaTemplate.target_group,
                    null,
                    posyanduId
                ]
            );

            return result.rows[0].id;
        };


        // =====================================================
        // 8. HELPER MEMBUAT PEMERIKSAAN
        // =====================================================

        const createExamination = async (
            wargaId,
            examinerId,
            posyanduId
        ) => {

            const now = new Date();

            const period =
                `${now.getFullYear()}-${String(
                    now.getMonth() + 1
                ).padStart(2, '0')}-01`;

            const examDate =
                `${now.getFullYear()}-${String(
                    now.getMonth() + 1
                ).padStart(2, '0')}-${String(
                    now.getDate()
                ).padStart(2, '0')}`;

            const result = await client.query(
                `
                INSERT INTO examinations (
                    warga_id,
                    examiner_id,
                    posyandu_id,
                    period,
                    exam_date
                )
                VALUES ($1,$2,$3,$4,$5)
                RETURNING id
                `,
                [
                    wargaId,
                    examinerId,
                    posyanduId,
                    period,
                    examDate
                ]
            );

            return result.rows[0].id;
        };


        // =====================================================
        // 9. MEMBUAT FIXTURE POSYANDU KEDUA
        // =====================================================

        console.log('\n[2] CREATE TEST FIXTURES');

        const otherPosyanduId = await createPosyandu(
            users.puskesmas.id
        );

        const otherKaderId = await createKader(
            otherPosyanduId
        );

        const otherWargaId = await createWarga(
            otherPosyanduId
        );


        // =====================================================
        // 10. MEMBUAT PUSKESMAS KEDUA
        // =====================================================

        const otherPuskesmasResult = await client.query(
            `
            INSERT INTO users (
                nik,
                pin_hash,
                role_id
            )
            VALUES ($1,$2,$3)
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

        const otherPosyandu2Id = await createPosyandu(
            otherPuskesmasId
        );

        const otherKader2Id = await createKader(
            otherPosyandu2Id
        );

        const otherWarga2Id = await createWarga(
            otherPosyandu2Id
        );

        console.log('✔ Fixture Posyandu kedua dibuat');
        console.log('✔ Fixture Warga kedua dibuat');
        console.log('✔ Fixture Kader kedua dibuat');
        console.log('✔ Fixture Puskesmas kedua dibuat');


        // =====================================================
        // 11. MEMBUAT DATA PEMERIKSAAN
        // =====================================================

        console.log('\n[3] CREATE EXAMINATION FIXTURES');

        const now = new Date();

        const currentPeriod =
            `${now.getFullYear()}-${String(
                now.getMonth() + 1
            ).padStart(2, '0')}-01`;

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
                currentPeriod
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

        const otherExamId = await createExamination(
            otherWargaId,
            otherKaderId,
            otherPosyanduId
        );

        const otherExam2Id = await createExamination(
            otherWarga2Id,
            otherKader2Id,
            otherPosyandu2Id
        );

        console.log('✔ Pemeriksaan Warga demo tersedia');
        console.log('✔ Pemeriksaan Posyandu kedua dibuat');
        console.log('✔ Pemeriksaan Puskesmas kedua dibuat');


        // =====================================================
        // 12. MEMBUAT EXPRESS TEST APPLICATION
        // =====================================================

        console.log('\n[4] SETUP EXPRESS TEST ROUTES');

        const app = express();

        app.use(express.json());

        // Middleware khusus pengujian.
        // Mengambil user berdasarkan header test.
        // Ini bukan middleware autentikasi produksi.
        const attachTestUser = (req, res, next) => {

            const role = req.get('x-test-role');

            if (role && users[role]) {
                req.user = users[role];
            }

            next();
        };


        // Route tanpa user untuk menguji 401
        app.get(
            '/unauth/warga/:id',
            createRequireWargaScope(client),
            (req, res) => res.status(200).json({ ok: true })
        );

        app.post(
            '/unauth/examinations',
            createRequireExaminationCreateScope(client),
            (req, res) => res.status(201).json({ ok: true })
        );


        // Route pengujian akses Warga
        app.get(
            '/warga/:id',
            attachTestUser,
            createRequireWargaScope(client),
            (req, res) => res.status(200).json({ ok: true })
        );


        // Route pengujian akses pemeriksaan
        app.get(
            '/examinations/:id',
            attachTestUser,
            createRequireExaminationScope(client),
            (req, res) => res.status(200).json({ ok: true })
        );


        // Route pengujian pembuatan pemeriksaan
        app.post(
            '/examinations',
            attachTestUser,
            createRequireExaminationCreateScope(client),
            (req, res) => {
                return res.status(201).json(req.body);
            }
        );

        console.log('✔ Express test routes siap');


        // =====================================================
        // 13. TEST WARGA SCOPE
        // =====================================================

        console.log('\n[5] TEST WARGA SCOPE');

        await checkHttp(
            'Pengguna tanpa autentikasi ditolak',
            request(app).get(
                `/unauth/warga/${users.warga.warga_id}`
            ),
            401
        );

        await checkHttp(
            'ID Warga tidak valid ditolak',
            request(app)
                .get('/warga/12abc')
                .set('x-test-role', 'warga'),
            400
        );

        await checkHttp(
            'ID Warga di luar safe integer ditolak',
            request(app)
                .get('/warga/9007199254740992')
                .set('x-test-role', 'warga'),
            400
        );

        await checkHttp(
            'Warga dapat mengakses profil sendiri',
            request(app)
                .get(`/warga/${users.warga.warga_id}`)
                .set('x-test-role', 'warga'),
            200
        );

        await checkHttp(
            'Warga tidak dapat mengakses profil orang lain',
            request(app)
                .get(`/warga/${otherWargaId}`)
                .set('x-test-role', 'warga'),
            403
        );

        await checkHttp(
            'Kader dapat mengakses Warga Posyandu sendiri',
            request(app)
                .get(`/warga/${users.warga.warga_id}`)
                .set('x-test-role', 'kader'),
            200
        );

        await checkHttp(
            'Kader tidak dapat mengakses Warga Posyandu lain',
            request(app)
                .get(`/warga/${otherWargaId}`)
                .set('x-test-role', 'kader'),
            403
        );

        await checkHttp(
            'Puskesmas dapat mengakses Warga yang diawasi',
            request(app)
                .get(`/warga/${users.warga.warga_id}`)
                .set('x-test-role', 'puskesmas'),
            200
        );

        await checkHttp(
            'Puskesmas dapat mengakses Posyandu lain dalam pengawasannya',
            request(app)
                .get(`/warga/${otherWargaId}`)
                .set('x-test-role', 'puskesmas'),
            200
        );

        await checkHttp(
            'Puskesmas tidak dapat mengakses Warga Puskesmas lain',
            request(app)
                .get(`/warga/${otherWarga2Id}`)
                .set('x-test-role', 'puskesmas'),
            403
        );


        // =====================================================
        // 14. TEST EXAMINATION SCOPE
        // =====================================================

        console.log('\n[6] TEST EXAMINATION SCOPE');

        await checkHttp(
            'ID pemeriksaan tidak valid ditolak',
            request(app)
                .get('/examinations/1.5')
                .set('x-test-role', 'warga'),
            400
        );

        await checkHttp(
            'Warga dapat membaca pemeriksaan sendiri',
            request(app)
                .get(`/examinations/${ownExamId}`)
                .set('x-test-role', 'warga'),
            200
        );

        await checkHttp(
            'Warga tidak dapat membaca pemeriksaan orang lain',
            request(app)
                .get(`/examinations/${otherExamId}`)
                .set('x-test-role', 'warga'),
            403
        );

        await checkHttp(
            'Kader dapat membaca pemeriksaan Posyandu sendiri',
            request(app)
                .get(`/examinations/${ownExamId}`)
                .set('x-test-role', 'kader'),
            200
        );

        await checkHttp(
            'Kader tidak dapat membaca pemeriksaan Posyandu lain',
            request(app)
                .get(`/examinations/${otherExamId}`)
                .set('x-test-role', 'kader'),
            403
        );

        await checkHttp(
            'Puskesmas dapat membaca pemeriksaan yang diawasi',
            request(app)
                .get(`/examinations/${ownExamId}`)
                .set('x-test-role', 'puskesmas'),
            200
        );

        await checkHttp(
            'Puskesmas dapat membaca pemeriksaan Posyandu yang diawasi',
            request(app)
                .get(`/examinations/${otherExamId}`)
                .set('x-test-role', 'puskesmas'),
            200
        );

        await checkHttp(
            'Puskesmas tidak dapat membaca pemeriksaan Puskesmas lain',
            request(app)
                .get(`/examinations/${otherExam2Id}`)
                .set('x-test-role', 'puskesmas'),
            403
        );


        // =====================================================
        // 15. TEST EXAMINATION CREATE SCOPE
        // =====================================================

        console.log('\n[7] TEST EXAMINATION CREATE SCOPE');

        await checkHttp(
            'Pengguna tanpa autentikasi tidak dapat membuat pemeriksaan',
            request(app)
                .post('/unauth/examinations')
                .send({ warga_id: users.warga.warga_id }),
            401
        );

        await checkHttp(
            'warga_id yang tidak valid ditolak',
            request(app)
                .post('/examinations')
                .set('x-test-role', 'kader')
                .send({ warga_id: 'abc' }),
            400
        );

        await checkHttp(
            'Warga tidak boleh membuat pemeriksaan',
            request(app)
                .post('/examinations')
                .set('x-test-role', 'warga')
                .send({ warga_id: users.warga.warga_id }),
            403
        );

        await checkHttp(
            'Puskesmas tidak boleh membuat pemeriksaan',
            request(app)
                .post('/examinations')
                .set('x-test-role', 'puskesmas')
                .send({ warga_id: users.warga.warga_id }),
            403
        );


        // Kader membuat pemeriksaan untuk Warga Posyandu sendiri
        const createAllowedResponse = await checkHttp(
            'Kader dapat membuat pemeriksaan untuk Warga Posyandu sendiri',
            request(app)
                .post('/examinations')
                .set('x-test-role', 'kader')
                .send({
                    warga_id: users.warga.warga_id,

                    // Nilai palsu untuk memastikan server
                    // mengganti nilai berdasarkan req.user
                    examiner_id: 999999,
                    posyandu_id: 999999
                }),
            201
        );

        assert(
            'examiner_id ditentukan oleh server',
            Number(createAllowedResponse.body.examiner_id) ===
            Number(users.kader.id)
        );

        assert(
            'posyandu_id ditentukan oleh server',
            Number(createAllowedResponse.body.posyandu_id) ===
            Number(users.kader.posyandu_id)
        );

        assert(
            'warga_id dikonversi menjadi integer',
            Number(createAllowedResponse.body.warga_id) ===
            Number(users.warga.warga_id)
        );


        // Kader mencoba membuat pemeriksaan di Posyandu lain
        await checkHttp(
            'Kader tidak dapat membuat pemeriksaan untuk Posyandu lain',
            request(app)
                .post('/examinations')
                .set('x-test-role', 'kader')
                .send({ warga_id: otherWargaId }),
            403
        );


        // =====================================================
        // 16. TEST RESULT
        // =====================================================

        console.log('\n========================================');
        console.log(' MIDDLEWARE TEST RESULT');
        console.log('========================================');

        console.log(`Total assertion berhasil: ${assertionCount}`);
        console.log('Status: ALL TESTS PASSED');
        console.log('Exit code: 0');


    } catch (err) {

        console.error('\n========================================');
        console.error(' MIDDLEWARE TEST FAILED');
        console.error('========================================');

        console.error('Message:', err.message);

        if (err.code) {
            console.error('Database error code:', err.code);
        }

        process.exitCode = 1;

    } finally {

        // =====================================================
        // 17. ROLLBACK TRANSACTION
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

        if (client) {
            client.release();
        }

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