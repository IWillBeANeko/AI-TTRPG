import { mergeAbortSignals } from "./page-session";

const STORAGE_KEY = "chronodeck.rpg_api_key";
const LOCAL_LLM_PROXY = "/llm";

/** 已按你的要求写入前端，任意访问站点的人都能用这把 Key 调智谱 GLM。 */
const PUBLIC_ZHIPU_KEY = "d7cba4c33bc742f3bd67884afa932099.4TEfGJMxAnEPGTpf";
const DEFAULT_API_BASE = "https://open.bigmodel.cn/api/paas/v4";
const DEFAULT_MODEL = "glm-5.3";

function readEnv(name, fallback = "") {
  const viteKey = `VITE_${name}`;
  const value = import.meta.env[name] ?? import.meta.env[viteKey] ?? fallback;
  return String(value ?? "").trim();
}

function readStoredKey() {
  try {
    return (localStorage.getItem(STORAGE_KEY) || "").trim();
  } catch {
    return "";
  }
}

function isBrowserLocalhost() {
  try {
    return /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);
  } catch {
    return false;
  }
}

function resolveApiBase(configuredBase) {
  const devProxy = readEnv("RPG_DEV_PROXY");
  if (devProxy) return devProxy.replace(/\/$/, "");
  if (isBrowserLocalhost()) return LOCAL_LLM_PROXY;
  return configuredBase;
}

export function getSettings() {
  const apiKey = readEnv("RPG_API_KEY") || readStoredKey() || PUBLIC_ZHIPU_KEY;
  const configuredBase = readEnv("RPG_API_BASE", DEFAULT_API_BASE)
    .replace(/\/$/, "")
    .replace(/\/chat\/completions$/i, "");
  const apiBase = resolveApiBase(configuredBase);
  return {
    apiKey,
    apiBase,
    configuredBase,
    model: readEnv("RPG_MODEL", DEFAULT_MODEL) || DEFAULT_MODEL,
    embeddingModel: readEnv("RPG_EMBEDDING_MODEL"),
    loraRoot: readEnv("RPG_LORA_ROOT"),
    memoryRetrieveK: 8,
    reflectionImportanceThreshold: 12,
    maxRecentEvents: 12,
    actorTemperature: 0.7,
    actorMaxRetries: 3,
    get usesLlm() {
      return Boolean(this.apiKey);
    },
  };
}

export function setApiKey(key) {
  const value = (key || "").trim();
  if (value) localStorage.setItem(STORAGE_KEY, value);
  else localStorage.removeItem(STORAGE_KEY);
}

export function isOllamaSettings(settings) {
  const blob = `${settings?.configuredBase || ""} ${settings?.apiBase || ""} ${settings?.apiKey || ""}`.toLowerCase();
  return blob.includes("11434") || blob.includes("ollama");
}

export function isZhipuSettings(settings) {
  const blob = `${settings?.configuredBase || ""} ${settings?.apiBase || ""} ${settings?.model || ""}`.toLowerCase();
  return blob.includes("bigmodel.cn") || blob.includes("zhipu") || /\bglm-/.test(blob);
}

function thinkingOptions(settings, ollama) {
  if (ollama) return {};
  if (isZhipuSettings(settings)) {
    // glm-5.3 / glm-4.7 强制思考，传 disabled 会 400；对话场景用 low 控制延迟
    if (/glm-5(?:\.|$)|glm-4\.7/i.test(settings.model || "")) {
      return { thinking: { type: "enabled" }, reasoning_effort: "low" };
    }
    return {};
  }
  return { thinking: { type: "disabled" } };
}

export function llmChatRequest(settings, { messages, temperature, json = false, user }) {
  const ollama = isOllamaSettings(settings);
  const payloadMessages = ollama && /\bqwen3\b/i.test(settings.model || "")
    ? withQwenNoThink(messages)
    : messages;
  return {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model,
      temperature,
      stream: false,
      messages: payloadMessages,
      ...thinkingOptions(settings, ollama),
      ...(user ? { user } : {}),
      ...(json && !ollama ? { response_format: { type: "json_object" } } : {}),
    }),
  };
}

function withQwenNoThink(messages) {
  if (!Array.isArray(messages) || !messages.length) return messages;
  const next = messages.map((item) => ({ ...item }));
  const last = next[next.length - 1];
  if (last && !String(last.content || "").includes("/no_think")) {
    last.content = `${last.content || ""}\n/no_think`;
  }
  return next;
}

export async function llmFetch(url, init = {}, { timeoutMs = 60000, signal } = {}) {
  const { signal: combined, dispose } = mergeAbortSignals(timeoutMs, signal);
  try {
    return await fetch(url, { ...init, signal: combined });
  } finally {
    dispose();
  }
}
