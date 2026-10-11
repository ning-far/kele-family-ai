/**
 * Shared UI widgets.
 */
import { el } from "./dom.js";

/**
 * A small on-screen dev-board view. Shows S1..S8 and lights up as they are
 * pressed (from the real board or the keyboard simulator). Helps kids and
 * testers see that buttons are connected. Returns {node, unsub}.
 */
export function miniKeypad(keypad) {
  const keyEls = [];
  const row = el("div", { class: "board" });
  for (let i = 0; i < 8; i++) {
    const k = el("div", { class: "key" }, [
      String(i + 1),
      el("small", { text: i === 0 ? "PTT" : i === 6 ? "S7" : "" }),
    ]);
    keyEls.push(k);
    row.appendChild(k);
  }
  const apply = (i, down) => keyEls[i]?.classList.toggle("down", !!down);
  const unsub = keypad.onKey((i, down) => apply(i, down));
  return { node: row, unsub };
}

/** A score pill element with update / read methods. */
export function scorePill() {
  const value = el("span", { text: "0" });
  const node = el("div", { class: "score-pill" }, ["Score: ", value]);
  let current = 0;
  return {
    node,
    set(n) {
      current = n;
      value.textContent = String(n);
    },
    get() {
      return current;
    },
  };
}
