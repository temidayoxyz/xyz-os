// Audit every symlink/junction in the tree before it is archived.
//
// Windows junctions always store absolute targets (the OS resolves relative
// targets at creation time), so targets are made location-independent when the
// tar is written, not here. This pass only enforces the invariants the archive
// relies on: no link may resolve outside the root, and pnpm's dangling links
// for skipped optional/dev dependencies are dropped because nothing resolves
// them.
import { lstatSync, readdirSync, realpathSync, unlinkSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = process.argv[2]
if (!root) {
  console.error('usage: node normalize-links.mjs <root>')
  process.exit(1)
}

const rootResolved = resolve(root)
let dropped = 0
const failures = []

function walk(dir) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch (error) {
    failures.push(`cannot read ${dir}: ${error.message}`)
    return
  }
  for (const entry of entries) {
    const full = join(dir, entry.name)
    let stat
    try {
      stat = lstatSync(full)
    } catch (error) {
      failures.push(`cannot stat ${full}: ${error.message}`)
      continue
    }
    if (!stat.isSymbolicLink()) {
      if (stat.isDirectory()) walk(full)
      continue
    }
    let real
    try {
      real = realpathSync(full)
    } catch {
      try {
        unlinkSync(full)
        dropped++
      } catch {}
      continue
    }
    if (!real.startsWith(rootResolved)) {
      failures.push(`link escapes root: ${full} -> ${real}`)
    }
  }
}

walk(root)
console.log(`normalize-links: dropped ${dropped} dangling link(s)`)

if (failures.length > 0) {
  console.error(`ERROR: link audit failures (${failures.length}):`)
  for (const failure of failures.slice(0, 20)) console.error(`  ${failure}`)
  process.exit(1)
}
console.log('normalize-links OK: every link target stays inside the root')
