/**
 * CuteSounds — 用 Web Audio API 合成的「小朋友风」音效。
 *
 * 不依赖任何外部音频文件，离线可用。包括：答对叮、答错噗、揭示答案的魔法音、
 * 奖励小号角、升级 fanfare + 烟花声、点击泡泡音。
 *
 * 所有声音都调高 pitch、短促、圆润，避免刺耳，贴合儿童 App。
 */
export class CuteSounds {
  constructor() {
    this.ctx = null;
    this.master = null;
    this._enabled = true;
    if (typeof window !== "undefined") {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        try {
          this.ctx = new AC();
          this.master = this.ctx.createGain();
          this.master.gain.value = 0.32; // 整体音量柔和
          this.master.connect(this.ctx.destination);
        } catch {}
      }
    }
  }

  set enabled(v) {
    this._enabled = !!v;
  }
  get enabled() {
    return this._enabled;
  }

  async _resume() {
    if (this.ctx && this.ctx.state === "suspended") {
      try {
        await this.ctx.resume();
      } catch {}
    }
  }

  _when() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  _tone({ freq, dur = 0.18, when = 0, type = "sine", vol = 1, attack = 0.01, decay = 0.12 }) {
    if (!this.ctx || !this.master || !this._enabled) return;
    const t0 = when || this._when();
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol), t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
    osc.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  _chord(freqs, { dur = 0.35, when, vol = 0.9, type = "triangle" } = {}) {
    freqs.forEach((f, i) =>
      this._tone({ freq: f, dur, when, type, vol: vol * (1 - i * 0.08), attack: 0.015, decay: dur * 0.75 })
    );
  }

  /** 答对：清脆欢快的「叮铃」 */
  correct() {
    this._resume();
    const w = this._when();
    this._tone({ freq: 880, dur: 0.15, when: w, vol: 0.7, type: "sine", attack: 0.01, decay: 0.12 });
    this._tone({ freq: 1175, dur: 0.25, when: w + 0.08, vol: 0.55, type: "sine", attack: 0.01, decay: 0.18 });
    this._tone({ freq: 1760, dur: 0.35, when: w + 0.16, vol: 0.35, type: "triangle", attack: 0.01, decay: 0.25 });
  }

  /** 答错 / 没听清：柔软低沉的「噗」 */
  wrong() {
    this._resume();
    const w = this._when();
    this._tone({ freq: 180, dur: 0.22, when: w, vol: 0.6, type: "sine", attack: 0.02, decay: 0.16 });
    this._tone({ freq: 150, dur: 0.25, when: w + 0.08, vol: 0.4, type: "sine", attack: 0.02, decay: 0.18 });
  }

  /** 揭示答案：魔法般的闪亮音 */
  reveal() {
    this._resume();
    const w = this._when();
    [740, 987, 1245, 1480].forEach((f, i) =>
      this._tone({ freq: f, dur: 0.28, when: w + i * 0.06, vol: 0.35, type: "sine", attack: 0.02, decay: 0.18 })
    );
  }

  /** 普通奖励：小号角 */
  reward() {
    this._resume();
    const w = this._when();
    this._chord([523, 659, 784], { when: w, dur: 0.25, vol: 0.55, type: "triangle" });
    this._chord([659, 784, 1047], { when: w + 0.18, dur: 0.35, vol: 0.5, type: "triangle" });
  }

  /** 升级 / 过关：隆重的 fanfare + 烟花 */
  levelUp() {
    this._resume();
    const w = this._when();
    // fanfare
    [523, 659, 784, 1047, 1319].forEach((f, i) =>
      this._tone({ freq: f, dur: 0.55, when: w + i * 0.09, vol: 0.45, type: "triangle", attack: 0.02, decay: 0.4 })
    );
    // 三声烟花「砰-咻-砰」
    this.firework(w + 0.55);
    this.firework(w + 0.9);
    this.firework(w + 1.25);
  }

  /** 单个烟花：「咻——砰」 */
  firework(when) {
    if (!this.ctx || !this.master || !this._enabled) return;
    this._resume();
    const w = when == null ? this._when() : when;
    // 上升咻声
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(600, w);
    osc.frequency.exponentialRampToValueAtTime(1800, w + 0.18);
    g.gain.setValueAtTime(0.0001, w);
    g.gain.exponentialRampToValueAtTime(0.25, w + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, w + 0.18);
    osc.connect(g).connect(this.master);
    osc.start(w);
    osc.stop(w + 0.2);
    // 绽放砰声
    const pop = this.ctx.createOscillator();
    const popG = this.ctx.createGain();
    pop.type = "triangle";
    pop.frequency.setValueAtTime(250, w + 0.18);
    pop.frequency.exponentialRampToValueAtTime(80, w + 0.38);
    popG.gain.setValueAtTime(0.0001, w + 0.18);
    popG.gain.exponentialRampToValueAtTime(0.7, w + 0.2);
    popG.gain.exponentialRampToValueAtTime(0.0001, w + 0.42);
    pop.connect(popG).connect(this.master);
    pop.start(w + 0.18);
    pop.stop(w + 0.45);
  }

  /** 点击 / 切换： tiny 泡泡音 */
  click() {
    this._resume();
    const w = this._when();
    this._tone({ freq: 1200, dur: 0.06, when: w, vol: 0.25, type: "sine", attack: 0.005, decay: 0.05 });
  }
}
