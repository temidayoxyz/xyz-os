# Agent Note: Desktop shell ships the engine as one extracted archive

Status: implemented

English | [中文](2026-08-15-desktop-shell-archive.zh.md)

## Problem

A desktop distribution of the harness needed a native window around the existing web UI without reimplementing product behavior. The first attempt shipped the whole workspace as a Tauri resource directory; the Tauri build script expands directory resources into per-file watch entries and copies, and it follows pnpm's workspace links while walking. The vendored Cordis packages link each other, so the walk recursed until Windows rejected the path (`os error 161`). Builds took tens of minutes and then failed, and the installers inherited the same link fragility.

## Decision

The shell ships one `runtime/runtime.tar.zst` resource (a zstd-compressed tar) plus a per-target Node engine binary as a Tauri external binary. On first launch it extracts the archive into the per-user app data dir and recreates pnpm's workspace links as junctions on Windows and symlinks on Unix, with each target resolved against the extracted tree. Link targets are rewritten to relative paths when the archive is written, because Windows junctions always read back their absolute paths. Windows junctions also store absolute paths, so extraction writes directly into the final directory and a version marker written last marks the tree complete; a partial tree from an interrupted extraction is cleared on the next launch. The engine starts with `--port 0`, and the shell navigates to the loopback URL the engine prints on stdout, so the desktop app never contends with a dev server on port 3080. Dev builds skip the archive and open `http://127.0.0.1:3080`.

For the `universal-apple-darwin` target the engine binary is a `lipo` merge of the Node builds for both darwin CPUs, and the staged production install records pnpm `supportedArchitectures` for darwin x64 + arm64 so one archive carries both CPU variants of the optional platform packages. Intel and Apple Silicon Macs therefore share one runtime tree.

## Alternatives considered

**Bundle the workspace as a resource directory.** The natural first reading of the Tauri config, and the original implementation — rejected because the build script expands directories into tens of thousands of per-file operations and follows links, which the vendored dependency cycle turns into unbounded recursion.

**Copy every link target into a real directory before bundling.** Removes links entirely, but duplicates the dependency tree into a multi-gigabyte artifact (roughly 500 MB of packages became 3 GB), and the cycle handling still left some links behind on later installs.

**Ship without the engine and require a local Node install.** Cuts the payload but breaks "one installer, everything runs", and silently depends on the user's Node version, which the harness does not own.

**Electron instead of Tauri.** An equivalent window shell with a much larger runtime, rejected for size and because the app needs only one webview plus one child process.

## Consequences

The Tauri build script copies one resource file, so desktop builds take minutes instead of tens of minutes and the installers are roughly 147 MB on Windows, 122 MB of which is the compressed engine runtime. First launch extracts about 500 MB and recreates roughly 3,500 workspace links; later launches skip extraction. The packed engine is boot-verified and the web UI is fetched before any installer is produced. macOS and Linux artifacts are unsigned until platform signing credentials are configured.

Windows ships both an NSIS installer and an MSI, and macOS ships one universal DMG that runs on Intel and Apple Silicon, so no separate Intel build is released.
