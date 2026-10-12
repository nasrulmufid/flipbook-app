import { useState } from 'react';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import { useAuth } from '../../lib/auth.jsx';

export default function Login() {
  const { user, login, loading } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ username: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  if (!loading && user) return <Navigate to="/admin" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try { await login(f.username, f.password); nav('/admin', { replace: true }); }
    catch (ex) { setErr(ex.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="grid min-h-full place-items-center p-4" style={{ background: 'var(--color-background)' }}>
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2 text-xl font-semibold"><BookOpen /> FlipBook</div>
        <form className="card" onSubmit={submit}>
          <div className="card__header">
            <h1 className="card__title">Masuk ke Dashboard</h1>
            <p className="card__subtitle">Kelola buku dan halaman flipbook Anda.</p>
          </div>
          <div className="card__body flex flex-col gap-4">
            {err && <div className="alert alert--danger" role="alert"><div className="alert__description">{err}</div></div>}
            <div className="field">
              <label className="field__label" htmlFor="u">Username</label>
              <input id="u" className="input" autoComplete="username" autoFocus required value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="p">Password</label>
              <input id="p" type="password" className="input" autoComplete="current-password" required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
            </div>
            <button className="button button--primary" type="submit" aria-busy={busy} disabled={busy}>Masuk</button>
          </div>
        </form>
        <p className="mt-4 text-center text-sm"><Link to="/" className="link">← Kembali ke perpustakaan</Link></p>
      </div>
    </div>
  );
}
