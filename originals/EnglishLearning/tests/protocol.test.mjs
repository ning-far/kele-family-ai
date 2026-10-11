/**
 * Unit tests for the host-protocol parser and key constants.
 * Run with:  node --test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseHostLine, KEY, ENGLISH_MODE, ESPRESSIF_VID, BAUD_RATE } from "../src/board/protocol.js";

test("parseHostLine accepts a valid key frame", () => {
  const m = parseHostLine('{"t":"key","i":0,"v":1}');
  assert.deepEqual(m, { t: "key", i: 0, v: 1 });
});

test("parseHostLine accepts hello/state with appmode", () => {
  const m = parseHostLine('{"t":"state","appmode":"english"}');
  assert.equal(m.t, "state");
  assert.equal(m.appmode, "english");
});

test("parseHostLine ignores non-JSON and non-object lines", () => {
  assert.equal(parseHostLine("boot message noise"), null);
  assert.equal(parseHostLine("{not json"), null);
  assert.equal(parseHostLine('["array",1]'), null); // not an object with t
  assert.equal(parseHostLine(""), null);
});

test("parseHostLine tolerates surrounding whitespace and \r", () => {
  const m = parseHostLine('  {"t":"ping"}\r');
  assert.equal(m.t, "ping");
});

test("KEY constants map S1..S8 to 0..7 with S7 = 6", () => {
  assert.equal(KEY.S1, 0);
  assert.equal(KEY.S7, 6);
  assert.equal(KEY.S8, 7);
});

test("ENGLISH_MODE and board constants are stable", () => {
  assert.equal(ENGLISH_MODE, "english");
  assert.equal(ESPRESSIF_VID, 0x303a);
  assert.equal(BAUD_RATE, 115200);
});
