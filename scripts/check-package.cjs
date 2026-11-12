const assert = require('node:assert/strict');
const fs = require('node:fs');
const p = JSON.parse(fs.readFileSync('package.json', 'utf8'));
assert.equal(p.name, 'opencode-codex-limits-desktop');
assert.equal(p.private, true, 'npm publication is deliberately disabled until ownership is configured');
for (const entry of Object.values(p.exports || {}).flatMap(v => typeof v === 'string' ? [v] : Object.values(v))) {
  assert.ok(fs.existsSync(entry), 'missing entrypoint: ' + entry);
}
for (const entry of Object.values(p.bin || {})) assert.ok(fs.existsSync(entry), 'missing binary entry: ' + entry);
console.log(p.name + '@' + p.version + ': package identity and entrypoints OK');
const gui = fs.readFileSync('gui-experimental.cjs', 'utf8');
assert.ok(!/[\u3040-\u30ff\u4e00-\u9fff]/u.test(gui), 'unexpected untranslated Japanese text');
const server = fs.readFileSync('src/entry.ts', 'utf8');
assert.ok(!/readGo|readClaude|readXAI|Bun\.file|codexLogin/.test(server), 'unexpected provider or local auth-file access');
assert.ok(server.includes('redirect: "error"'), 'quota requests must reject redirects');
