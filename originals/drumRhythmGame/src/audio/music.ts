/**
 * MusicEngine：Tone.js 音频引擎，同时充当游玩期的「权威音频时钟」（实现 Clock）。
 *
 * 设计：
 *  - 八音盒《小星星》旋律（纯合成、零素材、零版权）走 Tone.Transport 循环，
 *    一乐句 16 拍，循环 phrases 遍；Transport 就是权威时钟，绝不用 setTimeout 计时。
 *  - 音色 = 正弦基频 + 2~3 泛音（振幅递减，用 custom partials 实现）+ 极快 attack + 指数 decay + 一点 reverb。
 *  - 4 个鼓声（CHH/OHH/Clap/Rim）全部程序化合成（噪声 + 滤波 + 包络 / 少量音高 ping），零素材。
 *  - 命中 → triggerDrum；失误 → 极轻柔和音；连击里程碑 → 柔和上行钟声。全部低音量、不刺耳。
 *  - 图节点在首次用户手势（unlock/play）时才创建，规避浏览器 autoplay 限制。
 */

import * as Tone from "tone";
import type { Clock } from "../core/clock";
import { clamp } from "../core/clock";

// 难度 / BPM / 显示名定义在 src/settings.ts（保持那里无 Tone 依赖，music 不重复定义）。

/** 一乐句 16 拍。 */
const PHRASE_BEATS = 16;

/** 旋律总线常态增益；暂停时立即置 0 静音、继续时还原（避免 lookahead/包络/reverb 拖尾）。 */
const MUSIC_BUS_GAIN = 0.82;

interface MelodyNote {
  beat: number;
  freq: number;
  dur: number; // 拍
}

/** 《小星星》主旋律（C 大调 4/4，公有领域）。频率见任务规格。 */
const MELODY: readonly MelodyNote[] = [
  { beat: 0, freq: 261.63, dur: 1 }, // C4
  { beat: 1, freq: 261.63, dur: 1 }, // C4
  { beat: 2, freq: 392.0, dur: 1 }, //  G4
  { beat: 3, freq: 392.0, dur: 1 }, //  G4
  { beat: 4, freq: 440.0, dur: 1 }, //  A4
  { beat: 5, freq: 440.0, dur: 1 }, //  A4
  { beat: 6, freq: 392.0, dur: 2 }, //  G4（时值 2）
  { beat: 8, freq: 349.23, dur: 1 }, // F4
  { beat: 9, freq: 349.23, dur: 1 }, // F4
  { beat: 10, freq: 329.63, dur: 1 }, // E4
  { beat: 11, freq: 329.63, dur: 1 }, // E4
  { beat: 12, freq: 293.66, dur: 1 }, // D4
  { beat: 13, freq: 293.66, dur: 1 }, // D4
  { beat: 14, freq: 261.63, dur: 2 }, // C4（时值 2）
];

/** 一个鼓声：可反复触发的 one-shot。 */
interface DrumVoice {
  trigger(time: number, vel01: number): void;
  dispose(): void;
}

export class MusicEngine implements Clock {
  private ready = false;

  // 图节点（懒创建）
  private master!: Tone.Gain;
  private musicGain!: Tone.Gain;
  private musicBox!: Tone.PolySynth;
  private drums: DrumVoice[] = [];
  private grooveDrums: DrumVoice[] = [];
  private useGroove = false;
  setDrumKit(groove:boolean):void {this.useGroove=groove;}
  private chime!: Tone.PolySynth;
  private missTone!: Tone.Synth;

  private repeatId: number | null = null;
  private phrases = 0;
  private phraseCount = 0;
  private leadInSec = 0;
  private melodyBpm = 120; // 保留以便 resume 时重新注册 scheduleRepeat

  // MP3 播放相关
  private player: Tone.Player | null = null;
  private mp3Active = false;          // 是否正在用 MP3（而非合成）
  private mp3StartOffset = 0;         // MP3 本次播放的起始偏移（秒）
  private mp3StartTransportTime = 0;  // MP3 本次开始播放时的 Transport 时间（秒）

  /** 当前音频时钟时间（ms）。基于 Tone.Transport，暂停时自然保持不动。 */
  nowMs(): number {
    // Transport.seconds reads the scheduler's lookahead time. Recorded music
    // and touch judgement must use the actual audio processing time instead.
    return (this.mp3Active?Tone.Transport.getSecondsAtTime(Tone.immediate()):Tone.Transport.seconds) * 1000;
  }

  /** 由用户手势调用：解锁音频上下文并（首次）构建合成图。 */
  async unlock(): Promise<void> {
    await Tone.start();
    if (!this.ready) {
      this.buildGraph();
      this.ready = true;
    }
    if (Tone.getContext().state !== "running") {
      await Tone.getContext().resume();
    }
  }

  /**
   * 开始播放：设定 BPM、把 Transport 归零、排旋律循环并启动。
   * @param bpm 难度对应 BPM
   * @param totalBeats 整曲拍数（据旋律乐句数循环）
   * @param leadInBeats 预备拍（默认 4 拍 = 一小节）：旋律从第 leadInBeats 拍才开始，
   *   前面这段空拍用作「3-2-1」倒数与音符下落预备。与 engine 的 leadInMs 一致，两者对齐。
   * @param audioFile 可选 MP3 文件路径，有值时用 MP3 播放而非合成旋律。
   */
  async play(bpm: number, totalBeats: number, leadInBeats = 4, audioFile?: string): Promise<void> {
    await this.unlock();
    Tone.Transport.stop();
    Tone.Transport.cancel();
    Tone.Transport.bpm.value = bpm;
    Tone.Transport.position = 0;

    // 重置旋律总线增益：pause() 会把 musicGain 置 0，重来/回家后必须恢复到常态，
    // 否则 Transport 虽在跑但旋律静音（Bug 3/4 根因）。
    if (this.ready) {
      const t = Tone.now();
      this.musicGain.gain.cancelScheduledValues(t);
      this.musicGain.gain.setValueAtTime(MUSIC_BUS_GAIN, t);
    }

    this.leadInSec = Math.max(0, leadInBeats) * (60 / bpm);
    this.melodyBpm = bpm;

    // 清理旧的 MP3 player
    this.disposePlayer();

    if (audioFile) {
      // MP3 模式：创建 Player，在 leadIn 结束后开始播放
      this.mp3Active = true;
      this.player = new Tone.Player();
      this.player.connect(this.musicGain);
      // 等待 player 加载完成
      const loadingPlayer = this.player;
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          loadingPlayer.load(import.meta.env.BASE_URL + audioFile),
          new Promise<never>((_, reject) => {
            timeout = setTimeout(() => reject(new Error('歌曲音频加载超时，请重试')), 30000);
          }),
        ]);
      } catch (error) {
        this.disposePlayer();
        this.mp3Active = false;
        throw error;
      } finally {
        clearTimeout(timeout);
      }
      if (this.player !== loadingPlayer || !loadingPlayer.loaded) return;
      // 计算 MP3 起始：leadIn 结束后才开始播放
      this.mp3StartOffset = 0;
      this.mp3StartTransportTime = this.leadInSec;
      // 用 scheduleOnce 在 leadIn 时刻启动 player
      Tone.Transport.scheduleOnce((time) => {
        if (this.player?.loaded && this.mp3Active) {
          this.player.start(time, this.mp3StartOffset);
        }
      }, this.leadInSec);
      // 不调用 scheduleMelody
      Tone.Transport.start();
    } else {
      // 合成模式：走原有 scheduleMelody 逻辑
      this.mp3Active = false;
      this.phrases = Math.max(1, Math.ceil(totalBeats / PHRASE_BEATS));
      this.phraseCount = 0;
      this.scheduleMelody(bpm);
      Tone.Transport.start();
    }
  }

  pause(): void {
    // ① 冻结 Transport 逻辑时钟（位置不再推进）。
    Tone.Transport.pause(this.mp3Active?Tone.immediate():undefined);
    // ② 清除 lookahead 窗口内已排程但未触发的音符事件。
    //    Tone.js 在 Transport 运行时会提前 ~0.1s 把音符送进 AudioContext 队列；
    //    pause() 冻结了逻辑时钟，但这些「已在 Web Audio 队列里」的事件仍会发声，
    //    导致用户听到暂停后音乐仍在走（实际是 lookahead 残留音符）。cancel() 清除它们。
    //    注意：cancel() 会移除 timeline 上的 scheduleRepeat 条目，
    //    因此 resume() 必须重新注册 scheduleRepeat（见 resume 实现）。
    Tone.Transport.cancel();
    this.repeatId = null; // cancel 已清除，标记无效
    if (this.ready) {
      // ③ 即时静音旋律总线（含 reverb 尾音），实现「按暂停马上没声音」。
      //    鼓/钟声/失误音走 master 的其它分支，one-shot 不受影响。
      const t = this.mp3Active?Tone.immediate():Tone.now();
      this.musicGain.gain.cancelScheduledValues(t);
      this.musicGain.gain.setValueAtTime(0, t);
    }
    // MP3 模式：暂停播放器 + 记录墙钟时间
    if (this.mp3Active && this.player) {
      // Tone.Player 没有 pause()，用 stop() 并记录当前偏移
      const elapsed = this.nowMs()/1000 - this.mp3StartTransportTime;
      this.mp3StartOffset = Math.max(0, this.mp3StartOffset + elapsed);
      this.player.stop(Tone.immediate());
    }
  }

  resume(): void {
    const resumeAt=Tone.now();
    if (this.mp3Active) {
      // MP3 模式：从暂停时保存的偏移继续。
      // Transport 在暂停期间不走；不能把墙钟暂停时长加进歌曲偏移。
      const currentTransportTime = this.nowMs()/1000;
      this.mp3StartTransportTime = currentTransportTime;
      // 重启播放器
      if (this.player?.loaded) {
        this.player.stop(Tone.immediate());
        const remainingLeadIn = this.leadInSec - currentTransportTime;
        if (remainingLeadIn > 0) {
          Tone.Transport.scheduleOnce(time => this.player?.start(time, this.mp3StartOffset), this.leadInSec);
          this.mp3StartTransportTime = this.leadInSec;
        } else this.player.start(resumeAt, this.mp3StartOffset);
      }
    } else {
      // 合成模式：从冻结位置继续，重新注册 scheduleRepeat
      this.scheduleMelody(this.melodyBpm);
    }
    if (Tone.Transport.state !== "started") Tone.Transport.start(this.mp3Active?resumeAt:undefined);
    if (this.ready) {
      // 即时恢复旋律增益（cancelScheduledValues 已清除暂停期间残留事件）。
      const t = Tone.now();
      this.musicGain.gain.cancelScheduledValues(t);
      this.musicGain.gain.setValueAtTime(MUSIC_BUS_GAIN, t);
    }
  }

  /** 结束/退出：停表并清空所有排程，避免残留回调。 */
  stop(): void {
    if (this.repeatId !== null) {
      Tone.Transport.clear(this.repeatId);
      this.repeatId = null;
    }
    // 清理 MP3
    this.disposePlayer();
    this.mp3Active = false;
    Tone.Transport.stop();
    Tone.Transport.cancel();
    Tone.Transport.position = 0;
    this.phraseCount = 0;
  }

  /** 主音量 0..1（平滑过渡）。 */
  setVolume(v01: number): void {
    if (!this.ready) return;
    const g = clamp(v01, 0, 1);
    this.master.gain.setTargetAtTime(g, Tone.now(), 0.03);
  }

  /** 命中鼓声（lane 0..3，vel 0..127）。 */
  triggerDrum(lane: number, vel: number): void {
    if (!this.ready) return;
    const drum = (this.useGroove?this.grooveDrums:this.drums)[lane];
    if (!drum) return;
    drum.trigger(this.mp3Active?Tone.immediate():Tone.now(), clamp(vel / 127, 0.15, 1));
  }

  /** 失误：极轻、柔和、短促，绝不刺耳。 */
  triggerMiss(): void {
    if (!this.ready) return;
    this.missTone.triggerAttackRelease(196, 0.16, Tone.now(), 0.12);
  }

  /** 连击里程碑：柔和上行钟声（三音，音量小）。 */
  triggerCombo(milestone: number): void {
    if (!this.ready) return;
    const base = milestone >= 50 ? 784 : milestone >= 25 ? 698.46 : 622.25;
    const t = Tone.now();
    const seq = [base, base * 1.25, base * 1.5];
    seq.forEach((f, i) => this.chime.triggerAttackRelease(f, 0.35, t + i * 0.06, 0.18));
  }

  // ---- 内部 ----

  /** 清理 MP3 player。 */
  private disposePlayer(): void {
    if (this.player) {
      this.player.stop();
      this.player.disconnect();
      this.player.dispose();
      this.player = null;
    }
  }

  private scheduleMelody(bpm: number): void {
    const spb = 60 / bpm; // 每拍秒数
    const phraseLen = PHRASE_BEATS * spb; // 一乐句秒数
    const leadIn = this.leadInSec;
    let id = 0;
    id = Tone.Transport.scheduleRepeat((time) => {
      // Bug 1 修复：scheduleRepeat 的 offset 参数是相位对齐而非延迟，
      // 首次回调可能在 t=0（倒计时期间）就触发。用 time 门控：
      // 倒计时期间 (time < leadIn) 跳过音符，不消耗 phraseCount。
      if (time < leadIn - 0.01) return;
      if (this.phraseCount >= this.phrases) {
        Tone.Transport.clear(id);
        this.repeatId = null;
        return;
      }
      this.phraseCount++;
      for (const n of MELODY) {
        const t = time + n.beat * spb;
        const dur = Math.max(0.08, n.dur * spb * 0.9);
        this.musicBox.triggerAttackRelease(n.freq, dur, t, 0.8);
      }
    }, phraseLen, leadIn); // 4 小节 = 16 拍 = 一乐句；从预备拍之后开始
    this.repeatId = id;
  }

  private buildGraph(): void {
    const limiter = new Tone.Limiter(-1.5);
    limiter.toDestination();

    this.master = new Tone.Gain(0.85);
    this.master.connect(limiter);

    // 八音盒：正弦基频 + 泛音（振幅递减）+ 极快 attack + 指数 decay + 一点 reverb。
    const reverb = new Tone.Freeverb({ roomSize: 0.55, dampening: 2600 });
    reverb.wet.value = 0.28;
    // 旋律总线：略退一点（0.9→0.82），给鼓让出头部空间，八音盒仍清晰可闻。
    const musicGain = new Tone.Gain(MUSIC_BUS_GAIN);
    this.musicGain = musicGain;
    musicGain.connect(this.master);

    this.musicBox = new Tone.PolySynth(Tone.Synth, {
      // custom partials = 加性泛音：基频 1，2x 0.32，3x 0.15，4x 0.06（递减）。
      oscillator: { type: "custom", partials: [1, 0.32, 0.15, 0.06] },
      envelope: { attack: 0.005, decay: 0.85, sustain: 0, release: 0.35 },
    });
    this.musicBox.connect(reverb);
    reverb.connect(musicGain);
    this.musicBox.connect(musicGain); // 干声也送一点，保证清晰度

    // 鼓总线：调大（0.85→1.3，约 +3.7dB），让敲击反馈明显、靠前于旋律——
    // 这是打鼓游戏，孩子自己敲的声音要有打击感。峰值仍由 master(0.85)+Limiter(-1.5dB) 兜底防削波。
    const drumBus = new Tone.Gain(1.3);
    drumBus.connect(this.master);

    this.drums = [
      this.makeNoiseDrum(drumBus, "white", "highpass", 7200, 0.001, 0.05), // lane0 CHH 闭镲
      this.makeNoiseDrum(drumBus, "white", "highpass", 6000, 0.002, 0.32), // lane1 OHH 开镲
      this.makeNoiseDrum(drumBus, "pink", "bandpass", 1500, 0.001, 0.15, 1.1), // lane2 Clap 拍手
      this.makeRimDrum(drumBus), // lane3 Rim 边击
    ];
    const kick=new Tone.MembraneSynth({pitchDecay:.045,octaves:6,envelope:{attack:.001,decay:.3,sustain:0,release:.08}}).connect(drumBus);
    this.grooveDrums=[
      {trigger:(time,vel)=>kick.triggerAttackRelease('C1',.12,time,vel*.65),dispose:()=>{kick.dispose();}},
      this.makeNoiseDrum(drumBus,'white','highpass',7200,.001,.05),
      this.makeNoiseDrum(drumBus,'white','bandpass',1800,.001,.14,.8),
      this.makeNoiseDrum(drumBus,'white','highpass',6000,.002,.24),
    ];

    // 连击钟声（柔和三角波）
    this.chime = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.01, decay: 0.4, sustain: 0, release: 0.3 },
    });
    const chimeGain = new Tone.Gain(0.5);
    this.chime.connect(chimeGain);
    chimeGain.connect(this.master);

    // 失误柔和音（低八度正弦，很轻）
    this.missTone = new Tone.Synth({
      oscillator: { type: "sine" },
      envelope: { attack: 0.02, decay: 0.18, sustain: 0, release: 0.1 },
    });
    const missGain = new Tone.Gain(0.4);
    this.missTone.connect(missGain);
    missGain.connect(this.master);
  }

  /** 噪声鼓：常驻噪声源 → 滤波 → 幅度包络（可反复触发，天然支持重叠）。 */
  private makeNoiseDrum(
    bus: Tone.Gain,
    noiseType: "white" | "pink",
    filterType: "highpass" | "bandpass",
    freq: number,
    attack: number,
    decay: number,
    q?: number,
  ): DrumVoice {
    const noise = new Tone.Noise(noiseType);
    const filter = new Tone.Filter(freq, filterType);
    if (q !== undefined) filter.Q.value = q;
    const env = new Tone.AmplitudeEnvelope({ attack, decay, sustain: 0, release: 0.05 });
    noise.connect(filter);
    filter.connect(env);
    env.connect(bus);
    noise.start();
    return {
      trigger: (time, vel01) => env.triggerAttackRelease(Math.max(0.02, decay), time, vel01),
      dispose: () => {
        noise.dispose();
        filter.dispose();
        env.dispose();
      },
    };
  }

  /** 边击 Rim：短促噪声 click + 一点音高 ping（木鱼感），两层叠加。 */
  private makeRimDrum(bus: Tone.Gain): DrumVoice {
    const noise = new Tone.Noise("white");
    const hp = new Tone.Filter(3800, "highpass");
    const nEnv = new Tone.AmplitudeEnvelope({ attack: 0.001, decay: 0.04, sustain: 0, release: 0.03 });
    noise.connect(hp);
    hp.connect(nEnv);
    nEnv.connect(bus);
    noise.start();

    const ping = new Tone.Synth({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.001, decay: 0.07, sustain: 0, release: 0.03 },
    });
    const pingGain = new Tone.Gain(0.6);
    ping.connect(pingGain);
    pingGain.connect(bus);

    return {
      trigger: (time, vel01) => {
        nEnv.triggerAttackRelease(0.04, time, vel01 * 0.7);
        ping.triggerAttackRelease(1320, 0.06, time, vel01 * 0.6);
      },
      dispose: () => {
        noise.dispose();
        hp.dispose();
        nEnv.dispose();
        ping.dispose();
        pingGain.dispose();
      },
    };
  }

  dispose(): void {
    this.stop();
    for (const d of this.drums) d.dispose();
    this.drums = [];
    for(const d of this.grooveDrums)d.dispose();this.grooveDrums=[];
    if (this.ready) {
      this.musicBox.dispose();
      this.chime.dispose();
      this.missTone.dispose();
      this.master.dispose();
    }
    this.ready = false;
    this.mp3Active = false;
  }
}
