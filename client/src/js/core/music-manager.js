import audioManager from './audio-manager.js';

// TASK-424: Quest detection for performance - disable adaptive music on Quest
const _isQuest = typeof window !== 'undefined' &&
  (window.__isQuestDevice || /Quest|Android|Mobile/i.test(navigator.userAgent));

const MUSIC_PROFILES = {
  cyber: {
    bassFreq: 40, bassType: 'sine',
    padFreq: 220, padFilter: 400,
    tempo: 0.5,
    arpNotes: [330, 440, 550, 660],
    leadNotes: [660, 880, 1100, 1320],
  },
  sunset: {
    bassFreq: 55, bassType: 'triangle',
    padFreq: 165, padFilter: 300,
    tempo: 0.4,
    arpNotes: [262, 330, 392, 440],
    leadNotes: [523, 659, 784, 880],
  },
  space: {
    bassFreq: 30, bassType: 'sine',
    padFreq: 110, padFilter: 250,
    tempo: 0.3,
    arpNotes: [880, 1047, 1175, 1319],
    leadNotes: [1319, 1568, 1760, 2093],
  },
  neon: {
    bassFreq: 80, bassType: 'square',
    padFreq: 330, padFilter: 600,
    tempo: 0.7,
    arpNotes: [523, 659, 784, 880],
    leadNotes: [880, 1047, 1175, 1319],
  },
  day: {
    bassFreq: 50, bassType: 'triangle',
    padFreq: 196, padFilter: 350,
    tempo: 0.45,
    arpNotes: [294, 370, 440, 523],
    leadNotes: [523, 659, 784, 880],
  },
  underwater: {
    bassFreq: 35, bassType: 'sine',
    padFreq: 130, padFilter: 180,
    tempo: 0.25,
    arpNotes: [440, 523, 659, 784],
    leadNotes: [784, 880, 1047, 1175],
  },
};

// Intensity levels: 1=idle, 2=combo5+, 3=combo10+, 4=combo15+/boss
const INTENSITY = {
  1: { tempoMul: 1.0, arpVol: 0.08, padVol: 0.1, percVol: 0, leadVol: 0 },
  2: { tempoMul: 1.2, arpVol: 0.12, padVol: 0.15, percVol: 0, leadVol: 0 },
  3: { tempoMul: 1.4, arpVol: 0.15, padVol: 0.18, percVol: 0.06, leadVol: 0 },
  4: { tempoMul: 1.6, arpVol: 0.18, padVol: 0.22, percVol: 0.08, leadVol: 0.06 },
};

class MusicManager {
  constructor() {
    this._nodes = [];
    this._intervals = [];
    this._playing = false;
    this._enabled = true;
    this._intensity = 1;
    this._percGain = null;
    this._leadGain = null;
    this._arpGain = null;
    this._padGain = null;
    this._profile = null;
    this._beatCallbacks = [];
    this._beatCount = 0;
  }

  /** Get current effective BPM based on theme tempo and intensity */
  getBPM() {
    if (!this._profile) return 120;
    const baseBPM = this._profile.tempo * 120;
    return Math.round(baseBPM * (INTENSITY[this._intensity]?.tempoMul || 1));
  }

  /** Register a callback that fires on each beat: cb(bpm, beatCount) */
  onBeat(callback) {
    this._beatCallbacks.push(callback);
  }

  _fireBeat() {
    this._beatCount++;
    const bpm = this.getBPM();
    this._beatCallbacks.forEach(cb => {
      try { cb(bpm, this._beatCount); } catch (_e) {}
    });
  }

  loadSettings() {
    try {
      const raw = localStorage.getItem('vr_quest_player_v2');
      if (raw) {
        const profile = JSON.parse(raw);
        const s = profile.settings || {};
        this._enabled = s.music !== false;
      }
    } catch (e) { /* ignore */ }
  }

  /** Set music intensity based on combo count */
  setIntensity(combo) {
    if (!this._playing) return;
    let level = 1;
    if (combo >= 15) level = 4;
    else if (combo >= 10) level = 3;
    else if (combo >= 5) level = 2;

    if (level === this._intensity) return;
    this._intensity = level;
    this._applyIntensity();
  }

  _applyIntensity() {
    const ctx = audioManager._getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const cfg = INTENSITY[this._intensity];

    // Crossfade layers over 1s
    if (this._arpGain) {
      this._arpGain.gain.linearRampToValueAtTime(cfg.arpVol, now + 1);
    }
    if (this._padGain) {
      this._padGain.gain.linearRampToValueAtTime(cfg.padVol, now + 1);
    }
    if (this._percGain) {
      this._percGain.gain.linearRampToValueAtTime(cfg.percVol, now + 1);
    }
    if (this._leadGain) {
      this._leadGain.gain.linearRampToValueAtTime(cfg.leadVol, now + 1);
    }

    // Tempo scaling via detune on all oscillators
    const tempoDetune = Math.log2(cfg.tempoMul) * 1200 * 0.3; // subtle pitch shift
    this._nodes.forEach(node => {
      if (node instanceof OscillatorNode && node._isRhythmic) {
        try { node.detune.linearRampToValueAtTime(tempoDetune, now + 1); } catch(e) {}
      }
    });
  }

  startMusic(themeId) {
    // TASK-424: Skip music on Quest for performance (8 oscillators too expensive)
    if (_isQuest) {
      console.log('[music-manager] Disabled on Quest for performance');
      return;
    }
    if (!this._enabled) return;
    this.stopMusic();

    const ctx = audioManager._getCtx();
    if (!ctx) return;
    const dest = audioManager.destination;
    if (!dest) return;

    const profile = MUSIC_PROFILES[themeId] || MUSIC_PROFILES.cyber;
    this._profile = profile;
    this._playing = true;
    this._intensity = 1;

    // Master gain for music (quieter than SFX)
    const masterGain = ctx.createGain();
    masterGain.gain.value = 0;
    masterGain.connect(dest);
    // Fade in
    masterGain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 2);
    this._nodes.push(masterGain);
    this._masterGain = masterGain;

    // Bass drone
    const bass = ctx.createOscillator();
    const bassGain = ctx.createGain();
    bass.type = profile.bassType;
    bass.frequency.value = profile.bassFreq;
    bassGain.gain.value = 0.4;
    bass.connect(bassGain).connect(masterGain);
    bass.start();
    this._nodes.push(bass, bassGain);

    // Rhythmic bass pulse
    const pulseInterval = setInterval(() => {
      if (!this._playing) return;
      const tempo = profile.tempo * INTENSITY[this._intensity].tempoMul;
      bassGain.gain.setValueAtTime(0.4, ctx.currentTime);
      bassGain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + (1 / tempo));
      bassGain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + (2 / tempo));
    }, (2 / profile.tempo) * 1000);
    this._intervals.push(pulseInterval);

    // Pad layer (filtered sawtooth)
    const padOsc = ctx.createOscillator();
    const padGain = ctx.createGain();
    const padFilter = ctx.createBiquadFilter();
    padOsc.type = 'sawtooth';
    padOsc.frequency.value = profile.padFreq;
    padFilter.type = 'lowpass';
    padFilter.frequency.value = profile.padFilter;
    padFilter.Q.value = 2;
    padGain.gain.value = INTENSITY[1].padVol;
    padOsc.connect(padFilter).connect(padGain).connect(masterGain);
    padOsc.start();
    this._nodes.push(padOsc, padGain, padFilter);
    this._padGain = padGain;

    // Slow pad modulation
    const padModInterval = setInterval(() => {
      if (!this._playing) return;
      const f = profile.padFreq * (0.9 + Math.random() * 0.2);
      padOsc.frequency.linearRampToValueAtTime(f, ctx.currentTime + 2);
    }, 4000);
    this._intervals.push(padModInterval);

    // Arp pings (sparse melodic pings)
    const arpGain = ctx.createGain();
    arpGain.gain.value = INTENSITY[1].arpVol;
    arpGain.connect(masterGain);
    this._arpGain = arpGain;
    this._nodes.push(arpGain);

    const arpInterval = setInterval(() => {
      if (!this._playing) return;
      this._fireBeat();
      const note = profile.arpNotes[Math.floor(Math.random() * profile.arpNotes.length)];
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = note;
      gain.gain.setValueAtTime(1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);
      osc.connect(gain).connect(arpGain);
      osc.start();
      osc.stop(ctx.currentTime + 1.5);
    }, (3 / profile.tempo) * 1000);
    this._intervals.push(arpInterval);

    // === Percussion layer (hi-hat + kick pattern) — level 3+ ===
    const percGain = ctx.createGain();
    percGain.gain.value = 0; // starts silent
    percGain.connect(masterGain);
    this._percGain = percGain;
    this._nodes.push(percGain);

    const percInterval = setInterval(() => {
      if (!this._playing || this._intensity < 3) return;
      const tempo = profile.tempo * INTENSITY[this._intensity].tempoMul;
      const now = ctx.currentTime;

      // Hi-hat (filtered noise burst)
      const bufSize = ctx.sampleRate * 0.03;
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1);
      const noise = ctx.createBufferSource();
      noise.buffer = buf;
      const hiFilter = ctx.createBiquadFilter();
      hiFilter.type = 'highpass';
      hiFilter.frequency.value = 8000;
      const hiGain = ctx.createGain();
      hiGain.gain.setValueAtTime(0.3, now);
      hiGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      noise.connect(hiFilter).connect(hiGain).connect(percGain);
      noise.start(now);

      // Kick on every other beat
      if (Math.random() < 0.5) {
        const kick = ctx.createOscillator();
        const kGain = ctx.createGain();
        kick.type = 'sine';
        kick.frequency.setValueAtTime(150, now);
        kick.frequency.exponentialRampToValueAtTime(40, now + 0.1);
        kGain.gain.setValueAtTime(0.4, now);
        kGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        kick.connect(kGain).connect(percGain);
        kick.start(now);
        kick.stop(now + 0.15);
      }
    }, (0.5 / profile.tempo) * 1000);
    this._intervals.push(percInterval);

    // === Lead melody layer — level 4 only ===
    const leadGain = ctx.createGain();
    leadGain.gain.value = 0; // starts silent
    leadGain.connect(masterGain);
    this._leadGain = leadGain;
    this._nodes.push(leadGain);

    const leadNotes = profile.leadNotes || profile.arpNotes.map(n => n * 2);
    let leadIdx = 0;
    const leadInterval = setInterval(() => {
      if (!this._playing || this._intensity < 4) return;
      const note = leadNotes[leadIdx % leadNotes.length];
      leadIdx++;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = note;
      // Filter for softer lead
      const flt = ctx.createBiquadFilter();
      flt.type = 'lowpass';
      flt.frequency.value = 2000;
      gain.gain.setValueAtTime(1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
      osc.connect(flt).connect(gain).connect(leadGain);
      osc.start(now);
      osc.stop(now + 0.8);
    }, (2 / profile.tempo) * 1000);
    this._intervals.push(leadInterval);

    // === TASK-263: Underwater whale call — occasional low sine sweep ===
    if (themeId === 'underwater') {
      const whaleInterval = setInterval(() => {
        if (!this._playing) return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(50, now);
        osc.frequency.exponentialRampToValueAtTime(200, now + 2.5);
        osc.frequency.exponentialRampToValueAtTime(60, now + 5);
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.04, now + 1);
        gain.gain.linearRampToValueAtTime(0.06, now + 3);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 5);
        osc.connect(gain).connect(masterGain);
        osc.start(now);
        osc.stop(now + 5);
      }, 15000 + Math.random() * 10000);
      this._intervals.push(whaleInterval);

      // Extra master low-pass for muffled underwater feel
      const underwaterFilter = ctx.createBiquadFilter();
      underwaterFilter.type = 'lowpass';
      underwaterFilter.frequency.value = 800;
      underwaterFilter.Q.value = 0.5;
      masterGain.disconnect();
      masterGain.connect(underwaterFilter).connect(dest);
      this._nodes.push(underwaterFilter);
    }
  }

  setPlaybackRate(rate) {
    if (!this._playing || !this._masterGain) return;
    try {
      const ctx = audioManager._getCtx();
      // Detune all oscillators to simulate pitch shift
      const cents = Math.log2(rate) * 1200;
      this._nodes.forEach(node => {
        if (node instanceof OscillatorNode) {
          node.detune.setValueAtTime(cents, ctx.currentTime);
        }
      });
    } catch (e) { /* ignore */ }
  }

  stopMusic() {
    this._playing = false;
    this._intensity = 1;

    // Fade out if possible
    if (this._masterGain) {
      try {
        const ctx = audioManager._getCtx();
        this._masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
      } catch (e) { /* ignore */ }
    }

    // Clean up after fade
    setTimeout(() => {
      this._intervals.forEach(id => clearInterval(id));
      this._intervals = [];
      this._nodes.forEach(node => {
        try { if (node.stop) node.stop(); } catch (e) { /* ignore */ }
        try { node.disconnect(); } catch (e) { /* ignore */ }
      });
      this._nodes = [];
      this._masterGain = null;
      this._percGain = null;
      this._leadGain = null;
      this._arpGain = null;
      this._padGain = null;
    }, 600);
  }
}

const musicManager = new MusicManager();
export { musicManager };
export default musicManager;
