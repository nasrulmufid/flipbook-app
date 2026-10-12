// Suara membalik halaman disintesis dengan WebAudio (tanpa file audio).
export function createFlipSound() {
  let ctx = null;
  return {
    play() {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ctx = ctx || new AC();
        if (ctx.state === 'suspended') ctx.resume();
        const dur = 0.32;
        const sr = ctx.sampleRate;
        const buf = ctx.createBuffer(1, Math.floor(sr * dur), sr);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) {
          const t = i / d.length;
          const attack = t < 0.05 ? t / 0.05 : 1;
          const env = Math.pow(1 - t, 2.4) * attack * (0.65 + 0.35 * Math.sin(t * 38));
          d[i] = (Math.random() * 2 - 1) * env;
        }
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.Q.value = 0.8;
        bp.frequency.setValueAtTime(3600, ctx.currentTime);
        bp.frequency.exponentialRampToValueAtTime(1100, ctx.currentTime + dur);
        const g = ctx.createGain();
        g.gain.value = 0.38;
        src.connect(bp).connect(g).connect(ctx.destination);
        src.start();
      } catch {
        /* audio tidak tersedia */
      }
    },
  };
}
