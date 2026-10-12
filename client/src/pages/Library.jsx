import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';

export default function Library() {
	const [books, setBooks] = useState(null);
	const [error, setError] = useState('');

	useEffect(() => {
		document.title = 'DAFTAR MENU R&B GRILL PALEMBANG';
		api
			.get('/api/books')
			.then((d) => setBooks(d.books))
			.catch((e) => setError(e.message));
	}, []);

	return (
		<div
			className='min-h-full'
			style={{ background: 'var(--color-background)' }}>
			<main className='mx-auto max-w-6xl px-4 py-10'>
				<div className='mb-8'>
					<h1 className='text-2xl font-semibold'>
						DAFTAR MENU R&B GRILL PALEMBANG
					</h1>
					<p style={{ color: 'var(--color-muted-foreground)' }}>
						Pilih menu untuk dilihat.
					</p>
				</div>

				{error && (
					<div className='alert alert--danger'>
						<div className='alert__description'>{error}</div>
					</div>
				)}

				{!books && !error && (
					<div className='grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4'>
						{Array.from({ length: 4 }).map((_, i) => (
							<div
								key={i}
								className='aspect-[0.707] animate-pulse rounded-md'
								style={{ background: 'var(--color-neutral)' }}
							/>
						))}
					</div>
				)}

				{books && books.length === 0 && (
					<div className='empty-state'>
						<div className='empty-state__title'>
							Belum ada buku yang diterbitkan
						</div>
						<div className='empty-state__text'>
							Masuk ke dashboard untuk menambahkan buku pertama Anda.
						</div>
						<div className='empty-state__action'>
							<Link to='/admin' className='button button--primary'>
								Buka Dashboard
							</Link>
						</div>
					</div>
				)}

				{books && books.length > 0 && (
					<div
						className='grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 md:grid-cols-4'
						style={{ perspective: 1200 }}>
						{books.map((b) => (
							<Link
								key={b.id}
								to={`/book/${b.slug}`}
								className='lib-card group block'>
								<div
									className='lib-cover overflow-hidden rounded-sm bg-white'
									style={{
										aspectRatio:
											b.page_width && b.page_height
												? b.page_width / b.page_height
												: 0.707,
									}}>
									{b.cover && (
										<img
											src={b.cover.t}
											alt={`Sampul ${b.title}`}
											className='h-full w-full object-fill'
											loading='lazy'
										/>
									)}
								</div>
								<div className='mt-3'>
									<div className='font-medium leading-snug group-hover:underline'>
										{b.title}
									</div>
									<div
										className='text-sm'
										style={{ color: 'var(--color-muted-foreground)' }}>
										{b.page_count} halaman{b.author ? ` · ${b.author}` : ''}
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
