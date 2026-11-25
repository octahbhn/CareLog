// backend/config/db.js

const path = require('path');
const { Pool } = require('pg');

// Selalu membaca .env dari folder backend
require('dotenv').config({
    path: path.resolve(__dirname, '../.env')
});

// Validasi konfigurasi database
const requiredEnv = [
    'DB_USER',
    'DB_HOST',
    'DB_NAME',
    'DB_PASSWORD',
    'DB_PORT'
];

const missingEnv = requiredEnv.filter(
    key => !process.env[key]
);

if (missingEnv.length > 0) {
    throw new Error(
        `Konfigurasi database belum lengkap: ${missingEnv.join(', ')}`
    );
}

// Membuat satu koneksi Pool
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT),
});

// Event koneksi
pool.on('connect', () => {
    console.log('Berhasil terhubung ke PostgreSQL!');
});

pool.on('error', (err) => {
    console.error('Database error:', err);
});

module.exports = pool;