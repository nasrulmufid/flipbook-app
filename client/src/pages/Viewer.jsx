import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import FlipViewer from '../components/viewer/FlipViewer.jsx';

export default function Viewer({ embed = false }) {
  const { slug } = useParams();
  const [state, setState] = useState({ loading: true, book: null, error: null });

  useEffect(() => {
    let alive = true;
    setState({ loading: true, book: null, error: null });
    api
      .get(`/api/books/${slug}`)
      .then(({ book }) => {
        if (!alive) return;
        if (!book.pages.length) setState({ loading: false, book: null, error: 'Buku ini belum memiliki halaman.' });
        else {
          setState({ loading: false, book, error: null });
          api.post(`/api/books/${slug}/view`).catch(() => {});
        }
      })
      .catch((e) => alive && setState({ loading: false, book: null, error: e.message }));
    return () => { alive = false; };
  }, [slug]);

  if (state.loading) {
    return <div className="fixed inset-0 grid place-items-center" style={{ background: '#1F2232' }}><div className="fb-loading__ring" style={{ width: 46, height: 46, borderRadius: '50%', border: '3px solid rgba(255,255,255,.18)', borderTopColor: '#fff', animation: 'fbSpin .8s linear infinite' }} /></div>;
  }
  if (state.error) {
    return (
      <div className="fixed inset-0 grid place-items-center p-6 text-center" style={{ background: '#1F2232', color: '#ddd' }}>
        <div>
          <p className="mb-4 text-lg">{state.error}</p>
          {!embed && <Link to="/" className="underline">Kembali ke perpustakaan</Link>}
        </div>
      </div>
    );
  }
  return <FlipViewer key={state.book.id} book={state.book} embed={embed} />;
}
