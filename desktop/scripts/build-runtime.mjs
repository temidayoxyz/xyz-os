// Assemble the bundled engine runtime for the desktop sidecar.
//
// Outputs:
//   desktop/runtime/runtime.tar.zst                the self-contained app tree
//   desktop/src-tauri/binaries/xyz-engine-<triple>[.exe]   the Node engine
//
// The app tree ships as ONE compressed archive so the Tauri build script
// copies a single resource file instead of walking tens of thousands of files
// (the old per-directory resource also followed pnpm's workspace links, which
// recurse forever on the vendored Cordis dependency cycle). The archive keeps
// pnpm's link layout, with every link target made relative to its own
// directory so extraction is location-independent. Verification boots the
// packed engine and checks the web UI answers before the script reports
// success.
//
// Usage: node scripts/build-runtime.mjs [--skip-verify] [--skip-copy] [--keep-stage]

import { execSync, spawnSync } from 'node:child_process'
import {
  cpSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as tar from 'tar'
import zstd from '@mongodb-js/zstd'

const desktopRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = join(desktopRoot, '..')
const runtimeRoot = join(desktopRoot, 'runtime')
const stageRoot = join(runtimeRoot, '.stage')
const archivePath = join(runtimeRoot, 'runtime.tar.zst')
const tarPath = join(runtimeRoot, 'runtime.tar')
const skipVerify = process.argv.includes('--skip-verify')
const skipCopy = process.argv.includes('--skip-copy')
const keepStage = process.argv.includes('--keep-stage')

const EXCLUDE_DIRS = new Set([
  '.agents',
  '.claude',
  '.codex',
  '.dsh',
  '.git',
  '.github',
  'assets',
  'desktop',
  'docs',
  'examples',
  'native',
  'python',
  'scripts',
  'website',
])

const EXCLUDE_ROOT_FILES = new Set([
  '.editorconfig',
  '.gitattributes',
  '.gitignore',
  '.gitlab-ci.yml',
  '.jscpd.json',
  '.oxlintrc.json',
  '.oxlintrc.staged.json',
  '.rgignore',
  'AGENTS.md',
  'BENCHMARK.md',
  'CLAUDE.md',
  'CONTRIBUTING.i18n.yaml',
  'CONTRIBUTING.md',
  'CONTRIBUTING.zh.md',
  'README.i18n.yaml',
  'README.md',
  'README.zh.md',
  'knip.json',
  'lefthook.yml',
  'pytest.ini',
  'tsconfig.base.client.json',
  'tsconfig.base.json',
  'tsconfig.client.json',
  'tsconfig.client.tsbuildinfo',
  'tsconfig.host.json',
  'tsconfig.host.tsbuildinfo',
  'tsconfig.json',
  'tsdown.config.ts',
  'vitest.config.ts',
  'vitest.e2e.config.ts',
  'vitest.shared.ts',
  'vitest.snapshot.config.ts',
  'vitest.web.config.ts',
  'vitest.web.perf.config.ts',
  'vitest.web-stress.config.ts',
])

function copyFilter(src) {
  const rel = src.slice(repoRoot.length + 1).replaceAll('\\', '/')
  if (rel === '') return true
  const top = rel.split('/')[0]
  if (EXCLUDE_DIRS.has(top)) {
    // native/ is excluded except the landlock JS wrapper subtree, which the
    // sandbox packages resolve for workspace path handling.
    if (top === 'native') {
      if (
        rel === 'native/landlock-run/packages/entry' ||
        rel.startsWith('native/landlock-run/packages/entry/')
      ) {
        return false
      }
      return rel === 'native' || rel.startsWith('native/landlock-run')
    }
    return false
  }
  // Every nested node_modules is recreated by the production install; the dev
  // links are Windows junctions/symlinks the copy must not reproduce.
  if (rel.split('/').includes('node_modules')) return false
  // Skip test directories and incremental compiler state.
  if (rel.endsWith('.tsbuildinfo')) return false
  if (
    /(^|\/)tests?(\/|$)/.test(rel) &&
    (rel.startsWith('packages/') || rel.startsWith('apps/') || rel.startsWith('vendor/'))
  ) {
    return false
  }
  return true
}

/** Rust host triple for the Tauri externalBin naming convention. */
function hostTriple() {
  try {
    const output = execSync('rustc -vV', { encoding: 'utf8' })
    const match = /host:\s*(\S+)/.exec(output)
    if (match) return match[1]
  } catch {
    // rustc missing: fall through to the platform table.
  }
  const table = {
    'win32-x64': 'x86_64-pc-windows-msvc',
    'win32-arm64': 'aarch64-pc-windows-msvc',
    'darwin-x64': 'x86_64-apple-darwin',
    'darwin-arm64': 'aarch64-apple-darwin',
    'linux-x64': 'x86_64-unknown-linux-gnu',
    'linux-arm64': 'aarch64-unknown-linux-gnu',
  }
  const fallback = table[`${process.platform}-${process.arch}`]
  if (!fallback) {
    console.error(`unknown host ${process.platform}-${process.arch}; install rustc or extend the table`)
    process.exit(1)
  }
  return fallback
}

console.log('== XYZ-OS desktop runtime builder ==')
console.log(`repo: ${repoRoot}`)
console.log(`out:  ${archivePath}`)

mkdirSync(runtimeRoot, { recursive: true })
rmSync(archivePath, { force: true })
rmSync(tarPath, { force: true })
rmSync(join(runtimeRoot, 'node'), { recursive: true, force: true }) // old layout residue

if (skipCopy) {
  console.log('--skip-copy: reusing the existing stage tree; install + verify only')
} else {
  if (existsSync(stageRoot)) rmSync(stageRoot, { recursive: true, force: true })
  mkdirSync(stageRoot, { recursive: true })

  console.log('copying workspace (this is the big one)...')
  for (const entry of readdirSync(repoRoot)) {
    if (EXCLUDE_DIRS.has(entry) || EXCLUDE_ROOT_FILES.has(entry)) continue
    const src = join(repoRoot, entry)
    try {
      if (statSync(src).isDirectory()) {
        cpSync(src, join(stageRoot, entry), {
          recursive: true,
          verbatimSymlinks: false,
          filter: copyFilter,
        })
      } else {
        cpSync(src, join(stageRoot, entry))
      }
    } catch (error) {
      console.warn(`skipping ${entry}: ${error.message}`)
    }
  }

  // native/: only the landlock JS wrapper is needed. Copied piece by piece
  // because the tree contains a dev junction that cpSync refuses on Windows.
  {
    const landlock = join(repoRoot, 'native', 'landlock-run')
    const landlockDst = join(stageRoot, 'native', 'landlock-run')
    cpSync(join(landlock, 'package.json'), join(landlockDst, 'package.json'))
    mkdirSync(join(landlockDst, 'packages'), { recursive: true })
    for (const piece of readdirSync(join(landlock, 'packages'))) {
      const src = join(landlock, 'packages', piece)
      if (!statSync(src).isDirectory()) continue
      cpSync(src, join(landlockDst, 'packages', piece), {
        recursive: true,
        verbatimSymlinks: false,
        filter: (path) =>
          path === src || !path.replaceAll('\\', '/').split('/').includes('node_modules'),
      })
    }
    console.log('native: landlock wrapper package included')
  }

  // The web UI build is required at runtime (the engine serves it).
  const webDist = join(repoRoot, 'apps', 'web', 'dist')
  const webDistDst = join(stageRoot, 'apps', 'web', 'dist')
  if (existsSync(webDist)) {
    mkdirSync(join(stageRoot, 'apps', 'web'), { recursive: true })
    cpSync(webDist, webDistDst, { recursive: true })
    console.log('web UI: apps/web/dist included')
  } else {
    console.warn('WARNING: apps/web/dist missing — build the workspace first!')
  }

  // The repo's postinstall installs lefthook git hooks. A bundled runtime has
  // no git checkout and no dev tooling, so drop only that hook; workspace
  // postinstalls (for example the node-pty spawn helper) still run.
  const stageManifest = join(stageRoot, 'package.json')
  const manifest = JSON.parse(readFileSync(stageManifest, 'utf8'))
  if (manifest.scripts) delete manifest.scripts.postinstall
  writeFileSync(stageManifest, `${JSON.stringify(manifest, null, 2)}\n`)
  // Harness packages declare @deepseek-ai/cordis as a peer dependency, so the
  // production-only install must still link peers or the engine cannot boot.
  writeFileSync(join(stageRoot, '.npmrc'), 'auto-install-peers=true\n')
}

// Production-only dependency install, served from the pnpm store.
console.log('pnpm install --offline --prod ...')
const install = spawnSync(
  process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
  ['install', '--offline', '--prod'],
  {
    cwd: stageRoot,
    shell: process.platform === 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, npm_config_loglevel: 'error' },
  },
)
if (install.status !== 0) {
  console.error(`pnpm install failed (exit ${install.status}):`)
  console.error(`${install.stdout ?? ''}\n${install.stderr ?? ''}`.slice(0, 3000))
  process.exit(1)
}

// A production install skips workspace peer links; restore them so the engine
// can import @deepseek-ai/cordis and friends at runtime.
console.log('linking workspace peers...')
const linkPeers = spawnSync(
  process.execPath,
  [join(desktopRoot, 'scripts', 'link-peers.mjs'), stageRoot],
  { stdio: 'inherit', env: process.env },
)
if (linkPeers.status !== 0) {
  console.error('link-peers failed')
  process.exit(1)
}

// Rewrite absolute link targets to relative ones so the archive is portable.
console.log('normalizing links...')
const normalize = spawnSync(
  process.execPath,
  [join(desktopRoot, 'scripts', 'normalize-links.mjs'), stageRoot],
  { stdio: 'inherit', env: process.env },
)
if (normalize.status !== 0) {
  console.error('normalize-links failed')
  process.exit(1)
}

if (!skipVerify) {
  console.log('verifying the bundled engine boots...')
  const binJs = join(stageRoot, 'apps', 'cli', 'lib', 'bin.js')
  if (!existsSync(binJs)) {
    console.error('bin.js missing — build the workspace first (pnpm run build)')
    process.exit(1)
  }
  const { spawn } = await import('node:child_process')
  const verifyHome = join(runtimeRoot, '.verify-home')
  rmSync(verifyHome, { recursive: true, force: true })
  mkdirSync(verifyHome, { recursive: true })
  const child = spawn(process.execPath, [binJs, 'web', '--port', '0'], {
    cwd: stageRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, DSH_HOME: verifyHome },
  })
  let log = ''
  child.stdout.on('data', (chunk) => {
    log += chunk.toString()
  })
  child.stderr.on('data', (chunk) => {
    log += chunk.toString()
  })
  let ok = false
  for (let attempt = 0; attempt < 60; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 1000))
    const match = /xyz web: (https?:\/\/[^\s]+)/.exec(log)
    if (match) {
      const url = match[1].split(' (LAN:')[0]
      try {
        const response = await fetch(url)
        if (response.ok) {
          ok = true
          break
        }
      } catch {
        // engine announced the URL but is not answering yet; keep polling
      }
    }
    if (child.exitCode !== null) break
  }
  try {
    child.kill()
  } catch {}
  rmSync(verifyHome, { recursive: true, force: true })
  if (!ok) {
    console.error('VERIFY FAILED:')
    console.error(log.slice(0, 2000))
    process.exit(1)
  }
  console.log('VERIFY OK: bundled engine booted and served the UI over HTTP')
}

console.log('archiving runtime (tar + zstd level 19)...')
const started = Date.now()
await new Promise((resolvePromise, rejectPromise) => {
  const output = createWriteStream(tarPath)
  output.on('error', rejectPromise)
  output.on('close', resolvePromise)
  const pack = tar.c(
    {
      cwd: stageRoot,
      portable: true,
      mtime: new Date(0),
      onWriteEntry(entry) {
        // Windows junctions read back as absolute paths; rewrite their targets
        // relative to the link's own directory so extraction is portable.
        if (entry.type === 'SymbolicLink' && entry.linkpath) {
          entry.linkpath = relative(resolve(stageRoot, dirname(entry.path)), entry.linkpath).replaceAll(
            '\\',
            '/',
          )
        }
      },
    },
    ['.'],
  )
  pack.on('error', rejectPromise)
  pack.pipe(output)
})
const tarBytes = readFileSync(tarPath)
writeFileSync(archivePath, await zstd.compress(tarBytes, 19))
rmSync(tarPath, { force: true })
console.log(`archive written in ${Math.round((Date.now() - started) / 1000)}s`)

// Ship the machine's Node as the engine Tauri places beside the executable.
const triple = hostTriple()
const engineDst = join(
  desktopRoot,
  'src-tauri',
  'binaries',
  `xyz-engine-${triple}${process.platform === 'win32' ? '.exe' : ''}`,
)
mkdirSync(join(desktopRoot, 'src-tauri', 'binaries'), { recursive: true })
cpSync(process.execPath, engineDst)
console.log(`engine: ${process.execPath} -> ${engineDst}`)

if (!keepStage) {
  rmSync(stageRoot, { recursive: true, force: true })
  console.log('stage removed')
}

const archiveSize = statSync(archivePath).size
console.log(`runtime size: ${(archiveSize / 1024 / 1024).toFixed(0)} MB compressed`)
console.log('== runtime ready ==')
