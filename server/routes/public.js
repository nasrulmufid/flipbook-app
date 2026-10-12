import { Router } from 'express';
import { getOne, getAll, runStmt } from '../db.js';
import { parseSettings } from '../settings.js';
import { pageUrls } from '../images.js';
import { readUser } from '../auth.js';

const r = Router();

function coverOf(bookId) {
	const p = getOne(
		'SELECT file FROM pages WHERE book_id = ? ORDER BY position LIMIT 1',
		[bookId],
	);
	return p ? pageUrls(bookId, p.file) : null;
}

// Daftar buku terbit (halaman perpustakaan)
r.get('/books', (_req, res) => {
	const rows = getAll(
		`SELECT b.id, b.slug, b.title, b.description, b.author, b.page_width, b.page_height, b.updated_at,
            (SELECT COUNT(*) FROM pages p WHERE p.book_id = b.id) AS page_count
     FROM books b WHERE b.status = 'published' ORDER BY b.updated_at DESC`,
	).filter((b) => b.page_count > 0);
	res.json({ books: rows.map((b) => ({ ...b, cover: coverOf(b.id) })) });
});

// Detail buku + halaman (untuk viewer). Admin boleh melihat draft.
r.get('/books/:slug', (req, res) => {
	const book = getOne('SELECT * FROM books WHERE slug = ?', [req.params.slug]);
	if (!book) return res.status(404).json({ error: 'Buku tidak ditemukan.' });
	if (book.status !== 'published' && !readUser(req)) {
		return res.status(404).json({ error: 'Buku tidak ditemukan.' });
	}
	const pages = getAll(
		'SELECT id, file, width, height FROM pages WHERE book_id = ? ORDER BY position',
		[book.id],
	).map((p) => ({ id: p.id, ...pageUrls(book.id, p.file) }));
	res.json({
		book: {
			id: book.id,
			slug: book.slug,
			title: book.title,
			description: book.description,
			author: book.author,
			status: book.status,
			pageWidth: book.page_width || 1655,
			pageHeight: book.page_height || 2340,
			settings: parseSettings(book.settings),
			pages,
		},
	});
});

// Hitung kunjungan (dipanggil sekali per pembukaan viewer)
r.post('/books/:slug/view', (req, res) => {
	if (readUser(req)) return res.json({ ok: true, counted: false });
	const info = runStmt(
		"UPDATE books SET views = views + 1 WHERE slug = ? AND status = 'published'",
		[req.params.slug],
	);
	res.json({ ok: true, counted: info.changes > 0 });
});

export default r;
