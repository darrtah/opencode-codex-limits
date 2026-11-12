import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const patterns = [
  /\bsk-[A-Za-z0-9_-]{20,}/g,
  /\bgh[pousr]_[A-Za-z0-9_]{20,}/g,
  /eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}/g,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/g,
  /[A-Za-z]:[\\/]Users[\\/](?!YOUR_USER)[^\s"']+/g,
]
const found = []
function scan(name, text) {
  if (patterns.some((pattern) => { pattern.lastIndex = 0; return pattern.test(text) })) found.push(name)
}
const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z']).toString().split('\0').filter(Boolean)
for (const file of files) scan(file, readFileSync(file, 'utf8'))
// Scan every reachable historical blob, not just the current checkout.
const objects = execFileSync('git', ['rev-list', '--objects', '--all']).toString().trim().split('\n')
let count = 0
for (const line of objects) {
  const hash = line.split(' ')[0]
  if (!hash) continue
  const type = execFileSync('git', ['cat-file', '-t', hash]).toString().trim()
  if (type !== 'blob') continue
  scan(`history:${hash}`, execFileSync('git', ['cat-file', 'blob', hash], { maxBuffer: 20 * 1024 * 1024 }).toString())
  count++
}
if (found.length) {
  console.error('Potential secrets or personal paths (values redacted):\n' + found.join('\n'))
  process.exitCode = 1
} else console.log(`Pattern scan passed: ${files.length} working files and ${count} historical blobs. Not a complete security audit.`)
