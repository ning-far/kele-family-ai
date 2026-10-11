/**
 * SpeechManager — 按开关选择当前语音引擎（本地 Whisper / 百度云）。
 *
 * 各模块通过 ctx.recognizer / ctx.tts 取用；引擎切换后无需重建模块，
 * 因为 recognizer / tts 这两个属性是「按需返回当前引擎」的 getter。
 */
import { WhisperRecognizer, MODEL_ID, ADVANCED_MODEL_ID } from "./whisperRecognizer.js";
import { BaiduRecognizer } from "./baiduRecognizer.js";
import { TTS } from "./tts.js";
import { BaiduTTS } from "./baiduTts.js";
import { getEngine, setEngine, getBaiduVoice, setBaiduVoice } from "./engineConfig.js";

export class SpeechManager {
  constructor() {
    // 按已保存的引擎初始化本地模型的档位（标准版 / 高级版）
    const initial = getEngine();
    this.localRec = new WhisperRecognizer({
      modelId: initial === "local-adv" ? ADVANCED_MODEL_ID : MODEL_ID,
    });
    this.baiduRec = new BaiduRecognizer();
    this.localTts = new TTS();
    this.baiduTts = new BaiduTTS({ per: getBaiduVoice() });
    this._listeners = [];
  }

  get engine() {
    return getEngine();
  }
  get recognizer() {
    return this.engine === "baidu" ? this.baiduRec : this.localRec;
  }
  get tts() {
    return this.engine === "baidu" ? this.baiduTts : this.localTts;
  }

  setEngine(e) {
    // 切换引擎前，强制复位两个识别器，清除可能卡住的录音/识别状态，
    // 否则刚切到本地模式时 Whisper 可能直接 start() 失败（_listening 残留）。
    try { this.localRec.abort?.(); } catch {}
    try { this.baiduRec.abort?.(); } catch {}
    // 本地引擎内部分档：高级版用 whisper-small.en，其余本地档位用标准版 whisper-base
    this.localRec.useModel(e === "local-adv" ? ADVANCED_MODEL_ID : MODEL_ID);
    setEngine(e);
    this._emit();
  }

  setBaiduVoice(v) {
    setBaiduVoice(v);
    this.baiduTts.per = v;
  }

  onChange(fn) {
    this._listeners.push(fn);
    return () => {
      this._listeners = this._listeners.filter((x) => x !== fn);
    };
  }

  _emit() {
    for (const f of this._listeners) f(this.engine);
  }
}
