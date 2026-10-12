// Impor folder gambar menjadi buku contoh.
//   npm run seed                       → pakai ./seed/demo
//   npm run seed -- /path/files/page   → pakai folder gambar milik Anda (1.jpg, 2.jpg, ...)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	initDb,
	getOne,
	getAll,
	runStmt,
	uniqueSlug,
	recomputeBookSize,
} from './db.js';
import { processUpload } from './images.js';
import { DEFAULT_SETTINGS } from './settings.js';

await initDb();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.resolve(
	process.argv[2] || path.join(__dirname, '..', 'seed', 'demo'),
);
const title = process.argv[3] || 'Menu R&B Grill';

if (!fs.existsSync(dir)) {
	console.error(`Folder tidak ditemukan: ${dir}`);
	process.exit(1);
}
const collator = new Intl.Collator(undefined, { numeric: true });
const files = fs
	.readdirSync(dir)
	.filter((f) => /\.(jpe?g|png|webp|avif)$/i.test(f))
	.sort(collator.compare);
if (!files.length) {
	console.error('Tidak ada gambar di folder tersebut.');
	process.exit(1);
}

const info = runStmt(
	"INSERT INTO books (slug, title, description, author, status, settings) VALUES (?,?,?,?, 'published', ?)",
	[
		uniqueSlug(title),
		title,
		'Buku contoh hasil impor.',
		'Admin',
		JSON.stringify(DEFAULT_SETTINGS),
	],
);
const bookId = info.lastInsertRowid;

let pos = -1;
for (const f of files) {
	const img = await processUpload(fs.readFileSync(path.join(dir, f)), bookId);
	pos += 1;
	runStmt(
		'INSERT INTO pages (book_id, position, file, width, height, bytes) VALUES (?,?,?,?,?,?)',
		[bookId, pos, img.file, img.width, img.height, img.bytes],
	);
	process.stdout.write(`\r${pos + 1}/${files.length} halaman`);
}
recomputeBookSize(bookId);
console.log(
	`\nSelesai: "${title}" (${files.length} halaman) \u2192 /book/${getOne('SELECT slug FROM books WHERE id=?', [bookId]).slug}`,
);
