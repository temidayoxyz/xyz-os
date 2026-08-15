// Build the desktop app for the current platform.
//
// The bundle targets differ per OS, so they are chosen here rather than in
// tauri.conf.json: Windows ships an NSIS installer, macOS an app bundle plus
// DMG, and Linux a DEB plus AppImage. Pass `--bundles <csv>` to override.
//
// Usage: node scripts/build.mjs [--bundles <csv>] [--skip-verify]

import { spawnSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const desktopRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

function defaultBundles() {
  if (process.platform === 'win32') return 'nsis'
  if (process.platform === 'darwin') return 'app,dmg'
  return 'deb,appimage'
}

function run(command, args, label) {
  const result = spawnSync(command, args, {
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

const runtimeArgs = ['scripts/build-runtime.mjs']
if (process.argv.includes('--skip-verify')) runtimeArgs.push('--skip-verify')

run(process.execPath, runtimeArgs, 'build-runtime')

const tauriBin = join(
  desktopRoot,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'tauri.cmd' : 'tauri',
)
run(tauriBin, ['build', '--bundles', bundles], `tauri build --bundles ${bundles}`)
