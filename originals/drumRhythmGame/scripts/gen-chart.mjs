// 谱面生成器：把 easyinput-beatbox gear2《小星星》鼓谱骨架重映射到 4 键（S1–S4）。
//
// 原 gear2（firmware/main/seq/pattern.c:234-241，已打开核对）每小节 16 步：
//   Kick  在 step 0/8   （= 第1、3拍）
//   Snare 在 step 4/12  （= 第2、4拍）
//   CHH   在 step 0/4/8/12（每拍一下）
// 4 键版没有 Kick/Snare，于是保留「每拍 1 下」的节奏骨架，重映射到 S1–S4：
//   每小节：Rim(lane3) 落第1、3拍，Clap(lane2) 落第2、4拍 —— 稳定交替律动；
//   每乐句末尾（每 16 拍，beat%16==15）把该拍换成 OHH(lane1)，当「亮一下」；
//   CHH(lane0) 本版不用（留给高难度 8 分脉冲）。
// 约束自查：无负 beat、beat 单调不减、lane∈{0..3}、单音符不重复、vel∈[0,127]、
//           密度=每拍 1 音（≤2）、双押=0；6 个乐句 = 96 拍，约 1–1.5 分钟。
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const PHRASES = 6; // 乐句循环 6 遍（4–6 遍区间内，落到约 1–1.5 分钟）
const BEATS_PER_PHRASE = 16;
const TOTAL_BEATS = PHRASES * BEATS_PER_PHRASE; // 96

const LANES = [
  { id: 0, name: "闭镲 CHH", key: "S1", gm: 42, color: "#74e0b8", shape: "circle" },
  { id: 1, name: "开镲 OHH", key: "S2", gm: 46, color: "#7cc5ff", shape: "triangle" },
  { id: 2, name: "拍手 Clap", key: "S3", gm: 39, color: "#ffe6a0", shape: "round" },
  { id: 3, name: "边击 Rim", key: "S4", gm: 37, color: "#ffb0d0", shape: "star" },
];

// 每拍力度：强-弱-次强-弱（对齐原 gear2 的重音走向），乐句末 OHH 最亮。
const VEL = { rimDown: 112, clap: 92, rimUp: 100, ohh: 120 };

function laneForBeat(beat) {
  if (beat % BEATS_PER_PHRASE === BEATS_PER_PHRASE - 1) return 1; // 乐句末 OHH
  const local = beat % 4;
  return local === 0 || local === 2 ? 3 : 2; // Rim(1/3拍) / Clap(2/4拍)
}

function velForBeat(beat, lane) {
  if (lane === 1) return VEL.ohh;
  if (lane === 3) return beat % 4 === 0 ? VEL.rimDown : VEL.rimUp;
  return VEL.clap;
}

const notes = [];
for (let beat = 0; beat < TOTAL_BEATS; beat++) {
  const lane = laneForBeat(beat);
  notes.push({ beat, lanes: [lane], vel: velForBeat(beat, lane) });
}

const chart = {
  format: "drumgame-chart/1",
  meta: {
    title: "小星星",
    gear: 2,
    difficulty: "normal",
    bpm: 84,
    beatsPerBar: 4,
    stepsPerBar: 16,
    audioOffsetMs: 0,
    lengthBeats: TOTAL_BEATS,
    source: "remapped from easyinput-beatbox firmware gear2 (pattern.c)",
  },
  lanes: LANES,
  notes,
};

const here = dirname(fileURLToPath(import.meta.url));
const chartsDir = resolve(here, "..", "charts");
mkdirSync(chartsDir, { recursive: true });
const out = resolve(chartsDir, "twinkle.json");
writeFileSync(out, JSON.stringify(chart, null, 2) + "\n", "utf8");
console.log(`wrote ${out} — ${notes.length} notes over ${TOTAL_BEATS} beats`);
