import { Plugin } from "@opencode/plugin"
import { Usage } from "./contract"
import { createQuotaCache, parseUsage } from "./quota-core.mjs"

type Meter = {
  id: string
  label: string
  usedPercent: number
  resetsAt?: number
  limited?: boolean
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

type Credential =
  | { type: "oauth"; access: string; expires: number; metadata?: Record<string, unknown> }
  | { type: "key"; key: string; metadata?: Record<string, unknown> }
  | { type: "external"; metadata?: Record<string, unknown> }

export default Plugin.define({
  id: "provider-usage",
  async setup(ctx) {
    const cache = createQuotaCache()
    let pending: Promise<unknown> | undefined
    const registration = await ctx.rpc.register(Usage, {
      snapshot: async (input) => {
        const fresh = Boolean((input as { fresh?: boolean } | undefined)?.fresh)
        const connection = await ctx.integration.connection.active("openai")
        const accountID = connection?.type === "credential" ? connection.id : undefined
        if (!accountID) return { checkedAt: Date.now(), providers: [signedOut("openai", "Codex")] }
        const hit = cache.get(accountID, fresh)
        if (hit) return hit
        // Avoid simultaneous polls from several Desktop windows in this runtime.
        if (pending) await pending
        const secondHit = cache.get(accountID)
        if (secondHit && !fresh) return secondHit
        const work = (async () => {
          let provider: ProviderUsage
          try {
            provider = await readChatGPT(ctx)
          } catch {
            provider = unavailable("openai", "Codex", "Не удалось прочитать подключение OpenAI")
          }
          const current = await ctx.integration.connection.active("openai")
          if (current?.type !== "credential" || current.id !== accountID) {
            return { checkedAt: Date.now(), providers: [unavailable("openai", "Codex", "Аккаунт изменился; обновите данные")] }
          }
          return cache.update(accountID, provider)
        })()
        pending = work
        try {
          return await work
        } finally {
          if (pending === work) pending = undefined
        }
      },
    })
    return () => registration.dispose()
  },
})

async function readChatGPT(ctx: PluginContext): Promise<ProviderUsage> {
  const login = await chatLogin(ctx)
  if (!login) return signedOut("openai", "Codex")
  if (!login.accountID) return unavailable("openai", "Codex", login.reason)
  const body = await getJSON("https://chatgpt.com/backend-api/wham/usage", {
    authorization: `Bearer ${login.access}`,
    "ChatGPT-Account-Id": login.accountID,
  })
  if (!body.ok) return unavailable("openai", "Codex", body.error)
  const { meters, detail } = parseUsage(body.json)
  return ready("openai", "Codex", meters, detail)
}

async function chatLogin(ctx: PluginContext) {
  const credential = await active(ctx, "openai")
  const openAI =
    credential?.type === "oauth"
      ? {
          access: credential.access,
          accountID: stringOf(credential.metadata?.accountID) ?? stringOf(credential.metadata?.accountId) ?? accountFromToken(credential.access),
        }
      : undefined
  if (openAI?.accountID) return { access: openAI.access, accountID: openAI.accountID, reason: "" }
  if (openAI) return { access: openAI.access, reason: "В авторизации Codex отсутствует идентификатор аккаунта" }
  if (credential?.type === "key") {
    return { access: "", reason: "С API-ключом лимиты подписки недоступны" }
  }
   return
}

async function active(ctx: PluginContext, integrationID: string): Promise<Credential | undefined> {
  const connection = await ctx.integration.connection.active(integrationID)
  if (!connection) return
  return (await ctx.integration.connection.resolve(connection)) as Credential | undefined
}

function ready(id: string, name: string, meters: Meter[], detail?: string): ProviderUsage {
  return { id, name, state: "ready", meters, ...(detail ? { detail } : {}) }
}

function signedOut(id: string, name: string): ProviderUsage {
  return { id, name, state: "signed-out", meters: [] }
}

function unavailable(id: string, name: string, detail: string): ProviderUsage {
  return { id, name, state: "unavailable", detail, meters: [] }
}

async function getJSON(url: string, headers: Record<string, string>) {
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json", ...headers },
      redirect: "error",
      signal: AbortSignal.timeout(12_000),
    })
    if (!response.ok) return { ok: false as const, status: response.status, error: `HTTP ${response.status}` }
    return { ok: true as const, status: response.status, json: (await response.json()) as unknown }
  } catch {
    return { ok: false as const, status: 0, error: "Не удалось получить данные" }
  }
}

function stringOf(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined
}

function accountFromToken(token: string) {
  const part = token.split(".")[1]
  if (!part) return
  try {
    const claims = JSON.parse(Buffer.from(part, "base64url").toString()) as {
      chatgpt_account_id?: string
      organizations?: Array<{ id?: string }>
      "https://api.openai.com/auth"?: { chatgpt_account_id?: string; organizations?: Array<{ id?: string }> }
    }
    const auth = claims["https://api.openai.com/auth"]
    return (
      claims.chatgpt_account_id ??
      auth?.chatgpt_account_id ??
      claims.organizations?.[0]?.id ??
      auth?.organizations?.[0]?.id
    )
  } catch {
    return
  }
}

type PluginContext = Parameters<NonNullable<Parameters<typeof Plugin.define>[0]["setup"]>>[0]
