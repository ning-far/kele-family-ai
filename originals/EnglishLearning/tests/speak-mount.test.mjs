/**
 * Regression test: mountSpeak must not crash on entry.
 * A minimal DOM shim is provided so we can actually call mountSpeak
 * without a real browser (no jsdom dependency).
 */
import { test } from "node:test";
import assert from "node:assert/strict";

function makeNode() {
  const node = {
    children: [],
    style: new Proxy(
      {},
      {
        get: (t, k) => (k === "setProperty" ? () => {} : t[k]),
        set: (t, k, v) => {
          t[k] = v;
          return true;
        },
      }
    ),
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c); },
      remove(c) { this._s.delete(c); },
      toggle(c, on) { (on ? this._s.add(c) : this._s.delete(c)); },
      contains(c) { return this._s.has(c); },
    },
    _attrs: {},
    setAttribute(k, v) { this._attrs[k] = v; },
    getAttribute(k) { return this._attrs[k]; },
    appendChild(c) { this.children.push(c); return c; },
    append(...args) { for (const a of args) this.children.push(a); },
    addEventListener() {},
    removeChild(c) { this.children = this.children.filter((x) => x !== c); },
    remove() {},
  };
  Object.defineProperty(node, "innerHTML", { get() { return this._html || ""; }, set(v) { this._html = v; } });
  Object.defineProperty(node, "textContent", { get() { return this._text || ""; }, set(v) { this._text = v; } });
  Object.defineProperty(node, "className", { get() { return this._cls || ""; }, set(v) { this._cls = v; } });
  Object.defineProperty(node, "firstChild", { get() { return this.children[0] || null; } });
  return node;
}

const g = globalThis;
g.document = {
  createElement: () => makeNode(),
  createTextNode: (t) => ({ textContent: t, nodeType: 3 }),
  body: makeNode(),
  getElementById: () => makeNode(),
};
g.window = {
  setTimeout: () => 0,
  clearTimeout: () => {},
  matchMedia: () => ({ matches: false }),
  addEventListener() {},
};

const { mountSpeak } = await import("../src/modules/speak.js");
const {clearAll,getVocab} = await import('../src/content/vocabStore.js');
const store=new Map();
g.localStorage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)};

test("mountSpeak builds without throwing (regression: startRound must run at mount)", () => {
  const ctx = {
    screen: makeNode(),
    keypad: { onKey: () => () => {} },
    tts: { speak: () => {}, cancel: () => {} },
    fx: undefined,
    recorder: { start() {}, release() {}, stop() {} },
    board: { send() {} },
    flashLed() {},
    toast() {},
    goHome() {},
    goModule() {},
  };
  let mod;
  assert.doesNotThrow(() => {
    mod = mountSpeak(ctx);
  });
  assert.equal(typeof mod.unmount, "function");
  mod.unmount();
});

test('real Speak recorder callback collects one wrong result per question; empty result and retry do not inflate it',()=>{
 clearAll();let keys,recording;
 const ctx={screen:makeNode(),keypad:{onKey:fn=>{keys=fn;return()=>{}}},
 tts:{speak:()=>{},cancel(){}},
 recorder:{start(_lang,callbacks){recording=callbacks},release(){},stop(){}},
 flashLed(){},goHome(){},fx:undefined};
 const mod=mountSpeak(ctx);
 keys(0,true);recording.onResult({transcript:''});
 assert.equal(getVocab().length,0);
 recording.onResult({transcript:'zzzzzzzzzzzz'});
 assert.equal(getVocab().filter(v=>v.inNew).length,1);
 assert.equal(getVocab()[0].wrongCount,1);
 recording.onResult({transcript:'zzzzzzzzzzzz'});
 assert.equal(getVocab()[0].wrongCount,1);
 mod.unmount();
 recording.onResult({transcript:'zzzzzzzzzzzz'});
 assert.equal(getVocab()[0].wrongCount,1);
});
