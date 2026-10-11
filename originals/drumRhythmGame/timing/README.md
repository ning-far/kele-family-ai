# 歌曲制作与节奏验收

本流程把“录音的实际时间”与“游戏难度”分离。原合成小星星仍保留已有体验；MP3曲目不会因为选难度而改变谱面时钟。

2026-10-08新增red-star/white-rabbit，meta.drumKit=groove：底鼓→闭镲→军鼓→闭镲，16拍末开镲变化，挑战半拍仍跟实际起音。此字段启用独立程序化音色，原三曲音色不改；发布只上传实际MP3，不上传私有点击预览。CloudBase资源用相对audioFile路径保持本地/云托管兼容，独立云曲库后台另作扩展。

制作顺序：确定录音版本 → 记录SHA256/时长 → 打击成分起音与节拍分析 → 检查半拍/倍拍和起点 → 四轨儿童简化配鼓 → 三档密度 → 对齐校验 → 开头/中段/结尾听审 → 手机实玩 → 灰度上传。

工具：Python3.12、librosa0.11.0、soundfile0.13.1、imageio-ffmpeg0.6.0；要求见scripts/requirements-audio.txt。本项目分析库在.tools/music-analysis，FFmpeg来自已有imageio工具。分析发生在开发电脑，不在手机游戏运行时执行。

默认使用统一FFmpeg解码和轻量混合录音起音分析；--percussive可启用较慢的HPSS打击分离。输出analysis字段记录实际方法，不把混合录音起音冒称隔离鼓声。NumPy/SciPy等运行时版本需随分析归档记录。

已有歌曲重新制作：

```text
python scripts/analyze-audio.py public/audio/babybaby.mp3 --out .analysis/babybaby
node scripts/build-aligned-chart.mjs babybaby
node scripts/check-timing.mjs babybaby
```

同样适用于grow。命令在drumRhythmGame下运行；指定实际Python3.12路径。生成器校验录音哈希，保留首次旧谱备份。旧gen-charts模板被保护，不能覆盖已经对齐的谱面。

新增歌曲：提供对应MP3录音后，一条命令建立草稿并注册：

```text
node scripts/import-song.mjs red-star --title "红星闪闪" --audio "录音路径.mp3" --python "Python3.12路径"
```

import工具不自动下载音乐、不自动发布；已有id/文件不覆盖。失败保留未注册草稿供检查，不破坏已有歌曲。新歌曲听审后再随平台构建。小兔子乖乖可用rabbit等稳定id。

产物：public/charts/*.json；timing/*.json含分析、录音哈希与逐拍时间；.analysis/*/beat-review.wav是私有点击预览，不上传；timing/legacy-20261008是首次旧谱。录音改变必须重新分析，不能套用同名曲BPM。

谱面扩展：note.timeMs为录音内实际毫秒，meta.audioDurationMs保持结算不截断，meta.audioSha256绑定版本。beat是密度编排索引，不用于重新拉伸已有timeMs。简单/标准/挑战分别保留隔拍/主拍/主拍加选定打击起音。

自动质量门槛：至少16个有效节拍、40–220BPM、节拍到打击起音中位误差≤60ms、时间单调、无越界、音频哈希一致；游戏判定与完整音频结束回归通过。自动门槛只证明时间数据和程序一致，不能替代原曲鼓谱或音乐人的听审。

人工听审至少覆盖开头、中段、结尾各12秒；检查是否选成半拍/倍拍、主强拍相位、弱拍/人声误识和变速片段。可用--bpm提供复核后的节奏约束重跑分析，再调整逐拍/轨道JSON。

参考：[osu! timing](https://osu.ppy.sh/wiki/en/Beatmapping/Timing)、[librosa beat tracking](https://librosa.org/doc/0.11.0/generated/librosa.beat.beat_track.html)、[生长吧官方简谱入口](https://zgsxd.k618.cn/ypzp/201701/t20170109_10003167.html)。前三者分别支持时间轴/分段、检测算法、旋律节拍参考；本流程不声称已获取原版架子鼓鼓谱。
