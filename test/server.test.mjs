import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'

// Run the actual server implementation with a mock OpenCode context and fetch.
// No real SDK runtime, account, disk credential store or network is involved.
let source = stripTypeScriptTypes(readFileSync(new URL('../src/entry.ts', import.meta.url), 'utf8'))
source = source.replace('import { Plugin } from "@opencode/plugin"', 'const Plugin = { define: (definition) => definition }')
source = source.replace('import { Usage } from "./contract"', 'const Usage = {}')
source = source.replace('"./quota-core.mjs"', JSON.stringify(new URL('../src/quota-core.mjs', import.meta.url).href))
source = source.replace('"./preferences.mjs"', JSON.stringify(new URL('../src/preferences.mjs', import.meta.url).href))
const { default: plugin } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'))

function context() {
  let selected = 'account-a'
  let handler
  return {
    integration: { connection: {
      active: async () => selected ? { type: 'credential', id: selected } : undefined,
      resolve: async () => ({ type: 'oauth', access: 'synthetic-test-value', metadata: { accountID: 'synthetic-account' } }),
    } },
    rpc: { register: async (_contract, methods) => { handler = methods.snapshot; return { dispose() {} } } },
    select(value) { selected = value },
    snapshot(input = {}) { return handler(input) },
  }
}

test('server request is GET, fixed destination, no redirects, output has no credential', async () => {
  const ctx = context()
  await plugin.setup(ctx)
  const original = globalThis.fetch
  let calls = 0
  try {
    globalThis.fetch = async (url, options) => {
      calls++
      assert.equal(url, 'https://chatgpt.com/backend-api/wham/usage')
      assert.equal(options.method, undefined)
      assert.equal(options.redirect, 'error')
      assert.equal(options.headers.authorization, 'Bearer synthetic-test-value')
      return { ok: true, json: async () => ({ plan_type: 'plus', rate_limit: { primary_window: { used_percent: 40, limit_window_seconds: 18000 } } }) }
    }
    const result = await ctx.snapshot({ fresh: true })
    assert.equal(result.providers[0].meters[0].usedPercent, 40)
    assert.equal(JSON.stringify(result).includes('synthetic'), false)
    await ctx.snapshot()
    assert.equal(calls, 1)
    globalThis.fetch = async () => { throw new Error('synthetic-test-value must not escape') }
    const stale = await ctx.snapshot({ fresh: true })
    assert.equal(stale.providers[0].stale, true)
    assert.equal(JSON.stringify(stale).includes('synthetic'), false)
    ctx.select('account-b')
    const failedOther = await ctx.snapshot({ fresh: true })
    assert.equal(failedOther.providers[0].meters.length, 0)
  } finally { globalThis.fetch = original }
})

test('no saved connection does not attempt to use Codex Desktop or network', async () => {
  const ctx = context()
  ctx.select(undefined)
  await plugin.setup(ctx)
  const original = globalThis.fetch
  try {
    globalThis.fetch = async () => { assert.fail('Unexpected network access') }
    assert.equal((await ctx.snapshot()).providers[0].state, 'signed-out')
  } finally { globalThis.fetch = original }
})

test('an account switch while a request is in flight discards its readings', async () => {
  const ctx = context()
  await plugin.setup(ctx)
  const original = globalThis.fetch
  try {
    globalThis.fetch = async () => {
      ctx.select('account-b')
      return { ok: true, json: async () => ({ rate_limit: { primary_window: { used_percent: 99 } } }) }
    }
    const result = await ctx.snapshot({ fresh: true })
    assert.equal(result.providers[0].meters.length, 0)
    assert.equal(result.providers[0].state, 'unavailable')
  } finally { globalThis.fetch = original }
})
