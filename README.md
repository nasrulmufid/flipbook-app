# FlipBook — viewer ala FlipHTML5 + dashboard manajemen buku

Stack: **React 19 · Tailwind CSS v4 · Stisla v3 · Express 5 · SQLite (better-sqlite3) · sharp**

## Fitur

**Viewer (`/book/:slug`)** — mereplikasi project referensi (`bookConfig`):
- Efek flip halaman 3D (soft page, durasi 0,6 dtk), **lipat sudut halaman saat hover**, seret/swipe untuk membalik
- Sampul tampil sendiri & dipusatkan (gaya *Catalog*), halaman terakhir sendiri; mobile otomatis **1 halaman**
- Bayangan lipatan/spine, bayangan buku, animasi masuk, layar loading dengan progress
- Toolbar gelap: thumbnail, zoom (tombol, double-click, Ctrl+roda, pinch), halaman pertama/sebelumnya/berikutnya/terakhir, lompat ke nomor halaman, putar otomatis, suara flip, bagikan (link, embed, sosial), cetak, layar penuh, petunjuk, tentang
- Roda mouse membalik halaman, keyboard (←/→, Home/End, +/−, F, Esc), URL `#p=N` tersinkron
- Lazy-load gambar + otomatis memakai gambar `large` saat zoom
- Embed: `/embed/:slug`

**Dashboard (`/admin`)** — Stisla v3:
- Login (cookie httpOnly JWT), ganti password, mode gelap
- Dashboard statistik, **CRUD buku** (cari, filter status, pagination, hapus dengan konfirmasi)
- **Upload gambar** drag & drop (multi-file, progress, urut nama natural), **urutkan dengan drag**, ganti/hapus halaman, pratinjau
- Pengaturan viewer per buku (animasi, warna, tombol toolbar, autoplay)
- Server membuat 3 varian per gambar seperti struktur referensi: `page/` (1655px), `large/` (2480px), `thumb/` (200px)

## Menjalankan

```bash
npm run setup          # install server + client
npm run seed           # (opsional) impor buku contoh dari ./seed/demo
npm run dev            # API :3001 + Vite :5173  → buka http://localhost:5173
```

Produksi:
```bash
npm run build
cp .env.example .env   # lalu set ADMIN_PASSWORD (atau export variabelnya)
npm start              # http://localhost:3001
```
Login awal: `admin` / `admin123` (atau sesuai `ADMIN_USER` / `ADMIN_PASSWORD`). **Segera ganti password** di menu Akun.

Impor folder gambar Anda sendiri (mis. `files/page` dari project lama):
```bash
npm run seed -- /path/ke/files/page "Judul Buku"
```

## Struktur
```
server/    index.js, db.js (skema SQLite), images.js (sharp), routes/{auth,public,admin}.js, seed.js
client/    src/components/viewer (FlipViewer, Toolbar, ...), src/pages/admin, src/pages/{Library,Viewer}.jsx
data/      flipbook.db + uploads/books/<id>/{page,large,thumb}  (dibuat otomatis)
```

## Catatan
- Halaman dengan rasio berbeda dari mayoritas halaman di-*stretch* mengikuti ukuran buku (sama seperti pengaturan "Stretch" di FlipHTML5). Ukuran buku = rasio halaman terbanyak.
- Mesin flip: [`page-flip`](https://github.com/Nodlik/StPageFlip) (mode HTML).
- Fitur FlipHTML5 yang tidak ada di referensi/tidak dibuat: pencarian teks, daftar isi, bookmark, anotasi, musik latar.
