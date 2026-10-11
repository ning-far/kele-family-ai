/**
 * audioPrep — 识别前的音频预处理（纯函数，零依赖，可单测）。
 *
 * 为什么要做：
 *   ASR（尤其云端英文模型）对「音量过小」和「过短片段」非常敏感——
 *   这类输入模型往往靠语言模型"脑补"出一个常见词（orange→outrage、
 *   pants→hands），甚至只吐出一个字母（"g"/"h"）。本地 Whisper 在极短
 *   音频上同样会幻觉（把静音当成某句话）。
 *
 * 三步处理：
 *   1. trimSilence      去掉首尾静音，只保留真正说话的部分（留一点余量）
 *   2. normalizeGain    把音量归一化到目标峰值（限制最大增益，避免把底噪放大）
 *   3. padToMinLength   不足最小时长则尾部补静音，避免"超短片段"触发幻觉
 */

/** 找出一段样本的峰值幅度。 */
export function peakOf(data) {
  let peak = 0;
  for (let i = 0; i < data.length; i++) {
    const a = Math.abs(data[i]);
    if (a > peak) peak = a;
  }
  return peak;
}

/**
 * 去掉首尾静音。阈值相对于本段音频自身的峰值（自动适应音量大小）。
 * @param {Float32Array} data
 * @param {object} [o]
 * @param {number} [o.threshold]   静音判定阈值（占峰值的比例）
 * @param {number} [o.marginSamples] 保留在首尾的余量样本数，避免切掉词首尾辅音
 */
export function trimSilence(data, { threshold = 0.03, marginSamples = 0 } = {}) {
  if (!data || data.length === 0) return data;
  const peak = peakOf(data);
  if (peak <= 0) return data;
  const cut = peak * threshold;
  let start = 0;
  let end = data.length - 1;
  while (start < data.length && Math.abs(data[start]) < cut) start++;
  while (end > start && Math.abs(data[end]) < cut) end--;
  if (end <= start) return data; // 几乎全是静音：原样返回，交给后续处理
  start = Math.max(0, start - marginSamples);
  end = Math.min(data.length - 1, end + marginSamples);
  return data.subarray(start, end + 1);
}

/**
 * 归一化音量到目标峰值。
 * 几乎静音（低于 floorPeak）时不放大，避免把环境底噪顶到满刻度；
 * 同时限制最大增益，防止极端安静的录音被放大成噪声。
 */
export function normalizeGain(data, { targetPeak = 0.9, maxGain = 20, floorPeak = 1e-4 } = {}) {
  if (!data || data.length === 0) return data;
  const peak = peakOf(data);
  if (peak <= floorPeak) return data;
  const gain = Math.min(targetPeak / peak, maxGain);
  if (Math.abs(gain - 1) < 0.001) return data;
  const out = new Float32Array(data.length);
  for (let i = 0; i < data.length; i++) {
    const v = data[i] * gain;
    out[i] = v > 1 ? 1 : v < -1 ? -1 : v;
  }
  return out;
}

/** 不足最小时长则在尾部补零（静音），避免超短片段引起模型幻觉。 */
export function padToMinLength(data, minLen) {
  if (!data || data.length >= minLen) return data;
  const out = new Float32Array(minLen);
  out.set(data, 0);
  return out;
}

/**
 * 送识别前的标准处理：去静音 → 归一化 → 补到最小时长。
 * @param {Float32Array} data 重采样到 sampleRate 后的单声道样本
 * @param {number} sampleRate
 */
export function prepareSpeech(
  data,
  sampleRate,
  { minSeconds = 1, threshold = 0.03, targetPeak = 0.9, maxGain = 10, floorPeak = 0.005 } = {}
) {
  if (!data || data.length === 0) return data;
  const trimmed = trimSilence(data, { threshold, marginSamples: Math.round(0.08 * sampleRate) });
  // 关键：几乎没说话时既不放大也不补长。
  // 否则 0.1s 的准静音会被放大成一整秒噪声，模型反而更容易"脑补"出一个词，
  // 把本该「没听清、不扣分」的情况变成一次真实答错。
  if (peakOf(trimmed) < floorPeak) return trimmed;
  let out = normalizeGain(trimmed, { targetPeak, maxGain });
  out = padToMinLength(out, Math.round(minSeconds * sampleRate));
  return out;
}
