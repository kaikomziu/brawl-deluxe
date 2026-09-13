// ===== WebAudio 効果音合成 =====
const SFX = (() => {
  let ctx = null;
  let master = null;
  let muted = false;
  let volume = 0.6;

  function ensure() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : volume;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function setVolume(v) { volume = clamp(v, 0, 1); if (master) master.gain.value = muted ? 0 : volume; }
  function setMuted(m) { muted = m; if (master) master.gain.value = muted ? 0 : volume; }

  function env(gainNode, t0, attack, decay, peak) {
    gainNode.gain.cancelScheduledValues(t0);
    gainNode.gain.setValueAtTime(0.0001, t0);
    gainNode.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
  }

  function tone(freq, dur, type, opts = {}) {
    const c = ensure();
    const t0 = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type || "sine";
    osc.frequency.setValueAtTime(freq, t0);
    if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.slideTo), t0 + dur);
    env(gain, t0, opts.attack ?? 0.005, dur, opts.peak ?? 0.3);
    osc.connect(gain).connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function noiseBurst(dur, opts = {}) {
    const c = ensure();
    const bufSize = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, bufSize, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
    const src = c.createBufferSource();
    src.buffer = buf;
    const filt = c.createBiquadFilter();
    filt.type = opts.filterType || "lowpass";
    filt.frequency.value = opts.freq || 2000;
    const gain = c.createGain();
    gain.gain.value = opts.peak ?? 0.3;
    src.connect(filt).connect(gain).connect(master);
    src.start();
  }

  return {
    setVolume, setMuted, ensure,
    shoot(kind) {
      const f = { rifle: 520, sniper: 260, shotgun: 180, dart: 700, homing: 400 }[kind] || 500;
      tone(f, 0.09, "square", { slideTo: f * 0.5, peak: 0.18, attack: 0.002 });
    },
    hit() { noiseBurst(0.08, { peak: 0.22, freq: 3000 }); tone(180, 0.06, "sine", { peak: 0.15 }); },
    explosion() {
      noiseBurst(0.35, { peak: 0.35, freq: 900, filterType: "lowpass" });
      tone(90, 0.35, "sawtooth", { slideTo: 30, peak: 0.3 });
    },
    superReady() { tone(700, 0.12, "sine", { slideTo: 1100, peak: 0.25 }); tone(900, 0.12, "sine", { slideTo: 1300, peak: 0.15 }); },
    superFire() { tone(220, 0.3, "sawtooth", { slideTo: 900, peak: 0.3 }); noiseBurst(0.25, { peak: 0.25 }); },
    pickup() { tone(880, 0.08, "sine", { slideTo: 1200, peak: 0.2 }); },
    goal() { tone(523, 0.12, "square", { peak: 0.25 }); setTimeout(() => tone(784, 0.18, "square", { peak: 0.25 }), 110); },
    death() { tone(300, 0.25, "sawtooth", { slideTo: 60, peak: 0.25 }); },
    win() {
      [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.25, "square", { peak: 0.22 }), i * 110));
    },
    lose() { [400, 340, 260, 180].forEach((f, i) => setTimeout(() => tone(f, 0.3, "sawtooth", { peak: 0.2 }), i * 130)); },
    click() { tone(600, 0.05, "square", { peak: 0.15 }); },
    countdown(final) { tone(final ? 1200 : 700, 0.15, "sine", { peak: 0.25 }); },
    heal() { tone(500, 0.15, "sine", { slideTo: 800, peak: 0.18 }); },
    freeze() { tone(1500, 0.2, "sine", { slideTo: 400, peak: 0.15 }); },
  };
})();
