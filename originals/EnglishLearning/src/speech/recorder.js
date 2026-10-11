/**
 * Recorder — single-session push-to-talk controller around a Recognizer.
 *
 * 按钮语义（与小孩友好）：
 *   - 未录音 + 按 S1  -> 开始采集麦克风音频
 *   - 录音中 + 再按 S1 -> 停止采集并把音频交给 Recognizer 识别，返回文字
 *   - 安全超时(8s)    -> 自动停止并识别，避免小孩不松手卡住
 *
 * recognizer 可以是：
 *   - 一个对象（如 WhisperRecognizer 实例），或
 *   - 一个函数 () => 当前 recognizer（用于「本地 Whisper / 百度云」运行时切换）。
 * 两种写法下，Recorder 都只依赖 recognizer 的 start/stop/abort 接口。
 *
 * Logging: 记录 PTT 生命周期（按下 → 采集 → 停止 → 识别结果/无结果），
 * 以便定位「到底哪一步断了」。
 */
import { debugLog } from "./debugLog.js";

export class Recorder {
  constructor(recognizer, { maxDurationMs = 8000 } = {}) {
    // 兼容「传对象」与「传函数」两种用法：统一成取当前 recognizer 的函数。
    this._getRec = typeof recognizer === "function" ? recognizer : () => recognizer;
    this.recording = false;
    this.maxDurationMs = maxDurationMs;
    this._timer = null;
    this._done = true; // 当前这一轮尝试是否已结算
    this._cb = null;
    this._seq = 0; // 每轮递增令牌；旧轮迟到的回调(seq 不匹配)一律忽略，避免串扰冻死
  }

  /** 按下 PTT：开始 / 停止并识别。 */
  toggle(lang, cb = {}) {
    const r = this._getRec();

    if (this.recording) {
      // 第二次按下：停止录音并交给 Recognizer 识别（不是丢弃！）
      debugLog("PTT 再次按下 → 停止录音并交给 Recognizer 识别");
      this.recording = false;
      this._clearTimer();
      try {
        r.stop({ lang, ...this._sessionCbs() });
      } catch (e) {
        debugLog(`recorder: stop 异常 ${e?.message || e}`, "error");
        this._emit(this._seq, () => this._cb.onState?.(false));
      }
      return;
    }
    if (!this._done) {
      // 上一轮还在识别中（常见：小孩松手后马上又按），强制取消并继续新的
      debugLog("PTT 按下，上一轮尚未结算 → 强制取消并重启", "warn");
      try {
        r.abort();
      } catch (e) {
        debugLog(`recorder: abort 异常 ${e?.message || e}`, "warn");
      }
      this._clearTimer();
      this._done = true;
    }

    this._cb = cb;
    this.recording = true;
    this._done = false;
    this._seq++;
    debugLog(`PTT 按下 → 开始录音 (lang=${lang})`);
    cb.onState?.(true);

    // 安全超时：自动停止并识别
    this._timer = setTimeout(() => {
      debugLog("安全超时 → 自动停止并识别");
      this.recording = false;
      try {
        r.stop({ lang, ...this._sessionCbs() });
      } catch (e) {
        debugLog(`recorder: 超时 stop 异常 ${e?.message || e}`, "error");
        this._emit(this._seq, () => this._cb.onState?.(false));
      }
    }, this.maxDurationMs);

    try {
      const ok = r.start({ lang, onStart: () => {}, ...this._sessionCbs() });
      if (!ok) {
        debugLog("recorder: recognizer.start 返回 false（见上方 reason）", "error");
        this._emit(this._seq, () => this._cb.onState?.(false));
      }
    } catch (e) {
      debugLog(`recorder: start 异常 ${e?.message || e}`, "error");
      this._emit(this._seq, () => this._cb.onState?.(false));
    }
  }

  /**
   * 完整回调集合（start / stop 共用同一份）。
   * - onResult / onError / onEnd 都带当前轮 seq，只有「本轮」(seq 匹配) 才生效；
   *   旧轮迟到的回调（例如上一轮的 onEnd 在新一轮开始后才到达）会被 _emit 忽略，
   *   避免串扰把新一轮误判为「无结果」而导致游戏卡死。
   * - onInterim 是非终态，但同样带 seq 守卫：旧轮迟到的中间文本不得写进新一轮的 UI。
   * - 'no-speech' / 'aborted' 不是真正的错误，按「无结果」处理（提示小孩重说）。
   */
  _sessionCbs() {
    const seq = this._seq;
    return {
      onResult: (res) =>
        this._emit(seq, () => {
          debugLog(`recorder → onResult 已交付: ${JSON.stringify(res)}`);
          this._cb.onState?.(false);
          this._cb.onResult?.(res);
        }),
      onInterim: (text) => {
        if (seq !== this._seq) return; // 旧轮迟到的 interim 不写进新一轮 UI
        this._cb.onInterim?.(text);
      },
      onError: (reason) =>
        this._emit(seq, () => {
          if (reason === "no-speech" || reason === "aborted") {
            debugLog(`recorder → onNoResult (reason=${reason})`);
            this._cb.onState?.(false);
            this._cb.onNoResult?.();
          } else {
            debugLog(`recorder → onError: ${reason}`);
            this._cb.onState?.(false);
            this._cb.onError?.(reason);
          }
        }),
      onEnd: () =>
        this._emit(seq, () => {
          debugLog("recorder → onNoResult（onEnd 无结果）");
          this._cb.onState?.(false);
          this._cb.onNoResult?.();
        }),
    };
  }

  /** 同一轮尝试只触发一次终态回调；seq 不匹配的旧轮回调一律忽略（防串扰冻死）。 */
  _emit(seq, fn) {
    if (this._done || seq !== this._seq) return;
    this._done = true;
    this._clearTimer();
    this.recording = false;
    fn();
  }

  _clearTimer() {
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
  }

  /** 模块卸载时丢弃当前会话（不识别）。 */
  stop() {
    this._clearTimer();
    this._getRec().abort();
    this.recording = false;
    this._done = true;
  }

  /**
   * 按住说话（长按 PTT）：按下即开始录音。
   * 松开时调用 release() 结束并交给 Recognizer 识别。
   * 与 toggle() 的区别：toggle 是「按一下开始 / 再按一下结束」，
   * start/release 是「按住=录，松手=停」，更适合小朋友的短语音。
   */
  start(lang, cb = {}) {
    if (this.recording) return false;
    if (!this._done) {
      // 上一轮识别尚未返回（如百度云还在转写），小孩又按住了：取消旧的、开始新的
      debugLog("PTT start，上一轮尚未结算 → 强制取消并重启", "warn");
      try {
        this._getRec().abort();
      } catch (e) {
        debugLog(`recorder: abort 异常 ${e?.message || e}`, "warn");
      }
      this._clearTimer();
      this._done = true;
    }
    this._cb = cb;
    this._lang = lang;
    this.recording = true;
    this._done = false;
    this._seq++;
    debugLog(`PTT 按住 → 开始录音 (lang=${lang})`);
    cb.onState?.(true);
    this._timer = setTimeout(() => {
      debugLog("安全超时 → 自动停止并识别");
      this.release();
    }, this.maxDurationMs);
    try {
      const ok = this._getRec().start({ lang, onStart: () => {}, ...this._sessionCbs() });
      if (!ok) {
        debugLog("recorder: recognizer.start 返回 false（见上方 reason）", "error");
        this._emit(this._seq, () => this._cb.onState?.(false));
      }
    } catch (e) {
      debugLog(`recorder: start 异常 ${e?.message || e}`, "error");
      this._emit(this._seq, () => this._cb.onState?.(false));
    }
    return true;
  }

  /** 松开说话键：停止录音并交给 Recognizer 识别（与 toggle 第二次按等价）。 */
  release() {
    if (!this.recording) return;
    this.recording = false;
    this._clearTimer();
    try {
      this._getRec().stop({ lang: this._lang, ...this._sessionCbs() });
    } catch (e) {
      debugLog(`recorder: release stop 异常 ${e?.message || e}`, "error");
      this._emit(this._seq, () => this._cb.onState?.(false));
    }
  }
}
