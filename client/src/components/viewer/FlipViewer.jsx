import { useCallback, useEffect, useRef, useState } from 'react';
import { PageFlip } from 'page-flip';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Toolbar from './Toolbar.jsx';
import ThumbStrip from './ThumbStrip.jsx';
import {
	ShareDialog,
	PrintDialog,
	AboutDialog,
	HelpDialog,
} from './Dialogs.jsx';
import { createFlipSound } from './sound.js';

const MIN_PAGE_W = 280; // lebar halaman minimum → di bawah 2× ini viewer pindah ke mode 1 halaman (mobile)
const MAX_ZOOM = 4;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const parseHash = (total) => {
	const m = /[#&]p=(\d+)/.exec(window.location.hash);
	return clamp(m ? parseInt(m[1], 10) || 1 : 1, 1, total);
};

export default function FlipViewer({ book, embed = false }) {
	const s = book.settings;
	const total = book.pages.length;
	const ratio = book.pageWidth / book.pageHeight;

	const rootRef = useRef(null);
	const stageRef = useRef(null);
	const zoomRef = useRef(null);
	const hostRef = useRef(null);
	const E = useRef({
		view: { z: 1, x: 0, y: 0 },
		e: 0,
		lead: 0,
		count: 0,
		orientation: 'landscape',
		curN: 1,
		flipping: false,
		target: null,
		wheelAt: 0,
		loops: 0,
		soundOn: s.flipSound,
		modal: false,
	}).current;

	const [phase, setPhase] = useState('loading');
	const [pct, setPct] = useState(0);
	const [info, setInfo] = useState({ left: 1, right: null });
	const [layout, setLayout] = useState(null);
	const [spineHidden, setSpineHidden] = useState(false);
	const [zoom, setZoom] = useState(1);
	const [thumbs, setThumbs] = useState(false);
	const [dialog, setDialog] = useState(null);
	const [playing, setPlaying] = useState(false);
	const [soundOn, setSoundOn] = useState(s.flipSound);
	const [isFs, setIsFs] = useState(false);
	const [toast, setToast] = useState('');
	const [narrow, setNarrow] = useState(
		typeof window !== 'undefined' && window.innerWidth < 720,
	);

	E.soundOn = soundOn;
	E.modal = !!dialog;

	const flash = useCallback(
		(msg) => {
			setToast(msg);
			clearTimeout(E.toastT);
			E.toastT = setTimeout(() => setToast(''), 1600);
		},
		[E],
	);

	// Mode mobile: panel daftar halaman otomatis terbuka
	useEffect(() => {
		if (narrow && s.allowThumbnails) setThumbs(true);
	}, [narrow, s.allowThumbnails]);

	/* ---------------- zoom & pan ---------------- */
	const applyView = useCallback(
		(animate = true) => {
			const z = zoomRef.current;
			if (!z) return;
			const { z: zz, x, y } = E.view;
			z.classList.toggle('is-animated', animate);
			z.classList.toggle('is-zoomed', zz > 1.001);
			z.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${zz})`;
			setZoom(zz);
		},
		[E],
	);

	const clampPan = useCallback((v) => {
		const r = stageRef.current?.getBoundingClientRect();
		if (!r) return;
		const mx = Math.max(0, ((v.z - 1) * r.width) / 2);
		const my = Math.max(0, ((v.z - 1) * r.height) / 2);
		v.x = clamp(v.x, -mx, mx);
		v.y = clamp(v.y, -my, my);
	}, []);

	/** cx, cy = titik fokus relatif terhadap pusat stage */
	const zoomTo = useCallback(
		(nz, cx = 0, cy = 0, animate = true) => {
			const v = E.view;
			nz = clamp(nz, 1, MAX_ZOOM);
			const k = nz / v.z;
			v.x = cx - (cx - v.x) * k;
			v.y = cy - (cy - v.y) * k;
			v.z = nz;
			if (nz <= 1.001) {
				v.x = 0;
				v.y = 0;
				v.z = 1;
			}
			clampPan(v);
			applyView(animate);
			if (nz > 1.001) E.api?.upgrade();
		},
		[E, applyView, clampPan],
	);

	/* ---------------- mesin flipbook ---------------- */
	useEffect(() => {
		const host = hostRef.current;
		const el = document.createElement('div');
		el.className = 'fb-stf';
		host.appendChild(el);

		const sound = createFlipSound();
		let pf = null;
		let destroyed = false;
		let raf = 0;
		let rebuildT = 0;

		const mkImg = (i) => {
			const d = document.createElement('div');
			d.className = 'fb-page';
			const img = document.createElement('img');
			img.className = 'fb-img';
			img.draggable = false;
			img.alt = `Halaman ${i + 1}`;
			img.decoding = 'async';
			img.onload = () => img.classList.add('is-loaded');
			d.appendChild(img);
			d.__img = img;
			return d;
		};
		const mkBlank = () => {
			const d = document.createElement('div');
			d.className = 'fb-page fb-blank';
			return d;
		};

		const pageNodes = book.pages.map((_, i) => mkImg(i));
		const headBlank = mkBlank();
		const tailBlank = mkBlank();

		const landscapeNow = () => host.clientWidth >= MIN_PAGE_W * 2;
		E.orientation = landscapeNow() ? 'landscape' : 'portrait';
		E.lead = s.showCover && E.orientation === 'landscape' ? 1 : 0;

		// Halaman sampul dibuat "sendirian" dengan menyisipkan halaman kosong transparan di depan (mode landscape),
		// sehingga semua halaman tetap bertipe soft (melengkung) seperti gaya Catalog di FlipHTML5.
		const buildList = (lead) => {
			const list = [...(lead ? [headBlank] : []), ...pageNodes];
			if (lead && list.length % 2 === 1) list.push(tailBlank);
			E.count = list.length;
			return list;
		};
		const lastSpreadE = () =>
			E.orientation === 'landscape'
				? 2 * Math.floor((E.count - 1) / 2)
				: E.count - 1;
		const toIndex = (n) => {
			let e = n - 1 + E.lead;
			if (E.orientation === 'landscape') e -= e % 2;
			return clamp(e, 0, E.count - 1);
		};
		const labelFor = (e) => {
			const l = e - E.lead + 1;
			const landscape = E.orientation === 'landscape';
			const ok = (n) => (n >= 1 && n <= total ? n : null);
			return { left: ok(l), right: landscape ? ok(l + 1) : null };
		};

		const setSrc = (img, url) => {
			if (img.getAttribute('src') !== url) img.src = url;
		};
		const ensureLoaded = (e) => {
			for (let k = e - 4; k <= e + 6; k++) {
				const n = k - E.lead;
				if (n < 0 || n >= total) continue;
				const img = pageNodes[n].__img;
				setSrc(img, img.__big ? book.pages[n].l : book.pages[n].n);
			}
		};
		E.upgrade = () => {
			for (let k = E.e - 1; k <= E.e + 2; k++) {
				const n = k - E.lead;
				if (n < 0 || n >= total) continue;
				const img = pageNodes[n].__img;
				img.__big = true;
				setSrc(img, book.pages[n].l);
			}
		};

		const applyLayout = (e) => {
			if (!pf) return;
			const b = pf.getBoundsRect();
			const pw = b.pageWidth;
			const landscape = pf.getOrientation() === 'landscape';
			const { left, right } = labelFor(e);
			let boxLeft = b.left;
			let boxW = pw * 2;
			let shift = 0;
			if (!landscape) {
				boxLeft = b.left + pw;
				boxW = pw;
			} else if (left && right) {
				/* spread penuh */
			} else if (right) {
				boxLeft = b.left + pw;
				boxW = pw;
				if (s.retainBookCenter) shift = -pw / 2;
			} else {
				boxW = pw;
				if (s.retainBookCenter) shift = pw / 2;
			}
			setLayout({
				boxLeft,
				boxTop: b.top,
				boxW,
				boxH: b.height,
				pw,
				shift,
				spread: landscape && !!left && !!right,
			});
		};

		const refresh = (e) => {
			const { left, right } = labelFor(e);
			E.curN = left ?? right ?? 1;
			setInfo({ left, right });
			applyLayout(e);
			ensureLoaded(e);
			if (E.view.z > 1) E.upgrade();
			try {
				window.history.replaceState(null, '', `#p=${E.curN}`);
			} catch {
				/* iframe sandbox */
			}
		};

		const rebuild = () => {
			if (!pf || destroyed) return;
			const land = pf.getOrientation() === 'landscape';
			const want = land ? 'landscape' : 'portrait';
			if (want === E.orientation && E.count) return;
			E.orientation = want;
			E.lead = s.showCover && land ? 1 : 0;
			pf.updateFromHtml(buildList(E.lead));
			const e = toIndex(E.curN);
			pf.turnToPage(e);
			E.e = e;
			refresh(e);
		};

		const predictTarget = () => {
			if (E.target != null) return E.target;
			try {
				const dir = pf.getFlipController().getCalculation().getDirection(); // 0 = maju, 1 = mundur
				const step = E.orientation === 'landscape' ? 2 : 1;
				return clamp(E.e + (dir === 0 ? step : -step), 0, E.count - 1);
			} catch {
				return E.e;
			}
		};

		const initialList = buildList(E.lead); // harus sebelum toIndex (butuh E.count)
		const startN = parseHash(total);
		const startE = toIndex(startN);
		E.e = startE;

		pf = new PageFlip(el, {
			width: book.pageWidth,
			height: book.pageHeight,
			size: 'stretch',
			minWidth: MIN_PAGE_W,
			maxWidth: 4000,
			minHeight: 200,
			maxHeight: 8000,
			drawShadow: true,
			flippingTime: Math.round(s.flippingTime * 1000),
			usePortrait: true,
			startZIndex: 0,
			autoSize: false,
			maxShadowOpacity: s.shadowIntensity,
			showCover: false,
			mobileScrollSupport: false,
			swipeDistance: 24,
			clickEventForward: true,
			useMouseEvents: true,
			showPageCorners: s.curlingPageCorner,
			disableFlipByClick: true,
			startPage: startE,
		});
		E.pf = pf;
		pf.loadFromHTML(initialList);

		pf.on('init', () => {
			if (destroyed) return;
			rebuild();
			refresh(E.e);
		});
		pf.on('flip', (ev) => {
			if (destroyed) return;
			E.e = ev.data;
			E.target = null;
			refresh(ev.data);
		});
		pf.on('changeOrientation', () => {
			clearTimeout(rebuildT);
			rebuildT = setTimeout(rebuild, 0);
		});
		pf.on('changeState', (ev) => {
			if (destroyed) return;
			const st = ev.data;
			if (st === 'flipping') {
				E.flipping = true;
				setSpineHidden(true);
				if (E.soundOn) sound.play();
				applyLayout(predictTarget());
			} else if (st === 'user_fold') {
				setSpineHidden(true);
			} else if (st === 'read') {
				E.flipping = false;
				setSpineHidden(false);
				applyLayout(E.e);
			}
		});

		// Catatan: pf.flipNext()/flipPrev()/flip() bawaan library memakai koordinat y=1 dan x=10 (tanpa offset bounds),
		// sehingga gagal bila buku tidak menempel di tepi atas/kiri container (mode mobile / letterbox).
		// Di sini koordinat sudut dihitung dari getBoundsRect().
		const flipDir = (forward) => {
			const r = pf.getBoundsRect();
			pf.getFlipController().flip({
				x: forward ? r.left + r.pageWidth * 2 - 10 : r.left + 10,
				y: r.top + 1,
			});
		};
		// Mundur mode 1 halaman: animasi lembar kustom — halaman yang sedang tampil
		// terangkat dari punggung buku, menggulung membentuk silinder, lalu menyapu ke
		// kanan memperlihatkan halaman tujuan di bawahnya (seperti membuka buku asli).
		// Mesin bawaan hanya menggambar satu bidang kaku sehingga tidak bisa menggulung.
		const sheetBack = (targetE) => {
			const pc = pf.getPageCollection();
			const cur = pc.getCurrentSpreadIndex();
			const tgt = targetE ?? cur - 1;
			if (cur < 1 || tgt < 0 || tgt >= cur || destroyed) return false;
			const b = pf.getBoundsRect();
			const pw = b.pageWidth;
			const ph = b.height;
			const curN = E.e - E.lead;
			const tgtN = tgt - E.lead;
			if (tgtN < 0 || tgtN >= total || !pageNodes[curN] || !pageNodes[tgtN])
				return false;
			ensureLoaded(tgt); // gambar tujuan tersedia walau lompatannya jauh
			const curSrc = pageNodes[curN].__img.getAttribute('src');
			const tgtSrc = pageNodes[tgtN].__img.getAttribute('src');

			const layer = document.createElement('div');
			layer.style.cssText = `position:absolute;left:${
				b.left + pw
			}px;top:${b.top}px;width:${pw}px;height:${ph}px;z-index:30;perspective:1200px;pointer-events:none;`;
			// Halaman tujuan tersingkap di bawah lembar yang terangkat
			const under = document.createElement('img');
			under.src = tgtSrc;
			under.alt = '';
			under.style.cssText =
				'position:absolute;left:0;top:0;width:100%;height:100%;';
			layer.appendChild(under);
			// Bayangan lembut yang mengikuti gulungan di atas halaman tersingkap
			const shade = document.createElement('div');
			shade.style.cssText =
				'position:absolute;top:0;height:100%;width:80px;opacity:0;background:linear-gradient(to left, rgba(0,0,0,0.32), rgba(0,0,0,0));';
			layer.appendChild(shade);

			// Lembar dipecah menjadi strip vertikal; tiap strip berputar mengelilingi
			// pinggir kanannya sehingga rangkaiannya terlihat menggulung seperti kertas.
			const K = 10;
			const sw = pw / K;
			const mkFace = (src, isBack) => {
				const f = document.createElement('div');
				f.style.cssText = `position:absolute;inset:0;overflow:hidden;backface-visibility:hidden;-webkit-backface-visibility:hidden;${
					isBack ? 'transform:rotateY(180deg);' : ''
				}`;
				const im = document.createElement('img');
				im.src = src;
				im.alt = '';
				im.style.cssText = `position:absolute;top:0;height:100%;width:${pw}px;max-width:none;`;
				f.appendChild(im);
				const sh = document.createElement('div'); // penshade permukaan kertas
				f.appendChild(sh);
				return { f, im, sh };
			};
			const strips = [];
			for (let k = 0; k < K; k++) {
				const el = document.createElement('div');
				el.style.cssText = `position:absolute;left:${
					k * sw
				}px;top:0;width:${sw + 0.6}px;height:100%;transform-style:preserve-3d;will-change:transform;`;
				const front = mkFace(curSrc, false);
				const back = mkFace(tgtSrc, true);
				front.im.style.left = `${-k * sw}px`;
				back.im.style.left = `${-k * sw}px`;
				el.appendChild(front.f);
				el.appendChild(back.f);
				layer.appendChild(el);
				strips.push({ el, front, back });
			}
			pf.getUI().getDistElement().appendChild(layer);

			const DUR = Math.max(400, Math.round(s.flippingTime * 1000));
			const bw = pw * 0.6; // lebar rentang lengkungan gulungan
			const t0 = performance.now();
			const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
			E.flipping = true;
			setSpineHidden(true);
			if (E.soundOn) sound.play();
			applyLayout(tgt);

			const frame = (now) => {
				if (destroyed) {
					layer.remove();
					return;
				}
				const t = Math.min(1, (now - t0) / DUR);
				const C = ease(t) * (pw + bw + sw);
				let shadeX = pw;
				for (let k = 0; k < K; k++) {
					const st = strips[k];
					const phi = (180 * (C - k * sw)) / bw;
					if (phi <= 0.5) continue; // masih datar — salinan persis halaman asli
					if (phi >= 179.5) {
						// terlipat penuh → menghilang (material lembar sudah "lewat")
						st.el.style.visibility = 'hidden';
						continue;
					}
					st.el.style.visibility = 'visible';
					st.el.style.transformOrigin = `${sw}px 50%`;
					st.el.style.transform = `rotateY(${phi.toFixed(2)}deg)`;
					st.el.style.zIndex = String(2 + Math.round(phi / 10));
					const dim = Math.sin((phi * Math.PI) / 180);
					st.front.sh.style.background = `rgba(0,0,0,${(0.38 * dim).toFixed(
						3,
					)})`;
					st.back.sh.style.background = `rgba(255,255,255,${(
						0.25 +
						0.3 * (1 - dim)
					).toFixed(3)})`;
					const lift = k * sw + sw * (1 - Math.cos((phi * Math.PI) / 180));
					if (phi < 150 && lift < shadeX) shadeX = lift;
				}
				shade.style.left = `${Math.max(0, shadeX - 80)}px`;
				shade.style.opacity = shadeX < pw ? '1' : '0';
				if (t < 1) {
					requestAnimationFrame(frame);
					return;
				}
				layer.remove();
				// Komit perpindahan spread ke mesin tanpa animasi bawaan
				try {
					pc.setCurrentSpreadIndex(tgt);
					pc.showSpread();
					pf.updatePageIndex(tgt);
				} catch {
					/* spread tidak valid */
				}
				E.flipping = false;
				setSpineHidden(false);
			};
			requestAnimationFrame(frame);
			return true;
		};
		// Flip mundur dijalankan sebagai flip MAJU dari spread dua langkah sebelumnya agar
		// arah, kurva, dan lapisan animasinya identik dengan flip maju (mesin hanya punya satu
		// pola lipatan; lipatan mundur bawaan portrait memakai halaman peran ganda sehingga
		// terlihat berbeda).
		const flipBack = () => {
			const pc = pf.getPageCollection();
			const cur = pc.getCurrentSpreadIndex();
			if (E.orientation === 'portrait') {
				// Mode 1 halaman: gulungan lembar kustom seperti membuka buku asli
				sheetBack();
				return;
			}
			if (cur >= 2) {
				const srcN = E.e - E.lead; // halaman buku pertama yang sedang terlihat
				// Lipatan landscape menyatu dari halaman kanan → konten yang "dipinjam"
				// adalah halaman kanan yang sedang tampil.
				const visN = srcN + 1;
				const proxy = pageNodes[srcN - 2]?.__img;
				const trueSrc = proxy ? proxy.getAttribute('src') : null;
				let swapped = false;
				// Halaman yang melipat adalah elemen salinan halaman dua spread sebelumnya,
				// bukan halaman yang sedang terlihat. "Pinjam" gambar halaman yang terlihat
				// agar frame pertama animasi identik dengan tampilan saat ini (tanpa kedipan).
				if (proxy && pageNodes[visN]?.__img) {
					swapped = true;
					proxy.setAttribute('src', pageNodes[visN].__img.getAttribute('src'));
				}
				E.target = E.e - 2;
				pc.setCurrentSpreadIndex(cur - 2);
				flipDir(true);
				if (!pf.getFlipController().getCalculation()) {
					// Gagal memulai → pulihkan spread & gambar tanpa berpindah halaman
					pc.setCurrentSpreadIndex(cur);
					E.target = null;
					if (swapped) proxy.setAttribute('src', trueSrc);
					return;
				}
				if (swapped)
					setTimeout(
						() => proxy.setAttribute('src', trueSrc),
						s.flippingTime * 1000 + 300,
					);
			} else {
				flipDir(false);
			}
		};
		E.api = {
			next: () => {
				if (E.flipping) return;
				if (E.e < lastSpreadE()) flipDir(true);
			},
			prev: () => {
				if (E.flipping || E.e <= 0) return;
				flipBack();
			},
			goto: (n) => {
				const e = toIndex(n);
				if (e === E.e) return;
				if (E.flipping) return;
				E.target = e;
				const pc = pf.getPageCollection();
				const cur = pc.getCurrentSpreadIndex();
				const next = pc.getSpreadIndexByPage(e);
				try {
					if (next > cur) {
						pc.setCurrentSpreadIndex(next - 1);
						flipDir(true);
					} else if (next < cur) {
						if (E.orientation === 'portrait') {
							// Mode 1 halaman: gulungan lembar mundur (konsisten dengan
							// tombol mundur), sekali gulung berapapun jarak lompatannya.
							if (!sheetBack(e)) E.target = null;
						} else if (next >= 1) {
							// Mundur lewat jalur maju agar animasinya konsisten
							pc.setCurrentSpreadIndex(next - 1);
							flipDir(true);
						} else {
							pc.setCurrentSpreadIndex(next + 1);
							flipDir(false);
						}
					}
				} catch {
					E.target = null;
				}
			},
			lastSpreadE,
			upgrade: E.upgrade,
			relayout: () => {
				pf.update();
				applyLayout(E.e);
			},
		};

		// Ubah ukuran stage (panel thumbnail, rotasi, dll.) → hitung ulang
		const ro = new ResizeObserver(() => {
			cancelAnimationFrame(raf);
			raf = requestAnimationFrame(() => {
				if (!destroyed && E.api) {
					E.api.relayout();
					rebuild();
				}
			});
		});
		ro.observe(stageRef.current);

		// Preload halaman awal sambil menampilkan layar loading
		(async () => {
			const urls = [];
			for (let k = startE - 1; k <= startE + 3; k++) {
				const n = k - E.lead;
				if (n >= 0 && n < total) urls.push(book.pages[n].n);
			}
			let done = 0;
			const load = (u) =>
				new Promise((res) => {
					const im = new Image();
					im.onload = im.onerror = () => {
						done += 1;
						if (!destroyed) setPct(Math.round((done / urls.length) * 100));
						res();
					};
					im.src = u;
				});
			await Promise.race([
				Promise.all(urls.map(load)),
				new Promise((r) => setTimeout(r, 12000)),
			]);
			await new Promise((r) => setTimeout(r, 350));
			if (destroyed) return;
			ensureLoaded(E.e);
			setPhase('ready');
			if (s.autoPlayAutoStart) setPlaying(true);
			if (s.showInstructionsOnStart && s.allowInstructions && !embed) {
				try {
					if (!localStorage.getItem(`fb_help_${book.id}`)) {
						localStorage.setItem(`fb_help_${book.id}`, '1');
						setTimeout(() => !destroyed && setDialog('help'), 900);
					}
				} catch {
					/* storage dinonaktifkan */
				}
			}
		})();

		const onHash = () => {
			const n = parseHash(total);
			if (n !== E.curN) E.api?.goto(n);
		};
		window.addEventListener('hashchange', onHash);

		return () => {
			destroyed = true;
			cancelAnimationFrame(raf);
			clearTimeout(rebuildT);
			window.removeEventListener('hashchange', onHash);
			ro.disconnect();
			try {
				pf.destroy();
			} catch {
				/* sudah dibersihkan */
			}
			el.remove();
			E.pf = null;
			E.api = null;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [book.id, total]);

	/* ---------------- aksi toolbar ---------------- */
	const canFs =
		typeof document !== 'undefined' &&
		!!(document.fullscreenEnabled || document.webkitFullscreenEnabled);

	const act = useCallback(
		(name, arg) => {
			const api = E.api;
			switch (name) {
				case 'next':
					api?.next();
					break;
				case 'prev':
					api?.prev();
					break;
				case 'first':
					api?.goto(1);
					break;
				case 'last':
					api?.goto(total);
					break;
				case 'goto':
					api?.goto(arg);
					break;
				case 'thumbs':
					setThumbs((v) => !v);
					break;
				case 'zoomIn':
					zoomTo(E.view.z < 1.01 ? 2 : E.view.z * 1.5);
					break;
				case 'zoomOut':
					zoomTo(E.view.z / 1.5 < 1.15 ? 1 : E.view.z / 1.5);
					break;
				case 'autoplay':
					setPlaying((v) => {
						flash(v ? 'Putar otomatis dihentikan' : 'Putar otomatis dimulai');
						return !v;
					});
					break;
				case 'sound':
					setSoundOn((v) => {
						flash(v ? 'Suara mati' : 'Suara menyala');
						return !v;
					});
					break;
				case 'share':
					setDialog('share');
					break;
				case 'print':
					setDialog('print');
					break;
				case 'about':
					setDialog('about');
					break;
				case 'help':
					setDialog('help');
					break;
				case 'fullscreen': {
					const r = rootRef.current;
					const cur =
						document.fullscreenElement || document.webkitFullscreenElement;
					if (cur)
						(document.exitFullscreen || document.webkitExitFullscreen).call(
							document,
						);
					else (r.requestFullscreen || r.webkitRequestFullscreen)?.call(r);
					break;
				}
				default:
			}
		},
		[E, flash, total, zoomTo],
	);

	/* ---------------- keyboard, wheel, fullscreen, resize ---------------- */
	useEffect(() => {
		const onKey = (e) => {
			if (E.modal || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
			switch (e.key) {
				case 'ArrowRight':
				case 'PageDown':
					e.preventDefault();
					act('next');
					break;
				case 'ArrowLeft':
				case 'PageUp':
					e.preventDefault();
					act('prev');
					break;
				case 'Home':
					act('first');
					break;
				case 'End':
					act('last');
					break;
				case '+':
				case '=':
					if (s.allowZoom) act('zoomIn');
					break;
				case '-':
				case '_':
					if (s.allowZoom) act('zoomOut');
					break;
				case 'f':
				case 'F':
					if (s.allowFullscreen) act('fullscreen');
					break;
				case 'Escape':
					if (E.view.z > 1) zoomTo(1);
					else setThumbs(false);
					break;
				default:
			}
		};
		const onFs = () =>
			setIsFs(
				!!(document.fullscreenElement || document.webkitFullscreenElement),
			);
		const onResize = () => setNarrow(window.innerWidth < 720);
		window.addEventListener('keydown', onKey);
		document.addEventListener('fullscreenchange', onFs);
		document.addEventListener('webkitfullscreenchange', onFs);
		window.addEventListener('resize', onResize);
		return () => {
			window.removeEventListener('keydown', onKey);
			document.removeEventListener('fullscreenchange', onFs);
			document.removeEventListener('webkitfullscreenchange', onFs);
			window.removeEventListener('resize', onResize);
		};
	}, [E, act, s.allowZoom, s.allowFullscreen, zoomTo]);

	useEffect(() => {
		const stage = stageRef.current;
		const center = () => {
			const r = stage.getBoundingClientRect();
			return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
		};

		const onWheel = (ev) => {
			if (E.modal) return;
			if ((ev.ctrlKey || ev.metaKey) && s.allowZoom) {
				ev.preventDefault();
				const c = center();
				zoomTo(
					E.view.z * (ev.deltaY < 0 ? 1.15 : 1 / 1.15),
					ev.clientX - c.x,
					ev.clientY - c.y,
					false,
				);
				return;
			}
			if (E.view.z > 1.001) {
				ev.preventDefault();
				E.view.x -= ev.deltaX;
				E.view.y -= ev.deltaY;
				clampPan(E.view);
				applyView(false);
				return;
			}
			if (!s.mouseWheelFlip || Math.abs(ev.deltaY) < 4) return;
			ev.preventDefault();
			const now = performance.now();
			if (now - E.wheelAt < s.flippingTime * 1000 + 150) return;
			E.wheelAt = now;
			if (ev.deltaY > 0) E.api?.next();
			else E.api?.prev();
		};

		// Ketukan/klik di area mana pun (termasuk tengah kanan/kiri) membalik halaman.
		const bookPos = (cx, cy) => {
			const pf = E.pf;
			if (!pf) return null;
			try {
				const b = pf.getBoundsRect();
				const dr = pf.getUI().getDistElement().getBoundingClientRect();
				return { x: cx - dr.left - b.left, y: cy - dr.top - b.top, b };
			} catch {
				return null;
			}
		};
		const zoneFlip = (cx, cy) => {
			if (!E.pf || E.flipping || E.modal || E.view.z > 1.001) return;
			const p = bookPos(cx, cy);
			if (!p) {
				const r = stage.getBoundingClientRect();
				if (cx >= r.left + r.width / 2) E.api?.next();
				else E.api?.prev();
				return;
			}
			// Portrait: halaman terlihat hanya setengah kanan buku → bagi halaman itu menjadi dua
			const mid =
				E.orientation === 'portrait' ? p.b.pageWidth * 1.5 : p.b.pageWidth;
			if (p.x > mid) E.api?.next();
			else E.api?.prev();
		};

		// Double-click / double-tap dideteksi manual dari pointer events: mesin flip mengganti elemen target
		// di antara dua klik sehingga event 'dblclick' bawaan browser tidak andal.
		let down = null;
		let lastTap = null;
		let tapFlipT = 0;
		const onPD = (ev) => {
			down = { x: ev.clientX, y: ev.clientY, id: ev.pointerId };
		};
		const onPU = (ev) => {
			if (!down || ev.pointerId !== down.id) return;
			const moved = Math.hypot(ev.clientX - down.x, ev.clientY - down.y);
			down = null;
			if (moved > 8 || E.modal || ev.target.closest('.fb-arrow')) {
				lastTap = null;
				clearTimeout(tapFlipT);
				return;
			}
			const now = performance.now();
			if (
				lastTap &&
				now - lastTap.t < 330 &&
				Math.hypot(ev.clientX - lastTap.x, ev.clientY - lastTap.y) < 28
			) {
				// Ketukan kedua → zoom; batalkan balik-halaman satu ketukan yang tertunda
				lastTap = null;
				clearTimeout(tapFlipT);
				if (s.allowZoom) {
					const c = center();
					if (E.view.z > 1.001) zoomTo(1);
					else zoomTo(2.2, ev.clientX - c.x, ev.clientY - c.y);
				}
			} else {
				lastTap = { t: now, x: ev.clientX, y: ev.clientY };
				if (s.allowZoom) {
					// Ketukan pertama → jadwalkan balik halaman; batal bila ternyata ketukan ganda
					clearTimeout(tapFlipT);
					tapFlipT = setTimeout(() => {
						if (lastTap && !E.modal && !E.flipping && E.view.z <= 1.001)
							zoneFlip(lastTap.x, lastTap.y);
					}, 330);
				} else {
					// Zoom nonaktif → tak perlu menunggu kemungkinan ketukan ganda
					zoneFlip(ev.clientX, ev.clientY);
				}
			}
		};

		// pinch-to-zoom (layar sentuh) + ambil alih gestur geser/flick bawaan library
		let pinch = null;
		let hijack = null; // sentuhan tunggal yang sedang dilacak
		let dragBlock = false; // true = gestur geser diambil alih dari library
		const dist = (t) =>
			Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
		const clearLibTouch = () => {
			try {
				// userStop(pos, true) hanya mereset flag sentuhan library tanpa memicu flip
				E.pf?.userStop({ x: 0, y: 0 }, true);
			} catch {
				/* abaikan */
			}
		};
		const onTS = (ev) => {
			if (ev.touches.length >= 2) {
				hijack = null;
				dragBlock = false;
				if (s.allowZoom) {
					ev.stopPropagation();
					pinch = { d: dist(ev.touches), z: E.view.z };
				}
				return;
			}
			const t = ev.touches[0];
			hijack = {
				id: t.identifier,
				x: t.clientX,
				y: t.clientY,
				t: performance.now(),
			};
		};
		const onTM = (ev) => {
			if (pinch) {
				if (ev.touches.length !== 2) return;
				ev.preventDefault();
				ev.stopPropagation();
				const c = center();
				const mx = (ev.touches[0].clientX + ev.touches[1].clientX) / 2 - c.x;
				const my = (ev.touches[0].clientY + ev.touches[1].clientY) / 2 - c.y;
				zoomTo(pinch.z * (dist(ev.touches) / pinch.d), mx, my, false);
				return;
			}
			if (!hijack || dragBlock || ev.touches.length !== 1) return;
			const t = ev.touches[0];
			const dx = t.clientX - hijack.x;
			const dy = t.clientY - hijack.y;
			if (dx > 12 && Math.abs(dx) > Math.abs(dy) * 1.2) {
				// Seret ke kanan (mundur): di luar 40% zona kiri portrait, library malah
				// melipat halaman ke arah depan lalu mengembalikannya (terasa salah arah).
				// Blokir fold-nya dan animasikan lewat jalur maju yang konsisten saat lepas.
				dragBlock = !E.modal && !E.flipping && E.view.z <= 1.001;
				if (dragBlock) ev.stopPropagation();
			}
		};
		const onTE = (ev) => {
			if (ev.touches.length < 2) pinch = null;
			const t = hijack
				? [...ev.changedTouches].find((c) => c.identifier === hijack.id)
				: null;
			const start = hijack;
			const blocked = dragBlock;
			hijack = null;
			dragBlock = false;
			if (!t || !start) return;
			if (!blocked) return; // geser ke kiri / ke bawah → jalur native library
			ev.stopPropagation();
			clearLibTouch();
			const dx = t.clientX - start.x;
			if (E.modal || E.view.z > 1.001 || E.flipping || Math.abs(dx) <= 12) {
				// Tidak jadi membalik → ratakan kembali lipatan kecil yang sempat terbentuk
				try {
					E.pf?.getFlipController()?.stopMove();
				} catch {
					/* abaikan */
				}
				return;
			}
			if (dx < 0) E.api?.next();
			else E.api?.prev();
		};

		stage.addEventListener('wheel', onWheel, { passive: false });
		stage.addEventListener('pointerdown', onPD, true);
		stage.addEventListener('pointerup', onPU, true);
		stage.addEventListener('touchstart', onTS, {
			capture: true,
			passive: false,
		});
		stage.addEventListener('touchmove', onTM, {
			capture: true,
			passive: false,
		});
		stage.addEventListener('touchend', onTE, true);
		return () => {
			clearTimeout(tapFlipT);
			stage.removeEventListener('wheel', onWheel);
			stage.removeEventListener('pointerdown', onPD, true);
			stage.removeEventListener('pointerup', onPU, true);
			stage.removeEventListener('touchstart', onTS, true);
			stage.removeEventListener('touchmove', onTM, true);
			stage.removeEventListener('touchend', onTE, true);
		};
	}, [
		E,
		s.allowZoom,
		s.mouseWheelFlip,
		s.flippingTime,
		zoomTo,
		applyView,
		clampPan,
	]);

	// Geser (pan) saat di-zoom
	const drag = useRef(null);
	const onPanDown = (ev) => {
		if (ev.pointerType === 'touch' && ev.isPrimary === false) return;
		ev.currentTarget.setPointerCapture(ev.pointerId);
		drag.current = { x: ev.clientX, y: ev.clientY };
		ev.currentTarget.classList.add('is-dragging');
	};
	const onPanMove = (ev) => {
		if (!drag.current) return;
		E.view.x += ev.clientX - drag.current.x;
		E.view.y += ev.clientY - drag.current.y;
		drag.current = { x: ev.clientX, y: ev.clientY };
		clampPan(E.view);
		applyView(false);
	};
	const onPanUp = (ev) => {
		drag.current = null;
		ev.currentTarget.classList.remove('is-dragging');
	};

	/* ---------------- putar otomatis ---------------- */
	useEffect(() => {
		if (!playing) return undefined;
		E.loops = 0;
		const id = setInterval(
			() => {
				const api = E.api;
				if (!api || E.flipping || E.modal) return;
				if (E.e >= api.lastSpreadE()) {
					E.loops += 1;
					if (s.autoPlayLoopCount === 0 || E.loops < s.autoPlayLoopCount)
						api.goto(1);
					else setPlaying(false);
					return;
				}
				api.next();
			},
			(s.autoPlayDuration + s.flippingTime) * 1000,
		);
		return () => clearInterval(id);
	}, [playing, E, s.autoPlayDuration, s.autoPlayLoopCount, s.flippingTime]);

	useEffect(() => {
		document.title = book.title;
	}, [book.title]);

	const atStart = Math.min(info.left ?? 9e9, info.right ?? 9e9) === 1;
	const atEnd = Math.max(info.left ?? 0, info.right ?? 0) === total;
	const cssVars = {
		'--fb-bg': s.backgroundColor,
		'--fb-toolbar': s.toolbarColor,
		'--fb-icon': s.iconColor,
		'--fb-loading-bg': s.loadingBackground,
		'--fb-flip': `${s.flippingTime}s`,
	};

	return (
		<div className='fb' ref={rootRef} style={cssVars}>
			<div className='fb-stage' ref={stageRef}>
				<div className='fb-zoom' ref={zoomRef}>
					<div className={`fb-enter ${phase === 'ready' ? 'is-in' : ''}`}>
						<div
							className='fb-shift'
							style={{ transform: `translateX(${layout?.shift ?? 0}px)` }}>
							{layout && (
								<div
									className='fb-bookshadow'
									style={{
										left: layout.boxLeft,
										top: layout.boxTop,
										width: layout.boxW,
										height: layout.boxH,
									}}
								/>
							)}
							<div className='fb-host' ref={hostRef} />
							{layout?.spread && (
								<>
									<div
										className={`fb-spine fb-spine--l ${spineHidden ? 'is-hidden' : ''}`}
										style={{
											left: layout.boxLeft + layout.pw - layout.pw * 0.045,
											top: layout.boxTop,
											width: layout.pw * 0.045,
											height: layout.boxH,
										}}
									/>
									<div
										className={`fb-spine fb-spine--r ${spineHidden ? 'is-hidden' : ''}`}
										style={{
											left: layout.boxLeft + layout.pw,
											top: layout.boxTop,
											width: layout.pw * 0.07,
											height: layout.boxH,
										}}
									/>
								</>
							)}
						</div>
					</div>
				</div>

				<div
					className={`fb-pan ${zoom > 1.001 ? 'is-active' : ''}`}
					onPointerDown={onPanDown}
					onPointerMove={onPanMove}
					onPointerUp={onPanUp}
					onPointerCancel={onPanUp}
				/>

				<button
					type='button'
					className='fb-arrow fb-arrow--l'
					aria-label='Halaman sebelumnya'
					disabled={atStart || zoom > 1.001}
					onClick={() => act('prev')}>
					<ChevronLeft size={26} />
				</button>
				<button
					type='button'
					className='fb-arrow fb-arrow--r'
					aria-label='Halaman berikutnya'
					disabled={atEnd || zoom > 1.001}
					onClick={() => act('next')}>
					<ChevronRight size={26} />
				</button>
			</div>

			{s.allowThumbnails && (
				<ThumbStrip
					open={thumbs}
					pages={book.pages}
					ratio={ratio}
					info={info}
					onGoto={(n) => act('goto', n)}
				/>
			)}

			<Toolbar
				s={s}
				info={info}
				total={total}
				narrow={narrow}
				zoom={zoom}
				thumbs={thumbs}
				playing={playing}
				soundOn={soundOn}
				isFs={isFs}
				canFs={canFs}
				atStart={atStart}
				atEnd={atEnd}
				act={act}
			/>

			{toast && (
				<div className='fb-toast' role='status'>
					{toast}
				</div>
			)}
			{dialog === 'share' && (
				<ShareDialog
					book={book}
					page={E.curN}
					onClose={() => setDialog(null)}
				/>
			)}
			{dialog === 'print' && (
				<PrintDialog book={book} info={info} onClose={() => setDialog(null)} />
			)}
			{dialog === 'about' && (
				<AboutDialog book={book} onClose={() => setDialog(null)} />
			)}
			{dialog === 'help' && <HelpDialog onClose={() => setDialog(null)} />}

			<div
				className={`fb-loading ${phase === 'ready' ? 'is-done' : ''}`}
				aria-hidden={phase === 'ready'}>
				<div className='fb-loading__box'>
					<div className='fb-loading__ring' />
					<div className='fb-loading__title'>{book.title}</div>
					<div className='fb-loading__bar'>
						<i style={{ width: `${Math.max(6, pct)}%` }} />
					</div>
					<div className='fb-loading__pct'>Memuat… {pct}%</div>
				</div>
			</div>
		</div>
	);
}
