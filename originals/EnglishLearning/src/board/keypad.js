/**
 * Keypad — the single source of truth for physical-button state.
 *
 * Both the real board (via SerialLink key frames) and the keyboard simulator
 * feed state in through `setKey` / `setAppMode`. Everything else in the app
 * (modules, UI) subscribes here and never cares where the press came from.
 *
 * Key facts (EasyInput V2.0):
 *   S1..S8 -> index 0..7, reported by firmware as {t:"key", i, v:1|0}.
 *   Entering English mode happens when S1+S8 are held together (combo),
 *   OR when the firmware reports appmode="english".
 *   NOTE: S1+S7 is RESERVED for the maker appmode (see maker-bridge README) and
 *   must NOT be hijacked by this app — we only listen for S1+S8.
 */

import { KEY, ENGLISH_MODE } from "./protocol.js";

const KEY_COUNT = 8;

export class Keypad {
  constructor() {
    this.keysDown = new Array(KEY_COUNT).fill(false);
    this.appmode = "";
    this.flashUntil = new Array(KEY_COUNT).fill(0);
    this.comboActive = false;
    this.keyListeners = new Set(); // (index, down) => void
    this.comboListeners = new Set(); // () => void  (S1+S8 pressed together)
    this.appmodeListeners = new Set(); // (mode) => void
    this.stateListeners = new Set(); // (state) => void  (KeyStateLink)
  }

  getState() {
    return { keysDown: this.keysDown.slice(), flashUntil: this.flashUntil.slice(), appmode: this.appmode };
  }

  /** KeyStateLink-style subscription used by input sources. */
  subscribe(fn) {
    this.stateListeners.add(fn);
    fn(this.getState());
    return () => this.stateListeners.delete(fn);
  }

  onKey(cb) {
    this.keyListeners.add(cb);
    return () => this.keyListeners.delete(cb);
  }

  /** Fired once when S1+S8 become pressed together. */
  onEnterCombo(cb) {
    this.comboListeners.add(cb);
    return () => this.comboListeners.delete(cb);
  }

  onAppMode(cb) {
    this.appmodeListeners.add(cb);
    return () => this.appmodeListeners.delete(cb);
  }

  setKey(index, down) {
    const i = index & 0x07;
    const was = this.keysDown[i];
    const now = !!down;
    if (was === now) return;
    this.keysDown[i] = now;
    this.flashUntil[i] = now ? Date.now() + 220 : 0;
    for (const cb of this.keyListeners) cb(i, now);
    this._checkCombo();
    for (const cb of this.stateListeners) cb(this.getState());
  }

  setAppMode(mode) {
    if (!mode || mode === this.appmode) return;
    const prev = this.appmode;
    this.appmode = mode;
    for (const cb of this.appmodeListeners) cb(mode, prev);
    for (const cb of this.stateListeners) cb(this.getState());
  }

  _checkCombo() {
    const both = this.keysDown[KEY.S1] && this.keysDown[KEY.S8];
    if (both && !this.comboActive) {
      this.comboActive = true;
      for (const cb of this.comboListeners) cb();
    } else if (!both && this.comboActive) {
      this.comboActive = false;
    }
  }

  isEnglish() {
    return this.appmode === ENGLISH_MODE || this.comboActive;
  }
}
