import jwt from 'jsonwebtoken';
import { JWT_SECRET, IS_PROD } from './config.js';
import { getOne } from './db.js';

const COOKIE = 'fb_token';
const MAX_AGE = 7 * 24 * 60 * 60 * 1000;

export function signIn(res, user) {
	const token = jwt.sign({ uid: user.id }, JWT_SECRET, { expiresIn: '7d' });
	res.cookie(COOKIE, token, {
		httpOnly: true,
		sameSite: 'lax',
		secure: IS_PROD && process.env.COOKIE_SECURE === 'true',
		maxAge: MAX_AGE,
		path: '/',
	});
}

export function signOut(res) {
	res.clearCookie(COOKIE, { path: '/' });
}

export function readUser(req) {
	const token = req.cookies?.[COOKIE];
	if (!token) return null;
	try {
		const { uid } = jwt.verify(token, JWT_SECRET);
		return (
			getOne('SELECT id, username, name FROM users WHERE id = ?', [uid]) || null
		);
	} catch {
		return null;
	}
}

export function requireAuth(req, res, next) {
	const user = readUser(req);
	if (!user)
		return res
			.status(401)
			.json({ error: 'Sesi berakhir, silakan login kembali.' });
	req.user = user;
	next();
}

// Pembatas percobaan login sederhana (in-memory) — 8 percobaan gagal / 15 menit / IP
const attempts = new Map();
export function loginLimiter(req, res, next) {
	const key = req.ip;
	const now = Date.now();
	const rec = attempts.get(key);
	if (rec && now - rec.first > 15 * 60 * 1000) attempts.delete(key);
	const cur = attempts.get(key);
	if (cur && cur.count >= 8) {
		return res
			.status(429)
			.json({
				error: 'Terlalu banyak percobaan login. Coba lagi dalam 15 menit.',
			});
	}
	res.on('finish', () => {
		if (res.statusCode === 401) {
			const r = attempts.get(key) || { count: 0, first: now };
			r.count += 1;
			attempts.set(key, r);
		} else if (res.statusCode < 400) attempts.delete(key);
	});
	next();
}
