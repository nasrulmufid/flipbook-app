import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ROOT = path.resolve(__dirname, '..');
export const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT, 'data');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
export const CLIENT_DIST = path.join(ROOT, 'client', 'dist');
export const PORT = Number(process.env.PORT || 3001);
export const IS_PROD = process.env.NODE_ENV === 'production';

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// JWT secret: env > persisted file (generated on first run)
function loadSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  const file = path.join(DATA_DIR, '.jwt_secret');
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8').trim();
  const secret = crypto.randomBytes(48).toString('hex');
  fs.writeFileSync(file, secret, { mode: 0o600 });
  return secret;
}
export const JWT_SECRET = loadSecret();

export const ADMIN_USER = process.env.ADMIN_USER || 'admin';
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// Ukuran output gambar (sama dengan struktur referensi: page / large / thumb)
export const IMAGE = {
  pageWidth: 1655,
  largeWidth: 2480,
  thumbWidth: 200,
  maxUploadBytes: 30 * 1024 * 1024,
  maxFilesPerRequest: 100,
};
