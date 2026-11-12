import { Rpc } from "@opencode/plugin/rpc"

const meter = {
  type: "object",
  properties: {
    id: { type: "string" },
    label: { type: "string" },
    usedPercent: { type: "number" },
    resetsAt: { type: "number" },
    limited: { type: "boolean" },
    windowSeconds: { type: "number" },
  },
  required: ["id", "label", "usedPercent"],
  additionalProperties: false,
} as const

const provider = {
  type: "object",
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    state: { type: "string", enum: ["ready", "signed-out", "unavailable"] },
    detail: { type: "string" },
    stale: { type: "boolean" },
    lastSuccess: { type: "number" },
    meters: { type: "array", items: meter },
  },
  required: ["id", "name", "state", "meters"],
  additionalProperties: false,
} as const

export const Usage = Rpc.define({
  id: "provider-usage",
  methods: {
    snapshot: {
      input: {
        type: "object",
        properties: { fresh: { type: "boolean" }, interval: { type: "number", enum: [30000, 60000, 120000, 300000, 600000] } },
        additionalProperties: false,
      },
      output: {
        type: "object",
        properties: {
          checkedAt: { type: "number" },
          providers: { type: "array", items: provider },
        },
        required: ["checkedAt", "providers"],
        additionalProperties: false,
      },
    },
  },
  events: {},
})
