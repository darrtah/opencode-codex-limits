export const NORMAL_INTERVAL = 300_000
export const RETRY_INTERVAL = 30_000

export function record(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : undefined
}

export function periodLabel(seconds) {
  if (seconds === 18000) return '5 часов'
  if (seconds === 604800) return 'Неделя'
  if (!Number.isFinite(seconds) || seconds <= 0) return 'Период'
  if (seconds % 86400 === 0) return `${seconds / 86400} дн.`
  if (seconds % 3600 === 0) return `${seconds / 3600} ч`
  if (seconds % 60 === 0) return `${seconds / 60} мин`
  return `${seconds} сек`
}

export function parseWindow(id, value, now = Date.now()) {
  const window = record(value)
  if (!window || typeof window.used_percent !== 'number' || !Number.isFinite(window.used_percent)) return
  const seconds = window.limit_window_seconds
  let resetsAt
  if (typeof window.reset_at === 'number' && Number.isFinite(window.reset_at) && window.reset_at > 0) {
    resetsAt = window.reset_at * 1000
  } else if (typeof window.reset_after_seconds === 'number' && Number.isFinite(window.reset_after_seconds) && window.reset_after_seconds >= 0) {
    resetsAt = now + window.reset_after_seconds * 1000
  }
  return {
    id,
    label: periodLabel(seconds),
    usedPercent: Math.min(100, Math.max(0, window.used_percent)),
    ...(resetsAt === undefined ? {} : { resetsAt }),
    ...(typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0 ? { windowSeconds: seconds } : {}),
  }
}

export function parseUsage(payload, now = Date.now()) {
  const json = record(payload)
  if (!json) return { meters: [], detail: 'Не удалось распознать ответ OpenAI' }
  const rate = record(json.rate_limit)
  const meters = [parseWindow('primary', rate?.primary_window, now), parseWindow('secondary', rate?.secondary_window, now)].filter(Boolean)
  const plan = typeof json.plan_type === 'string' && /^[\w -]{1,64}$/.test(json.plan_type) ? json.plan_type : undefined
  return {
    meters,
    detail: meters.length ? plan : rate?.allowed === true ? 'Численные лимиты не предоставлены OpenAI' : 'Данные лимитов не предоставлены OpenAI',
  }
}

// Separate successful readings and retry clocks for every saved OpenCode credential.
export function createQuotaCache() {
  const entries = new Map()
  return {
    get(account, fresh = false, now = Date.now(), interval = NORMAL_INTERVAL) {
      const value = entries.get(account)
      if (!value || fresh || now - value.checkedAt >= (value.retry ? RETRY_INTERVAL : interval)) return
      return { checkedAt: value.checkedAt, providers: [value.provider] }
    },
    update(account, provider, now = Date.now()) {
      const previous = entries.get(account)
      const success = provider.state === 'ready' && provider.meters.length > 0
      const last = success ? { provider, at: now } : previous?.last
      const visible = provider.state === 'unavailable' && last
        ? { ...last.provider, stale: true, lastSuccess: last.at, detail: 'Не удалось обновить; показаны последние данные' }
        : provider
      const value = { checkedAt: now, provider: visible, last, retry: provider.state === 'unavailable' }
      entries.set(account, value)
      return { checkedAt: now, providers: [visible] }
    },
  }
}
