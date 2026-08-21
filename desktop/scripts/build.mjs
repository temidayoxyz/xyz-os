// Build the desktop app for the current platform.
//
// The bundle targets differ per OS, so they are chosen here rather than in
// tauri.conf.json: Windows ships NSIS + MSI, macOS an app bundle plus DMG
// (universal on Apple Silicon CI), and Linux a DEB plus AppImage. Pass
// `--bundles <csv>` and `--target <rust-triple>` to override.
//
// Usage: node scripts/build.mjs [--bundles <csv>] [--target <triple>] [--skip-verify]

import { spawnSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const desktopRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

function defaultBundles() {
  if (process.platform === 'win32') return 'nsis,msi'
  if (process.platform === 'darwin') return 'app,dmg'
  return 'deb,appimage'
}

function run(command, args, label) {
  // cmd.exe splits an unquoted command at spaces, which breaks any Node
  // installed under "C:\Program Files".
  const quoted = process.platform === 'win32' ? `"${command}"` : command
  const result = spawnSync(quoted, args, {
    cwd: desktopRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  if (result.status !== 0) {
    console.error(`${label} failed (exit ${result.status})`)
    process.exit(result.status ?? 1)
  }
}

const bundlesIndex = process.argv.indexOf('--bundles')
const bundles =
  bundlesIndex !== -1 && process.argv[bundlesIndex + 1]
    ? process.argv[bundlesIndex + 1]
    : defaultBundles()

const targetIndex = process.argv.indexOf('--target')
const target = targetIndex !== -1 ? process.argv[targetIndex + 1] : null
const universal = target === 'universal-apple-darwin'

const runtimeArgs = ['scripts/build-runtime.mjs']
if (process.argv.includes('--skip-verify')) runtimeArgs.push('--skip-verify')
if (universal) runtimeArgs.push('--universal-macos')
if (target) runtimeArgs.push('--engine-triple', target)

run(process.execPath, runtimeArgs, 'build-runtime')

const tauriBin = join(
  desktopRoot,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'tauri.cmd' : 'tauri',
)
const tauriArgs = ['build', '--bundles', bundles]
if (target) tauriArgs.push('--target', target)
run(tauriBin, tauriArgs, `tauri build --bundles ${bundles}${target ? ` --target ${target}` : ''}`)
