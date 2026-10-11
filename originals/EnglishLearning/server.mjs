/**
 * Tiny zero-dependency static file server for the EnglishLearning app.
 *
 * Why zero-dep: the project must run without `npm install` (no network, no
 * node_modules on C:). Node >= 18 ships everything we need in its stdlib.
 *
 * Web Serial and Web Speech APIs require a secure context, which includes
 * http://localhost. So we serve over 127.0.0.1 and open that URL.
 *
 * Run:  node server.mjs            (defaults to 127.0.0.1:5175)
 *       PORT=8080 node server.mjs
 */
import { createServer as createHttp } from "node:http";
import { createServer as createHttps } from "node:https";
import { readFile, stat } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)));
const PORT = Number(process.env.PORT) || 5175;
const HOST = process.env.HOST || "127.0.0.1";

/* ----------------------------------------------------------------------------
 * 百度智能云语音代理（可选）
 * 仅在 server 同目录的 .env 配置了 BAIDU_API_KEY / BAIDU_SECRET_KEY 时启用。
 * 密钥只存在于服务端；浏览器通过 /api/baidu/* 间接调用，密钥绝不暴露给前端。
 * -------------------------------------------------------------------------- */
loadDotEnv();
const BAIDU_API_KEY = process.env.BAIDU_API_KEY || "";
const BAIDU_SECRET_KEY = process.env.BAIDU_SECRET_KEY || "";
// 百度「语音翻译」(MT/speech_trans) 是机器翻译产品线下的独立应用，
// 与「语音技术」(ASR/TTS) 的 AK/SK 通常是两套。这里允许单独配一套翻译密钥；
// 没配则回退到语音密钥（但那样大概率报 5203/6 无权限，需翻译应用自己的密钥）。
const BAIDU_TRANSLATE_API_KEY = process.env.BAIDU_TRANSLATE_API_KEY || "";
const BAIDU_TRANSLATE_SECRET_KEY = process.env.BAIDU_TRANSLATE_SECRET_KEY || "";
// 旧的「通用翻译 appid」兼容保留（若你用的是 fanyi-api 通用翻译而非语音翻译）
const BAIDU_TRANSLATE_APPID = process.env.BAIDU_TRANSLATE_APPID || "";
const BAIDU_TRANSLATE_KEY = process.env.BAIDU_TRANSLATE_KEY || "";
const _baiduTokens = new Map(); // ak -> { token, exp }（不同应用各自缓存）
const JSON_HEAD = { "Content-Type": "application/json; charset=utf-8" };

function loadDotEnv() {
  try {
    const txt = readFileSync(join(ROOT, ".env"), "utf8");
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (m && !(m[1] in process.env)) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    /* 没有 .env 文件也没关系，密钥也可以直接来自 shell 环境变量 */
  }
}

async function getBaiduToken(ak = BAIDU_API_KEY, sk = BAIDU_SECRET_KEY) {
  if (!ak || !sk) throw new Error("baidu-not-configured");
  const cached = _baiduTokens.get(ak);
  if (cached && cached.token && Date.now() < cached.exp) return cached.token;
  const url =
    "https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials" +
    `&client_id=${encodeURIComponent(ak)}&client_secret=${encodeURIComponent(sk)}`;
  const r = await fetch(url, { method: "POST" });
  const j = await r.json();
  if (!j.access_token) throw new Error(j.error_description || "baidu-token-failed");
  const entry = {
    token: j.access_token,
    exp: Date.now() + Math.max(0, (j.expires_in || 0) - 300) * 1000,
  };
  _baiduTokens.set(ak, entry);
  return j.access_token;
}

async function readBody(req, maxBytes = 16 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > maxBytes) {
        reject(new Error("body-too-large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}
async function readJson(req, maxBytes) {
  const buf = await readBody(req, maxBytes);
  return JSON.parse(buf.toString("utf8"));
}

async function handleConfig(_req, res) {
  res
    .writeHead(200, JSON_HEAD)
    .end(JSON.stringify({ baiduConfigured: !!(BAIDU_API_KEY && BAIDU_SECRET_KEY) }));
}

async function handleBaiduAsr(req, res) {
  if (!BAIDU_API_KEY || !BAIDU_SECRET_KEY) {
    res.writeHead(500, JSON_HEAD).end(JSON.stringify({ error: "baidu-not-configured" }));
    return;
  }
  let body;
  try {
    body = await readJson(req);
  } catch {
    res.writeHead(400, JSON_HEAD).end(JSON.stringify({ error: "bad-json" }));
    return;
  }
  const { audioBase64, rate = 16000, dev_pid = 1737 } = body;
  if (!audioBase64) {
    res.writeHead(400, JSON_HEAD).end(JSON.stringify({ error: "missing-audio" }));
    return;
  }
  try {
    const token = await getBaiduToken();
    const payload = {
      format: "pcm",
      rate: Number(rate) || 16000,
      channel: 1,
      speech: audioBase64,
      len: Buffer.from(audioBase64, "base64").length,
      cuid: "english-learning-app",
      token,
      dev_pid: Number(dev_pid) || 1737,
    };
    const r = await fetch("http://vop.baidu.com/server_api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const j = await r.json();
    if (j && j.err_no === 0) {
      res
        .writeHead(200, JSON_HEAD)
        .end(JSON.stringify({ text: Array.isArray(j.result) ? j.result.join("") : "" }));
    } else {
      res
        .writeHead(502, JSON_HEAD)
        .end(JSON.stringify({ error: "baidu-asr-failed", err_no: j?.err_no, err_msg: j?.err_msg }));
    }
  } catch (e) {
    res.writeHead(502, JSON_HEAD).end(JSON.stringify({ error: String(e?.message || e) }));
  }
}

async function handleBaiduTts(req, res) {
  if (!BAIDU_API_KEY || !BAIDU_SECRET_KEY) {
    res.writeHead(500, JSON_HEAD).end(JSON.stringify({ error: "baidu-not-configured" }));
    return;
  }
  let body;
  try {
    body = await readJson(req);
  } catch {
    res.writeHead(400, JSON_HEAD).end(JSON.stringify({ error: "bad-json" }));
    return;
  }
  const { tex, per = 0, spd = 5, pit = 5, vol = 9, aue = 3 } = body;
  if (!tex) {
    res.writeHead(400, JSON_HEAD).end(JSON.stringify({ error: "missing-text" }));
    return;
  }
  try {
    const token = await getBaiduToken();
    const form = new URLSearchParams();
    form.set("tok", token);
    form.set("per", String(per));
    form.set("spd", String(spd));
    form.set("pit", String(pit));
    form.set("vol", String(vol));
    form.set("aue", String(aue));
    form.set("lan", "zh");
    form.set("ctp", "1");
    form.set("cuid", "english-learning-app");
    // 百度要求 tex 做两次 urlencode（网关会先解一次）
    const bodyStr = form.toString() + "&tex=" + encodeURIComponent(encodeURIComponent(tex));
    const r = await fetch("https://tsn.baidu.com/text2audio", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: bodyStr,
    });
    const ct = r.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const j = await r.json();
      res.writeHead(502, JSON_HEAD).end(JSON.stringify({ error: "baidu-tts-failed", ...j }));
      return;
    }
    const buf = Buffer.from(await r.arrayBuffer());
    const outType = aue === 6 ? "audio/wav" : aue === 4 || aue === 5 ? "audio/basic" : "audio/mp3";
    res.writeHead(200, {
      "Content-Type": outType,
      "Content-Length": buf.length,
      "Cache-Control": "no-store",
    });
    res.end(buf);
  } catch (e) {
    res.writeHead(502, JSON_HEAD).end(JSON.stringify({ error: String(e?.message || e) }));
  }
}

async function handleBaiduTranslate(req, res) {
  let body;
  try {
    body = await readJson(req);
  } catch {
    res.writeHead(400, JSON_HEAD).end(JSON.stringify({ error: "bad-json" }));
    return;
  }
  let q = (body.q || "").toString().trim();
  if (!q) {
    res.writeHead(400, JSON_HEAD).end(JSON.stringify({ error: "missing-q" }));
    return;
  }
  // 避免过长语音/识别错乱导致翻译异常，服务端把 q 截断到 100 字符
  const MAX_Q = 100;
  if (q.length > MAX_Q) q = q.slice(0, MAX_Q).replace(/\s+\S*$/, "") + "…";
  // 自动识别方向：含中文 -> 中译英，否则 -> 英译中
  const hasZh = /[一-鿿]/.test(q);
  const from = body.from || (hasZh ? "zh" : "en");
  const to = body.to || (from === "zh" ? "en" : "zh");
  try {
    const r = await translateText(q, from, to);
    res.writeHead(200, JSON_HEAD).end(JSON.stringify(r));
  } catch (e) {
    res.writeHead(502, JSON_HEAD).end(JSON.stringify({ error: String(e?.message || e) }));
  }
}

function capDst(dst, max = 300) {
  const s = String(dst || "").trim();
  if (s.length <= max) return s;
  return s.slice(0, max).replace(/\s+\S*$/, "") + "…";
}

async function translateText(q, from, to) {
  // 1) 优先百度「文本翻译」(aip.baidubce.com/rpc/2.0/mt/texttrans/v1)，用独立翻译 AK/SK
  const tAk = BAIDU_TRANSLATE_API_KEY || "";
  const tSk = BAIDU_TRANSLATE_SECRET_KEY || "";
  if (tAk && tSk) {
    try {
      const token = await getBaiduToken(tAk, tSk);
      const r = await fetch(
        "https://aip.baidubce.com/rpc/2.0/mt/texttrans/v1?access_token=" + token,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ from, to, q }),
        }
      );
      const j = await r.json();
      const dst = j?.result?.trans_result?.[0]?.dst;
      if (dst) {
        return {
          from: j.result.from || from,
          to: j.result.to || to,
          src: j.result.trans_result[0].src || q,
          dst: capDst(dst),
          engine: "baidu",
        };
      }
      if (j?.error_code) throw new Error("baidu:" + j.error_code + " " + j.error_msg);
      throw new Error("baidu-empty");
    } catch (e) {
      console.error("百度文本翻译失败，转 MyMemory 兜底:", e.message);
    }
  }
  // 2) 兜底：MyMemory（免密钥；免费额度有限，超量会报错）
  const lp = from + "|" + to;
  const r2 = await fetch(
    "https://api.mymemory.translated.net/get?q=" +
      encodeURIComponent(q) +
      "&langpair=" +
      encodeURIComponent(lp)
  );
  const j2 = await r2.json();
  if (j2 && j2.responseData && j2.responseData.translatedText) {
    return { from, to, src: q, dst: capDst(j2.responseData.translatedText), engine: "mymemory" };
  }
  throw new Error(j2?.responseDetails || "translate-failed");
}

async function handleBaiduSpeechTranslate(req, res) {
  if (!BAIDU_API_KEY || !BAIDU_SECRET_KEY) {
    res.writeHead(500, JSON_HEAD).end(JSON.stringify({ error: "baidu-not-configured" }));
    return;
  }
  let body;
  try {
    body = await readJson(req);
  } catch {
    res.writeHead(400, JSON_HEAD).end(JSON.stringify({ error: "bad-json" }));
    return;
  }
  const { voice, from = "zh", to = "en", format = "pcm" } = body;
  if (!voice) {
    res.writeHead(400, JSON_HEAD).end(JSON.stringify({ error: "missing-voice" }));
    return;
  }
  try {
    const tAk = BAIDU_TRANSLATE_API_KEY || BAIDU_API_KEY;
    const tSk = BAIDU_TRANSLATE_SECRET_KEY || BAIDU_SECRET_KEY;
    const token = await getBaiduToken(tAk, tSk);
    const r = await fetch(
      "https://aip.baidubce.com/rpc/2.0/mt/v2/speech-translation?access_token=" + token,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to, format, voice }),
      }
    );
    const j = await r.json();
    if (j && j.result && j.result.target) {
      res.writeHead(200, JSON_HEAD).end(
        JSON.stringify({
          source: j.result.source || "",
          target: j.result.target || "",
          target_tts: j.result.target_tts || "",
          engine: "baidu-speech-translate",
        })
      );
    } else {
      res
        .writeHead(502, JSON_HEAD)
        .end(
          JSON.stringify({
            error: "baidu-translate-failed",
            error_code: j?.error_code,
            error_msg: j?.error_msg,
          })
        );
    }
  } catch (e) {
    res.writeHead(502, JSON_HEAD).end(JSON.stringify({ error: String(e?.message || e) }));
  }
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".map": "application/json",
};

/**
 * True only when `filePath` is exactly `root` or lives inside it. The `sep`
 * suffix prevents a sibling directory whose name is a prefix of `root`
 * (e.g. ".../EnglishLearningX") from being mistaken for `root` itself.
 * Exported so tests can regression-check path-traversal protection.
 * @param {string} root
 * @param {string} filePath
 */
export function isInsideRoot(root, filePath) {
  return filePath === root || filePath.startsWith(root + sep);
}

const USE_HTTPS = process.env.HTTPS === "1";
let serverOptions = {};
if (USE_HTTPS) {
  try {
    serverOptions = {
      key: readFileSync(join(ROOT, "server.key.pem")),
      cert: readFileSync(join(ROOT, "server.cert.pem")),
    };
  } catch {
    console.error(
      "HTTPS=1 但找不到 server.key.pem / server.cert.pem。\n" +
        "请先生成自签名证书，例如：\n" +
        "  openssl req -x509 -newkey rsa:2048 -nodes -keyout server.key.pem -out server.cert.pem -days 365 -subj '/CN=localhost'\n" +
        "（或运行： node make-cert.mjs ）"
    );
    process.exit(1);
  }
}

const makeServer = USE_HTTPS ? createHttps : createHttp;
const server = makeServer(serverOptions, async (req, res) => {
  try {
    const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);

    // ---- API 路由（百度云语音代理等），优先于静态文件处理 ----
    if (urlPath.startsWith("/api/")) {
      if (req.method === "GET" && urlPath === "/api/config") return void handleConfig(req, res);
      if (req.method === "POST" && urlPath === "/api/baidu/asr") return void handleBaiduAsr(req, res);
      if (req.method === "POST" && urlPath === "/api/baidu/tts") return void handleBaiduTts(req, res);
      if (req.method === "POST" && urlPath === "/api/baidu/speech-translate") return void handleBaiduSpeechTranslate(req, res);
      if (req.method === "POST" && urlPath === "/api/baidu/translate") return void handleBaiduTranslate(req, res);
      res.writeHead(404, JSON_HEAD).end(JSON.stringify({ error: "not-found" }));
      return;
    }

    let filePath = normalize(join(ROOT, urlPath));
    if (!isInsideRoot(ROOT, filePath)) {
      res.writeHead(403).end("Forbidden");
      return;
    }
    if (urlPath === "/" || urlPath === "") filePath = join(ROOT, "index.html");

    let info;
    try {
      info = await stat(filePath);
    } catch {
      // SPA-ish fallback: unknown non-asset paths go to index.html
      if (!extname(filePath)) filePath = join(ROOT, "index.html");
    }
    const data = await readFile(filePath);
    const type = MIME[extname(filePath)] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-cache" });
    res.end(data);
  } catch (err) {
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Server error: " + (err && err.message ? err.message : String(err)));
  }
});

// Only start listening when run directly (`node server.mjs`). When imported by the
// test suite (e.g. to unit-test isInsideRoot), we must NOT open a port or keep the
// event loop alive, otherwise `node --test` would hang.
const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  server.listen(PORT, HOST, () => {
    const proto = USE_HTTPS ? "https" : "http";
    console.log(`EnglishLearning running at  ${proto}://${HOST}:${PORT}/`);
    if (USE_HTTPS)
      console.log("提示：浏览器会警告自签名证书，点“高级”→“继续访问”即可。");
    console.log("Press Ctrl+C to stop.");
  });
}
