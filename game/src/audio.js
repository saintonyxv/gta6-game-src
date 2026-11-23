// Sound, synthesised with WebAudio only — no audio files, no network.
// Engine hum pitched by speed, a two-tone siren, crash thuds, pickup chimes
// and a small bass-line loop. Created lazily on the first user gesture.
export function createSound() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = null;
  let musicTimer = null;
  let muted = false;
  let musicStep = 0;

  // A minor-key bass line (A minor) the loop walks through.
  const BASS = [55, 0, 55, 65.41, 55, 0, 49, 55, 55, 0, 55, 65.41, 82.41, 73.42, 65.41, 55];

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      // Engine: a sawtooth through a low-pass filter, gain follows speed.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 50;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      // Siren: a sine that alternates between two pitches.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 660;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, when = 0) {
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noiseBurst(dur, vol) {
    if (!ctx) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(g);
    g.connect(master);
    src.start();
  }

  return {
    unlock() { ensure(); },
    setMuted(m) {
      muted = m;
      if (master) master.gain.value = m ? 0 : 0.5;
    },
    isMuted() { return muted; },
    // speed 0..1 while driving; 0 silences the engine.
    engine(speed, driving) {
      if (!ctx) return;
      const target = driving ? 0.05 + speed * 0.09 : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(48 + speed * 130, ctx.currentTime, 0.1);
    },
    siren(on) {
      if (!ctx) return;
      if (on && sirenTimer === null) {
        let high = false;
        sirenGain.gain.setTargetAtTime(0.05, ctx.currentTime, 0.1);
        sirenTimer = window.setInterval(() => {
          high = !high;
          sirenOsc.frequency.value = high ? 880 : 660;
        }, 380);
      } else if (!on && sirenTimer !== null) {
        window.clearInterval(sirenTimer);
        sirenTimer = null;
        sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
      }
    },
    crash() { if (ensure()) noiseBurst(0.25, 0.5); },
    chime() {
      if (!ensure()) return;
      tone(660, 0.18, 'sine', 0.25);
      tone(990, 0.3, 'sine', 0.25, 0.12);
    },
    pickup() {
      if (!ensure()) return;
      tone(523, 0.12, 'triangle', 0.3);
      tone(784, 0.2, 'triangle', 0.3, 0.09);
    },
    busted() {
      if (!ensure()) return;
      tone(220, 0.5, 'square', 0.2);
      tone(165, 0.8, 'square', 0.2, 0.25);
    },
    startMusic() {
      if (!ensure() || musicTimer !== null) return;
      musicTimer = window.setInterval(() => {
        if (muted) return;
        const f = BASS[musicStep % BASS.length];
        musicStep += 1;
        if (f > 0) tone(f, 0.22, 'triangle', 0.16);
      }, 190);
    },
    stopMusic() {
      if (musicTimer !== null) {
        window.clearInterval(musicTimer);
        musicTimer = null;
      }
    },
  };
}
