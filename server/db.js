import initSqlJs from 'sql.js';
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { DATA_DIR, ADMIN_USER, ADMIN_PASSWORD } from './config.js';

const DB_PATH = path.join(DATA_DIR, 'flipbook.db');

let db;

export async function initDb() {
	const SQL = await initSqlJs();
	let buffer;
	try {
		buffer = fs.readFileSync(DB_PATH);
	} catch {
		buffer = null;
	}
	db = new SQL.Database(buffer);
	db.run('PRAGMA foreign_keys = ON');

	db.run(`
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS books (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT NOT NULL UNIQUE,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  author      TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  page_width  INTEGER NOT NULL DEFAULT 0,
  page_height INTEGER NOT NULL DEFAULT 0,
  settings    TEXT NOT NULL DEFAULT '{}',
  views       INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id    INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  position   INTEGER NOT NULL,
  file       TEXT NOT NULL,
  width      INTEGER NOT NULL DEFAULT 0,
  height     INTEGER NOT NULL DEFAULT 0,
  bytes      INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_pages_book ON pages(book_id, position);
CREATE INDEX IF NOT EXISTS idx_books_status ON books(status);
`);

	// Buat akun admin default jika belum ada user sama sekali.
	const row = db.exec('SELECT COUNT(*) AS c FROM users');
	if (row.length && row[0].values[0][0] === 0) {
		db.run(
			'INSERT INTO users (username, name, password_hash) VALUES (?, ?, ?)',
			[ADMIN_USER, 'Administrator', bcrypt.hashSync(ADMIN_PASSWORD, 10)],
		);
		console.log(
			`[db] Admin default dibuat \u2192 username: ${ADMIN_USER} / password: ${ADMIN_PASSWORD}`,
		);
	}

	saveDb();
	return db;
}

export function saveDb() {
	if (!db) return;
	const data = db.export();
	const buffer = Buffer.from(data);
	fs.writeFileSync(DB_PATH, buffer);
}

// Helper: query satu baris (objek)
export function getOne(stmt, params = []) {
	const result = db.exec(stmt, params);
	if (!result.length || !result[0].values.length) return null;
	const cols = result[0].columns;
	const vals = result[0].values[0];
	const obj = {};
	for (let i = 0; i < cols.length; i++) obj[cols[i]] = vals[i];
	return obj;
}

// Helper: query banyak baris (array of objek)
export function getAll(stmt, params = []) {
	const result = db.exec(stmt, params);
	if (!result.length) return [];
	const cols = result[0].columns;
	return result[0].values.map((row) => {
		const obj = {};
		for (let i = 0; i < cols.length; i++) obj[cols[i]] = row[i];
		return obj;
	});
}

// Helper: run statement, return { changes, lastInsertRowid }
export function runStmt(stmt, params = []) {
	db.run(stmt, params);
	const lastId = db.exec('SELECT last_insert_rowid() AS id');
	const changes = db.getRowsModified();
	saveDb();
	return {
		changes,
		lastInsertRowid: lastId.length ? lastId[0].values[0][0] : null,
	};
}

export function slugify(text) {
	return (
		String(text || '')
			.toLowerCase()
			.normalize('NFKD')
			.replace(/[\u0300-\u036f]/g, '')
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 60) || 'buku'
	);
}

export function uniqueSlug(base, ignoreId = null) {
	let slug = slugify(base);
	let i = 1;
	while (true) {
		const row = getOne('SELECT id FROM books WHERE slug = ?', [slug]);
		if (!row || row.id === ignoreId) return slug;
		i += 1;
		slug = `${slugify(base)}-${i}`;
	}
}

/**
 * Ukuran buku = rasio halaman yang paling umum (modus), bukan selalu halaman pertama.
 * Halaman dengan rasio berbeda akan di-stretch seperti di FlipHTML5 ("backgroundPosition: Stretch").
 */
export function recomputeBookSize(bookId) {
	const pages = getAll(
		'SELECT width, height FROM pages WHERE book_id = ? ORDER BY position',
		[bookId],
	);
	if (!pages.length) {
		runStmt('UPDATE books SET page_width = 0, page_height = 0 WHERE id = ?', [
			bookId,
		]);
		return;
	}
	const groups = new Map();
	for (const p of pages) {
		if (!p.width || !p.height) continue;
		const key = (p.width / p.height).toFixed(2);
		const g = groups.get(key) || { count: 0, w: p.width, h: p.height };
		g.count += 1;
		groups.set(key, g);
	}
	let best = null;
	for (const g of groups.values()) if (!best || g.count > best.count) best = g;
	if (best)
		runStmt('UPDATE books SET page_width = ?, page_height = ? WHERE id = ?', [
			best.w,
			best.h,
			bookId,
		]);
}
