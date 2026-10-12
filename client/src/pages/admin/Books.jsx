import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Search, Pencil, Trash2, ExternalLink, BookX } from 'lucide-react';
import { api, formatDate } from '../../lib/api.js';
import { useToast } from '../../lib/toast.jsx';
import Modal from '../../components/ui/Modal.jsx';

export default function Books() {
  const toast = useToast();
  const [sp, setSp] = useSearchParams();
  const search = sp.get('q') || '';
  const status = sp.get('status') || '';
  const page = parseInt(sp.get('page') || '1', 10);
  const [q, setQ] = useState(search);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [del, setDel] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (patch) => {
    const n = new URLSearchParams(sp);
    Object.entries(patch).forEach(([k, v]) => (v ? n.set(k, v) : n.delete(k)));
    setSp(n, { replace: true });
  };

  const load = useCallback(() => {
    const p = new URLSearchParams({ page, perPage: 10 });
    if (search) p.set('search', search);
    if (status) p.set('status', status);
    api.get(`/api/admin/books?${p}`).then((d) => { setData(d); setError(''); }).catch((e) => setError(e.message));
  }, [page, search, status]);
  useEffect(load, [load]);

  useEffect(() => {
    const t = setTimeout(() => q !== search && set({ q, page: '' }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const remove = async () => {
    setBusy(true);
    try { await api.del(`/api/admin/books/${del.id}`); toast(`"${del.title}" dihapus.`); setDel(null); load(); }
    catch (e) { toast(e.message, 'danger'); }
    finally { setBusy(false); }
  };

  return (
    <div className="page">
      <div className="page__header">
        <div className="page__headline">
          <h1 className="page__title">Kelola Buku</h1>
          <p className="page__description">Tambah, ubah, terbitkan, atau hapus buku beserta halamannya.</p>
        </div>
        <Link to="/admin/books/new" className="button button--primary"><Plus size={16} /> Buku Baru</Link>
      </div>

      <div className="card">
        <div className="card__header flex flex-wrap items-center gap-3">
          <div className="relative min-w-[14rem] flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-muted-foreground)' }} />
            <input className="input" style={{ paddingInlineStart: '2.25rem' }} placeholder="Cari judul, penulis, atau slug…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cari buku" />
          </div>
          <select className="select" style={{ width: '10rem' }} value={status} onChange={(e) => set({ status: e.target.value, page: '' })} aria-label="Filter status">
            <option value="">Semua status</option>
            <option value="published">Terbit</option>
            <option value="draft">Draft</option>
          </select>
        </div>

        {error && <div className="card__body"><div className="alert alert--danger"><div className="alert__description">{error}</div></div></div>}
        {!data && !error && <div className="grid place-items-center py-16"><span className="spinner" /></div>}

        {data && data.books.length === 0 && (
          <div className="card__body">
            <div className="empty-state">
              <div className="empty-state__media"><BookX size={32} /></div>
              <div className="empty-state__title">{search || status ? 'Tidak ada buku yang cocok' : 'Belum ada buku'}</div>
              <div className="empty-state__text">{search || status ? 'Coba ubah kata kunci atau filter.' : 'Buat buku pertama lalu unggah gambar halamannya.'}</div>
              {!search && !status && <div className="empty-state__action"><Link to="/admin/books/new" className="button button--primary">Buat Buku</Link></div>}
            </div>
          </div>
        )}

        {data && data.books.length > 0 && (
          <div className="overflow-x-auto">
            <table className="table table--hover table--align-middle">
              <thead>
                <tr><th style={{ width: 64 }}>Sampul</th><th>Judul</th><th>Status</th><th>Halaman</th><th>Dibaca</th><th>Diperbarui</th><th style={{ width: 130 }} /></tr>
              </thead>
              <tbody>
                {data.books.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <div className="h-14 w-10 overflow-hidden rounded-sm" style={{ background: 'var(--color-neutral)' }}>
                        {b.cover && <img src={b.cover.t} alt="" className="h-full w-full object-cover" loading="lazy" />}
                      </div>
                    </td>
                    <td>
                      <Link to={`/admin/books/${b.id}`} className="font-medium hover:underline">{b.title}</Link>
                      <div className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>/{b.slug}{b.author ? ` · ${b.author}` : ''}</div>
                    </td>
                    <td><span className={`badge badge--soft badge--${b.status === 'published' ? 'success' : 'warning'}`}>{b.status === 'published' ? 'Terbit' : 'Draft'}</span></td>
                    <td>{b.pageCount}</td>
                    <td>{b.views.toLocaleString('id-ID')}</td>
                    <td className="whitespace-nowrap">{formatDate(b.updatedAt)}</td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <a href={`/book/${b.slug}`} target="_blank" rel="noreferrer" className="button button--neutral button--ghost button--icon-only button--sm" aria-label={`Buka ${b.title}`}><ExternalLink size={16} /></a>
                        <Link to={`/admin/books/${b.id}`} className="button button--neutral button--ghost button--icon-only button--sm" aria-label={`Ubah ${b.title}`}><Pencil size={16} /></Link>
                        <button type="button" className="button button--danger button--ghost button--icon-only button--sm" aria-label={`Hapus ${b.title}`} onClick={() => setDel(b)}><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && data.totalPages > 1 && (
          <div className="card__footer flex items-center justify-between gap-3">
            <span className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>{data.total} buku</span>
            <div className="pagination">
              <button type="button" className="pagination__button" disabled={page <= 1} onClick={() => set({ page: String(page - 1) })}>Sebelumnya</button>
              <span className="px-3 text-sm">{page} / {data.totalPages}</span>
              <button type="button" className="pagination__button" disabled={page >= data.totalPages} onClick={() => set({ page: String(page + 1) })}>Berikutnya</button>
            </div>
          </div>
        )}
      </div>

      <Modal
        open={!!del}
        title="Hapus buku?"
        onClose={() => !busy && setDel(null)}
        footer={<><button type="button" className="button button--neutral button--outline" onClick={() => setDel(null)} disabled={busy}>Batal</button><button type="button" className="button button--danger" aria-busy={busy} onClick={remove}>Hapus permanen</button></>}
      >
        <p>Buku <strong>{del?.title}</strong> beserta {del?.pageCount} halaman dan file gambarnya akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.</p>
      </Modal>
    </div>
  );
}
