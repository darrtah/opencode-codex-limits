import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseUsage, parseWindow, periodLabel, createQuotaCache, NORMAL_INTERVAL, RETRY_INTERVAL } from '../src/quota-core.mjs'
import { selectMeters, meterTitle } from '../src/display-logic.mjs'

const five = { id: 'primary', label: '5 часов', usedPercent: 40, windowSeconds: 18000 }
const week = { id: 'secondary', label: 'Неделя', usedPercent: 20, windowSeconds: 604800 }
const good = { id: 'openai', name: 'Codex', state: 'ready', meters: [five, week] }
const failure = { id: 'openai', name: 'Codex', state: 'unavailable', detail: 'HTTP 503', meters: [] }

test('prefers five hours even if it is the second window', () => {
  assert.deepEqual(selectMeters([week, five]), { selected: five, other: week })
})
test('only a weekly window is honestly labelled', () => {
  const { selected, other } = selectMeters([week])
  assert.equal(meterTitle(selected), 'Неделя: 80%')
  assert.equal(other, undefined)
})
test('an unknown duration is not called five hours', () => {
  for (const [seconds, label] of [[86400, '1 дн.'], [7200, '2 ч'], [900, '15 мин'], [45, '45 сек'], [undefined, 'Период']]) {
    assert.equal(periodLabel(seconds), label)
  }
})
test('missing limits do not imply unlimited or 100% remaining', () => {
  assert.deepEqual(selectMeters([]), { selected: undefined, other: undefined })
  const result = parseUsage({ rate_limit: { allowed: true }, plan_type: 'pro' })
  assert.equal(result.meters.length, 0)
  assert.match(result.detail, /не предоставлены/)
})
test('invalid percentages are discarded and finite values are clamped', () => {
  for (const used_percent of [undefined, null, '50', NaN, Infinity]) {
    assert.equal(parseWindow('x', { used_percent }), undefined)
  }
  assert.equal(parseWindow('x', { used_percent: 150 }).usedPercent, 100)
  assert.equal(parseWindow('x', { used_percent: -1 }).usedPercent, 0)
})
test('reset timestamp and relative seconds are supported', () => {
  assert.equal(parseWindow('x', { used_percent: 0, reset_at: 100 }, 0).resetsAt, 100000)
  assert.equal(parseWindow('x', { used_percent: 0, reset_after_seconds: 30 }, 1000).resetsAt, 31000)
  assert.equal(parseWindow('x', { used_percent: 0 }).resetsAt, undefined)
})
test('raw upstream fields never enter the public result', () => {
  const parsed = parseUsage({ access_token: 'example-only', email: 'private@example.invalid', plan_type: 'plus', rate_limit: { primary_window: { used_percent: 12, limit_window_seconds: 18000 } } })
  assert.equal(JSON.stringify(parsed).includes('example'), false)
  assert.equal(parsed.meters[0].usedPercent, 12)
})
test('normal results are cached for five minutes', () => {
  const cache = createQuotaCache()
  cache.update('account-a', good, 1000)
  assert.ok(cache.get('account-a', false, 1000 + NORMAL_INTERVAL - 1))
  assert.equal(cache.get('account-a', false, 1000 + NORMAL_INTERVAL), undefined)
  assert.equal(cache.get('account-a', true, 1001), undefined)
})
test('failure preserves readings and immediately adds a warning', () => {
  const cache = createQuotaCache()
  cache.update('account-a', good, 1000)
  const result = cache.update('account-a', failure, 2000)
  assert.deepEqual(result.providers[0].meters, good.meters)
  assert.equal(result.providers[0].lastSuccess, 1000)
  assert.equal(meterTitle(result.providers[0].meters[0], result.providers[0].stale), '5ч: ! 60%')
})
test('failed results expire after thirty seconds', () => {
  const cache = createQuotaCache()
  cache.update('account-a', failure, 1000)
  assert.ok(cache.get('account-a', false, 1000 + RETRY_INTERVAL - 1))
  assert.equal(cache.get('account-a', false, 1000 + RETRY_INTERVAL), undefined)
})
test('successful refresh removes warning', () => {
  const cache = createQuotaCache()
  cache.update('account-a', good, 0)
  cache.update('account-a', failure, 1000)
  const result = cache.update('account-a', good, 2000)
  assert.equal(result.providers[0].stale, undefined)
})
test('account caches never mix', () => {
  const cache = createQuotaCache()
  cache.update('account-a', good, 1000)
  assert.equal(cache.get('account-b', false, 1001), undefined)
  assert.equal(cache.update('account-b', failure, 1002).providers[0].meters.length, 0)
  assert.equal(cache.get('account-a', false, 1003).providers[0].meters[0].usedPercent, 40)
})
test('new cache has no persisted personal data', () => {
  assert.equal(createQuotaCache().get('account-a'), undefined)
})
