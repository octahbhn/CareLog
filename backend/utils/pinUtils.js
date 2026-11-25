// backend/utils/pinUtils.js
// Utility functions for hashing and verifying 6‑digit PINs using Node.js crypto.scrypt.
// Stored format: "scrypt|N|r|p|saltHex|derivedHex"
// N, r, p are scrypt parameters; derived key length is 64 bytes.

const crypto = require('crypto');

// Default scrypt parameters (same as crypto.scrypt defaults)
const SCRYPT_PARAMS = {
  N: 16384, // CPU/memory cost factor
  r: 8,     // block size
  p: 1,     // parallelization factor
  keylen: 64 // derived key length in bytes
};

/**
 * Hash a 6‑digit PIN.
 * @param {string} pin - The PIN as a string of 6 digits.
 * @returns {Promise<string>} Stored hash string.
 */
async function hashPin(pin) {
  if (!/^\d{6}$/.test(pin)) {
    throw new Error('PIN must be a 6‑digit numeric string');
  }
  const salt = crypto.randomBytes(16);
  const derived = await new Promise((resolve, reject) => {
    crypto.scrypt(pin, salt, SCRYPT_PARAMS.keylen, {
      N: SCRYPT_PARAMS.N,
      r: SCRYPT_PARAMS.r,
      p: SCRYPT_PARAMS.p
    }, (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  });
  // Store parameters so we can verify later.
  return `scrypt|${SCRYPT_PARAMS.N}|${SCRYPT_PARAMS.r}|${SCRYPT_PARAMS.p}|${salt.toString('hex')}|${derived.toString('hex')}`;
}

/**
 * Verify a PIN against a stored hash.
 * @param {string} pin - The PIN to verify.
 * @param {string} stored - The stored hash string.
 * @returns {Promise<boolean>} True if match, false otherwise.
 */
async function verifyPin(pin, stored) {
  if (typeof stored !== 'string') return false;
  const parts = stored.split('|');
  if (parts.length !== 6) return false;
  const [algo, N, r, p, saltHex, derivedHex] = parts;
  if (algo !== 'scrypt') return false;
  const salt = Buffer.from(saltHex, 'hex');
  const derived = Buffer.from(derivedHex, 'hex');
  const keylen = derived.length;
  const newKey = await new Promise((resolve, reject) => {
    crypto.scrypt(pin, salt, keylen, {
      N: Number(N),
      r: Number(r),
      p: Number(p)
    }, (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  });
  // Constant‑time comparison
  return crypto.timingSafeEqual(derived, newKey);
}

module.exports = { hashPin, verifyPin };
