const STORAGE_KEY = "chronodeck.rpg_api_key";
const LOCAL_LLM_PROXY = "/llm";

/** 已按你的要求写入前端，任意访问站点的人都能用这把 Key 调 DeepSeek。 */
const PUBLIC_DEEPSEEK_KEY = "sk-184dbd18a77849d397ade668c29f3a17";
const DEFAULT_API_BASE = "https://api.deepseek.com";
const DEFAULT_MODEL = "deepseek-v4-flash";

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
  const apiKey = readEnv("RPG_API_KEY") || readStoredKey() || PUBLIC_DEEPSEEK_KEY;
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

export function llmChatRequest(settings, { messages, temperature, json = false, user }) {
  return {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model,
      temperature,
      stream: false,
      messages,
      thinking: { type: "disabled" },
      ...(user ? { user } : {}),
      ...(json ? { response_format: { type: "json_object" } } : {}),
    }),
  };
}
