import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import fs from 'node:fs';
import { PORT, UPLOAD_DIR, CLIENT_DIST, IS_PROD } from './config.js';
import { initDb } from './db.js';
import authRoutes from './routes/auth.js';
import publicRoutes from './routes/public.js';
import adminRoutes from './routes/admin.js';

const app = express();
app.set('trust proxy', 1);
// frameguard off → viewer boleh di-embed lewat <iframe> (fitur Share → Embed)
app.use(
	helmet({
		contentSecurityPolicy: false,
		frameguard: false,
		crossOriginResourcePolicy: { policy: 'cross-origin' },
	}),
);
app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));

app.use(
	'/uploads',
	express.static(UPLOAD_DIR, {
		maxAge: '30d',
		immutable: true,
		fallthrough: false,
		index: false,
	}),
);

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', publicRoutes);
app.use('/api', (_req, res) =>
	res.status(404).json({ error: 'Endpoint tidak ditemukan.' }),
);

if (IS_PROD || fs.existsSync(path.join(CLIENT_DIST, 'index.html'))) {
	app.use(express.static(CLIENT_DIST, { maxAge: '1h', index: false }));
	// fallback SPA (Express 5: jangan pakai pola '*')
	app.use((req, res, next) => {
		if (
			req.method !== 'GET' ||
			req.path.startsWith('/api') ||
			req.path.startsWith('/uploads')
		)
			return next();
		res.sendFile(path.join(CLIENT_DIST, 'index.html'));
	});
}

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
	if (err?.status === 404 || err?.code === 'ENOENT')
		return res.status(404).end();
	console.error(err);
	res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
});

app.listen(PORT, () =>
	console.log(
		`[server] http://localhost:${PORT}  (${IS_PROD ? 'production' : 'development'})`,
	),
);

// Init database setelah semua route terdaftar
initDb().catch((err) => {
	console.error('Gagal inisialisasi database:', err);
	process.exit(1);
});
