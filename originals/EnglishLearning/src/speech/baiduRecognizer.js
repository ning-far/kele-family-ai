/**
 * BaiduRecognizer — 通过本地 server.mjs 代理调用百度智能云「短语音识别标准版」。
 *
 * 接口与 WhisperRecognizer 对齐（supported / secureContext / start / stop / abort），
 * 因此 Recorder 可以无缝在「本地 Whisper」与「百度云」之间切换。
 *
 * 流程：浏览器采集麦克风 → 解码成 16k 单声道 PCM → base64 → POST /api/baidu/asr
 *       → server 端用密钥换 token 并调百度 → 返回文字。密钥只在服务端，浏览器永不见。
 *
 * 英文用 dev_pid=1737（英文模型，无标点）；中文用 1537。
 */
import { debugLog } from "./debugLog.js";
import { prepareSpeech } from "./audioPrep.js";

export class BaiduRecognizer {
  constructor({ lang = "en-US" } = {}) {
    this._lang = lang;
    this._stream = null;
    this._rec = null;
    this._chunks = [];
    this._listening = false;
    this._activeSeq = 0; // 递增序列号，用于作废在途/已放弃的旧轮识别结果
    this._pending = false; // getUserMedia 在途（录音尚未真正开始）
    this._wantStop = false; // stop 在 pending 期间到达，录音开始后立即停
    this._stopCbs = null; // pending 期间到达的 stop 回调
  }

  get supported() {
    return (
      typeof window !== "undefined" &&
      !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) &&
      typeof MediaRecorder !== "undefined"
    );
  }

  get secureContext() {
    return typeof window === "undefined" ? true : window.isSecureContext !== false;
  }

  _devPid(lang) {
    return lang && lang.toLowerCase().startsWith("en") ? 1737 : 1537;
  }

  start({ lang = this._lang, onStart, onError } = {}) {
    // 新会话开始，先清除上一轮可能残留的 pending-stop 请求，避免错配到本轮
    // （放在最前，连 supported/secureContext 早返回前也清，更稳妥）
    this._wantStop = false;
    this._stopCbs = null;
    if (!this.supported) {
      debugLog("Baidu: getUserMedia/MediaRecorder 不可用", "error");
      onError?.("not-supported");
      return false;
    }
    if (!this.secureContext) {
      debugLog("Baidu: 非安全上下文，浏览器禁用了麦克风", "error");
      onError?.("not-secure-context");
      return false;
    }
    // 自恢复：若上一次录音因「stop 早于 getUserMedia 返回」等竞态残留 _listening，
    // 先复位再重新开，避免「按下完全没反应 / start 一直返回 false」的冻死。
    if (this._listening) {
      debugLog("Baidu: 检测到上次录音未正常结束，先复位再启动", "warn");
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
        this._rec.start();
        this._listening = true;
        this._pending = false;
        debugLog("✅ Baidu: 麦克风音频开始采集");
        onStart?.();
        // stop 在 getUserMedia 在途期间到达：现在录音已开始，立即停
        if (this._wantStop && this._stopCbs) {
          const cbs = this._stopCbs;
          this._wantStop = false;
          this._stopCbs = null;
          this.stop(cbs);
        }
      })
      .catch(() => {
        this._pending = false;
        if (seq !== this._activeSeq) return;
        debugLog("Baidu: getUserMedia 失败", "error");
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

  stop({ lang = this._lang, onResult, onInterim, onError, onEnd } = {}) {
    // getUserMedia 还在路上（录音尚未真正开始）时到达的 stop：
    // 记下回调，待录音真正开始后立即停（见 start 的 .then）。
    if (this._pending && !this._listening) {
      this._wantStop = true;
      this._stopCbs = { lang, onResult, onInterim, onError, onEnd };
      return;
    }
    if (!this._listening || !this._rec) {
      debugLog("Baidu.stop: 当前未在录音 → onEnd");
      onEnd?.();
      return;
    }
    this._listening = false;
    const rec = this._rec;
    const stream = this._stream;
    const chunks = this._chunks;
    const dev_pid = this._devPid(lang);
    const seq = ++this._activeSeq; // 本轮序列号；若中途被新一轮/abort 顶掉则作废

    const finish = (text) => {
      if (seq !== this._activeSeq) {
        debugLog("Baidu: 旧轮结果已作废（被新录音/放弃顶替），丢弃", "warn");
        return;
      }
      const transcript = String(text || "").trim();
      if (!transcript) {
        debugLog("Baidu: 无文本 → onEnd");
        onEnd?.();
      } else {
        debugLog(`→ 交付 onResult: '${transcript}'`);
        onResult?.({ transcript, confidence: 0.95 });
      }
      stream?.getTracks().forEach((t) => t.stop());
    };

    rec.onstop = async () => {
      try {
        const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
        debugLog(`Baidu: 录音 ${blob.size} 字节，解码为 16k PCM…`);
        const pcm = await this._blobTo16kPcm(blob);
        const b64 = this._bytesToBase64(
          new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength)
        );
        debugLog("Baidu: 上传到本地代理 /api/baidu/asr …");
        // 百度云偶尔会在连续调用时报错（如 3302/3307），重试一次可显著降低失败率。
        const tryRecognize = async (attempt = 1) => {
          const resp = await fetch("/api/baidu/asr", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ audioBase64: b64, rate: 16000, dev_pid }),
          });
          const j = await resp.json();
          if (!resp.ok || j.error) {
            const info =
              j.err_no != null
                ? `err_no=${j.err_no} ${j.err_msg || ""}`
                : j.error || `http ${resp.status}`;
            if (attempt < 2) {
              debugLog(`Baidu: 识别失败(${info})，1秒后重试…`, "warn");
              await new Promise((r) => setTimeout(r, 1000));
              return tryRecognize(attempt + 1);
            }
            throw new Error(info);
          }
          return j.text;
        };
        const text = await tryRecognize();
        finish(text);
      } catch (e) {
        if (seq !== this._activeSeq) return; // 已被新轮顶替，丢弃陈旧错误
        debugLog(`Baidu: 识别失败 ${e?.message || e}`, "error");
        onError?.("baidu-failed");
        stream?.getTracks().forEach((t) => t.stop());
      }
    };
    try {
      rec.stop();
    } catch (e) {
      if (seq !== this._activeSeq) return;
      debugLog(`Baidu: rec.stop 异常 ${e?.message || e}`, "error");
      onError?.("baidu-failed");
      stream?.getTracks().forEach((t) => t.stop());
    }
  }

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

  async _blobTo16kPcm(blob) {
    const buf = await blob.arrayBuffer();
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = new AC();
    const audioBuf = await ctx.decodeAudioData(buf);
    const data = audioBuf.getChannelData(0);
    const sr = audioBuf.sampleRate;
    const target = 16000;
    const ratio = sr / target;
    const len = Math.max(1, Math.round(data.length / ratio));
    const f32 = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      const idx = i * ratio;
      const i0 = Math.floor(idx);
      const i1 = Math.min(i0 + 1, data.length - 1);
      const f = idx - i0;
      const s = data[i0] * (1 - f) + data[i1] * f;
      f32[i] = s > 1 ? 1 : s < -1 ? -1 : s;
    }
    try {
      ctx.close();
    } catch {}
    // 去静音 + 归一 + 补到最小时长：云端英文模型对过小/过短音频极易"脑补"成别的词
    const prepped = prepareSpeech(f32, target);
    const out = new Int16Array(prepped.length);
    for (let i = 0; i < prepped.length; i++) {
      const s = Math.max(-1, Math.min(1, prepped[i]));
      out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return out;
  }

  _bytesToBase64(bytes) {
    let bin = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(bin);
  }

  /**
   * 语音翻译：把刚录的音频直接发给百度「语音翻译」接口，
   * 一次拿到 {source(源文), target(译文), target_tts(译文朗读 mp3 base64)}。
   * 与 stop() 类似，但目标接口是 speech-translation 而非 ASR。
   */
  speechTranslate({ from = "zh", to = "en", onResult, onError, onEnd } = {}) {
    if (!this._listening || !this._rec) {
      debugLog("Baidu.speechTranslate: 当前未在录音 → onEnd");
      onEnd?.();
      return;
    }
    this._listening = false;
    const rec = this._rec;
    const stream = this._stream;
    const chunks = this._chunks;
    rec.onstop = async () => {
      try {
        const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
        debugLog(`Baidu: 录音 ${blob.size} 字节，解码为 16k PCM 后送语音翻译…`);
        const pcm = await this._blobTo16kPcm(blob);
        const b64 = this._bytesToBase64(
          new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength)
        );
        const resp = await fetch("/api/baidu/speech-translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ voice: b64, from, to, format: "pcm" }),
        });
        const j = await resp.json();
        if (!resp.ok || j.error) throw new Error(j.error || "http " + resp.status);
        const target = (j.target || "").trim();
        if (!target) {
          debugLog("Baidu: 语音翻译无结果 → onEnd");
          onEnd?.();
        } else {
          debugLog(`Baidu: 语音翻译 → source='${j.source}' target='${target}'`);
          onResult?.({ source: j.source || "", target, target_tts: j.target_tts || "" });
        }
        stream?.getTracks().forEach((t) => t.stop());
      } catch (e) {
        debugLog(`Baidu: 语音翻译失败 ${e?.message || e}`, "error");
        onError?.("baidu-translate-failed");
        stream?.getTracks().forEach((t) => t.stop());
      }
    };
    try {
      rec.stop();
    } catch (e) {
      debugLog(`Baidu: rec.stop 异常 ${e?.message || e}`, "error");
      onError?.("baidu-translate-failed");
      stream?.getTracks().forEach((t) => t.stop());
    }
  }
}
