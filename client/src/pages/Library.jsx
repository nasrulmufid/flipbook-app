import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
	ArrowRight,
	BookOpen,
	Library as LibraryIcon,
	Search,
} from 'lucide-react';
import { api } from '../lib/api.js';

export default function Library() {
	const [books, setBooks] = useState(null);
	const [error, setError] = useState('');
	const [q, setQ] = useState('');

	useEffect(() => {
		document.title = 'DAFTAR MENU R&B GRILL PALEMBANG';
		api
			.get('/api/books')
			.then((d) => setBooks(d.books))
			.catch((e) => setError(e.message));
	}, []);

	const list = useMemo(() => {
		if (!books) return null;
		const s = q.trim().toLowerCase();
		if (!s) return books;
		return books.filter((b) =>
			`${b.title} ${b.author || ''} ${b.description || ''}`
				.toLowerCase()
				.includes(s),
		);
	}, [books, q]);

	return (
		<div className='lib'>
			<header className='lib-hero'>
				<span className='lib-hero__glow' aria-hidden='true' />
				<div className='lib-hero__inner'>
					<div className='lib-hero__brand'>
						<span className='lib-hero__logo'>
							<BookOpen size={20} />
						</span>
						<span>R&amp;B FlipBook</span>
					</div>
					<h1 className='lib-hero__title'>
						DAFTAR MENU R&amp;B GRILL PALEMBANG
					</h1>
					<p className='lib-hero__sub'>
						Pilih menu untuk dibaca dengan efek membalik page.
					</p>
					{books && books.length > 0 && (
						<div className='lib-hero__search'>
							<Search size={18} />
							<input
								value={q}
								onChange={(e) => setQ(e.target.value)}
								placeholder='Cari menu…'
								aria-label='Cari menu'
							/>
						</div>
					)}
				</div>
			</header>

			<main className='lib-main'>
				{error && (
					<div className='alert alert--danger'>
						<div className='alert__description'>{error}</div>
					</div>
				)}

				{!books && !error && (
					<div className='lib-grid'>
						{Array.from({ length: 8 }).map((_, i) => (
							<div key={i} className='lib-skel'>
								<div className='lib-skel__cover' />
								<div className='lib-skel__line' />
								<div className='lib-skel__line lib-skel__line--sm' />
							</div>
						))}
					</div>
				)}

				{books && books.length === 0 && (
					<div className='lib-empty'>
						<span className='lib-empty__icon'>
							<LibraryIcon size={30} />
						</span>
						<div className='lib-empty__title'>
							Belum ada buku yang diterbitkan
						</div>
						<div className='lib-empty__text'>
							Masuk ke dashboard untuk menambahkan buku pertama Anda.
						</div>
						<Link to='/admin' className='button button--primary'>
							Buka Dashboard
						</Link>
					</div>
				)}

				{list && list.length === 0 && books.length > 0 && (
					<div className='lib-empty'>
						<span className='lib-empty__icon'>
							<Search size={28} />
						</span>
						<div className='lib-empty__title'>Tidak ada hasil</div>
						<div className='lib-empty__text'>
							Tidak ada menu yang cocok dengan “{q}”.
						</div>
					</div>
				)}

				{list && list.length > 0 && (
					<div className='lib-grid'>
						{list.map((b) => (
							<Link key={b.id} to={`/book/${b.slug}`} className='lib-card'>
								<div
									className='lib-cover'
									style={{
										aspectRatio:
											b.page_width && b.page_height
												? b.page_width / b.page_height
												: 0.707,
									}}>
									{b.cover ? (
										<img
											src={b.cover.t}
											alt={`Sampul ${b.title}`}
											loading='lazy'
										/>
									) : (
										<span className='lib-cover__ph'>
											<BookOpen size={28} />
										</span>
									)}
									<span className='lib-cover__spine' aria-hidden='true' />
									<span className='lib-cover__cta'>
										Baca sekarang <ArrowRight size={15} />
									</span>
								</div>
								<div className='lib-meta'>
									<div className='lib-meta__title'>{b.title}</div>
									<div className='lib-meta__sub'>
										<span className='lib-chip'>{b.page_count} page</span>
										{b.author && (
											<span className='lib-meta__author'>{b.author}</span>
										)}
									</div>
								</div>
							</Link>
						))}
					</div>
				)}
			</main>
		</div>
	);
}
