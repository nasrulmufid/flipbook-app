import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Library, Eye, Images, HardDrive, Plus } from 'lucide-react';
import { api, formatBytes, formatDate } from '../../lib/api.js';

function Stat({ icon: Icon, label, value, hint, tone = 'primary' }) {
  return (
    <div className="card">
      <div className="card__body flex items-center gap-4">
        <div className={`icon-box icon-box--${tone} icon-box--lg`}><Icon size={22} /></div>
        <div>
          <div className="text-2xl font-semibold leading-none">{value}</div>
          <div className="mt-1 text-sm" style={{ color: 'var(--color-muted-foreground)' }}>{label}{hint ? ` · ${hint}` : ''}</div>
        </div>
      </div>
    </div>
  );
}

function MiniList({ title, books, metric }) {
  return (
    <div className="card">
      <div className="card__header"><h3 className="card__title">{title}</h3></div>
      <div className="card__body flex flex-col gap-3">
        {books.length === 0 && <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Belum ada data.</p>}
        {books.map((b) => (
          <Link key={b.id} to={`/admin/books/${b.id}`} className="flex items-center gap-3 rounded-md p-1 hover:bg-[var(--color-accent)]">
            <div className="h-14 w-10 shrink-0 overflow-hidden rounded-sm" style={{ background: 'var(--color-neutral)' }}>
              {b.cover && <img src={b.cover.t} alt="" className="h-full w-full object-cover" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{b.title}</div>
              <div className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{metric(b)}</div>
            </div>
            <span className={`badge badge--soft badge--${b.status === 'published' ? 'success' : 'warning'}`}>{b.status === 'published' ? 'Terbit' : 'Draft'}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [s, setS] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { api.get('/api/admin/stats').then(setS).catch((e) => setErr(e.message)); }, []);

  return (
    <div className="page">
      <div className="page__header">
        <div className="page__headline">
          <h1 className="page__title">Dashboard</h1>
          <p className="page__description">Ringkasan koleksi flipbook Anda.</p>
        </div>
        <Link to="/admin/books/new" className="button button--primary"><Plus size={16} /> Buku Baru</Link>
      </div>
      {err && <div className="alert alert--danger"><div className="alert__description">{err}</div></div>}
      {!s && !err && <div className="grid place-items-center py-20"><span className="spinner" /></div>}
      {s && (
        <div className="page__body">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat icon={Library} label="Total buku" value={s.books} hint={`${s.published} terbit, ${s.drafts} draft`} />
            <Stat icon={Eye} label="Total kunjungan" value={s.views.toLocaleString('id-ID')} tone="info" />
            <Stat icon={Images} label="Total halaman" value={s.pages.toLocaleString('id-ID')} tone="success" />
            <Stat icon={HardDrive} label="Penyimpanan gambar" value={formatBytes(s.storage)} tone="warning" />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <MiniList title="Terakhir diperbarui" books={s.recent} metric={(b) => `${b.pageCount} halaman · ${formatDate(b.updatedAt)}`} />
            <MiniList title="Paling banyak dibaca" books={s.top} metric={(b) => `${b.views.toLocaleString('id-ID')} kunjungan`} />
          </div>
        </div>
      )}
    </div>
  );
}
