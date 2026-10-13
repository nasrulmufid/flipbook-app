import { useEffect, useRef } from 'react';

export default function ThumbStrip({ open, pages, ratio, info, onGoto }) {
	const scroller = useRef(null);
	const cur = info.left ?? info.right;

	useEffect(() => {
		if (!open || !scroller.current) return;
		const el = scroller.current.querySelector('[data-current="true"]');
		if (!el) return;
		const box = scroller.current;
		const target = el.offsetLeft - box.clientWidth / 2 + el.clientWidth / 2;
		box.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
	}, [open, cur]);

	return (
		<div className={`fb-thumbs ${open ? 'is-open' : ''}`} aria-hidden={!open}>
			<div className='fb-thumbs__scroll' ref={scroller}>
				{pages.map((p, i) => {
					const n = i + 1;
					const isCur = n === info.left || n === info.right;
					return (
						<button
							key={p.id}
							type='button'
							tabIndex={open ? 0 : -1}
							className={`fb-thumb ${isCur ? 'is-current' : ''}`}
							data-current={n === cur}
							style={{ aspectRatio: ratio }}
							aria-label={`Ke page ${n}`}
							onClick={() => onGoto(n)}>
							<img src={p.t} alt='' loading='lazy' draggable='false' />
							<span className='fb-thumb__n'>{n}</span>
						</button>
					);
				})}
			</div>
		</div>
	);
}
