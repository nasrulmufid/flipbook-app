import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { UPLOAD_DIR, IMAGE } from './config.js';

export const bookDir = (bookId) => path.join(UPLOAD_DIR, 'books', String(bookId));

export function pageUrls(bookId, file) {
  const base = `/uploads/books/${bookId}`;
  return { n: `${base}/page/${file}`, l: `${base}/large/${file}`, t: `${base}/thumb/${file}` };
}

/**
 * Proses 1 gambar upload menjadi 3 varian (sama seperti struktur referensi):
 *   page/  → tampilan normal (lebar maks 1655px)
 *   large/ → saat zoom (lebar maks 2480px)
 *   thumb/ → thumbnail panel (lebar 200px)
 */
export async function processUpload(buffer, bookId) {
  const id = crypto.randomUUID().replace(/-/g, '');
  const file = `${id}.jpg`;
  const base = bookDir(bookId);
  await Promise.all(['page', 'large', 'thumb'].map((d) => fs.mkdir(path.join(base, d), { recursive: true })));

  const src = () => sharp(buffer, { failOn: 'none', animated: false }).rotate().flatten({ background: '#ffffff' });

  const page = await src()
    .resize({ width: IMAGE.pageWidth, withoutEnlargement: true })
    .jpeg({ quality: 85, mozjpeg: true })
    .toFile(path.join(base, 'page', file));

  await src()
    .resize({ width: IMAGE.largeWidth, withoutEnlargement: true })
    .jpeg({ quality: 88, mozjpeg: true })
    .toFile(path.join(base, 'large', file));

  await src()
    .resize({ width: IMAGE.thumbWidth, withoutEnlargement: true })
    .jpeg({ quality: 72, mozjpeg: true })
    .toFile(path.join(base, 'thumb', file));

  return { file, width: page.width, height: page.height, bytes: page.size };
}

export async function removeImageFiles(bookId, file) {
  const base = bookDir(bookId);
  await Promise.all(
    ['page', 'large', 'thumb'].map((d) => fs.rm(path.join(base, d, file), { force: true }))
  );
}

export async function removeBookFiles(bookId) {
  await fs.rm(bookDir(bookId), { recursive: true, force: true });
}

export async function dirSize(dir) {
  let total = 0;
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) total += await dirSize(p);
    else if (e.isFile()) total += (await fs.stat(p)).size;
  }
  return total;
}
