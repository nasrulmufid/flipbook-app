import { useState } from 'react';
import { api } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useToast } from '../../lib/toast.jsx';

export default function Account() {
  const { user } = useAuth();
  const toast = useToast();
  const [f, setF] = useState({ current: '', next: '', confirm: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (f.next !== f.confirm) return setErr('Konfirmasi password tidak sama.');
    setBusy(true);
    try { await api.put('/api/auth/password', { current: f.current, next: f.next }); toast('Password berhasil diubah.'); setF({ current: '', next: '', confirm: '' }); }
    catch (ex) { setErr(ex.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="page">
      <div className="page__header"><div className="page__headline"><h1 className="page__title">Akun</h1><p className="page__description">Masuk sebagai <strong>{user?.username}</strong>.</p></div></div>
      <form className="card max-w-md" onSubmit={submit}>
        <div className="card__header"><h3 className="card__title">Ubah password</h3></div>
        <div className="card__body flex flex-col gap-4">
          {err && <div className="alert alert--danger"><div className="alert__description">{err}</div></div>}
          {[['current', 'Password saat ini', 'current-password'], ['next', 'Password baru (min. 6 karakter)', 'new-password'], ['confirm', 'Ulangi password baru', 'new-password']].map(([k, label, ac]) => (
            <div className="field" key={k}>
              <label className="field__label" htmlFor={k}>{label}</label>
              <input id={k} type="password" className="input" required autoComplete={ac} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
            </div>
          ))}
          <button className="button button--primary self-start" type="submit" aria-busy={busy} disabled={busy}>Simpan password</button>
        </div>
      </form>
    </div>
  );
}
