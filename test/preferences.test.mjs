import { test } from 'node:test'
import assert from 'node:assert/strict'
import { intervals, validInterval, translate } from '../src/preferences.mjs'
import { createQuotaCache } from '../src/quota-core.mjs'

test('all five intervals are supported; invalid values use five minutes', () => {
  for (const value of intervals) assert.equal(validInterval(String(value)), value)
  for (const value of [null, -1, 1, 'bad', Infinity]) assert.equal(validInterval(value), 300000)
})
test('chosen interval changes cache lifetime, errors still retry after 30 seconds', () => {
  const cache = createQuotaCache()
  const good = { state: 'ready', meters: [{ label: '5 часов', usedPercent: 25 }] }
  cache.update('a', good, 0)
  assert.equal(cache.get('a', false, 30000, 30000), undefined)
  assert.ok(cache.get('a', false, 30000, 600000))
  cache.update('a', { state: 'unavailable', meters: [] }, 1000)
  assert.equal(cache.get('a', false, 31000, 600000), undefined)
})
test('translations include percentages, alternate periods and reset text', () => {
  assert.equal(translate('Использовано 25%', 'en'), 'Used 25%')
  assert.equal(translate('5ч: ! 75%', 'en'), '5h: ! 75%')
  assert.equal(translate('Неделя: 75%', 'en'), 'Week: 75%')
  assert.equal(translate('12.11, 16:45 — сброс', 'en'), '12.11, 16:45 — resets')
  assert.equal(translate('Осталось 75%', 'ru'), 'Осталось 75%')
})
