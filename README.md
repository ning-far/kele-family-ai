# 可乐同学 · 家庭互动试玩

当前版本 **v0.1.0-preview.1**，对应体验版layout-20261009-r10。儿童英语/节奏游戏与老人成语练习，电脑和手机可玩，开发板是可选增强工具。

[打开HTTPS试玩](https://ning-and-far-d4gnalnk55f9133e8-1251364700.tcloudbaseapp.com/play/?v=layout-20261009-r10)。手机流量可用，无需电脑开机；测试域名首次可能显示“确定访问”。录音请允许麦克风。

- 英语五入口、朗读、随机练习、生词/易错复习。
- 鼓五首歌曲、三难度、五背景、触屏鼓垫与本机成绩。
- 成语三关24题、随机起点、三玩法、提示重试与奖励。

数据仍保存在当前浏览器，不能跨设备同步；文本匹配分不是专业音素评测。Agent、小程序正式版、家庭云同步尚未完成。见[版本记录](CHANGELOG.md)和[使用说明](docs/releases/v0.1.0-preview.1.md)。

## 当前版本启动

安装Node.js 24.21.0及pnpm 12.3.4，在克隆/解压目录运行：

```sh
pnpm install --frozen-lockfile
pnpm --dir originals/drumRhythmGame install --frozen-lockfile
pnpm dev:web
```

打开终端显示的地址并进入`/play/`。原游戏源码位于originals，不依赖作者D盘目录。生产Web构建用`pnpm --filter @kele/web build`。

本地语音需自己配置服务端密钥或使用浏览器支持的引擎，模型权重未随包分发；分享包不包含硬件备份和录音。整套项目未统一授予开源许可；第三方字体、歌曲保留原权利，分享不代表素材获商用/再发行许可。

## 历史工程初始化记录（2026-10-01）

以下保留为历史追溯，当前启动与能力以以上说明为准。

## 本地启动

使用项目父目录的Node24；Windows可在本目录执行：
```powershell
.\scripts\dev.ps1 web
.\scripts\dev.ps1 server
.\scripts\dev.ps1 verify
```
首次安装用相同Node24执行 `pnpm install --frozen-lockfile`。Web为 http://127.0.0.1:5173，API为 http://127.0.0.1:8787，分别占用一个终端。服务默认只监听本机。外部真机访问、HTTPS与账号接入后续单独配置。

支持Node24的其他环境：`pnpm install --frozen-lockfile` 后执行 `pnpm verify`。Windows缓存默认D盘；其他环境安装时覆盖 `--store-dir .cache/pnpm-store --cache-dir .cache/pnpm-cache`。

## 结构与验收

- apps/web：响应式四项导航、6个模式入口。暂不具备PWA离线能力。
- apps/miniprogram：Taro模式列表与详情入口。游客appid只用于开发工具导入；不是正式小程序。
- apps/server：健康检查和公开模式目录；其他接口明确404。
- packages/schemas：strict输入schema，不允许客户端注入身份。
- packages/mode-registry：三端共用的模式清单。
- packages/device-protocol：Transport契约与模拟器，不声明真实BLE已支持。
- packages/kele-agent：纯状态迁移校验，不是可靠执行Runtime。
- tests：边界、未知模式、状态和实际HTTP行为。
- CI：锁文件安装、类型检查、测试、三端构建；远端尚未执行。

兼容依据：[Vite运行环境](https://vite.dev/guide/)、[Taro安装说明](https://docs.taro.zone/docs/GETTING-STARTED)。Taro4.3.0要求React18，Web亦固定React18.3.1；使用经npm官方元数据核实的固定版本与锁文件，不盲目混装React19。

产品与架构依据在父目录docs/，进度在父目录flow/；本目录是独立Git边界，不初始化父目录。后续业务包随功能创建，避免以空目录表示完成。

## 当前验证与注意事项

2026-10-01：普通沙箱执行 `pnpm run verify` 退出码0，全部类型检查、5项基础测试和Web/服务器/weapp构建通过。[验收记录](../docs/reviews/T05-工程骨架验收记录.md)与[完整输出](verification/T05-verify.log)。远端CI与微信开发者工具/真机尚未执行。

`devEngines.runtime`将实际Node版本锁入依赖锁文件，避免全局Node25覆盖；首次安装可能需要下载固定运行时。[pnpm运行时说明](https://pnpm.io/package_json#devenginesruntime)。pnpm12的store/cache和安装脚本策略写在workspace YAML，.npmrc只保留官方registry。[pnpm配置说明](https://pnpm.io/cli/config)。

Taro默认会创建用户目录下的小型.taro4.0配置；受限环境首次创建可能需要一次提升权限，本项目之后的普通沙箱验证已通过。不修改用户HOME或安全设置。CLI自动安装全局性能插件的postinstall被明确禁用。共享TS编译范围通过mini.compile.include设置，不用全局hoist掩盖依赖错误。
