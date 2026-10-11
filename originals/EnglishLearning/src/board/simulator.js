/**
 * KeyboardSimulator — lets the whole app be used without the dev board.
 *
 * Two keyboard layouts map to S1..S8, and the S1+S8 enter combo works in both,
 * so the flow is testable on any laptop and friendly for young kids who find
 * number keys easier than letters. A real board is always preferred; the
 * simulator is auto-engaged when no serial port is connected.
 *
 *   Layout A (home row, good for laptops):
 *     A S D F G H J K  ->  S1 S2 S3 S4 S5 S6 S7 S8
 *   Layout B (number row, easiest for little kids):
 *     1 2 3 4 5 6 7 8  ->  S1 S2 S3 S4 S5 S6 S7 S8
 *   Enter combo: press A + K (layout A) or 1 + 8 (layout B) together (S1 + S8).
 *   (S1 + S7 is reserved for the maker appmode and is NOT used here.)
 *   Also: the on-screen "Start" button triggers the enter combo programmatically.
 */

import { KEY } from "./protocol.js";

/**
 * True when the key event originates from a text-entry control. When the child
 * is typing in an input/textarea (e.g. the type-it fallback box), we must let
 * the keystrokes through and NOT fire the board shortcuts — otherwise typing
 * "bear" would trigger S1/S2/S5… and the letters never reach the box.
 * @param {EventTarget|null} target
 */
export function isTypingTarget(target) {
  if (!target) return false;
  const tag = target.tagName;
  if (!tag) return false;
  const t = String(tag).toUpperCase();
  if (t === "INPUT" || t === "TEXTAREA") return true;
  if (target.isContentEditable) return true;
  return false;
}

/** Skip simulator handling when the user is composing/inputting text. */
function shouldSuppress(e) {
  // IME composition (Chinese pinyin, etc.) must not launch board actions.
  if (e.isComposing) return true;
  return isTypingTarget(e.target);
}

const KEYMAP = {
  // Layout A — home row.
  KeyA: KEY.S1,
  KeyS: KEY.S2,
  KeyD: KEY.S3,
  KeyF: KEY.S4,
  KeyG: KEY.S5,
  KeyH: KEY.S6,
  KeyJ: KEY.S7,
  KeyK: KEY.S8,
  // Layout B — number row (kids-friendly).
  Digit1: KEY.S1,
  Digit2: KEY.S2,
  Digit3: KEY.S3,
  Digit4: KEY.S4,
  Digit5: KEY.S5,
  Digit6: KEY.S6,
  Digit7: KEY.S7,
  Digit8: KEY.S8,
  Numpad1: KEY.S1,
  Numpad2: KEY.S2,
  Numpad3: KEY.S3,
  Numpad4: KEY.S4,
  Numpad5: KEY.S5,
  Numpad6: KEY.S6,
  Numpad7: KEY.S7,
  Numpad8: KEY.S8,
};

export { KEYMAP };

export class KeyboardSimulator {
  constructor(keypad) {
    this.keypad = keypad;
    this.attached = false;
  }

  attach() {
    if (this.attached) return;
    this.attached = true;
    window.addEventListener("keydown", this._down);
    window.addEventListener("keyup", this._up);
  }

  detach() {
    if (!this.attached) return;
    this.attached = false;
    window.removeEventListener("keydown", this._down);
    window.removeEventListener("keyup", this._up);
  }

  _down = (e) => {
    if (e.repeat) return;
    // Let keystrokes reach inputs / IME composition (typing "bear" must work).
    if (shouldSuppress(e)) return;
    const idx = KEYMAP[e.code];
    if (idx == null) return;
    e.preventDefault();
    this.keypad.setKey(idx, true);
  };

  _up = (e) => {
    // Mirror the down-side guard so a key released while typing isn't misread.
    if (shouldSuppress(e)) return;
    const idx = KEYMAP[e.code];
    if (idx == null) return;
    e.preventDefault();
    this.keypad.setKey(idx, false);
  };
}
