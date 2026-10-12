import { useEffect, useRef, useState } from 'react';
import {
  LayoutGrid, ZoomIn, ZoomOut, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight, Play, Pause,
  Volume2, VolumeX, Share2, Printer, Maximize, Minimize, CircleHelp, Info, Ellipsis,
} from 'lucide-react';

const Btn = ({ icon: Icon, tip, onClick, disabled, pressed, label }) => (
  <button type="button" className="fb-btn" data-tip={tip} aria-label={label || tip} aria-pressed={pressed} disabled={disabled} onClick={onClick}>
    <Icon />
  </button>
);

function PageNumber({ info, total, onGoto }) {
  const label = info.left && info.right ? `${info.left}-${info.right}` : String(info.left ?? info.right ?? 1);
  const [draft, setDraft] = useState(null);
  const commit = () => {
    const n = parseInt(draft, 10);
    setDraft(null);
    if (Number.isFinite(n)) onGoto(Math.min(total, Math.max(1, n)));
  };
  return (
    <div className="fb-pagenum" aria-live="polite">
      <input
        inputMode="numeric"
        aria-label="Nomor halaman"
        value={draft ?? label}
        onFocus={(e) => { setDraft(''); e.target.select(); }}
        onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ''))}
        onBlur={() => setDraft(null)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { commit(); e.currentTarget.blur(); }
          if (e.key === 'Escape') e.currentTarget.blur();
          e.stopPropagation();
        }}
      />
      <span>/ {total}</span>
    </div>
  );
}

export default function Toolbar({ s, info, total, narrow, zoom, thumbs, playing, soundOn, isFs, canFs, atStart, atEnd, act }) {
  const [more, setMore] = useState(false);
  const wrap = useRef(null);

  useEffect(() => {
    if (!more) return undefined;
    const h = (e) => { if (!wrap.current?.contains(e.target)) setMore(false); };
    document.addEventListener('pointerdown', h);
    return () => document.removeEventListener('pointerdown', h);
  }, [more]);

  const items = [
    s.allowAutoPlay && <Btn key="play" icon={playing ? Pause : Play} tip={playing ? 'Hentikan putar otomatis' : 'Putar otomatis'} pressed={playing} onClick={() => act('autoplay')} />,
    <Btn key="snd" icon={soundOn ? Volume2 : VolumeX} tip={soundOn ? 'Matikan suara' : 'Nyalakan suara'} onClick={() => act('sound')} />,
    s.allowShare && <Btn key="share" icon={Share2} tip="Bagikan" onClick={() => act('share')} />,
    s.allowPrint && <Btn key="print" icon={Printer} tip="Cetak" onClick={() => act('print')} />,
    s.allowFullscreen && canFs && <Btn key="fs" icon={isFs ? Minimize : Maximize} tip={isFs ? 'Keluar layar penuh' : 'Layar penuh'} onClick={() => act('fullscreen')} />,
    s.allowInstructions && <Btn key="help" icon={CircleHelp} tip="Petunjuk" onClick={() => act('help')} />,
    s.allowAbout && <Btn key="about" icon={Info} tip="Tentang buku" onClick={() => act('about')} />,
  ].filter(Boolean);

  return (
    <div className="fb-toolbar" ref={wrap} role="toolbar" aria-label="Kontrol buku">
      <div className="fb-group fb-group--side">
        {s.allowThumbnails && <Btn icon={LayoutGrid} tip="Daftar halaman" pressed={thumbs} onClick={() => act('thumbs')} />}
        {s.allowZoom && !narrow && (
          <>
            <Btn icon={ZoomOut} tip="Perkecil" disabled={zoom <= 1.001} onClick={() => act('zoomOut')} />
            <Btn icon={ZoomIn} tip="Perbesar" disabled={zoom >= 3.99} onClick={() => act('zoomIn')} />
          </>
        )}
      </div>

      <div className="fb-group fb-group--center">
        {!narrow && <Btn icon={ChevronsLeft} tip="Halaman pertama" disabled={atStart} onClick={() => act('first')} />}
        <Btn icon={ChevronLeft} tip="Sebelumnya" disabled={atStart} onClick={() => act('prev')} />
        <PageNumber info={info} total={total} onGoto={(n) => act('goto', n)} />
        <Btn icon={ChevronRight} tip="Berikutnya" disabled={atEnd} onClick={() => act('next')} />
        {!narrow && <Btn icon={ChevronsRight} tip="Halaman terakhir" disabled={atEnd} onClick={() => act('last')} />}
      </div>

      <div className="fb-group fb-group--side fb-group--end">
        {narrow ? (
          <>
            <Btn icon={Ellipsis} tip="Lainnya" pressed={more} onClick={() => setMore((v) => !v)} />
            {more && (
              <div className="fb-more" onClick={() => setMore(false)}>
                {s.allowZoom && <Btn icon={zoom > 1.001 ? ZoomOut : ZoomIn} tip={zoom > 1.001 ? 'Perkecil' : 'Perbesar'} onClick={() => act(zoom > 1.001 ? 'zoomOut' : 'zoomIn')} />}
                {items}
              </div>
            )}
          </>
        ) : (
          items
        )}
      </div>
    </div>
  );
}
