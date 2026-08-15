# XYZ-OS 桌面端

[English](README.md) | 中文

XYZ-OS 桌面应用是本地代理引擎外的一层轻量 Rust/Tauri 外壳。外壳从不重复实现产品行为：首次启动时解压随附的引擎运行时，启动随附的 Node 引擎在空闲的 loopback 端口上提供 Web UI，并把 webview 导航到引擎公布的那个 URL。会话、模式、模型与 UI 都在引擎里，因此桌面应用与 Web 应用的行为始终一致。

## 架构

应用运行时所需的一切都打包成一个资源：

- `runtime/runtime.tar.zst` —— 自包含的引擎树（已构建的包、生产依赖、Web UI 构建产物与 vendored 框架），以 zstd 压缩。Tauri 把它作为单个文件打包，构建脚本只需复制一个资源，而不是遍历数万个文件。
- `binaries/xyz-engine-<target-triple>[.exe]` —— Node，作为 Tauri external binary 随附，放在应用可执行文件旁。

首次启动时，外壳把归档解压到按用户的 app data 目录（`com.xyz.os` 下的 `runtime/`），把 pnpm 的工作区链接重建为 Windows 上的 junction 与 Unix 上的 symlink。版本标记让后续启动跳过解压；中断产生的残缺树会被自动清除。

引擎以 `--port 0` 启动，由操作系统分配空闲端口，桌面应用因此永远不会与运行中的 `xyz web` 开发服务器冲突。外壳监听引擎 stdout 中的 `xyz web: http://...` 一行并导航过去。关闭窗口会终止引擎。

## 构建

前提：Node 22.19+ 或 24+、pnpm 11、稳定版 Rust，以及 Tauri 2 的平台依赖（现代 Windows 自带 WebView2；Linux 需要 `libwebkit2gtk-4.1-dev` 等；macOS 需要 Xcode 命令行工具）。

```sh
pnpm install                       # from the repository root
pnpm run build                     # build the libraries and the web UI
cd desktop
pnpm install --ignore-workspace    # desktop-only tooling
pnpm run desktop:build             # build runtime + app for this platform
```

打包目标按平台选择：Windows 为 NSIS，macOS 为 app bundle + DMG，Linux 为 DEB + AppImage。可用 `node scripts/build.mjs --bundles <csv>` 覆盖。

`scripts/build-runtime.mjs` 负责组装运行时：复制工作区（排除仅开发用的目录）、从 pnpm store 安装生产依赖、恢复工作区 peer 链接、丢弃悬空的可选依赖链接、验证打包后的引擎能启动并提供 UI，最后归档整棵树。`--skip-copy` 复用已暂存的树；`--skip-verify` 跳过启动检查。

## 开发

自己运行 Web UI，再以开发模式启动外壳：

```sh
pnpm xyz web           # from the repository root (dev server on 127.0.0.1:3080)
cd desktop
pnpm run desktop:dev
```

开发构建跳过随附运行时，直接打开 `http://127.0.0.1:3080`。

## 验证

`pnpm run desktop:build` 在产出安装包之前，就会启动打包引擎并确认 Web UI 可访问。`XYZ_OS_PORT` 环境变量可为自动化冒烟测试固定引擎端口。

## 发布

推送 `desktop-v*` 标签。`Desktop` 工作流会在三个平台上构建、冒烟测试每个安装包，并把安装包连同 `RELEASE_NOTES.md` 中的说明发布到 GitHub Release。未配置签名凭据时，macOS 与 Linux 构建不签名。
