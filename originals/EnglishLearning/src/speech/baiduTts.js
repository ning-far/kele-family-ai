/**
 * BaiduTTS — 通过本地 server.mjs 代理调用百度「短文本在线合成（TTS）」。
 * 接口与 src/speech/tts.js (TTS) 对齐：speak(text, opts) / cancel()。
 *
 * 注意：百度 TTS 的 lan 固定为 zh，只能「中英文混合」发音——
 * 英文单词会用中文腔读出来。若你在意纯正美音，可在引擎开关切回「本地」。
 * 另外，万一百度未配置或调用失败，会自动回退到浏览器内置 speechSynthesis。
 */
import { debugLog } from "./debugLog.js";

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export class BaiduTTS {
  constructor({ per = 0, spd = 5, pit = 5, vol = 9, aue = 3 } = {}) {
    this.per = per;
    this.spd = spd;
    this.pit = pit;
    this.vol = vol;
    this.aue = aue;
    this.supported = typeof window !== "undefined";
    this._audio = null;
    this._context = null;
    this._source = null;
    this._generation = 0;
    // Unlock while a real gesture is active, before the asynchronous cloud request.
    if (this.supported) {
      const unlock = () => {
        try {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          if (!AudioContext) return;
          this._context ||= new AudioContext();
          this._context.resume().catch(() => {});
          const source = this._context.createBufferSource();
          source.buffer = this._context.createBuffer(1, 1, 22050);
          source.connect(this._context.destination);
          source.start();
        } catch {}
      };
      document.addEventListener('pointerdown', unlock, { capture: true });
      document.addEventListener('keydown', unlock, { capture: true });
    }
  }

  /** 揭示正确答案时换一个百度发音人（per），与常规提示音区分。 */
  answerPer() {
    return this.per === 1 ? 4 : 1;
  }

  async speak(text, { lang = "en-US", rate, pitch, kind = "prompt", onEnd } = {}) {
    if (!text) {
      onEnd?.();
      return Promise.resolve(false);
    }
    // Welcome narration is retried by the Start button. Do not make a paid
    // request or display a failure toast before the first user interaction.
    if (typeof navigator !== 'undefined' && navigator.userActivation && !navigator.userActivation.hasBeenActive) {
      onEnd?.();
      return false;
    }
    const isAnswer = kind === "answer";
    // 答案音默认降档（更慢更低），与提问音拉开距离；显式传值仍优先
    const spd = clamp(Math.round(rate != null ? rate * 5 : isAnswer ? 4 : this.spd), 0, 15);
    const pit = clamp(Math.round(pitch != null ? pitch * 5 : isAnswer ? 4 : this.pit), 0, 15);
    this.cancel();
    const generation = this._generation;
    try {
      // 先停掉上一段：否则答案音会和下一题的提问音同时出声（用户反馈的"连在一起"）
      const resp = await fetch("/api/baidu/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tex: text,
          per: isAnswer ? this.answerPer() : this.per,
          spd,
          pit,
          vol: this.vol,
          aue: this.aue,
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}));
        throw new Error(j.error || "http " + resp.status);
      }
      const blob = await resp.blob();
      if (generation !== this._generation) return false;
      if (this._context?.state === 'running') {
        const buffer = await this._context.decodeAudioData(await blob.arrayBuffer());
        if (generation !== this._generation) return false;
        return await new Promise(resolve => {
          const source = this._context.createBufferSource();
          source.buffer = buffer;
          source.connect(this._context.destination);
          this._source = source;
          source.onended = () => {
            if (this._source === source) this._source = null;
            onEnd?.();
            resolve(generation === this._generation);
          };
          source.start();
          document.querySelector('[data-audio-retry]')?.remove();
        });
      }
      const url = URL.createObjectURL(blob);
      const played = await new Promise((resolve) => {
        const audio = new Audio(url);
        this._audio = audio;
        let settled = false;
        const done = (ok) => {
          // 同一段音频只结算一次；且只有当它仍是"当前音频"时才清空引用，
          // 避免旧音频的回调把新音频的 url revoke 掉并提前 resolve。
          if (settled) return;
          settled = true;
          URL.revokeObjectURL(url);
          if (this._audio === audio) this._audio = null;
          resolve(ok);
        };
        audio.onended = () => done(true);
        audio.onerror = () => done(false);
        audio.play().catch(() => done(false));
      });
      if (!played) throw new Error('浏览器未允许音频播放');
      document.querySelector('[data-audio-retry]')?.remove();
      onEnd?.();
      return true;
    } catch (e) {
      if (generation !== this._generation) return false;
      debugLog("BaiduTTS 失败，回退浏览器 TTS：" + (e?.message || e), "warn");
      const ok = await fallbackBrowserTTS(text, { lang, rate, pitch, kind, onEnd });
      if (!ok && generation === this._generation) {
        document.querySelector('[data-audio-retry]')?.remove();
        const notice = document.createElement('button');
        notice.type = 'button';notice.dataset.audioRetry = '';notice.setAttribute('role','status');
        notice.textContent = '声音未播放，点这里重试（请调高媒体音量）';
        notice.style.cssText = 'position:fixed;bottom:16px;left:5%;width:90%;z-index:9999;padding:16px;background:#fff3da;color:#5b4100;border:2px solid #d8b156;border-radius:16px;font-size:18px';
        notice.onclick=()=>{notice.remove();void this.speak(text,{lang,rate,pitch,kind});};
        document.body.append(notice);
      }
      return ok;
    }
  }

  cancel() {
    this._generation++;
    if (this._source) {
      try { this._source.stop(); } catch {}
      this._source = null;
    }
    if (this._audio) {
      try {
        this._audio.pause();
      } catch {}
      this._audio = null;
    }
  }
}

function fallbackBrowserTTS(text, { lang, rate, pitch, kind, onEnd }) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    onEnd?.();
    return Promise.resolve(false);
  }
  const isAnswer = kind === "answer";
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = rate != null ? rate : isAnswer ? 0.75 : 0.9;
    u.pitch = pitch != null ? pitch : isAnswer ? 0.8 : 1.05;
    // onend / onerror / 12s 超时都可能触发，用 done 标志保证 onEnd 只回调一次
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      onEnd?.();
      resolve(ok);
    };
    u.onend = () => finish(true);
    u.onerror = () => finish(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
    window.setTimeout(() => finish(false), 12000);
  });
}
