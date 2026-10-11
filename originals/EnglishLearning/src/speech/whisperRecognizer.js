/**
 * WhisperRecognizer — 本地/离线语音识别（替代被墙的 Web Speech API）。
 *
 * 思路：
 *   - 用 getUserMedia + MediaRecorder 在浏览器里采集麦克风音频（这一步和之前一样，已证明可用）；
 *   - 用 transformers.js 在浏览器内跑 Whisper（默认 Xenova/whisper-base），把音频转成文字；
 *   - 模型/运行库从「国内可访问的镜像」加载（jsdelivr + hf-mirror），不依赖 Google，免费、无需账号。
 *
 * 结果：麦克风照常用、识别文字照常回来，只是后端从 Google 换成了本地 Whisper。
 *
 * 性能：whisper-tiny 量化版在普通笔记本 CPU 上，单个单词/短句约 1~3 秒，首次会加载模型（几秒）。
 *   - whisper-base（标准版）：~74M，英文单词/短句够用、速度快；
 *   - whisper-small.en（高级版，仅英文）：~244M，英文准确率明显更高、对孤立单词幻觉更少，
 *     代价是首次加载与单次识别更慢。D 盘空间充足时推荐使用。
 */
import { debugLog } from "./debugLog.js";
import { prepareSpeech } from "./audioPrep.js";

const TRANSFORMERS_SPEC = "@huggingface/transformers"; // 由 index.html 的 importmap 指向 jsdelivr（已验证国内可达）
export const MODEL_ID = "whisper-base"; // 标准版（当前默认），对应 /models/whisper-base
export const ADVANCED_MODEL_ID = "whisper-small.en"; // 高级版（英文更准），对应 /models/whisper-small.en
const FALLBACK_MODEL_IDS = ["whisper-base", "whisper-tiny"]; // 主模型残缺/加载失败时依次降级，保证「本地」引擎始终可用
const LOCAL_MODEL_PATH = "/models"; // 由 server.mjs 同机托管，运行时零外网、无需翻墙
// 模型目录必须齐备的顶层文件（只校验 config.json 会漏掉"有权重没分词器"的残缺情况）
const REQUIRED_FILES = ["config.json", "tokenizer.json", "preprocessor_config.json"];

export class WhisperRecognizer {
  constructor({ modelId = MODEL_ID } = {}) {
    this.modelId = modelId;
    this._pipe = null;
    this._stream = null;
    this._rec = null;
    this._chunks = [];
    this._listening = false;
    this._activeSeq = 0; // 递增序列号，用于作废在途/已放弃的旧轮识别结果
    this._pending = false; // getUserMedia 在途（录音尚未真正开始）
    this._wantStop = false; // stop 在 pending 期间到达，录音开始后立即停
    this._stopCbs = null; // pending 期间到达的 stop 回调
  }

  /** 运行时切换模型（标准版 <-> 高级版），下次识别会用新模型重新加载。 */
  useModel(id) {
    this.modelId = id || MODEL_ID;
    this._pipe = null; // 强制下次重新加载新模型
    this._loadedModelId = null; // 标记已加载的模型失效，避免复用旧管道
    this._activeSeq++; // 作废在途/已开始的旧轮识别，避免串进新模型结果
    debugLog(`Whisper: 切换到模型 ${this.modelId}`);
  }

  get supported() {
    return (
      typeof window !== "undefined" &&
      !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) &&
      !!(window.AudioContext || window.webkitAudioContext) &&
      typeof MediaRecorder !== "undefined"
    );
  }

  get secureContext() {
    return typeof window === "undefined" ? true : window.isSecureContext !== false;
  }

  /**
   * 加载 transformers.js 与本地 Whisper 模型。
   * 模型文件来自 http://127.0.0.1:5175/models/<modelId>（运行脚本一次性下载好），
   * <modelId> 由当前引擎决定（whisper-base 标准版 / whisper-small.en 高级版等），
   * 因此运行时完全不访问外网，也不需要翻墙。
   */
  /** 逐个确认模型目录的关键文件都在，缺任何一个都视为该模型不可用。 */
  async _modelUsable(id) {
    for (const f of REQUIRED_FILES) {
      try {
        const r = await fetch(`${LOCAL_MODEL_PATH}/${id}/${f}`, { cache: "no-store" });
        if (!r.ok) {
          debugLog(`Whisper: ${id} 缺少 ${f}（HTTP ${r.status}）`, "warn");
          return false;
        }
      } catch (e) {
        debugLog(`Whisper: ${id} 校验 ${f} 失败 ${e?.message || e}`, "warn");
        return false;
      }
    }
    return true;
  }

  async _ensurePipeline() {
    // 只有「已加载的模型」与「当前要用的模型」一致时才复用缓存管道，
    // 否则（刚刚 useModel 切换/降级）必须重新加载，避免复用错模型的管道导致静默识别错误。
    if (this._pipe && this._loadedModelId === this.modelId) return this._pipe;
    this._pipe = null;
    this._loadedModelId = null;
    debugLog(`Whisper: 动态加载 transformers.js（经 importmap → jsdelivr）…`);
    const mod = await import(TRANSFORMERS_SPEC);
    const { pipeline, env } = mod;
    env.allowLocalModels = true;
    env.allowRemoteModels = false; // 只从本地 /models 读，运行时零外网
    env.localModelPath = LOCAL_MODEL_PATH;

    // 优先用当前选定的模型，不可用则按 base → tiny 顺序自动降级，
    // 保证「本地」引擎不会因单个模型残缺而整体失效。
    let lastErr = null;
    const order = [this.modelId, ...FALLBACK_MODEL_IDS];
    for (const id of new Set(order)) {
      if (!(await this._modelUsable(id))) {
        debugLog(`Whisper: ${id} 文件不完整，尝试下一个候选…`, "warn");
        lastErr = new Error("local-model-missing");
        continue;
      }
      try {
        debugLog(`Whisper: 加载本地模型 ${LOCAL_MODEL_PATH}/${id}（首次需几秒）…`);
        this._pipe = await pipeline("automatic-speech-recognition", id, {
          device: "wasm",
          dtype: "q8",
        });
        this._loadedModelId = id;
        debugLog(`Whisper: 模型就绪 ✅ (${id})`);
        return this._pipe;
      } catch (e) {
        lastErr = e;
        this._pipe = null;
        this._loadedModelId = null;
        debugLog(`Whisper: ${id} 加载失败 ${e?.message || e}，尝试降级…`, "warn");
      }
    }
    debugLog(
      `Whisper: 本地模型均不可用。请先运行：node scripts/fetch-whisper-model.mjs`,
      "error"
    );
    throw lastErr || new Error("local-model-missing");
  }

  /** 组装传给 pipeline 的识别参数。英文专用模型（id 以 .en 结尾）不接受 language/task。 */
  _recognizeOptions(lang) {
    // 用「实际加载的模型」判断，而非设定值 modelId：
    // 高级版若因文件残缺降级到多语种 whisper-base，应按多语种处理（强制英文）。
    const loadedId = this._loadedModelId || this.modelId;
    const opts = { return_timestamps: false };
    if (!loadedId.endsWith(".en")) {
      opts.language = (lang || "en-US").split("-")[0];
      opts.task = "transcribe";
    }
    return opts;
  }

  /** 开始采集麦克风音频（不立即识别）。返回是否已发起采集。 */
  start({ lang = "en-US", onStart, onError } = {}) {
    debugLog(`Whisper.start() lang=${lang}`);
    // 新会话开始，先清除上一轮可能残留的 pending-stop 请求，避免错配到本轮
    // （放在最前，连 supported/secureContext 早返回前也清，更稳妥）
    this._wantStop = false;
    this._stopCbs = null;
    if (!this.supported) {
      debugLog("Whisper: getUserMedia/MediaRecorder 不可用（非安全上下文或旧浏览器）", "error");
      onError?.("not-supported");
      return false;
    }
    if (!this.secureContext) {
      debugLog("Whisper: 非安全上下文（非 HTTPS/localhost），浏览器禁用了麦克风", "error");
      onError?.("not-secure-context");
      return false;
    }
    // 自恢复：若上一次录音因异常/切引擎没正常结束而残留 _listening，
    // 先复位再重新开（避免「切回本地就起不来」）。
    if (this._listening) {
      debugLog("Whisper: 检测到上次录音未正常结束，先复位再启动", "warn");
      this.abort();
    }
    const seq = ++this._activeSeq; // 本轮令牌；若被新一轮/abort 顶替，则作废本次采集
    this._pending = true;
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        // 已被新一轮 start/abort 顶替：丢弃本次麦克风，避免残留录音占用
        if (seq !== this._activeSeq) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        this._stream = stream;
        this._chunks = [];
        const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";
        this._rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
        this._rec.ondataavailable = (e) => {
          if (e.data && e.data.size) this._chunks.push(e.data);
        };
        this._listening = true;
        this._pending = false;
        this._rec.start();
        debugLog("✅ onaudiostart（麦克风音频开始采集 ✅ 这一步有=麦克风在工作）");
        onStart?.();
        // stop 在 getUserMedia 在途期间到达：现在录音已开始，立即停
        if (this._wantStop && this._stopCbs) {
          const cbs = this._stopCbs;
          this._wantStop = false;
          this._stopCbs = null;
          this.stop(cbs);
        }
      })
      .catch((e) => {
        this._pending = false;
        if (seq !== this._activeSeq) return;
        debugLog(`Whisper: getUserMedia 失败 ${e.name} ${e.message}`, "error");
        if (this._wantStop && this._stopCbs) {
          const c = this._stopCbs;
          this._wantStop = false;
          this._stopCbs = null;
          c.onEnd?.();
        } else {
          onError?.("not-allowed");
        }
      });
    return true;
  }

  /** 停止采集并把整段音频交给 Whisper 识别，结果经回调返回。 */
  stop({ lang = "en-US", onResult, onInterim, onError, onEnd } = {}) {
    // getUserMedia 还在路上（录音尚未真正开始）时到达的 stop：记下回调，待录音开始后立即停
    if (this._pending && !this._listening) {
      this._wantStop = true;
      this._stopCbs = { lang, onResult, onInterim, onError, onEnd };
      return;
    }
    if (!this._listening || !this._rec) {
      debugLog("Whisper.stop: 当前未在录音 → onEnd");
      onEnd?.();
      return;
    }
    this._listening = false;
    const rec = this._rec;
    const stream = this._stream;
    const chunks = this._chunks;
    const seq = ++this._activeSeq; // 本轮序列号；若中途被新一轮/abort 顶掉则作废

    const finish = (text) => {
      if (seq !== this._activeSeq) {
        debugLog("Whisper: 旧轮结果已作废（被新录音/放弃顶替），丢弃", "warn");
        return;
      }
      const transcript = String(text || "").trim();
      if (!transcript) {
        debugLog("Whisper: 无文本 → onEnd（可转打字）");
        onEnd?.();
      } else {
        debugLog(`→ 交付 onResult: '${transcript}'`);
        onResult?.({ transcript, confidence: 0.9 });
      }
      stream?.getTracks().forEach((t) => t.stop());
    };

    rec.onstop = async () => {
      try {
        const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
        debugLog(`Whisper: 录音 ${blob.size} 字节，解码 + 识别中…`);
        const audio = await this._blobTo16k(blob);
        const pipe = await this._ensurePipeline();
        debugLog("Whisper: 识别中…");
        const out = await pipe(audio, this._recognizeOptions(lang));
        finish(out && out.text ? out.text : "");
      } catch (e) {
        if (seq !== this._activeSeq) return; // 已被新轮顶替，丢弃陈旧错误
        debugLog(`Whisper: 识别失败 ${e?.message || e}`, "error");
        onError?.("whisper-failed");
        stream?.getTracks().forEach((t) => t.stop());
      }
    };
    try {
      rec.stop();
    } catch (e) {
      if (seq !== this._activeSeq) return;
      debugLog(`Whisper: rec.stop 异常 ${e?.message || e}`, "error");
      onError?.("whisper-failed");
      stream?.getTracks().forEach((t) => t.stop());
    }
  }

  /** 立即丢弃（模块卸载等），不识别。 */
  abort() {
    this._activeSeq++; // 让任何在途识别结果作废，避免串进下一轮会话
    this._pending = false;
    this._wantStop = false;
    this._stopCbs = null;
    if (this._rec && this._listening) {
      this._listening = false;
      try {
        this._rec.stop();
      } catch {}
    }
    this._stream?.getTracks().forEach((t) => t.stop());
  }

  async _blobTo16k(blob) {
    const buf = await blob.arrayBuffer();
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = new AC();
    const audioBuf = await ctx.decodeAudioData(buf);
    const sr = audioBuf.sampleRate;
    const data = audioBuf.getChannelData(0);
    const target = 16000;
    const ratio = sr / target;
    const len = Math.max(1, Math.round(data.length / ratio));
    const out = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      const idx = i * ratio;
      const i0 = Math.floor(idx);
      const i1 = Math.min(i0 + 1, data.length - 1);
      const f = idx - i0;
      out[i] = data[i0] * (1 - f) + data[i1] * f;
    }
    try {
      ctx.close();
    } catch {}
    // 去静音 + 归一化 + 补到最小时长：显著降低短语音的幻觉率
    return prepareSpeech(out, target);
  }
}
