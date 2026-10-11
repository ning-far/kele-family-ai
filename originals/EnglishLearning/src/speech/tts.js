/**
 * TTS — wrapper around the Web Speech Synthesis API.
 *
 * Used to "say" prompts ("What is this?"), play listening-comprehension audio,
 * repeat sentences for the speak module, and read translation results aloud on
 * the PC. (The board can mirror the spoken text via an optional {t:"tts"} frame
 * if its firmware supports onboard playback — see FIRMWARE-INTEGRATION.md.)
 *
 * A slower rate and a friendly en-US voice make it gentler for small children.
 */
export class TTS {
  constructor() {
    this.supported = typeof window !== "undefined" && "speechSynthesis" in window;
    this.voiceCache = null;
    // 浏览器的人声列表是分批异步到达的：若首次只拿到 1 个英文音就永久缓存，
    // pickAnswerVoice 会找不到"另一个声音"，答案音就退化成提问音。
    // 因此列表变化时必须让缓存失效。
    if (this.supported && typeof window.speechSynthesis.addEventListener === "function") {
      window.speechSynthesis.addEventListener("voiceschanged", () => {
        this.voiceCache = null;
      });
    }
  }

  _voices() {
    if (!this.supported) return [];
    // 首次调用时 getVoices() 常返回空数组（列表异步加载）。
    // 旧实现会把这个空数组永久缓存，导致后续永远拿不到任何声音。
    if (this.voiceCache && this.voiceCache.length) return this.voiceCache;
    const list = window.speechSynthesis.getVoices() || [];
    if (list.length) this.voiceCache = list;
    return list;
  }

  pickVoice(lang = "en-US") {
    const list = this._voices();
    const exact = list.find((v) => v.lang === lang);
    if (exact) return exact;
    const prefix = list.find((v) => v.lang && v.lang.startsWith(lang.split("-")[0]));
    return prefix || null;
  }

  /**
   * 朗读「正确答案」时使用的另一个声音，刻意与常规提示音区分开，
   * 让孩子能听出「这是在报正确答案」而不是下一题的提问。
   * 优先挑英式 en-GB，否则挑任意一个不同于常规音的英文人声。
   */
  pickAnswerVoice(lang = "en-US") {
    const list = this._voices();
    if (!list.length) return null;
    const normal = this.pickVoice(lang);
    const en = list.filter((v) => v.lang && v.lang.toLowerCase().startsWith("en"));
    const gb = en.find((v) => v.lang.toLowerCase() === "en-gb");
    if (gb && gb !== normal) return gb;
    const other = en.find((v) => v !== normal);
    return other || normal || null;
  }

  /**
   * Speak text. Returns a promise that resolves when finished (or cancelled).
   * @param {string} text
   * @param {object} [opts]
   * @param {string} [opts.lang]
   * @param {number} [opts.rate]
   * @param {number} [opts.pitch]
   * @param {"prompt"|"answer"} [opts.kind] "answer" = 报正确答案，换一种声音 + 更慢更低
   * @param {()=>void} [opts.onEnd]
   */
  speak(text, { lang = "en-US", rate, pitch, kind = "prompt", onEnd } = {}) {
    if (!this.supported || !text) {
      onEnd?.();
      return Promise.resolve(false);
    }
    const isAnswer = kind === "answer";
    // 小朋友更喜欢的音色：pitch 偏高、圆润；答案音也放慢但不要太低沉
    const useRate = rate != null ? rate : isAnswer ? 0.78 : 0.95;
    const usePitch = pitch != null ? pitch : isAnswer ? 1.05 : 1.25;
    return new Promise((resolve) => {
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = lang;
      utter.rate = useRate;
      utter.pitch = usePitch;
      const voice = isAnswer ? this.pickAnswerVoice(lang) : this.pickVoice(lang);
      if (voice) utter.voice = voice;
      let done = false;
      const finish = (ok) => {
        if (done) return;
        done = true;
        onEnd?.();
        resolve(ok);
      };
      utter.onend = () => finish(true);
      utter.onerror = () => finish(false);
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utter);
      // Safety net if onend never fires.
      window.setTimeout(() => finish(true), 12000);
    });
  }

  cancel() {
    if (this.supported) window.speechSynthesis.cancel();
  }
}
