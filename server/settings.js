// Pengaturan viewer per-buku (dipetakan dari bookConfig project referensi).
export const DEFAULT_SETTINGS = {
  flippingTime: 0.6,          // detik (flippingTime)
  flipSound: true,            // FlipSound
  mouseWheelFlip: true,       // mouseWheelFlip
  curlingPageCorner: true,    // CurlingPageCorner
  showCover: true,            // sampul tampil sendiri (single) seperti FlipHTML5
  retainBookCenter: true,     // retainBookCenter
  shadowIntensity: 0.6,       // 0..1
  backgroundColor: '#7C7C7C', // bgBeginColor
  loadingBackground: '#1F2232',
  toolbarColor: '#111111',
  iconColor: '#EEEEEE',
  autoPlayDuration: 3,        // detik antar halaman
  autoPlayLoopCount: 1,       // 0 = tanpa batas
  autoPlayAutoStart: false,
  showInstructionsOnStart: true,
  allowThumbnails: true,
  allowZoom: true,
  allowFullscreen: true,
  allowShare: true,
  allowPrint: true,
  allowAutoPlay: true,
  allowAbout: true,
  allowInstructions: true,
};

const RANGES = {
  flippingTime: [0.2, 2],
  shadowIntensity: [0, 1],
  autoPlayDuration: [1, 30],
  autoPlayLoopCount: [0, 20],
};

const HEX = /^#[0-9a-fA-F]{6}$/;

export function sanitizeSettings(input = {}, base = DEFAULT_SETTINGS) {
  const out = { ...base };
  for (const [key, def] of Object.entries(DEFAULT_SETTINGS)) {
    if (!(key in input)) continue;
    const v = input[key];
    if (typeof def === 'boolean') out[key] = v === true || v === 'true' || v === 1;
    else if (typeof def === 'number') {
      let n = Number(v);
      if (!Number.isFinite(n)) continue;
      const r = RANGES[key];
      if (r) n = Math.min(r[1], Math.max(r[0], n));
      out[key] = n;
    } else if (typeof def === 'string') {
      if (typeof v === 'string' && HEX.test(v)) out[key] = v;
    }
  }
  return out;
}

export function parseSettings(json) {
  try {
    return sanitizeSettings(JSON.parse(json || '{}'));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}
