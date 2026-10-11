本地字体放置说明（阶段1B · 去掉 Google Fonts CDN）
====================================================

目标：本地打包一款「可爱圆体」，SIL Open Font License (OFL) 许可，零外链、离线可用。

当前状态
--------
构建环境无法联网下载字体文件，因此暂时使用「系统圆体优先」字体栈
（见 src/styles.css 的 --font：Baloo 2 / ZCOOL KuaiLe / Yuanti SC / 幼圆 / PingFang SC /
Microsoft YaHei / system-ui ...）。已经能立即呈现圆润观感，且不会产生任何外链请求或 404。

拿到字体后如何启用（3 步）
--------------------------
1) 下载 OFL 许可的可爱圆体，推荐任一：
   - Baloo 2（拉丁/数字，圆润）  https://fonts.google.com/specimen/Baloo+2
   - 站酷快乐体 ZCOOL KuaiLe（中文）https://fonts.google.com/specimen/ZCOOL+KuaiLe
   两者均为 SIL Open Font License 1.1，可自由打包分发（详见 THIRD_PARTY_NOTICES）。

2) 把 woff2 文件放进本目录 public/fonts/，建议命名：
   - Baloo2-VariableFont_wght.woff2
   - ZCOOLKuaiLe-Regular.woff2
   （Vite 会把 public/ 下的文件原样拷进构建产物根目录，运行时以 /fonts/xxx.woff2 访问。）

3) 打开 src/styles.css，取消文件顶部那两段 @font-face 的注释即可。
   字体名与 --font 字体栈里的 "Baloo 2" / "ZCOOL KuaiLe" 已对应，无需再改别处。

许可
----
放入的字体必须为 MIT / CC0 / OFL 之一（本项目只用这三种）。请在本目录或
THIRD_PARTY_NOTICES 里记录字体名称、版本、来源链接与 OFL 版权声明。
