// Write the staged runtime as an uncompressed tar archive.
//
// A minimal ustar writer replaces the tar dependency: the archive must store
// RELATIVE link targets (Windows junctions read back absolute), GNU long-name
// records for the deep node_modules paths, and executable bits for helpers
// such as node-pty's spawn helper. Emitting the bytes directly makes the
// behavior deterministic on every Node version and platform.
//
// Usage: node write-runtime-tar.mjs <root> <out.tar>
import { createWriteStream } from 'node:fs'
import {
  lstat,
  mkdir,
  open,
  readdir,
  readFile,
  realpath,
} from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'

const root = process.argv[2]
const outPath = process.argv[3]
if (!root || !outPath) {
  console.error('usage: node write-runtime-tar.mjs <root> <out.tar>')
  process.exit(1)
}

const BLOCK = 512

function octal(value, length) {
  const text = value.toString(8)
  return `${text.padStart(length - 1, '0')}\0`
}

function ascii(value, length) {
  return Buffer.from(String(value)).subarray(0, length).toString('latin1').padEnd(length, '\0')
}

/** Build one 512-byte ustar header block. */
function header({ name, mode = 0o644, size = 0, type = '0', linkname = '' }) {
  const block = Buffer.alloc(BLOCK)
  Buffer.from(name, 'utf8').subarray(0, 100).copy(block, 0)
  block.write(octal(mode, 8), 100, 'latin1')
  block.write(octal(0, 8), 108, 'latin1')
  block.write(octal(0, 8), 116, 'latin1')
  block.write(octal(size, 12), 124, 'latin1')
  block.write(octal(0, 12), 136, 'latin1')
  block.write('        ', 148, 'latin1')
  block.write(type, 156, 'latin1')
  Buffer.from(linkname, 'utf8').subarray(0, 100).copy(block, 157)
  block.write('ustar\0', 257, 'latin1')
  block.write('00', 263, 'latin1')
  block.write(ascii('', 32), 265, 'latin1')
  block.write(ascii('', 32), 297, 'latin1')
  block.write(octal(0, 8), 329, 'latin1')
  block.write(octal(0, 8), 337, 'latin1')
  block.write(ascii('', 155), 345, 'latin1')
  let checksum = 0
  for (const byte of block) checksum += byte
  block.write(octal(checksum, 7), 148, 'latin1')
  block[154] = 0x20
  block[155] = 0
  return block
}

function pad(block) {
  if (block.length % BLOCK === 0) return block
  return Buffer.concat([block, Buffer.alloc(BLOCK - (block.length % BLOCK))])
}

/** GNU long-name ('L') / long-linkname ('K') record preceding an entry. */
function longRecord(type, text) {
  const data = Buffer.concat([Buffer.from(text, 'utf8'), Buffer.from([0])])
  return Buffer.concat([
    header({ name: '././@LongLink', type, size: data.length }),
    pad(data),
  ])
}

async function collect(dir, prefix, entries) {
  const names = await readdir(dir, { withFileTypes: true })
  names.sort((a, b) => a.name.localeCompare(b.name))
  for (const entry of names) {
    const full = join(dir, entry.name)
    const name = prefix ? `${prefix}/${entry.name}` : entry.name
    const stat = await lstat(full)
    if (stat.isSymbolicLink()) {
      let target
      try {
        target = await realpath(full)
      } catch {
        continue // dangling links were dropped earlier; skip defensively
      }
      const linkname = relative(dirname(full), target).replaceAll('\\', '/')
      entries.push({ name, type: '2', mode: 0o777, linkname, size: 0, source: null })
    } else if (stat.isDirectory()) {
      entries.push({ name, type: '5', mode: stat.mode & 0o777, linkname: '', size: 0, source: null })
      await collect(full, name, entries)
    } else if (stat.isFile()) {
      entries.push({ name, type: '0', mode: stat.mode & 0o777, linkname: '', size: stat.size, source: full })
    }
  }
}

const entries = []
await collect(root, '', entries)
entries.push({ name: '', type: '5', mode: 0o755, linkname: '', size: 0, source: null })

await mkdir(dirname(outPath), { recursive: true })
const output = createWriteStream(outPath)
let failed = null
output.on('error', (error) => {
  failed = error
})

for (const entry of entries) {
  if (failed) break
  if (Buffer.byteLength(entry.name, 'utf8') >= 100) {
    output.write(longRecord('L', entry.name))
  }
  if (Buffer.byteLength(entry.linkname, 'utf8') >= 100) {
    output.write(longRecord('K', entry.linkname))
  }
  output.write(header(entry))
  if (entry.source) {
    const handle = await open(entry.source, 'r')
    try {
      let position = 0
      while (position < entry.size) {
        const { bytesRead, buffer } = await handle.read(
          Buffer.alloc(Math.min(8 * 1024 * 1024, entry.size - position)),
          0,
          Math.min(8 * 1024 * 1024, entry.size - position),
          position,
        )
        if (bytesRead === 0) break
        output.write(buffer.subarray(0, bytesRead))
        position += bytesRead
      }
    } finally {
      await handle.close()
    }
    const remainder = entry.size % BLOCK
    if (remainder !== 0) output.write(Buffer.alloc(BLOCK - remainder))
  }
}

output.write(Buffer.alloc(BLOCK * 2))

await new Promise((resolvePromise, rejectPromise) => {
  output.on('close', () => (failed ? rejectPromise(failed) : resolvePromise()))
  output.on('error', rejectPromise)
  output.end()
})

console.log(`write-runtime-tar: wrote ${entries.length} entries`)
