const express = require("express");
const cors = require("cors");
require("dotenv").config();

const pool = require("./config/db");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Endpoint untuk mengecek server
app.get("/", (req, res) => {
    res.json({
        message: "Backend CareLog berhasil berjalan!"
    });
});

// Endpoint untuk mengecek koneksi database
app.get("/api/residents", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM residents ORDER BY id ASC"
        );

        res.status(200).json({
            message: "Data warga berhasil diambil",
            data: result.rows
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Gagal mengambil data warga"
        });
    }
});

// POST tambah data warga
app.post("/api/residents", async (req, res) => {
    try {
        const {
            nik,
            name,
            birth_date,
            gender,
            category,
            address
        } = req.body;

        const result = await pool.query(
            `INSERT INTO residents
            (nik, name, birth_date, gender, category, address)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *`,
            [nik, name, birth_date, gender, category, address]
        );

        res.status(201).json({
            message: "Data warga berhasil ditambahkan",
            data: result.rows[0]
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Gagal menambahkan data warga"
        });
    }
});


 // POST menyimpan data pemeriksaan
app.post("/api/examinations", async (req, res) => {
    try {
        const {
            resident_id,
            examination_date,
            weight,
            height,
            head_circumference,
            arm_circumference,
            blood_pressure,
            abdominal_circumference,
            immunization_status,
            vitamin_status,
            fundal_height,
            gestational_age
        } = req.body;

        if (!resident_id || !examination_date) {
            return res.status(400).json({
                message: "Warga dan tanggal pemeriksaan wajib diisi."
            });
        }

        const result = await pool.query(
            `INSERT INTO examinations (
                resident_id,
                examination_date,
                weight,
                height,
                head_circumference,
                arm_circumference,
                blood_pressure,
                abdominal_circumference,
                immunization_status,
                vitamin_status,
                fundal_height,
                gestational_age
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING *`,
            [
                resident_id,
                examination_date,
                weight || null,
                height || null,
                head_circumference || null,
                arm_circumference || null,
                blood_pressure || null,
                abdominal_circumference || null,
                immunization_status || null,
                vitamin_status || null,
                fundal_height || null,
                gestational_age || null
            ]
        );

        res.status(201).json({
            message: "Data pemeriksaan berhasil disimpan.",
            data: result.rows[0]
        });

    } catch (error) {
        console.error("Error menyimpan pemeriksaan:", error);

        res.status(500).json({
            message: "Gagal menyimpan data pemeriksaan."
        });
    }
});

 // GET mengambil seluruh riwayat pemeriksaan
app.get("/api/examinations", async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT
                e.*,
                r.name AS resident_name,
                r.nik AS resident_nik,
                r.category AS resident_category
            FROM examinations e
            JOIN residents r ON e.resident_id = r.id
            ORDER BY e.examination_date DESC, e.id DESC`
        );

        res.status(200).json({
            message: "Riwayat pemeriksaan berhasil diambil",
            data: result.rows
        });

    } catch (error) {
        console.error("Error mengambil riwayat:", error);

        res.status(500).json({
            message: "Gagal mengambil riwayat pemeriksaan"
        });
    }
});

// Menjalankan server
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server CareLog berjalan di http://localhost:${PORT}`);
});

// PUT edit data warga
app.put("/api/residents/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const {
            nik,
            name,
            birth_date,
            gender,
            category,
            address
        } = req.body;

        const result = await pool.query(
            `UPDATE residents
             SET nik = $1,
                 name = $2,
                 birth_date = $3,
                 gender = $4,
                 category = $5,
                 address = $6
             WHERE id = $7
             RETURNING *`,
            [nik, name, birth_date, gender, category, address, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Data warga tidak ditemukan"
            });
        }

        res.status(200).json({
            message: "Data warga berhasil diperbarui",
            data: result.rows[0]
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Gagal memperbarui data warga"
        });
    }
});

// DELETE data warga
app.delete("/api/residents/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            "DELETE FROM residents WHERE id = $1 RETURNING *",
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Data warga tidak ditemukan"
            });
        }

        res.status(200).json({
            message: "Data warga berhasil dihapus",
            data: result.rows[0]
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Gagal menghapus data warga"
        });
    }
});