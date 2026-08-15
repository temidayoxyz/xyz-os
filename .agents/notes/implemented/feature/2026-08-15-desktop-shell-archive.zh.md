# Agent Note：桌面外壳以单一解压归档打包引擎

Status: implemented

[English](2026-08-15-desktop-shell-archive.md) | 中文

## 问题

桌面版需要在现有 Web UI 之外提供一个原生窗口，同时不得重复实现产品行为。最初的方案把整个工作区作为 Tauri 资源目录打包；Tauri 构建脚本会把目录资源展开成逐文件的 watch 条目并复制，遍历时还会跟随 pnpm 的工作区链接。vendor 中的 Cordis 包互相链接，遍历因此不断递归，直到 Windows 拒绝该路径（`os error 161`）。构建耗时数十分钟后失败，安装包也继承了同样的链接脆弱性。

## 决策

外壳只携带一个 `runtime/runtime.tar.zst` 资源（zstd 压缩的 tar），外加按目标平台准备的 Node 引擎二进制，作为 Tauri external binary。首次启动时，它把归档解压到按用户的 app data 目录，并把 pnpm 的工作区链接重建为 Windows 上的 junction 和 Unix 上的 symlink，每个目标都相对解压后的目录解析。写入归档时链接目标会被改写为相对路径，因为 Windows junction 读回时始终是绝对路径；Windows junction 本身也只存绝对路径，因此解压直接写入最终目录，最后写入的版本标记表示树已完整，中断产生的残缺树会在下次启动时清除。引擎以 `--port 0` 启动，外壳导航到引擎在 stdout 上打印的 loopback URL，因此桌面应用永远不会与 3080 端口上的开发服务器冲突。开发构建跳过归档，直接打开 `http://127.0.0.1:3080`。

面向 `universal-apple-darwin` 目标时，引擎二进制是两种 darwin CPU 的 Node 构建经 `lipo` 合并的产物，暂存区的生产安装会记录 darwin x64 与 arm64 的 pnpm `supportedArchitectures`，使一个归档同时携带可选平台包的两个 CPU 变体。Intel 与 Apple Silicon Mac 因此共享同一份运行时树。

## 备选方案

**把工作区作为资源目录打包。** 对 Tauri 配置最直接的理解，也是最初实现——被否决，因为构建脚本把目录展开成数万次逐文件操作并跟随链接，而 vendor 中的依赖环会把遍历变成无界递归。

**打包前把所有链接目标复制成真实目录。** 完全消除链接，但会把依赖树复制成数 GB 的产物（约 500 MB 的包膨胀到 3 GB），而且后续安装时环处理仍会留下部分链接。

**不携带引擎，要求本机安装 Node。** 减小了体积，但破坏了「一个安装包、开箱即用」，并隐式依赖用户机器的 Node 版本，而该版本不受本仓库控制。

**用 Electron 代替 Tauri。** 一个等价窗口外壳却带大得多的运行时，因体积而被否决——应用只需要一个 webview 加一个子进程。

## 后果

Tauri 构建脚本只复制一个资源文件，桌面构建从数十分钟缩短到几分钟，Windows 安装包约 147 MB，其中 122 MB 是压缩后的引擎运行时。首次启动解压约 500 MB 并重建约 3,500 个工作区链接，后续启动跳过解压。任何安装包产出前都会启动打包引擎并验证 Web UI 可访问。macOS 与 Linux 产物在配置平台签名凭据之前保持未签名。

Windows 同时发布 NSIS 安装包与 MSI，macOS 发布一个同时覆盖 Intel 与 Apple Silicon 的通用 DMG，因此不再单独发布 Intel 构建。
