# XYZ-OS Desktop 0.1.0

The first XYZ-OS desktop release: the local agent engine in a native window on
Windows, macOS, and Linux, with no changes to the web UI.

## What's included

- A thin Rust/Tauri shell that unpacks the bundled engine, boots it on a free
  loopback port, and opens the same web UI in a native window.
- The complete engine runtime as one compressed archive: built packages,
  production dependencies, the web UI, and the vendored framework.
- Single-instance behavior, engine cleanup on exit, and automatic recovery
  from an interrupted first-run extraction.

## Install

- **Windows** — run `XYZ-OS_0.1.0_x64-setup.exe`. The app installs per user;
  SmartScreen may ask you to confirm because the installer is unsigned.
- **macOS** — open `XYZ-OS_0.1.0_aarch64.dmg` on an Apple Silicon Mac and drag
  XYZ-OS into Applications.
  The app is unsigned, so the first open may require right-click → Open (or
  System Settings → Privacy & Security → Open Anyway).
- **Linux** — install `xyz-os_0.1.0_amd64.deb` with your package manager, or
  run the AppImage after `chmod +x`.

The first launch takes a few seconds while the engine runtime unpacks; later
launches start immediately.

## Notes

- The desktop app shares the same `~/.dsh` session data as the CLI, so
  sessions and modes carry over.
- No API keys or model credentials are bundled: each user's keys stay in their
  own `~/.dsh` profile and are added from the Models page.
- macOS and Linux artifacts are unsigned in this release; code signing and
  notarization require platform credentials and can be layered on without
  changing the app.
- The engine binds to `127.0.0.1` only; nothing is exposed to the network.
