// backend/db/apply_schema.js – Execute schema.sql via pg client (idempotent)
// Uses only DB_* environment variables (no DATABASE_URL)

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

// Validate required DB_* environment variables
function getEnvVar(name) {
  const val = process.env[name];
  if (!val) {
    console.error(`❌ Missing required environment variable ${name}`);
    process.exit(1);
  }
  return val;
}

// Additional validation for DB_PORT (must be integer 1‑65535)
function getPort() {
  const portStr = getEnvVar('DB_PORT');
  const port = Number(portStr);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error('❌ DB_PORT must be an integer between 1 and 65535');
    process.exit(1);
  }
  return port;
}

const clientConfig = {
  user: getEnvVar('DB_USER'),
  host: getEnvVar('DB_HOST'),
  database: getEnvVar('DB_NAME'),
  password: getEnvVar('DB_PASSWORD'),
  port: getPort(),
};

(async () => {
  const client = new Client(clientConfig);
  try {
    await client.connect();
    const sql = fs.readFileSync(path.resolve(__dirname, 'schema.sql'), 'utf8');
    // Execute the whole schema file in a single query.
    await client.query(sql);
    console.log('✅ Schema applied');
  } catch (e) {
    console.error('❌ Schema apply error:', e);
    process.exitCode = 1;
  } finally {
    try {
      await client.end();
    } catch (_) {}
  }
})();