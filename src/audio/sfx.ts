// Tiny synthesized chiptune SFX (original, generated at runtime with WebAudio).
// Safe to import in non-browser environments: it becomes a no-op.

export type SfxId =
  | 'click'
  | 'open'
  | 'close'
  | 'scan'
  | 'render'
  | 'publish'
  | 'coin'
  | 'viral'
  | 'error'
  | 'level'
  | 'sleep'
  | 'purr'
  | 'step';

type Note = [freq: number, dur: number, type?: OscillatorType, vol?: number];

const SEQUENCES: Record<SfxId, Note[]> = {
  click: [[660, 0.03, 'square', 0.05]],
  open: [[440, 0.04, 'square', 0.05], [660, 0.05, 'square', 0.05]],
  close: [[520, 0.04, 'square', 0.04], [330, 0.05, 'square', 0.04]],
  scan: [[300, 0.04, 'triangle', 0.08], [450, 0.04, 'triangle', 0.08], [600, 0.06, 'triangle', 0.08]],
  render: [[392, 0.06, 'square', 0.05], [523, 0.06, 'square', 0.05], [784, 0.1, 'square', 0.05]],
  publish: [[523, 0.07, 'square', 0.06], [659, 0.07, 'square', 0.06], [784, 0.07, 'square', 0.06], [1046, 0.14, 'square', 0.06]],
  coin: [[988, 0.05, 'square', 0.05], [1319, 0.12, 'square', 0.05]],
  viral: [
    [523, 0.08, 'square', 0.06], [659, 0.08, 'square', 0.06], [784, 0.08, 'square', 0.06],
    [1046, 0.08, 'square', 0.06], [784, 0.08, 'square', 0.06], [1046, 0.25, 'square', 0.07],
  ],
  error: [[180, 0.08, 'sawtooth', 0.05], [140, 0.12, 'sawtooth', 0.05]],
  level: [[659, 0.08, 'triangle', 0.09], [880, 0.08, 'triangle', 0.09], [1175, 0.18, 'triangle', 0.09]],
  sleep: [[392, 0.18, 'sine', 0.08], [330, 0.18, 'sine', 0.08], [262, 0.3, 'sine', 0.08]],
  purr: [[90, 0.08, 'triangle', 0.1], [80, 0.08, 'triangle', 0.1], [95, 0.1, 'triangle', 0.1]],
  step: [[120, 0.02, 'triangle', 0.03]],
};

class Sfx {
  private ctx: AudioContext | null = null;
  enabled = true;

  constructor() {
    try {
      if (typeof localStorage !== 'undefined') this.enabled = localStorage.getItem('ctr-sound') !== 'off';
    } catch {
      /* storage blocked: keep default */
    }
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    try {
      localStorage.setItem('ctr-sound', on ? 'on' : 'off');
    } catch {
      /* ignore */
    }
  }

  play(id: SfxId): void {
    if (!this.enabled) return;
    const Ctor = typeof window !== 'undefined' ? (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) : undefined;
    if (!Ctor) return;
    try {
      this.ctx ??= new Ctor();
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      let t = this.ctx.currentTime + 0.005;
      for (const [freq, dur, type = 'square', vol = 0.05] of SEQUENCES[id]) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(vol, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(gain).connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + dur + 0.02);
        t += dur * 0.9;
      }
    } catch {
      /* audio is optional */
    }
  }
}

export const sfx = new Sfx();
