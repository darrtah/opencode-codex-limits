import { createSignal } from "solid-js"
import { Command, MenuItem, Panel, Plugin, Slot, Style, type PanelTab } from "@opencode/plugin/gui"
import { Usage } from "./rpc"
import { selectMeters, meterTitle } from "./display-logic.mjs"

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
        const result = await ctx.client.rpc(Usage).snapshot({ fresh })
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
        return ctx.t("panel.title")
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
  mode: () => DisplayMode
}) {
  const shown = () => {
    const rows = headerRows(props.snapshot()?.providers ?? []).map((row) => ({ ...row, stale: row.stale || !!props.error() }))
    return props.compact() ? rows.slice(0, 1) : rows
  }
  return (
    <div class="provider-usage-header" style={{ display: props.active() ? "flex" : "none" }}>
      <button type="button" title={modeTitle(props.mode())} onClick={() => props.open()}>
        {shown().length === 0 ? (
          <span title={props.error() || props.snapshot()?.providers[0]?.detail || "Нет данных лимитов"}>Codex: нет данных</span>
        ) : (
          shown().map((row) => (
            <span class={`meter ${row.stale ? "warn" : percentClass(row.usedPercent, "remaining")}`} title={(row.other ? `${meterTitle(row.other, row.stale)}\nСброс: ${formatReset(row.other.resetsAt)}` : "Других лимитов нет или данные недоступны") + (row.stale ? "\n! Не удалось обновить; показаны последние данные" : "")}>
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <circle class="track" cx="10" cy="10" r="8" stroke-width="3" />
                <circle class="progress" cx="10" cy="10" r="8" stroke-width="3" pathLength="100" stroke-dasharray={`${shownPercent(row.usedPercent, "remaining")} 100`} />
              </svg>
              <span class="meter-text"><span>{meterTitle(row, row.stale)}</span><span class="meter-reset">{formatReset(row.resetsAt)}</span></span>
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
}) {
  return (
    <div class="provider-usage">
      <header>
        <h2>Лимиты Codex</h2>
        <div class="actions">
          <button type="button" title="Переключить остаток и расход" onClick={() => props.toggle()}>
            {props.mode === "remaining" ? "Показать использованное" : "Показать остаток"}
          </button>
          <button type="button" onClick={() => props.refresh()}>
            Обновить
          </button>
        </div>
      </header>
      <p class="detail">{props.error ?? "Codex"}</p>
      {(props.snapshot?.providers ?? []).map((provider) => (
        <section>
          <div class="name">
            <strong>{provider.name}</strong>
            <span class="detail">{provider.stale ? "! Последние данные: обновление не удалось" : status(provider)}</span>
          </div>
          {provider.meters.map((meter) => (
            <div>
              <div class="name">
                <span>{meter.label}</span>
                <span class={percentClass(meter.usedPercent, props.mode)}>{percentText(meter.usedPercent, props.mode)}</span>
              </div>
              <div class="bar">
                <div
                  class={fillClass(meter.usedPercent, props.mode)}
                  style={{ width: `${shownPercent(meter.usedPercent, props.mode)}%` }}
                />
              </div>
              <div class="when">{resetLabel(meter.resetsAt)}</div>
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
