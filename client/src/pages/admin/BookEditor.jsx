import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Save, UploadCloud, Trash2, RefreshCw, Expand, GripVertical, Copy, ImagePlus } from 'lucide-react';
import { api, upload, formatBytes } from '../../lib/api.js';
import { DEFAULT_SETTINGS } from '../../lib/defaults.js';
import { useToast } from '../../lib/toast.jsx';
import Modal from '../../components/ui/Modal.jsx';

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
const BATCH = 4;

/* ---------- field kecil ---------- */
const Switch = ({ label, hint, checked, onChange }) => (
  <label className="field__item" style={{ cursor: 'pointer' }}>
    <input type="checkbox" className="switch" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
    <span className="field__label" style={{ cursor: 'pointer' }}>{label}{hint && <span className="field__description block">{hint}</span>}</span>
  </label>
);
const Num = ({ label, value, onChange, min, max, step = 0.1, suffix }) => (
  <div className="field">
    <label className="field__label">{label}</label>
    <div className="flex items-center gap-2">
      <input type="number" className="input" min={min} max={max} step={step} value={value} onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))} />
      {suffix && <span className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>{suffix}</span>}
    </div>
  </div>
);
const Color = ({ label, value, onChange }) => (
  <div className="field">
    <label className="field__label">{label}</label>
    <div className="flex items-center gap-2">
      <input type="color" value={value} onChange={(e) => onChange(e.target.value.toUpperCase())} className="h-9 w-12 cursor-pointer rounded-md border bg-transparent p-1" style={{ borderColor: 'var(--color-border-strong)' }} aria-label={label} />
      <input className="input" value={value} maxLength={7} onChange={(e) => onChange(e.target.value)} />
    </div>
  </div>
);
const Group = ({ title, children }) => (
  <div className="flex flex-col gap-3">
    <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-muted-foreground)' }}>{title}</div>
    {children}
  </div>
);

/* ---------- pengelola halaman ---------- */
function PagesManager({ book, setBook, ratio }) {
  const toast = useToast();
  const fileRef = useRef(null);
  const replaceRef = useRef(null);
  const [replaceId, setReplaceId] = useState(null);
  const [over, setOver] = useState(false);
  const [queue, setQueue] = useState(null); // {done,total,pct,failed:[]}
  const [dragIdx, setDragIdx] = useState(null);
  const [dropIdx, setDropIdx] = useState(null);
  const [del, setDel] = useState(null);
  const [view, setView] = useState(null);
  const [busy, setBusy] = useState(false);
  const pages = book.pages || [];

  const doUpload = useCallback(async (fileList) => {
    const files = [...fileList].filter((f) => f.type.startsWith('image/')).sort((a, b) => collator.compare(a.name, b.name));
    const skipped = fileList.length - files.length;
    if (skipped) toast(`${skipped} file dilewati (bukan gambar).`, 'danger');
    if (!files.length) return;
    const failed = [];
    let done = 0;
    setQueue({ done: 0, total: files.length, pct: 0, failed });
    for (let i = 0; i < files.length; i += BATCH) {
      const chunk = files.slice(i, i + BATCH);
      const fd = new FormData();
      chunk.forEach((f) => fd.append('images', f));
      try {
        const res = await upload('POST', `/api/admin/books/${book.id}/pages`, fd, (p) => setQueue((q) => q && { ...q, pct: Math.round(((done + p * chunk.length) / files.length) * 100) }));
        failed.push(...(res.failed || []));
        setBook(res.book);
      } catch (e) {
        chunk.forEach((f) => failed.push({ name: f.name, error: e.message }));
      }
      done += chunk.length;
      setQueue({ done, total: files.length, pct: Math.round((done / files.length) * 100), failed: [...failed] });
    }
    const ok = files.length - failed.length;
    if (ok) toast(`${ok} halaman berhasil diunggah.`);
    if (failed.length) toast(`${failed.length} file gagal diunggah.`, 'danger');
    setTimeout(() => setQueue((q) => (q && !q.failed.length ? null : q)), 800);
  }, [book.id, setBook, toast]);

  const reorder = async (from, to) => {
    if (from == null || to == null || from === to) return;
    const next = [...pages];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    const prev = book;
    setBook({ ...book, pages: next });
    try {
      const res = await api.put(`/api/admin/books/${book.id}/pages/order`, { ids: next.map((p) => p.id) });
      setBook(res.book);
    } catch (e) { setBook(prev); toast(e.message, 'danger'); }
  };

  const removePage = async () => {
    setBusy(true);
    try { const res = await api.del(`/api/admin/books/${book.id}/pages/${del.id}`); setBook(res.book); toast('Halaman dihapus.'); setDel(null); }
    catch (e) { toast(e.message, 'danger'); }
    finally { setBusy(false); }
  };

  const replacePage = async (file) => {
    if (!file || !replaceId) return;
    const fd = new FormData();
    fd.append('image', file);
    try { const res = await upload('PUT', `/api/admin/books/${book.id}/pages/${replaceId}`, fd); setBook(res.book); toast('Gambar halaman diganti.'); }
    catch (e) { toast(e.message, 'danger'); }
    setReplaceId(null);
  };

  return (
    <div className="card">
      <div className="card__header">
        <h3 className="card__title">Halaman ({pages.length})</h3>
        <p className="card__subtitle">Seret kartu untuk mengurutkan. Nama file diurutkan otomatis (1, 2, 10…).</p>
        <div className="card__action">
          <button type="button" className="button button--primary button--sm" onClick={() => fileRef.current?.click()}><ImagePlus size={16} /> Tambah gambar</button>
        </div>
      </div>
      <div className="card__body flex flex-col gap-4">
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/gif" multiple hidden onChange={(e) => { doUpload(e.target.files); e.target.value = ''; }} />
        <input ref={replaceRef} type="file" accept="image/*" hidden onChange={(e) => { replacePage(e.target.files[0]); e.target.value = ''; }} />

        <div
          className="grid cursor-pointer place-items-center rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors"
          style={{ borderColor: over ? 'var(--color-primary)' : 'var(--color-border-strong)', background: over ? 'color-mix(in oklch, var(--color-primary) 8%, transparent)' : 'transparent' }}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setOver(true); } }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); if (e.dataTransfer.files.length) doUpload(e.dataTransfer.files); }}
          role="button" tabIndex={0}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && fileRef.current?.click()}
        >
          <div>
            <UploadCloud className="mx-auto mb-2" size={30} style={{ color: 'var(--color-primary)' }} />
            <div className="font-medium">Seret &amp; lepas gambar halaman di sini</div>
            <div className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>atau klik untuk memilih · JPG, PNG, WEBP, AVIF · maks. 30 MB per file</div>
          </div>
        </div>

        {queue && (
          <div className="rounded-lg border p-3" style={{ borderColor: 'var(--color-border)' }}>
            <div className="mb-2 flex justify-between text-sm"><span>Mengunggah {queue.done}/{queue.total} file…</span><span>{queue.pct}%</span></div>
            <div className="h-2 overflow-hidden rounded-full" style={{ background: 'var(--color-neutral)' }}><div className="h-full transition-all" style={{ width: `${queue.pct}%`, background: 'var(--color-primary)' }} /></div>
            {queue.failed.length > 0 && (
              <div className="alert alert--danger mt-3">
                <div className="alert__description">
                  <strong>{queue.failed.length} file gagal:</strong>
                  <ul className="ml-4 list-disc">{queue.failed.slice(0, 5).map((f, i) => <li key={i}>{f.name} — {f.error}</li>)}</ul>
                  <button type="button" className="link mt-1" onClick={() => setQueue(null)}>Tutup</button>
                </div>
              </div>
            )}
          </div>
        )}

        {pages.length === 0 && !queue && <p className="text-center text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Belum ada halaman. Unggah gambar pertama sebagai sampul.</p>}

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {pages.map((p, i) => (
            <div
              key={p.id}
              draggable
              onDragStart={(e) => { setDragIdx(i); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(i)); }}
              onDragOver={(e) => { if (dragIdx != null) { e.preventDefault(); setDropIdx(i); } }}
              onDrop={(e) => { e.preventDefault(); reorder(dragIdx, i); setDragIdx(null); setDropIdx(null); }}
              onDragEnd={() => { setDragIdx(null); setDropIdx(null); }}
              className="group relative rounded-md border p-1.5 transition-all"
              style={{
                borderColor: dropIdx === i && dragIdx !== i ? 'var(--color-primary)' : 'var(--color-border)',
                background: 'var(--color-surface)', opacity: dragIdx === i ? 0.4 : 1,
                transform: dropIdx === i && dragIdx !== i ? 'scale(1.03)' : 'none',
              }}
            >
              <div className="relative overflow-hidden rounded-sm" style={{ aspectRatio: ratio, background: 'var(--color-neutral)' }}>
                <img src={p.t} alt={`Halaman ${i + 1}`} className="h-full w-full object-fill" draggable={false} loading="lazy" />
                <span className="absolute left-1.5 top-1.5 rounded-full bg-black/70 px-2 py-0.5 text-xs font-medium text-white">{i + 1}</span>
                <span className="absolute right-1.5 top-1.5 cursor-grab rounded bg-black/60 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"><GripVertical size={14} /></span>
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-1">
                <span className="truncate text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{formatBytes(p.bytes)}</span>
                <div className="flex">
                  <button type="button" className="button button--neutral button--ghost button--icon-only button--sm" aria-label={`Lihat halaman ${i + 1}`} onClick={() => setView(p)}><Expand size={14} /></button>
                  <button type="button" className="button button--neutral button--ghost button--icon-only button--sm" aria-label={`Ganti gambar halaman ${i + 1}`} onClick={() => { setReplaceId(p.id); replaceRef.current?.click(); }}><RefreshCw size={14} /></button>
                  <button type="button" className="button button--danger button--ghost button--icon-only button--sm" aria-label={`Hapus halaman ${i + 1}`} onClick={() => setDel({ ...p, n: i + 1 })}><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Modal open={!!del} title="Hapus halaman?" onClose={() => !busy && setDel(null)}
        footer={<><button type="button" className="button button--neutral button--outline" onClick={() => setDel(null)} disabled={busy}>Batal</button><button type="button" className="button button--danger" aria-busy={busy} onClick={removePage}>Hapus</button></>}>
        <p>Halaman <strong>{del?.n}</strong> akan dihapus permanen beserta file gambarnya.</p>
      </Modal>
      <Modal open={!!view} title="Pratinjau halaman" size="xl" onClose={() => setView(null)}>
        {view && <img src={view.n} alt="" className="mx-auto max-h-[70vh] w-auto rounded-sm" />}
      </Modal>
    </div>
  );
}

/* ---------- halaman editor ---------- */
export default function BookEditor() {
  const { id } = useParams();
  const isNew = !id;
  const nav = useNavigate();
  const toast = useToast();
  const [book, setBook] = useState(null);
  const [form, setForm] = useState({ title: '', author: '', description: '', slug: '', status: 'draft', settings: { ...DEFAULT_SETTINGS } });
  const [saved, setSaved] = useState(null);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(!isNew);
  const [busy, setBusy] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const fill = useCallback((b) => {
    const f = { title: b.title, author: b.author, description: b.description, slug: b.slug, status: b.status, settings: { ...DEFAULT_SETTINGS, ...b.settings } };
    setForm(f);
    setSaved(JSON.stringify(f));
  }, []);

  useEffect(() => {
    if (isNew) return;
    setLoading(true);
    api.get(`/api/admin/books/${id}`).then(({ book: b }) => { setBook(b); fill(b); }).catch((e) => (e.status === 404 ? setNotFound(true) : toast(e.message, 'danger'))).finally(() => setLoading(false));
  }, [id, isNew, fill, toast]);

  const dirty = useMemo(() => (isNew ? true : JSON.stringify(form) !== saved), [form, saved, isNew]);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setS = (k, v) => setForm((f) => ({ ...f, settings: { ...f.settings, [k]: v } }));
  const S = form.settings;

  useEffect(() => {
    if (!dirty || isNew) return undefined;
    const h = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty, isNew]);

  const submit = async (e) => {
    e?.preventDefault();
    setBusy(true); setErrors({});
    try {
      if (isNew) {
        const { book: b } = await api.post('/api/admin/books', form);
        toast('Buku dibuat. Sekarang unggah halaman-halamannya.');
        nav(`/admin/books/${b.id}`, { replace: true });
      } else {
        const { book: b } = await api.put(`/api/admin/books/${id}`, form);
        setBook((old) => ({ ...old, ...b }));
        fill(b);
        toast('Perubahan disimpan.');
      }
    } catch (ex) {
      setErrors(ex.errors || {});
      toast(ex.message, 'danger');
    } finally { setBusy(false); }
  };

  if (loading) return <div className="grid place-items-center py-24"><span className="spinner" /></div>;
  if (notFound) return <div className="empty-state"><div className="empty-state__title">Buku tidak ditemukan</div><div className="empty-state__action"><Link className="button button--primary" to="/admin/books">Kembali</Link></div></div>;

  const ratio = book?.pageWidth && book?.pageHeight ? book.pageWidth / book.pageHeight : 0.707;
  const url = `${window.location.origin}/book/${form.slug}`;

  return (
    <form className="page" onSubmit={submit}>
      <div className="page__header">
        <div className="page__headline">
          <Link to="/admin/books" className="link inline-flex items-center gap-1 text-sm"><ArrowLeft size={14} /> Kelola Buku</Link>
          <h1 className="page__title">{isNew ? 'Buku Baru' : form.title || 'Ubah Buku'}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!isNew && <a className="button button--neutral button--outline" href={`/book/${book?.slug}`} target="_blank" rel="noreferrer"><ExternalLink size={16} /> Buka</a>}
          <button type="submit" className="button button--primary" aria-busy={busy} disabled={busy || (!isNew && !dirty)}><Save size={16} /> {isNew ? 'Buat Buku' : dirty ? 'Simpan Perubahan' : 'Tersimpan'}</button>
        </div>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-6 xl:order-1">
          {isNew ? (
            <div className="alert alert--info"><div className="alert__description">Isi informasi buku terlebih dahulu. Setelah dibuat, Anda dapat mengunggah gambar halaman (drag &amp; drop).</div></div>
          ) : (
            book && <PagesManager book={book} setBook={setBook} ratio={ratio} />
          )}
        </div>

        <div className="flex flex-col gap-6 xl:order-2">
          <div className="card">
            <div className="card__header"><h3 className="card__title">Informasi</h3></div>
            <div className="card__body flex flex-col gap-4">
              <div className="field">
                <label className="field__label" htmlFor="t">Judul *</label>
                <input id="t" className="input" required maxLength={150} value={form.title} aria-invalid={!!errors.title} onChange={(e) => set('title', e.target.value)} />
                {errors.title && <p className="field__error">{errors.title}</p>}
              </div>
              <div className="field">
                <label className="field__label" htmlFor="a">Penulis / Pemilik</label>
                <input id="a" className="input" maxLength={100} value={form.author} onChange={(e) => set('author', e.target.value)} />
              </div>
              <div className="field">
                <label className="field__label" htmlFor="d">Deskripsi</label>
                <textarea id="d" className="textarea" rows={3} maxLength={1000} value={form.description} onChange={(e) => set('description', e.target.value)} />
              </div>
              <div className="field">
                <label className="field__label" htmlFor="s">Slug (URL)</label>
                <input id="s" className="input" placeholder="otomatis dari judul" value={form.slug} onChange={(e) => set('slug', e.target.value)} />
                {!isNew && (
                  <p className="field__description flex items-center gap-1 break-all">
                    {url}
                    <button type="button" className="button button--neutral button--ghost button--icon-only button--sm" aria-label="Salin tautan" onClick={() => navigator.clipboard?.writeText(url).then(() => toast('Tautan disalin.'))}><Copy size={14} /></button>
                  </p>
                )}
              </div>
              <div className="field">
                <label className="field__label" htmlFor="st">Status</label>
                <select id="st" className="select" value={form.status} onChange={(e) => set('status', e.target.value)}>
                  <option value="draft">Draft (hanya admin)</option>
                  <option value="published">Terbit (publik)</option>
                </select>
                {errors.status && <p className="field__error">{errors.status}</p>}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card__header"><h3 className="card__title">Pengaturan Viewer</h3><p className="card__subtitle">Animasi, warna, dan tombol toolbar.</p></div>
            <div className="card__body flex flex-col gap-6">
              <Group title="Animasi & interaksi">
                <Num label="Durasi membalik" value={S.flippingTime} min={0.2} max={2} step={0.1} suffix="detik" onChange={(v) => setS('flippingTime', v)} />
                <Num label="Intensitas bayangan" value={S.shadowIntensity} min={0} max={1} step={0.1} onChange={(v) => setS('shadowIntensity', v)} />
                <Switch label="Efek lipat sudut halaman" checked={S.curlingPageCorner} onChange={(v) => setS('curlingPageCorner', v)} />
                <Switch label="Sampul tampil sendiri" hint="Halaman 1 dan terakhir berdiri sendiri seperti buku asli" checked={S.showCover} onChange={(v) => setS('showCover', v)} />
                <Switch label="Pusatkan sampul" checked={S.retainBookCenter} onChange={(v) => setS('retainBookCenter', v)} />
                <Switch label="Balik halaman dengan roda mouse" checked={S.mouseWheelFlip} onChange={(v) => setS('mouseWheelFlip', v)} />
                <Switch label="Suara membalik halaman" checked={S.flipSound} onChange={(v) => setS('flipSound', v)} />
              </Group>
              <Group title="Putar otomatis">
                <Num label="Jeda antar halaman" value={S.autoPlayDuration} min={1} max={30} step={1} suffix="detik" onChange={(v) => setS('autoPlayDuration', v)} />
                <Num label="Jumlah putaran (0 = tanpa batas)" value={S.autoPlayLoopCount} min={0} max={20} step={1} onChange={(v) => setS('autoPlayLoopCount', v)} />
                <Switch label="Mulai otomatis saat dibuka" checked={S.autoPlayAutoStart} onChange={(v) => setS('autoPlayAutoStart', v)} />
              </Group>
              <Group title="Warna">
                <Color label="Latar belakang" value={S.backgroundColor} onChange={(v) => setS('backgroundColor', v)} />
                <Color label="Latar layar loading" value={S.loadingBackground} onChange={(v) => setS('loadingBackground', v)} />
                <Color label="Toolbar" value={S.toolbarColor} onChange={(v) => setS('toolbarColor', v)} />
                <Color label="Ikon toolbar" value={S.iconColor} onChange={(v) => setS('iconColor', v)} />
              </Group>
              <Group title="Tombol toolbar">
                {[['allowThumbnails', 'Daftar halaman (thumbnail)'], ['allowZoom', 'Zoom'], ['allowAutoPlay', 'Putar otomatis'], ['allowShare', 'Bagikan'], ['allowPrint', 'Cetak'], ['allowFullscreen', 'Layar penuh'], ['allowInstructions', 'Petunjuk'], ['allowAbout', 'Tentang buku'], ['showInstructionsOnStart', 'Tampilkan petunjuk saat pertama dibuka']].map(([k, l]) => (
                  <Switch key={k} label={l} checked={S[k]} onChange={(v) => setS(k, v)} />
                ))}
              </Group>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
