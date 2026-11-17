// Solar Bay — audio.js
// All sound is synthesized with WebAudio: no audio files, no network.
// Engine hum, police siren, gunshots, pickup blips and a lazy bass loop
// for the title screen. The context is created on the first user gesture,
// so the game never blocks on audio before the player presses a key.

export function createAudio() {
  const audio = {
    ctx: null,
    muted: false,
    musicOn: false,
    engineOsc: null,
    engineGain: null,
    sirenOsc: null,
    sirenGain: null,
    sirenTimer: 0,
    musicTimer: null,
    musicStep: 0,
  };

  audio.ensure = function ensure() {
    if (audio.ctx) {
      if (audio.ctx.state === 'suspended') audio.ctx.resume();
      return;
    }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      audio.ctx = new Ctx();
    } catch {
      audio.ctx = null;
    }
  };

  audio.setMuted = function setMuted(muted) {
    audio.muted = muted;
    if (audio.ctx) audio.ctx.suspend();
    if (!muted && audio.ctx) audio.ctx.resume();
  };

  function blip(freq, duration, type, volume, slideTo) {
    if (!audio.ctx || audio.muted) return;
    const now = audio.ctx.currentTime;
    const osc = audio.ctx.createOscillator();
    const gain = audio.ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
    gain.gain.setValueAtTime(volume || 0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(audio.ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  function noiseBurst(duration, volume, lowpass) {
    if (!audio.ctx || audio.muted) return;
    const now = audio.ctx.currentTime;
    const length = Math.floor(audio.ctx.sampleRate * duration);
    const buffer = audio.ctx.createBuffer(1, length, audio.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = audio.ctx.createBufferSource();
    source.buffer = buffer;
    const filter = audio.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass || 1200;
    const gain = audio.ctx.createGain();
    gain.gain.setValueAtTime(volume || 0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(audio.ctx.destination);
    source.start(now);
  }

  audio.shoot = function shoot() {
    noiseBurst(0.14, 0.28, 2400);
    blip(220, 0.08, 'square', 0.1, 60);
  };

  audio.pickup = function pickup() {
    blip(660, 0.09, 'sine', 0.14);
    setTimeout(() => blip(990, 0.12, 'sine', 0.14), 70);
  };

  audio.crash = function crash() {
    noiseBurst(0.25, 0.3, 700);
  };

  audio.missionDone = function missionDone() {
    blip(523, 0.12, 'triangle', 0.16);
    setTimeout(() => blip(659, 0.12, 'triangle', 0.16), 110);
    setTimeout(() => blip(784, 0.22, 'triangle', 0.18), 220);
  };

  audio.wantedUp = function wantedUp() {
    blip(440, 0.1, 'square', 0.1, 880);
  };

  audio.setEngine = function setEngine(speedRatio, driving) {
    if (!audio.ctx || audio.muted) return;
    if (!driving) {
      if (audio.engineOsc) {
        audio.engineGain.gain.setTargetAtTime(0, audio.ctx.currentTime, 0.1);
      }
      return;
    }
    if (!audio.engineOsc) {
      audio.engineOsc = audio.ctx.createOscillator();
      audio.engineOsc.type = 'sawtooth';
      audio.engineGain = audio.ctx.createGain();
      audio.engineGain.gain.value = 0;
      const filter = audio.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 900;
      audio.engineOsc.connect(filter);
      filter.connect(audio.engineGain);
      audio.engineGain.connect(audio.ctx.destination);
      audio.engineOsc.start();
    }
    const freq = 55 + speedRatio * 130;
    audio.engineOsc.frequency.setTargetAtTime(freq, audio.ctx.currentTime, 0.08);
    audio.engineGain.gain.setTargetAtTime(0.045 + speedRatio * 0.03, audio.ctx.currentTime, 0.1);
  };

  audio.setSiren = function setSiren(on, dt) {
    if (!audio.ctx || audio.muted) return;
    if (!on) {
      if (audio.sirenOsc) audio.sirenGain.gain.setTargetAtTime(0, audio.ctx.currentTime, 0.1);
      return;
    }
    if (!audio.sirenOsc) {
      audio.sirenOsc = audio.ctx.createOscillator();
      audio.sirenOsc.type = 'triangle';
      audio.sirenGain = audio.ctx.createGain();
      audio.sirenGain.gain.value = 0;
      audio.sirenOsc.connect(audio.sirenGain);
      audio.sirenGain.connect(audio.ctx.destination);
      audio.sirenOsc.start();
    }
    audio.sirenTimer += dt;
    const high = Math.floor(audio.sirenTimer / 0.45) % 2 === 0;
    audio.sirenOsc.frequency.setTargetAtTime(high ? 880 : 660, audio.ctx.currentTime, 0.05);
    audio.sirenGain.gain.setTargetAtTime(0.035, audio.ctx.currentTime, 0.1);
  };

  // A slow four-chord bass loop for the title screen.
  const BASS_LINE = [55, 55, 65.41, 49, 55, 55, 73.42, 65.41];
  audio.startMusic = function startMusic() {
    if (!audio.ctx || audio.muted || audio.musicTimer) return;
    audio.musicTimer = setInterval(() => {
      if (audio.muted || !audio.ctx) return;
      const freq = BASS_LINE[audio.musicStep % BASS_LINE.length];
      audio.musicStep += 1;
      blip(freq, 0.55, 'triangle', 0.09);
      blip(freq * 2, 0.2, 'sine', 0.03);
    }, 620);
  };

  audio.stopMusic = function stopMusic() {
    if (audio.musicTimer) {
      clearInterval(audio.musicTimer);
      audio.musicTimer = null;
    }
  };

  return audio;
}
