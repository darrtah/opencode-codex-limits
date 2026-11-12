import { createSignal } from "solid-js"
import { Command, MenuItem, Panel, Plugin, Slot, Style, type PanelTab } from "@opencode/plugin/gui"
import { Usage } from "./rpc"
import { selectMeters, meterTitle } from "./display-logic.mjs"
import { translate, intervals, validInterval } from "./preferences.mjs"

type Meter = {
  id: string
  label: string
  usedPercent: number
  resetsAt?: number
  limited?: boolean
  windowSeconds?: number
}

type ProviderUsage = {
  id: string
  name: string
  state: "ready" | "signed-out" | "unavailable"
  detail?: string
  stale?: boolean
  lastSuccess?: number
  meters: Meter[]
}

type Snapshot = { checkedAt: number; providers: ProviderUsage[] }
type DisplayMode = "used" | "remaining"

const modeKey = "provider-usage.mode"

const css = `
.provider-usage { display: flex; flex-direction: column; gap: 12px; padding: 12px; color: var(--v2-text-text-base); font-size: 13px; }
.provider-usage header, .provider-usage .actions { display: flex; align-items: center; gap: 8px; }
.provider-usage header { justify-content: space-between; }
.provider-usage h2 { margin: 0; font-size: 14px; font-weight: 600; }
.provider-usage button { border: 0; border-radius: 6px; background: var(--v2-background-bg-layer-01); color: inherit; padding: 4px 8px; cursor: pointer; }
.provider-usage .preferences { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
.provider-usage select { color: inherit; background: var(--v2-background-bg-layer-01); border-radius: 6px; padding: 4px; }
.provider-usage section { display: flex; flex-direction: column; gap: 6px; }
.provider-usage .name { display: flex; justify-content: space-between; gap: 8px; }
.provider-usage .detail, .provider-usage .when { color: var(--v2-text-text-muted); }
.provider-usage .bar { height: 6px; border-radius: 99px; background: var(--v2-background-bg-layer-01); overflow: hidden; }
.provider-usage .full { color: var(--v2-state-fg-success, #2f9e44); }
.provider-usage .fill { height: 100%; background: var(--v2-text-text-base); }
.provider-usage .fill.full { background: var(--v2-state-fg-success, #2f9e44); }
.provider-usage .fill.warn { background: var(--v2-text-text-warning, #c47b12); }
.provider-usage .fill.hot { background: var(--v2-text-text-danger, #c44536); }
.provider-usage-header { display: flex; align-items: center; gap: 8px; flex-shrink: 0; color: var(--v2-text-text-muted); font-size: 13px; line-height: var(--line-height-compact); white-space: nowrap; }
.provider-usage-header button { display: flex; align-items: center; gap: 8px; border: 0; background: transparent; color: inherit; font: inherit; cursor: pointer; padding: 0; }
.provider-usage-header .meter { display: inline-flex; align-items: center; gap: 4px; }
.provider-usage-header .meter-text { display: inline-flex; flex-direction: column; align-items: flex-start; line-height: 1.15; }
.provider-usage-header .meter-reset { font-size: 10px; opacity: .75; }
.provider-usage-header svg { width: 16px; height: 16px; flex: none; transform: rotate(-90deg); }
.provider-usage-header .track { fill: none; stroke: currentColor; opacity: .2; }
.provider-usage-header .progress { fill: none; stroke: currentColor; }
.provider-usage-header span.full { color: var(--v2-state-fg-success, #2f9e44); }
.provider-usage-header span.warn { color: var(--v2-text-text-warning, #c47b12); }
.provider-usage-header span.hot { color: var(--v2-text-text-danger, #c44536); }
`

export default Plugin.define({
  i18n: {
    en: { "panel.title": "Лимиты Codex", "command.open": "Показать лимиты Codex" },
    ru: { "panel.title": "Лимиты Codex", "command.open": "Показать лимиты Codex" },
  },
  setup(ctx) {
    const [snapshot, setSnapshot] = createSignal<Snapshot>()
    const [error, setError] = createSignal<string>()
    const [mode, setMode] = createSignal<DisplayMode>(loadMode())
    const [language, setLanguage] = createSignal(loadPreference("language") === "en" ? "en" : "ru")
    const [interval, setIntervalValue] = createSignal(validInterval(loadPreference("interval")))
    const save = (key: string, value: string) => { try { localStorage.setItem(`provider-usage.${key}`, value) } catch {} }
    const changeLanguage = (value: string) => { setLanguage(value === "en" ? "en" : "ru"); save("language", value) }
    const changeInterval = (value: string) => { setIntervalValue(validInterval(value)); save("interval", value); void refresh(false) }
    let refreshing = false
    let disposed = false

    const toggleMode = () => {
      const next = mode() === "used" ? "remaining" : "used"
      setMode(next)
      try {
        localStorage.setItem(modeKey, next)
      } catch {
        // The readout still switches for this window when storage is blocked.
      }
    }

    const refresh = async (fresh = false) => {
      if (refreshing) return
      refreshing = true
      try {
        const result = await ctx.client.rpc(Usage).snapshot({ fresh, interval: interval() })
        if (disposed) return
        setSnapshot(result)
        setError()
      } catch (cause) {
        if (!disposed) setError("Не удалось обновить данные; повторная попытка через 30 секунд")
      } finally {
        refreshing = false
      }
    }

    const tab: PanelTab = {
      id: "main",
      get title() {
        return translate("Лимиты Codex", language())
      },
      closable: "compact",
      fallback: true,
    }

    ctx.add(Panel, {
      id: "main",
      region: "side",
      mobile: {
        get title() {
          return ctx.t("panel.title")
        },
        order: 80,
        kind: "menu",
      },
      list: (input) => (input.open.includes("main") ? [tab] : []),
      render: () => (
        <UsageView
          snapshot={snapshot()}
          error={error()}
          mode={mode()}
          refresh={() => void refresh(true)}
          toggle={toggleMode}
          language={language()}
          interval={interval()}
          changeLanguage={changeLanguage}
          changeInterval={changeInterval}
        />
      ),
    })

    ctx.add(MenuItem, () => ({
      menu: "session.panel",
      id: "open",
      title: ctx.t("panel.title"),
      run: () => {
        const session = ctx.sessions.current()
        if (session) ctx.layout.open(`${ctx.id}:main`, session)
        void refresh(false)
      },
    }))

    ctx.add(Command, () => ({
      id: "open",
      title: ctx.t("command.open"),
      run: () => {
        const session = ctx.sessions.current()
        if (session) ctx.layout.open(`${ctx.id}:main`, session, { tab: "select" })
        void refresh(false)
      },
    }))

    ctx.add(Slot, {
      at: "session.header",
      order: 20,
      render: (input) => (
        <HeaderUsage
          active={() => input.active}
          compact={() => input.compact}
          open={() => ctx.layout.open(`${ctx.id}:main`, input.session, { tab: "select" })}
          snapshot={snapshot}
          error={error}
          language={language}
          mode={mode}
        />
      ),
    })

    ctx.add(Style, css)
    void refresh(false)
    const timer = setInterval(() => void refresh(false), 30_000)
    return () => { disposed = true; clearInterval(timer) }
  },
})

function HeaderUsage(props: {
  active: () => boolean
  compact: () => boolean
  open: () => void
  snapshot: () => Snapshot | undefined
  error: () => string | undefined
  language: () => string
  mode: () => DisplayMode
}) {
  const shown = () => {
    const rows = headerRows(props.snapshot()?.providers ?? []).map((row) => ({ ...row, stale: row.stale || !!props.error() }))
    return props.compact() ? rows.slice(0, 1) : rows
  }
  return (
    <div class="provider-usage-header" style={{ display: props.active() ? "flex" : "none" }}>
      <button type="button" title={translate(modeTitle(props.mode()), props.language())} onClick={() => props.open()}>
        {shown().length === 0 ? (
          <span title={translate(props.error() || props.snapshot()?.providers[0]?.detail || "Нет данных лимитов", props.language())}>{translate("Codex: нет данных", props.language())}</span>
        ) : (
          shown().map((row) => (
            <span class={`meter ${row.stale ? "warn" : percentClass(row.usedPercent, "remaining")}`} title={(row.other ? `${translate(meterTitle(row.other, row.stale), props.language())}\n${translate("Сброс", props.language())}: ${formatReset(row.other.resetsAt)}` : translate("Других лимитов нет или данные недоступны", props.language())) + (row.stale ? `\n${translate("! Не удалось обновить; показаны последние данные", props.language())}` : "")}>
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <circle class="track" cx="10" cy="10" r="8" stroke-width="3" />
                <circle class="progress" cx="10" cy="10" r="8" stroke-width="3" pathLength="100" stroke-dasharray={`${shownPercent(row.usedPercent, "remaining")} 100`} />
              </svg>
              <span class="meter-text"><span>{translate(meterTitle(row, row.stale), props.language())}</span><span class="meter-reset">{translate(formatReset(row.resetsAt), props.language())}</span></span>
            </span>
          ))
        )}
      </button>
    </div>
  )
}

function UsageView(props: {
  snapshot?: Snapshot
  error?: string
  mode: DisplayMode
  refresh: () => void
  toggle: () => void
  language: string
  interval: number
  changeLanguage: (value: string) => void
  changeInterval: (value: string) => void
}) {
  return (
    <div class="provider-usage">
      <header>
        <h2>{translate("Лимиты Codex", props.language)}</h2>
        <div class="actions">
          <button type="button" title={translate("Переключить остаток и расход", props.language)} onClick={() => props.toggle()}>
            {translate(props.mode === "remaining" ? "Показать использованное" : "Показать остаток", props.language)}
          </button>
          <button type="button" onClick={() => props.refresh()}>
            {translate("Обновить", props.language)}
          </button>
        </div>
      </header>
      <div class="preferences">
        <label>{props.language === "en" ? "Language: " : "Язык: "}<select aria-label="Language / Язык" value={props.language} onChange={(event) => props.changeLanguage(event.currentTarget.value)}><option value="ru">Русский</option><option value="en">English</option></select></label>
        <label>{props.language === "en" ? "Refresh interval: " : "Обновлять каждые: "}<select aria-label={props.language === "en" ? "Refresh interval" : "Интервал обновления"} value={String(props.interval)} onChange={(event) => props.changeInterval(event.currentTarget.value)}>{intervals.map((value) => <option value={String(value)}>{value === 30000 ? (props.language === "en" ? "30 seconds" : "30 секунд") : `${value / 60000} ${props.language === "en" ? "min" : "мин"}`}</option>)}</select></label>
      </div>
      <p class="detail">{translate(props.error ?? "Codex", props.language)}</p>
      {(props.snapshot?.providers ?? []).map((provider) => (
        <section>
          <div class="name">
            <strong>{provider.name}</strong>
            <span class="detail">{translate(provider.stale ? "! Последние данные: обновление не удалось" : status(provider), props.language)}</span>
          </div>
          {provider.meters.map((meter) => (
            <div>
              <div class="name">
                <span>{translate(meter.label, props.language)}</span>
                <span class={percentClass(meter.usedPercent, props.mode)}>{translate(percentText(meter.usedPercent, props.mode), props.language)}</span>
              </div>
              <div class="bar">
                <div
                  class={fillClass(meter.usedPercent, props.mode)}
                  style={{ width: `${shownPercent(meter.usedPercent, props.mode)}%` }}
                />
              </div>
              <div class="when">{translate(resetLabel(meter.resetsAt), props.language)}</div>
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}

function status(provider: ProviderUsage) {
  if (provider.state === "signed-out") return "Не подключён"
  if (provider.state === "unavailable") return provider.detail ?? "Данные недоступны"
  return provider.detail ?? "Подключён"
}

function resetLabel(resetsAt: number | undefined) {
  if (!resetsAt) return ""
  if (resetsAt <= Date.now()) return "Сброшено"
  const when = new Date(resetsAt)
  const formatted = new Intl.DateTimeFormat("ru-RU", {
    year: when.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(when)
  return `${formatted} — сброс`
}

function fillClass(usedPercent: number, mode: DisplayMode) {
  const tone = percentClass(usedPercent, mode)
  return tone ? `fill ${tone}` : "fill"
}

function headerRows(providers: ProviderUsage[]) {
  return providers.flatMap((provider) => {
    const { selected: meter, other } = selectMeters(provider.meters)
    if (!meter) return []
    return [{ name: "Codex", label: meter.label, usedPercent: meter.usedPercent, resetsAt: meter.resetsAt, stale: provider.stale, lastSuccess: provider.lastSuccess, other }]
  })
}

function formatReset(value: number | undefined) {
  if (!value || !Number.isFinite(value)) return "неизвестно"
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value))
}

function loadMode(): DisplayMode {
  try {
    return localStorage.getItem(modeKey) === "remaining" ? "remaining" : "used"
  } catch {
    return "used"
  }
}

function loadPreference(key: string) {
  try { return localStorage.getItem(`provider-usage.${key}`) } catch { return null }
}

function shownPercent(usedPercent: number, mode: DisplayMode) {
  if (mode === "used") return usedPercent
  return Math.min(100, Math.max(0, 100 - usedPercent))
}

function percentText(usedPercent: number, mode: DisplayMode) {
  const value = Math.round(shownPercent(usedPercent, mode))
  return mode === "remaining" ? `Осталось ${value}%` : `Использовано ${value}%`
}

function modeLabel(mode: DisplayMode) {
  return mode === "remaining" ? "Осталось" : "Использовано"
}

function modeTitle(mode: DisplayMode) {
  return mode === "remaining" ? "Остаток лимитов" : "Лимиты провайдеров"
}

function percentClass(usedPercent: number, mode: DisplayMode) {
  if (mode === "remaining" && Math.round(shownPercent(usedPercent, mode)) === 100) return "full"
  if (usedPercent >= 95) return "hot"
  if (usedPercent >= 80) return "warn"
  return ""
}
