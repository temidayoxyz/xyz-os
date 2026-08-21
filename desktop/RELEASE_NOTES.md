# XYZ-OS Desktop 0.1.1

The engine update release: the desktop shell now ships the upstream
deepseek-harness v0.1.1-rc.2 engine, merged with XYZ-OS's five modes and
plugins. The shell itself is unchanged.

## What's new

- Engine updated from 0.1.0-rc.5 to 0.1.1-rc.2, bringing:
  - automatic browser handoff on boot (`--no-open` to disable);
  - native image requests with automatic resizing and format conversion;
  - subagents as Profile Bundles and persistent PowerShell sessions;
  - the new slot-based brand architecture (XYZ-OS branding rides the same
    slots, so the UI stays fully rebranded);
  - a reworked session-projection API (the DeepSeek tariff plugin's
    per-session spend chip was migrated to it).
- The sidebar no longer shows a build-revision hash next to the logo.
- The five modes (Coworker, Coder, Designer, Assistant, Creator), the
  DeepSeek peak/off-peak tariff chip, and the Deep Design preset all carry
  over unchanged.

## Install

- **Windows** — run `XYZ-OS_0.1.1_x64-setup.exe` (NSIS) or
  `XYZ-OS_0.1.1_x64_en-US.msi` (MSI). The app installs per user; SmartScreen
  may ask you to confirm because the installer is unsigned.
- **macOS** — open `XYZ-OS_0.1.1_universal.dmg` and drag XYZ-OS into
  Applications. The universal app runs on both Apple Silicon and Intel Macs.
  The app is unsigned, so the first open may require right-click → Open (or
  System Settings → Privacy & Security → Open Anyway).
- **Linux** — install `xyz-os_0.1.1_amd64.deb` with your package manager, or
  run the AppImage after `chmod +x`.

The first launch takes a few seconds while the engine runtime unpacks; later
launches start immediately.

## Notes

- The desktop app shares the same `~/.dsh` session data as the CLI, so
  sessions and modes carry over. Existing sessions stay readable; tariff
  spend projections rebuild from the session log on demand.
- No API keys or model credentials are bundled: each user's keys stay in
  their own `~/.dsh` profile and are added from the Models page.
- macOS and Linux artifacts are unsigned in this release; code signing and
  notarization require platform credentials and can be layered on without
  changing the app.
- The engine binds to `127.0.0.1` only; nothing is exposed to the network.
