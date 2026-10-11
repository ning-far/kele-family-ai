/**
 * 生成《宝贝宝贝》和《生长吧》鼓谱 JSON
 * 运行: node scripts/gen-charts.mjs
 *
 * Lane 映射：0=S1(闭镲CHH) 1=S2(开镲OHH) 2=S3(拍手Clap) 3=S4(边击Rim)
 * beat 使用浮点数：整数=四分音符，x.5=八分音符
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dir, "..", "public", "charts");

const LANES = [
  { id: 0, name: "闭镲 CHH", key: "S1", gm: 42, color: "#74e0b8", shape: "circle" },
  { id: 1, name: "开镲 OHH", key: "S2", gm: 46, color: "#7cc5ff", shape: "triangle" },
  { id: 2, name: "拍手 Clap", key: "S3", gm: 39, color: "#ffe6a0", shape: "round" },
  { id: 3, name: "边击 Rim", key: "S4", gm: 37, color: "#ffb0d0", shape: "star" },
];

const N = (beat, lane, vel) => ({ beat, lanes: [lane], vel });
const D = (beat, lanes, vel) => ({ beat, lanes, vel });

function bar(barStart, pattern) {
  return pattern.map(([off, lanes, vel]) =>
    Array.isArray(lanes) ? D(barStart + off, lanes, vel) : N(barStart + off, lanes, vel)
  );
}

function stats(chart, name, sectionDefs) {
  const totalBars = chart.meta.lengthBeats / 4;
  const noteCount = chart.notes.length;
  const density = (noteCount / totalBars).toFixed(1);
  const doubleCount = chart.notes.filter((n) => n.lanes.length > 1).length;
  console.log(`\n${"=".repeat(50)}`);
  console.log(`  ${name}`);
  console.log(`${"=".repeat(50)}`);
  console.log(`总拍数: ${chart.meta.lengthBeats}  总小节数: ${totalBars}`);
  console.log(`总音符数: ${noteCount}  平均密度: ${density} 音符/小节`);
  console.log(`双押次数: ${doubleCount}`);
  console.log(`\n-- 4键分布 --`);
  for (const lane of chart.lanes) {
    const c = chart.notes.reduce((s, n) => s + (n.lanes.includes(lane.id) ? 1 : 0), 0);
    console.log(`  ${lane.key} ${lane.name}: ${c} (${((c / noteCount) * 100).toFixed(1)}%)`);
  }
  if (sectionDefs) {
    console.log(`\n-- 各阶段密度 --`);
    for (const [sn, sb, sc] of sectionDefs) {
      const s = sb * 4, e = s + sc * 4;
      const cn = chart.notes.filter((n) => n.beat >= s && n.beat < e).length;
      console.log(`  ${sn} (${sc}小节): ${cn} 音符, 密度 ${(cn / sc).toFixed(1)}/小节`);
    }
  }
  console.log(`\n-- 每小节密度 --`);
  const perBar = [];
  for (let b = 0; b < totalBars; b++) {
    const s = b * 4;
    perBar.push(chart.notes.filter((n) => n.beat >= s && n.beat < s + 4).length);
  }
  for (let i = 0; i < perBar.length; i += 8) {
    const sl = perBar.slice(i, i + 8);
    console.log(`  Bar ${String(i).padStart(2)}-${String(i + sl.length - 1).padStart(2)}: [${sl.join(", ")}]`);
  }
}

function genBabyBaby() {
  const notes = [];
  const B = (i) => i * 4;

  // 前奏 6小节: 极稀疏 2音/小节
  notes.push(...bar(B(0), [[0, 0, 80], [2, 0, 80]]));
  notes.push(...bar(B(1), [[0, 0, 80], [2, 1, 82]]));
  notes.push(...bar(B(2), [[0, 0, 85], [2, 2, 85]]));
  notes.push(...bar(B(3), [[0, 0, 82], [2, 1, 82]]));
  notes.push(...bar(B(4), [[0, 0, 85], [2, 2, 85]]));
  notes.push(...bar(B(5), [[0, 0, 82], [2, 1, 82]]));

  // 主歌A 16小节: 简单 3-4音/小节
  for (let i = 0; i < 8; i++)
    notes.push(...bar(B(6 + i), [[0, 0, 90], [1, 1, 92], [2, 0, 90]]));
  for (let i = 0; i < 8; i++)
    notes.push(...bar(B(14 + i), [[0, 0, 92], [1, 1, 94], [2, 0, 92], [3, 2, 88]]));

  // 主歌B 8小节: 稳定 5-6音/小节
  for (const i of [0, 1, 3, 5])
    notes.push(...bar(B(22 + i), [[0, 0, 95], [0.5, 0, 90], [1, 3, 98], [2, 0, 95], [3, 3, 98]]));
  for (const i of [2, 4, 6])
    notes.push(...bar(B(22 + i), [[0, 0, 95], [0.5, 0, 90], [1, 3, 98], [2, 0, 95], [2.5, 2, 92], [3, 3, 98]]));
  // 双押#1 bar 29
  notes.push(...bar(B(29), [[0, 0, 95], [0.5, 0, 90], [1, 3, 98], [2, [2, 1], 95], [3, 3, 98]]));

  // 副歌 12小节: 丰富 5-6音/小节
  for (const i of [0, 2, 4, 6, 8, 10])
    notes.push(...bar(B(30 + i), [[0, 0, 100], [0.5, 0, 95], [1, 3, 105], [1.5, 0, 95], [2, 2, 98], [3, 3, 105]]));
  for (const i of [1, 5, 7, 11])
    notes.push(...bar(B(30 + i), [[0, 0, 100], [0.5, 0, 95], [1, 3, 105], [2, 0, 100], [2.5, 2, 95], [3, 1, 100]]));
  // 双押#2,#3 bar 33,39
  for (const i of [3, 9])
    notes.push(...bar(B(30 + i), [[0, 0, 100], [0.5, 0, 95], [1, 3, 105], [2, [2, 1], 100], [3, 3, 105]]));

  // 结尾A 4小节: 丰富 5音/小节
  notes.push(...bar(B(42), [[0, 0, 98], [0.5, 0, 93], [1, 3, 100], [2, 2, 95], [3, 3, 98]]));
  notes.push(...bar(B(43), [[0, 0, 98], [1, 3, 100], [1.5, 0, 93], [2, 2, 95], [3, 3, 100]]));
  notes.push(...bar(B(44), [[0, 0, 98], [0.5, 0, 93], [1, 3, 100], [2, 2, 95], [3, 3, 98]]));
  notes.push(...bar(B(45), [[0, 0, 98], [1, 3, 100], [1.5, 0, 93], [2, 2, 95], [3, 3, 100]]));

  // 结尾B 4小节: 渐疏 5->4->3->2
  notes.push(...bar(B(46), [[0, 0, 92], [0.5, 0, 88], [1, 3, 95], [2, 0, 92], [3, 2, 88]]));
  notes.push(...bar(B(47), [[0, 0, 90], [1, 3, 92], [2, 0, 90], [3, 3, 92]]));
  notes.push(...bar(B(48), [[0, 0, 88], [1, 3, 90], [2.5, 0, 85]]));
  notes.push(...bar(B(49), [[0, 0, 85], [2, 3, 88]]));

  // 结尾C 7小节: 3->2->1->0->0->0->0
  notes.push(...bar(B(50), [[0, 0, 85], [1, 3, 88], [2.5, 0, 82]]));
  notes.push(...bar(B(51), [[0, 0, 82], [2, 3, 85]]));
  notes.push(...bar(B(52), [[0, 0, 80]]));

  notes.sort((a, b) => a.beat - b.beat || a.lanes[0] - b.lanes[0]);
  return {
    format: "drumgame-chart/1",
    meta: { title: "宝贝宝贝", gear: 1, difficulty: "normal", bpm: 120, beatsPerBar: 4, stepsPerBar: 16, audioOffsetMs: 0, lengthBeats: 228, audioFile: "audio/babybaby.mp3" },
    lanes: LANES, notes,
  };
}

function genGrow() {
  const notes = [];
  const B = (i) => i * 4;

  // A段 8小节: 轻柔 4音/小节
  for (const i of [0, 1, 2, 4, 6])
    notes.push(...bar(B(i), [[0, 0, 85], [1, 1, 88], [2, 0, 85], [3, 3, 82]]));
  for (const i of [3, 5, 7])
    notes.push(...bar(B(i), [[0, 0, 88], [1, 1, 90], [2, 0, 88], [3, 2, 85]]));

  // B段第一次 16小节: 稳定 5-6音/小节
  // 前8小节: S1八分+S3拍2+S1拍2.5+S2拍4 (6音)
  for (const i of [0, 1, 2, 3, 4, 5, 6, 7])
    notes.push(...bar(B(8 + i), [[0, 0, 95], [0.5, 0, 90], [1, 2, 98], [2, 0, 95], [2.5, 0, 90], [3, 1, 95]]));
  // 后7小节(除11): S1+S4+S1+S4 (5音)
  for (const i of [8, 9, 10, 12, 13, 14, 15])
    notes.push(...bar(B(8 + i), [[0, 0, 95], [0.5, 0, 90], [1, 3, 98], [2, 0, 95], [3, 3, 98]]));
  // 双押#1 bar 19
  notes.push(...bar(B(19), [[0, 0, 98], [0.5, 0, 93], [1, 3, 100], [2, [2, 1], 95]]));

  // B段第二次 16小节: 丰富 5-6音/小节
  for (const i of [0, 1, 2, 4, 6, 8, 9, 10, 12, 14])
    notes.push(...bar(B(24 + i), [[0, 0, 100], [0.5, 0, 95], [1, 3, 105], [1.5, 0, 95], [2, 2, 100], [3, 3, 105]]));
  for (const i of [5, 7, 13])
    notes.push(...bar(B(24 + i), [[0, 0, 100], [0.5, 0, 95], [1, 3, 105], [2, 0, 100], [2.5, 2, 98], [3, 1, 100]]));
  // 双押#2,#3 bar 27,35
  for (const i of [3, 11])
    notes.push(...bar(B(24 + i), [[0, 0, 100], [0.5, 0, 95], [1, 3, 105], [2, [2, 1], 100], [3, 3, 105]]));
  // bar 15: 标准
  notes.push(...bar(B(39), [[0, 0, 100], [0.5, 0, 95], [1, 3, 105], [1.5, 0, 95], [2, 2, 100], [3, 3, 105]]));

  // C段 8小节: 高潮->收束 5->5->5->4->3->2->1->0
  notes.push(...bar(B(40), [[0, 0, 105], [0.5, 0, 100], [1, 3, 108], [2, 2, 100], [3, 3, 108]]));
  // 双押#4 bar 41
  notes.push(...bar(B(41), [[0, 0, 105], [1, 3, 108], [2, [2, 1], 100], [3, 3, 108]]));
  notes.push(...bar(B(42), [[0, 0, 102], [0.5, 0, 98], [1, 3, 105], [2, 0, 102], [3, 2, 100]]));
  notes.push(...bar(B(43), [[0, 0, 100], [1, 3, 105], [2, 0, 100], [3, 2, 98]]));
  notes.push(...bar(B(44), [[0, 0, 95], [1, 3, 98], [2.5, 0, 92]]));
  notes.push(...bar(B(45), [[0, 0, 92], [2, 3, 95]]));
  notes.push(...bar(B(46), [[0, 0, 88]]));

  notes.sort((a, b) => a.beat - b.beat || a.lanes[0] - b.lanes[0]);
  return {
    format: "drumgame-chart/1",
    meta: { title: "生长吧", gear: 1, difficulty: "normal", bpm: 120, beatsPerBar: 4, stepsPerBar: 16, audioOffsetMs: 0, lengthBeats: 192, audioFile: "audio/grow.mp3" },
    lanes: LANES, notes,
  };
}

for(const id of ['babybaby','grow']){
  const path=resolve(OUT,id+'.json');
  if(existsSync(path)&&JSON.parse(readFileSync(path,'utf8')).meta.audioSha256)
    throw new Error('Recording-aligned chart protected. Use analyze-audio.py and build-aligned-chart.mjs.');
}
mkdirSync(OUT, { recursive: true });
const babybaby = genBabyBaby();
const grow = genGrow();
writeFileSync(resolve(OUT, "babybaby.json"), JSON.stringify(babybaby, null, 2) + "\n");
writeFileSync(resolve(OUT, "grow.json"), JSON.stringify(grow, null, 2) + "\n");

stats(babybaby, "宝贝宝贝 (1=C, 4/4, BPM=120, 57小节)", [
  ["前奏", 0, 6], ["主歌A", 6, 16], ["主歌B", 22, 8], ["副歌", 30, 12],
  ["结尾A(丰富)", 42, 4], ["结尾B(渐疏)", 46, 4], ["结尾C(收束)", 50, 7],
]);
stats(grow, "生长吧 (1=F, 4/4, BPM=120, 48小节)", [
  ["A段(引入)", 0, 8], ["B段一次(渐强)", 8, 16], ["B段二次(丰富)", 24, 16], ["C段(高潮->收束)", 40, 8],
]);
console.log("\nDone.");
