import dotenv from 'dotenv';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// Load .env file
dotenv.config();

/**
 * Mendapatkan JWT Secret dengan tingkat fallback aman:
 * 1. process.env.JWT_SECRET
 * 2. Mencari di file lokal jwt_secret.txt
 * 3. Generate kunci ephemeral acak (hanya untuk testing lokal)
 */
function getJwtSecret() {
  if (process.env.JWT_SECRET && process.env.JWT_SECRET !== 'ephemeral_secret_change_me_in_production_12345') {
    return process.env.JWT_SECRET;
  }

  const secretFilePath = path.resolve('jwt_secret.txt');
  if (fs.existsSync(secretFilePath)) {
    return fs.readFileSync(secretFilePath, 'utf-8').trim();
  }

  // Jika tidak ada di env dan tidak ada di file, generate ephemeral secret
  console.warn("WARNING [Security]: JWT_SECRET tidak diatur atau default. Membuat ephemeral secret acak untuk instansi lokal!");
  const ephemeralSecret = crypto.randomBytes(32).toString('hex');
  
  try {
    fs.writeFileSync(secretFilePath, ephemeralSecret, 'utf-8');
    console.log("SUCCESS [Security]: Ephemeral JWT_SECRET disimpan di jwt_secret.txt untuk persistensi sesi lokal.");
  } catch (err) {
    console.error("ERROR [Security]: Gagal menulis ephemeral JWT_SECRET ke disk:", err.message);
  }

  return ephemeralSecret;
}

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  jwtSecret: getJwtSecret(),
  databaseFile: process.env.DATABASE_FILE || 'database.sqlite',
  allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:5173').split(','),
  geminiApiKey: process.env.GEMINI_API_KEY || ''
};
