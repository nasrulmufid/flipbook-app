import { useEffect, useMemo, useState } from 'react';
import {
	X,
	Copy,
	Check,
	MousePointerClick,
	Hand,
	ZoomIn,
	Keyboard,
	Printer,
	Link2,
	Mail,
} from 'lucide-react';

function Modal({ title, onClose, children }) {
	useEffect(() => {
		const h = (e) => {
			if (e.key === 'Escape') {
				e.stopPropagation();
				onClose();
			}
		};
		window.addEventListener('keydown', h, true);
		return () => window.removeEventListener('keydown', h, true);
	}, [onClose]);
	return (
		<div
			className='fb-modal'
			onPointerDown={(e) => e.target === e.currentTarget && onClose()}
			role='dialog'
			aria-modal='true'
			aria-label={title}>
			<div className='fb-modal__panel'>
				<div className='fb-modal__head'>
					<h3>{title}</h3>
					<button
						type='button'
						className='fb-btn'
						aria-label='Tutup'
						onClick={onClose}>
						<X />
					</button>
				</div>
				<div className='fb-modal__body'>{children}</div>
			</div>
		</div>
	);
}

function CopyField({ label, value, multiline }) {
	const [ok, setOk] = useState(false);
	const copy = async () => {
		try {
			await navigator.clipboard.writeText(value);
		} catch {
			const t = document.createElement('textarea');
			t.value = value;
			document.body.appendChild(t);
			t.select();
			document.execCommand('copy');
			t.remove();
		}
		setOk(true);
		setTimeout(() => setOk(false), 1600);
	};
	return (
		<div className='fb-field'>
			<label>{label}</label>
			<div className='fb-input-row'>
				{multiline ? (
					<textarea
						className='fb-input'
						readOnly
						value={value}
						onFocus={(e) => e.target.select()}
					/>
				) : (
					<input
						className='fb-input'
						readOnly
						value={value}
						onFocus={(e) => e.target.select()}
					/>
				)}
				<button type='button' className='fb-cta' onClick={copy}>
					{ok ? <Check size={16} /> : <Copy size={16} />}
					{ok ? 'Tersalin' : 'Salin'}
				</button>
			</div>
		</div>
	);
}

export function ShareDialog({ book, page, onClose }) {
	const base = window.location.origin;
	const url = `${base}/book/${book.slug}${page > 1 ? `#p=${page}` : ''}`;
	const embed = `<iframe src="${base}/embed/${book.slug}" width="100%" height="600" style="border:0" allowfullscreen></iframe>`;
	const enc = encodeURIComponent;
	const links = [
		['Facebook', `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`],
		[
			'X / Twitter',
			`https://twitter.com/intent/tweet?url=${enc(url)}&text=${enc(book.title)}`,
		],
		['WhatsApp', `https://wa.me/?text=${enc(`${book.title} ${url}`)}`],
		[
			'Telegram',
			`https://t.me/share/url?url=${enc(url)}&text=${enc(book.title)}`,
		],
		['Email', `mailto:?subject=${enc(book.title)}&body=${enc(url)}`],
	];
	return (
		<Modal title='Bagikan buku' onClose={onClose}>
			<CopyField label='Tautan' value={url} />
			<div className='fb-socials'>
				{links.map(([n, h]) => (
					<a
						key={n}
						className='fb-cta fb-cta--ghost'
						href={h}
						target='_blank'
						rel='noreferrer noopener'>
						{n === 'Email' ? <Mail size={16} /> : <Link2 size={16} />}
						{n}
					</a>
				))}
				{navigator.share && (
					<button
						type='button'
						className='fb-cta'
						onClick={() =>
							navigator.share({ title: book.title, url }).catch(() => {})
						}>
						Bagikan…
					</button>
				)}
			</div>
			<CopyField label='Kode sematan (embed)' value={embed} multiline />
		</Modal>
	);
}

export function PrintDialog({ book, info, onClose }) {
	const total = book.pages.length;
	const [mode, setMode] = useState('current');
	const [from, setFrom] = useState(1);
	const [to, setTo] = useState(total);

	const range = useMemo(() => {
		if (mode === 'all') return [1, total];
		if (mode === 'range')
			return [
				Math.max(1, Math.min(from, to)),
				Math.min(total, Math.max(from, to)),
			];
		const a = info.left ?? info.right ?? 1;
		return [a, info.right ?? a];
	}, [mode, from, to, info, total]);

	const doPrint = () => {
		const urls = book.pages
			.slice(range[0] - 1, range[1])
			.map((p) => new URL(p.l, window.location.origin).href);
		const iframe = document.createElement('iframe');
		iframe.setAttribute('aria-hidden', 'true');
		iframe.style.cssText =
			'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
		document.body.appendChild(iframe);
		const doc = iframe.contentWindow.document;
		doc.open();
		doc.write(
			`<!doctype html><html><head><meta charset="utf-8"><title>${book.title.replace(/</g, '&lt;')}</title><style>@page{margin:0}html,body{margin:0;background:#fff}img{display:block;width:100%;height:100vh;object-fit:contain;break-after:page;page-break-after:always}img:last-child{break-after:auto;page-break-after:auto}</style></head><body>${urls.map((u) => `<img src="${u}">`).join('')}</body></html>`,
		);
		doc.close();
		const imgs = [...doc.images];
		Promise.all(
			imgs.map((im) =>
				im.complete
					? 1
					: new Promise((r) => {
							im.onload = im.onerror = r;
						}),
			),
		).then(() => {
			iframe.contentWindow.focus();
			iframe.contentWindow.print();
			setTimeout(() => iframe.remove(), 60000);
		});
		onClose();
	};

	const opt = (v, text) => (
		<label className='fb-radio'>
			<input
				type='radio'
				name='pm'
				checked={mode === v}
				onChange={() => setMode(v)}
			/>
			{text}
		</label>
	);
	return (
		<Modal title='Cetak' onClose={onClose}>
			{opt(
				'current',
				`Page saat ini (${info.left && info.right ? `${info.left}-${info.right}` : (info.left ?? info.right)})`,
			)}
			{opt('all', `Semua page (${total})`)}
			{opt('range', 'Rentang page')}
			{mode === 'range' && (
				<div className='fb-input-row'>
					<input
						className='fb-input'
						type='number'
						min='1'
						max={total}
						value={from}
						onChange={(e) => setFrom(+e.target.value || 1)}
						aria-label='Dari page'
					/>
					<input
						className='fb-input'
						type='number'
						min='1'
						max={total}
						value={to}
						onChange={(e) => setTo(+e.target.value || 1)}
						aria-label='Sampai page'
					/>
				</div>
			)}
			<button
				type='button'
				className='fb-cta'
				style={{ justifySelf: 'start' }}
				onClick={doPrint}>
				<Printer size={16} /> Cetak {range[1] - range[0] + 1} page
			</button>
		</Modal>
	);
}

export function AboutDialog({ book, onClose }) {
	return (
		<Modal title='Tentang buku' onClose={onClose}>
			<div>
				<div style={{ fontSize: 18, fontWeight: 600 }}>{book.title}</div>
				{book.author && <div style={{ color: '#aaa' }}>Oleh {book.author}</div>}
			</div>
			{book.description && (
				<p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{book.description}</p>
			)}
			<div style={{ color: '#aaa', fontSize: 13 }}>
				{book.pages.length} page
			</div>
		</Modal>
	);
}

export function HelpDialog({ onClose }) {
	return (
		<Modal title='Cara membaca' onClose={onClose}>
			<div className='fb-help'>
				<div>
					<Hand className='fb-help__demo' />
					Seret atau klik sudut page untuk membalik
				</div>
				<div>
					<MousePointerClick />
					Klik dua kali untuk memperbesar, seret untuk menggeser
				</div>
				<div>
					<Keyboard />
					Panah kiri/kanan, Home/End, +/− dan F untuk layar penuh
				</div>
				<div>
					<ZoomIn />
					Putar roda mouse untuk membalik; Ctrl + roda untuk zoom
				</div>
			</div>
			<button
				type='button'
				className='fb-cta'
				style={{ justifySelf: 'end' }}
				onClick={onClose}>
				Mengerti
			</button>
		</Modal>
	);
}
