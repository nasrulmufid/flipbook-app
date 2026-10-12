import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { getOne, runStmt } from '../db.js';
import {
	signIn,
	signOut,
	readUser,
	requireAuth,
	loginLimiter,
} from '../auth.js';

const r = Router();

r.post('/login', loginLimiter, (req, res) => {
	const { username = '', password = '' } = req.body || {};
	const user = getOne('SELECT * FROM users WHERE username = ?', [
		String(username).trim(),
	]);
	if (!user || !bcrypt.compareSync(String(password), user.password_hash)) {
		return res.status(401).json({ error: 'Username atau password salah.' });
	}
	signIn(res, user);
	res.json({ user: { id: user.id, username: user.username, name: user.name } });
});

r.post('/logout', (_req, res) => {
	signOut(res);
	res.json({ ok: true });
});

r.get('/me', (req, res) => {
	const user = readUser(req);
	if (!user) return res.status(401).json({ error: 'Belum login.' });
	res.json({ user });
});

r.put('/password', requireAuth, (req, res) => {
	const { current = '', next = '' } = req.body || {};
	if (String(next).length < 6)
		return res.status(400).json({ error: 'Password baru minimal 6 karakter.' });
	const row = getOne('SELECT * FROM users WHERE id = ?', [req.user.id]);
	if (!bcrypt.compareSync(String(current), row.password_hash)) {
		return res.status(400).json({ error: 'Password saat ini salah.' });
	}
	runStmt('UPDATE users SET password_hash = ? WHERE id = ?', [
		bcrypt.hashSync(String(next), 10),
		row.id,
	]);
	res.json({ ok: true });
});

export default r;
