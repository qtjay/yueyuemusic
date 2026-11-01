# 悦悦哄睡

一款儿童睡前音乐播放器，支持在线搜索播放、下载缓存与离线收听。

## 来源与致谢

本项目基于以下开源项目修改：

- [lx-music-mobile](https://github.com/lyswhut/lx-music-mobile)（v1.9.2，Apache-2.0）— 音乐播放内核与整体架构
- [musicsquare](https://github.com/qtjay/musicsquare) — UI 布局与交互逻辑参考
- [lx-music-source](https://github.com/pdone/lx-music-source) — 内置音源脚本集合

音源脚本版权归各自原作者所有，本项目仅做内置集成，不做任何修改。

## 功能特性

- **在线播放**：多平台搜索，支持音质切换、歌词、后台播放
- **内置音源**：预置 16 个洛雪音源（六音、fish、星海、玉宁熙等），首次启动自动导入，可自行增删
- **离线缓存**：
  - 播放时自动缓存开关，听过的歌自动落盘，断网也能播
  - 「离线缓存」页面查看已缓存歌曲（大小、音质、时间），支持单曲删除与清空
  - 缓存文件存于应用私有目录，播放时优先命中本地文件
- **主题**：默认「悦悦哄睡」（清新绿白），深色模式自动切换「悦悦夜眠」

## 技术栈

React Native 0.73.11 · Android（minSdk 21 / compileSdk 36 / NDK 26.1）

## 构建

推送到 `main` 即由 GitHub Actions 自动构建 Debug APK，产物在 Actions 运行页的 Artifacts 中下载。

手动构建 Release 需在仓库 Settings → Secrets 中配置：

| Secret | 说明 |
|---|---|
| `KEYSTORE_BASE64` | 签名文件的 base64 编码 |
| `KEYSTORE_PASSWORD` | 密钥库密码 |
| `KEY_ALIAS` | 密钥别名 |
| `KEY_PASSWORD` | 密钥密码 |

未配置签名时，Release 会自动回退到 debug 签名，保证任何情况下都能出包。

## 本地开发

```bash
npm install          # 安装依赖
npm run gen:sources  # 从 .ref/lx-music-source 重新生成内置音源（需先克隆参考仓库）
npm run build:theme  # 修改主题配置后重新生成主题文件
npm run dev          # 本地运行（需 Android SDK）
```

## 许可

沿用上游 [Apache-2.0](./LICENSE) 许可，保留原作者署名。
