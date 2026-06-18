export class PacmanAudio {
  constructor() {
    this._ctx = null;
    this._muted = false;
  }

  _ac() {
    if (!this._ctx) this._ctx = new (window.AudioContext || window.webkitAudioContext)();
    return this._ctx;
  }

  setMuted(v) { this._muted = v; }

  _tone(freq, type, duration, vol = 0.3, startFreq = null) {
    if (this._muted) return;
    try {
      const ac = this._ac();
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.connect(gain); gain.connect(ac.destination);
      osc.type = type;
      const t = ac.currentTime;
      osc.frequency.setValueAtTime(startFreq || freq, t);
      if (startFreq) osc.frequency.linearRampToValueAtTime(freq, t + duration);
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
      osc.start(t); osc.stop(t + duration);
    } catch(e) {}
  }

  playPellet() {
    // Short high chirp alternating between two pitches (waka-waka feel)
    if (this._muted) return;
    try {
      const ac = this._ac();
      const t = ac.currentTime;
      [0, 0.06].forEach((delay, i) => {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.connect(gain); gain.connect(ac.destination);
        osc.type = 'square';
        osc.frequency.setValueAtTime(i === 0 ? 494 : 392, t + delay);
        gain.gain.setValueAtTime(0.15, t + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.05);
        osc.start(t + delay); osc.stop(t + delay + 0.055);
      });
    } catch(e) {}
  }

  playPower() {
    this._tone(220, 'sawtooth', 0.5, 0.4, 880);
  }

  playGhostEat(chain) {
    // chain: 1-4, ascending arpeggio pitches
    const pitches = [200, 280, 370, 494];
    if (this._muted) return;
    try {
      const ac = this._ac();
      const t = ac.currentTime;
      for (let i = 0; i < 3; i++) {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.connect(gain); gain.connect(ac.destination);
        osc.type = 'square';
        osc.frequency.setValueAtTime(pitches[Math.min(chain-1,3)] * (1 + i * 0.5), t + i * 0.07);
        gain.gain.setValueAtTime(0.3, t + i * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.07 + 0.065);
        osc.start(t + i * 0.07); osc.stop(t + i * 0.07 + 0.07);
      }
    } catch(e) {}
  }

  playDeath() {
    if (this._muted) return;
    try {
      const ac = this._ac();
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.connect(gain); gain.connect(ac.destination);
      osc.type = 'sawtooth';
      const t = ac.currentTime;
      osc.frequency.setValueAtTime(600, t);
      osc.frequency.linearRampToValueAtTime(80, t + 1.0);
      gain.gain.setValueAtTime(0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 1.0);
      osc.start(t); osc.stop(t + 1.0);
    } catch(e) {}
  }

  playLevelComplete() {
    if (this._muted) return;
    try {
      const ac = this._ac();
      const notes = [523, 659, 784, 1047]; // C5 E5 G5 C6
      notes.forEach((freq, i) => {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.connect(gain); gain.connect(ac.destination);
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, ac.currentTime + i * 0.12);
        gain.gain.setValueAtTime(0.3, ac.currentTime + i * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + i * 0.12 + 0.11);
        osc.start(ac.currentTime + i * 0.12);
        osc.stop(ac.currentTime + i * 0.12 + 0.12);
      });
    } catch(e) {}
  }

  playIntro() {
    if (this._muted) return;
    try {
      const ac = this._ac();
      // Classic Pac-Man intro melody (simplified)
      const melody = [
        [494,0.12],[494,0.12],[494,0.12],[392,0.24],[494,0.12],
        [587,0.36],[294,0.36]
      ];
      let t = ac.currentTime + 0.1;
      melody.forEach(([freq, dur]) => {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.connect(gain); gain.connect(ac.destination);
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.25, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + dur - 0.01);
        osc.start(t); osc.stop(t + dur);
        t += dur;
      });
    } catch(e) {}
  }

  playExtraLife() {
    if (this._muted) return;
    try {
      const ac = this._ac();
      const notes = [784, 988, 1175, 1568];
      notes.forEach((freq, i) => {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.connect(gain); gain.connect(ac.destination);
        osc.type = 'square';
        const t = ac.currentTime + i * 0.1;
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.25, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
        osc.start(t); osc.stop(t + 0.1);
      });
    } catch(e) {}
  }
}
