/**
 * 一次性下载 Whisper 模型（Xenova/whisper-<size>[.en]）到本地，供浏览器离线加载。
 *
 * 为什么需要它：
 *   - 浏览器端 transformers.js 默认从 HuggingFace Hub 拉模型，而 HF 在国内常不通（需翻墙）；
 *   - 本脚本在 Node 侧用「国内可达的镜像」（hf-mirror 优先，ModelScope 兜底）下载，
 *     不涉及浏览器 CORS，也不要求你翻墙；
 *   - 下载后浏览器从 http://127.0.0.1:5175/models/... 直接读，运行时零外网。
 *
 * 用法：  node scripts/fetch-whisper-model.mjs [模型名]
 *   例：  node scripts/fetch-whisper-model.mjs            # 默认 whisper-base（当前标准版）
 *         node scripts/fetch-whisper-model.mjs whisper-small.en   # 高级版（英文更准）
 *         node scripts/fetch-whisper-model.mjs whisper-medium.en  # 更高级（更慢）
 * 输出：  <项目根>/models/<模型>/ 下的配置/tokenizer + 必要的 onnx 权重
 */
import { writeFile, mkdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPO = process.argv[2] || "whisper-base"; // 如 whisper-base / whisper-small.en
const MODEL_DIR = join(ROOT, "models", REPO);
const OWNER = "Xenova";
const BRANCH = "main";

// 镜像：hf-mirror 优先（已验证可达），ModelScope 兜底。均为国内站点，无需翻墙。
// 只下载 transformers.js 实际需要的文件，跳过 onnx/ 下几十个冗余变体（可达数 GB）：
//   - 顶层配置/分词器文件（config.json、tokenizer.json、vocab.json 等）全部保留；
//   - onnx/ 下只保留 2 个量化权重（dtype: "q8" 所需）。
const NEEDED_ONNX = [
  "onnx/encoder_model_quantized.onnx",
  "onnx/decoder_model_merged_quantized.onnx",
];
const isNeeded = (p) => !p.startsWith("onnx/") || NEEDED_ONNX.includes(p);

const MIRRORS = [
  {
    name: "hf-mirror",
    listUrl: `https://hf-mirror.com/api/models/${OWNER}/${REPO}/tree/${BRANCH}?recursive=true`,
    fileUrl: (p) => `https://hf-mirror.com/${OWNER}/${REPO}/resolve/${BRANCH}/${p}`,
    parse: (json) => (json || []).filter((f) => f.type === "file").map((f) => f.path),
  },
  {
    name: "ModelScope",
    listUrl: `https://modelscope.cn/api/v1/models/${OWNER}/${REPO}/repo/files?Recursive=true&Revision=master`,
    fileUrl: (p) =>
      `https://modelscope.cn/api/v1/models/${OWNER}/${REPO}/repo?Revision=master&FilePath=${encodeURIComponent(p)}`,
    parse: (json) => {
      const d = json && json.Data != null ? json.Data : json;
      const arr = Array.isArray(d)
        ? d
        : d && Array.isArray(d.Files)
        ? d.Files
        : d && Array.isArray(d.files)
        ? d.files
        : [];
      return arr
        .filter((f) => f && (f.Type === "file" || f.type === "file"))
        .map((f) => f.Path || f.path);
    },
  },
];

async function getFileList(mirror) {
  const res = await fetch(mirror.listUrl, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const files = mirror.parse(json);
  if (!files.length) throw new Error("文件列表为空");
  return files;
}

async function main() {
  await mkdir(MODEL_DIR, { recursive: true });
  let files = null;
  let used = null;
  for (const m of MIRRORS) {
    try {
      console.log(`[fetch] 用 ${m.name} 获取 ${REPO} 文件列表…`);
      files = await getFileList(m);
      used = m;
      break;
    } catch (e) {
      console.warn(`[fetch] ${m.name} 失败：${e.message}`);
    }
  }
  if (!files) {
    console.error(
      `❌ 两个镜像都拿不到 ${REPO} 的文件列表。请确认网络能访问 modelscope.cn 或 hf-mirror.com（均为国内站点，无需翻墙）。`
    );
    process.exit(1);
  }
  // 只保留 transformers.js 实际需要的文件：顶层配置/分词器 + 2 个量化权重（其余 onnx 变体动辄数 GB，无需下载）
  files = files.filter((f) => isNeeded(f));
  if (!files.length) {
    console.error("❌ 没有可下载的文件，请检查仓库结构。");
    process.exit(1);
  }
  console.log(`[fetch] 从 ${used.name} 下载 ${files.length} 个文件到 ${MODEL_DIR}（模型：${REPO}）`);
  let ok = 0;
  let skip = 0;
  for (const f of files) {
    const dest = join(MODEL_DIR, f);
    if (existsSync(dest)) {
      const s = await stat(dest);
      if (s.size > 0) {
        skip++;
        continue;
      }
    }
    const url = used.fileUrl(f);
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(120000) });
      if (!res.ok) {
        console.warn(`  跳过 ${f}: HTTP ${res.status}`);
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      await mkdir(dirname(dest), { recursive: true });
      await writeFile(dest, buf);
      ok++;
      console.log(`  ✅ ${f} (${(buf.length / 1024 / 1024).toFixed(2)} MB)`);
    } catch (e) {
      console.warn(`  跳过 ${f}: ${e.message}`);
    }
  }
  console.log(
    `\n✅ 完成：新增 ${ok} 个，已存在 ${skip} 个，共 ${files.length} 个文件。\n` +
      `   浏览器现在从 http://127.0.0.1:5175/models/${REPO}/ 离线加载，无需翻墙。`
  );
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
