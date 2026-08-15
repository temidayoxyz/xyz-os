// Link every workspace package's peer dependencies into its node_modules.
//
// pnpm skips peers of workspace projects on a production install, but the
// built engine imports its peers at runtime (every harness package declares
// @deepseek-ai/cordis as a peer). This recreates the links a dev install would
// have made, without installing the dev-only packages themselves.
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  symlinkSync,
} from 'node:fs'
import { dirname, join, relative } from 'node:path'

const root = process.argv[2]
if (!root) {
  console.error('usage: node link-peers.mjs <root>')
  process.exit(1)
}

const globs = [
  { base: ['packages'], depth: 2 },
  { base: ['vendor'], depth: 1 },
  { base: ['apps'], depth: 1 },
  { base: ['native', 'landlock-run', 'packages'], depth: 1 },
]

/** Expand the shallow workspace globs to package directories. */
function packageDirs() {
  const dirs = []
  for (const glob of globs) {
    const walk = (base, depth) => {
      if (depth === 0) {
        dirs.push(base)
        return
      }
      let entries
      try {
        entries = readdirSync(base, { withFileTypes: true })
      } catch {
        return
      }
      for (const entry of entries) {
        if (entry.isDirectory() || entry.isSymbolicLink()) {
          walk(join(base, entry.name), depth - 1)
        }
      }
    }
    const base = join(root, ...glob.base)
    walk(base, glob.depth)
  }
  return dirs.filter((dir) => existsSync(join(dir, 'package.json')))
}

const dirs = packageDirs()
const byName = new Map()
for (const dir of dirs) {
  try {
    const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
    if (manifest.name) byName.set(manifest.name, dir)
  } catch {
    // unreadable manifest: skip
  }
}

let linked = 0
for (const dir of dirs) {
  let manifest
  try {
    manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
  } catch {
    continue
  }
  for (const name of Object.keys(manifest.peerDependencies ?? {})) {
    const target = byName.get(name)
    if (!target) continue
    const dest = join(dir, 'node_modules', name)
    if (existsSync(dest)) continue
    try {
      mkdirSync(dirname(dest), { recursive: true })
      symlinkSync(relative(dirname(dest), target), dest, process.platform === 'win32' ? 'junction' : 'dir')
      linked++
    } catch (error) {
      console.error(`cannot link ${name} into ${dir}: ${error.message}`)
      process.exit(1)
    }
  }
}
console.log(`link-peers: linked ${linked} workspace peer(s)`)
