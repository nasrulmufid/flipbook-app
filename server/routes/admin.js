import { Router } from 'express';
import multer from 'multer';
import {
	getOne,
	getAll,
	runStmt,
	uniqueSlug,
	slugify,
	recomputeBookSize,
} from '../db.js';
import { requireAuth } from '../auth.js';
import {
	DEFAULT_SETTINGS,
	parseSettings,
	sanitizeSettings,
} from '../settings.js';
import { IMAGE, UPLOAD_DIR } from '../config.js';
import {
	processUpload,
	removeImageFiles,
	removeBookFiles,
	pageUrls,
	dirSize,
} from '../images.js';

const r = Router();
r.use(requireAuth);

const ALLOWED = new Set([
	'image/jpeg',
	'image/png',
	'image/webp',
	'image/avif',
	'image/gif',
	'image/tiff',
]);
const upload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: IMAGE.maxUploadBytes, files: IMAGE.maxFilesPerRequest },
	fileFilter: (_req, file, cb) => {
		if (!ALLOWED.has(file.mimetype))
			return cb(new Error(`Format tidak didukung: ${file.originalname}`));
		cb(null, true);
	},
});

const collator = new Intl.Collator(undefined, {
	numeric: true,
	sensitivity: 'base',
});

function bookRow(id) {
	return getOne('SELECT * FROM books WHERE id = ?', [id]);
}

function serializeBook(b, withPages = false) {
	const pages = getAll(
		'SELECT id, position, file, width, height, bytes FROM pages WHERE book_id = ? ORDER BY position',
		[b.id],
	);
	const out = {
		id: b.id,
		slug: b.slug,
		title: b.title,
		description: b.description,
		author: b.author,
		status: b.status,
		pageWidth: b.page_width,
		pageHeight: b.page_height,
		views: b.views,
		settings: parseSettings(b.settings),
		pageCount: pages.length,
		cover: pages[0] ? pageUrls(b.id, pages[0].file) : null,
		createdAt: b.created_at,
		updatedAt: b.updated_at,
	};
	if (withPages)
		out.pages = pages.map((p) => ({
			id: p.id,
			position: p.position,
			width: p.width,
			height: p.height,
			bytes: p.bytes,
			...pageUrls(b.id, p.file),
		}));
	return out;
}

const touch = (id) =>
	runStmt("UPDATE books SET updated_at = datetime('now') WHERE id = ?", [id]);

function validateBookInput(body, { partial = false } = {}) {
	const errors = {};
	const out = {};
	if (!partial || 'title' in body) {
		const t = String(body.title ?? '').trim();
		if (!t) errors.title = 'Judul wajib diisi.';
		else if (t.length > 150) errors.title = 'Judul maksimal 150 karakter.';
		out.title = t;
	}
	if ('description' in body)
		out.description = String(body.description ?? '')
			.trim()
			.slice(0, 1000);
	if ('author' in body)
		out.author = String(body.author ?? '')
			.trim()
			.slice(0, 100);
	if ('status' in body) {
		if (!['draft', 'published'].includes(body.status))
			errors.status = 'Status tidak valid.';
		else out.status = body.status;
	}
	if ('slug' in body && String(body.slug).trim()) out.slug = slugify(body.slug);
	return { errors, out };
}

/* ---------- Statistik dashboard ---------- */
r.get('/stats', async (_req, res) => {
	const totals = getOne(
		`SELECT COUNT(*) AS books,
            SUM(CASE WHEN status='published' THEN 1 ELSE 0 END) AS published,
            COALESCE(SUM(views),0) AS views FROM books`,
	);
	const pages = getOne('SELECT COUNT(*) AS c FROM pages').c;
	const storage = await dirSize(UPLOAD_DIR);
	const top = getAll(
		'SELECT * FROM books ORDER BY views DESC, updated_at DESC LIMIT 5',
	).map((b) => serializeBook(b));
	const recent = getAll(
		'SELECT * FROM books ORDER BY updated_at DESC LIMIT 5',
	).map((b) => serializeBook(b));
	res.json({
		books: totals.books,
		published: totals.published || 0,
		drafts: totals.books - (totals.published || 0),
		views: totals.views,
		pages,
		storage,
		top,
		recent,
	});
});

r.get('/defaults', (_req, res) => res.json({ settings: DEFAULT_SETTINGS }));

/* ---------- CRUD buku ---------- */
r.get('/books', (req, res) => {
	const {
		search = '',
		status = '',
		page = '1',
		perPage = '10',
		sort = 'updated_at',
		dir = 'desc',
	} = req.query;
	const where = [];
	const params = [];
	if (search) {
		where.push('(title LIKE ? OR author LIKE ? OR slug LIKE ?)');
		const q = `%${String(search).trim()}%`;
		params.push(q, q, q);
	}
	if (status === 'draft' || status === 'published') {
		where.push('status = ?');
		params.push(status);
	}
	const sortCol =
		{
			title: 'title',
			views: 'views',
			created_at: 'created_at',
			updated_at: 'updated_at',
			status: 'status',
		}[sort] || 'updated_at';
	const sortDir = dir === 'asc' ? 'ASC' : 'DESC';
	const W = where.length ? `WHERE ${where.join(' AND ')}` : '';
	const total = getOne(`SELECT COUNT(*) AS c FROM books ${W}`, params).c;
	const pp = Math.min(50, Math.max(1, parseInt(perPage, 10) || 10));
	const pg = Math.max(1, parseInt(page, 10) || 1);
	const rows = getAll(
		`SELECT * FROM books ${W} ORDER BY ${sortCol} ${sortDir}, id DESC LIMIT ? OFFSET ?`,
		[...params, pp, (pg - 1) * pp],
	);
	res.json({
		books: rows.map((b) => serializeBook(b)),
		total,
		page: pg,
		perPage: pp,
		totalPages: Math.max(1, Math.ceil(total / pp)),
	});
});

r.post('/books', (req, res) => {
	const { errors, out } = validateBookInput(req.body || {});
	if (Object.keys(errors).length)
		return res.status(422).json({ error: 'Data tidak valid.', errors });
	const slug = uniqueSlug(out.slug || out.title);
	const settings = JSON.stringify(sanitizeSettings(req.body?.settings || {}));
	const info = runStmt(
		'INSERT INTO books (slug, title, description, author, status, settings) VALUES (?,?,?,?,?,?)',
		[
			slug,
			out.title,
			out.description || '',
			out.author || '',
			out.status || 'draft',
			settings,
		],
	);
	res
		.status(201)
		.json({ book: serializeBook(bookRow(info.lastInsertRowid), true) });
});

r.get('/books/:id', (req, res) => {
	const b = bookRow(req.params.id);
	if (!b) return res.status(404).json({ error: 'Buku tidak ditemukan.' });
	res.json({ book: serializeBook(b, true) });
});

r.put('/books/:id', (req, res) => {
	const b = bookRow(req.params.id);
	if (!b) return res.status(404).json({ error: 'Buku tidak ditemukan.' });
	const { errors, out } = validateBookInput(req.body || {}, { partial: true });
	if (Object.keys(errors).length)
		return res.status(422).json({ error: 'Data tidak valid.', errors });

	const next = {
		title: out.title ?? b.title,
		description: out.description ?? b.description,
		author: out.author ?? b.author,
		status: out.status ?? b.status,
		slug: out.slug ? uniqueSlug(out.slug, b.id) : b.slug,
		settings: req.body?.settings
			? JSON.stringify(
					sanitizeSettings(req.body.settings, parseSettings(b.settings)),
				)
			: b.settings,
	};
	if (next.status === 'published') {
		const count = getOne('SELECT COUNT(*) AS c FROM pages WHERE book_id = ?', [
			b.id,
		]).c;
		if (count === 0) {
			return res
				.status(422)
				.json({
					error: 'Tambahkan minimal 1 halaman sebelum menerbitkan buku.',
					errors: { status: 'Belum ada halaman.' },
				});
		}
	}
	runStmt(
		"UPDATE books SET title=?, description=?, author=?, status=?, slug=?, settings=?, updated_at=datetime('now') WHERE id=?",
		[
			next.title,
			next.description,
			next.author,
			next.status,
			next.slug,
			next.settings,
			b.id,
		],
	);
	res.json({ book: serializeBook(bookRow(b.id), true) });
});

r.delete('/books/:id', async (req, res) => {
	const b = bookRow(req.params.id);
	if (!b) return res.status(404).json({ error: 'Buku tidak ditemukan.' });
	runStmt('DELETE FROM books WHERE id = ?', [b.id]);
	await removeBookFiles(b.id);
	res.json({ ok: true });
});

/* ---------- Halaman (upload gambar) ---------- */
function runUpload(field, max) {
	const handler = max === 1 ? upload.single(field) : upload.array(field, max);
	return (req, res, next) =>
		handler(req, res, (err) => {
			if (!err) return next();
			const msg =
				err.code === 'LIMIT_FILE_SIZE'
					? `Ukuran file melebihi batas ${Math.round(IMAGE.maxUploadBytes / 1024 / 1024)} MB.`
					: err.code === 'LIMIT_FILE_COUNT'
						? `Maksimal ${IMAGE.maxFilesPerRequest} file per upload.`
						: err.message;
			res.status(400).json({ error: msg });
		});
}

r.post(
	'/books/:id/pages',
	runUpload('images', IMAGE.maxFilesPerRequest),
	async (req, res) => {
		const b = bookRow(req.params.id);
		if (!b) return res.status(404).json({ error: 'Buku tidak ditemukan.' });
		const files = [...(req.files || [])];
		if (!files.length)
			return res.status(400).json({ error: 'Tidak ada gambar yang diunggah.' });
		files.sort((a, c) => collator.compare(a.originalname, c.originalname)); // 1.jpg, 2.jpg, 10.jpg

		const failed = [];
		const added = [];
		let pos = getOne(
			'SELECT COALESCE(MAX(position), -1) AS m FROM pages WHERE book_id = ?',
			[b.id],
		).m;

		for (const f of files) {
			try {
				const img = await processUpload(f.buffer, b.id);
				pos += 1;
				const info = runStmt(
					'INSERT INTO pages (book_id, position, file, width, height, bytes) VALUES (?,?,?,?,?,?)',
					[b.id, pos, img.file, img.width, img.height, img.bytes],
				);
				added.push(info.lastInsertRowid);
			} catch (e) {
				failed.push({
					name: f.originalname,
					error: 'File gambar rusak / tidak dapat diproses.',
				});
			}
		}
		recomputeBookSize(b.id);
		touch(b.id);
		res
			.status(201)
			.json({
				added: added.length,
				failed,
				book: serializeBook(bookRow(b.id), true),
			});
	},
);

r.put('/books/:id/pages/order', (req, res) => {
	const b = bookRow(req.params.id);
	if (!b) return res.status(404).json({ error: 'Buku tidak ditemukan.' });
	const ids = (req.body?.ids || []).map(Number);
	const current = getAll('SELECT id FROM pages WHERE book_id = ?', [b.id]).map(
		(p) => p.id,
	);
	if (
		ids.length !== current.length ||
		!ids.every((i) => current.includes(i)) ||
		new Set(ids).size !== ids.length
	) {
		return res.status(400).json({ error: 'Urutan halaman tidak valid.' });
	}
	ids.forEach((id, i) =>
		runStmt('UPDATE pages SET position = ? WHERE id = ? AND book_id = ?', [
			i,
			id,
			b.id,
		]),
	);
	touch(b.id);
	res.json({ book: serializeBook(bookRow(b.id), true) });
});

r.put('/books/:id/pages/:pageId', runUpload('image', 1), async (req, res) => {
	const b = bookRow(req.params.id);
	const p = getOne('SELECT * FROM pages WHERE id = ? AND book_id = ?', [
		req.params.pageId,
		req.params.id,
	]);
	if (!b || !p)
		return res.status(404).json({ error: 'Halaman tidak ditemukan.' });
	if (!req.file)
		return res.status(400).json({ error: 'Pilih gambar pengganti.' });
	try {
		const img = await processUpload(req.file.buffer, b.id);
		runStmt('UPDATE pages SET file=?, width=?, height=?, bytes=? WHERE id=?', [
			img.file,
			img.width,
			img.height,
			img.bytes,
			p.id,
		]);
		await removeImageFiles(b.id, p.file);
		recomputeBookSize(b.id);
		touch(b.id);
		res.json({ book: serializeBook(bookRow(b.id), true) });
	} catch {
		res
			.status(400)
			.json({ error: 'File gambar rusak / tidak dapat diproses.' });
	}
});

r.delete('/books/:id/pages/:pageId', async (req, res) => {
	const b = bookRow(req.params.id);
	const p = getOne('SELECT * FROM pages WHERE id = ? AND book_id = ?', [
		req.params.pageId,
		req.params.id,
	]);
	if (!b || !p)
		return res.status(404).json({ error: 'Halaman tidak ditemukan.' });
	runStmt('DELETE FROM pages WHERE id = ?', [p.id]);
	await removeImageFiles(b.id, p.file);
	// rapikan posisi
	const rest = getAll(
		'SELECT id FROM pages WHERE book_id = ? ORDER BY position',
		[b.id],
	);
	rest.forEach((row, i) =>
		runStmt('UPDATE pages SET position = ? WHERE id = ?', [i, row.id]),
	);
	recomputeBookSize(b.id);
	if (rest.length === 0)
		runStmt("UPDATE books SET status='draft' WHERE id=?", [b.id]);
	touch(b.id);
	res.json({ book: serializeBook(bookRow(b.id), true) });
});

export default r;
