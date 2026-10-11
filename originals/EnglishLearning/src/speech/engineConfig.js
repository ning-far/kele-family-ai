/**
 * engineConfig — 语音引擎开关的本地持久化（localStorage）。
 *
 * 三个可选值（用户可在右上角下拉框自由选择）：
 *   'local-base' -> 本地 Whisper 标准版（whisper-base，当前默认，离线、英文较准）
 *   'local-adv'  -> 本地 Whisper 高级版（whisper-small.en，英文更准，占用更多算力）
 *   'baidu'      -> 百度智能云 ASR + TTS（经 server.mjs 本地代理，密钥不进浏览器）
 *
 * 历史值 'local' 视为 'local-base'（标准版），保证旧配置向后兼容。
 */
const ENGINE_KEY = "el_speech_engine"; // 'local-base' | 'local-adv' | 'baidu'
const VOICE_KEY = "el_baidu_voice"; // 百度 TTS 发音人 per 值
const KNOWN = ["local-base", "local-adv", "baidu"];

export function getEngine() {
  const v = localStorage.getItem(ENGINE_KEY);
  if (v === "baidu") return "baidu";
  if (v === "local-adv") return "local-adv";
  return "local-base"; // 旧值 'local' 或空 → 标准本地版
}

export function setEngine(e) {
  localStorage.setItem(ENGINE_KEY, KNOWN.includes(e) ? e : "local-base");
}

export function isLocal(e = getEngine()) {
  return e === "local-base" || e === "local-adv";
}

export function getBaiduVoice() {
  const v = Number(localStorage.getItem(VOICE_KEY));
  return Number.isFinite(v) ? v : 0; // 默认 0 = 度小美
}
export function setBaiduVoice(v) {
  localStorage.setItem(VOICE_KEY, String(v));
}
