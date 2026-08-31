const STORAGE_KEY = "chronodeck.rpg_api_key";
const LOCAL_LLM_PROXY = "http://127.0.0.1:8787";

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
  // 锁定的 vite.config.js 没有 /rpg-llm 代理。
  // Nocode / 生产：浏览器直连 AIGC。
  // 本机 localhost：走独立 sidecar，避免 CORS。
  const devProxy = readEnv("RPG_DEV_PROXY");
  if (devProxy) return devProxy.replace(/\/$/, "");
  if (isBrowserLocalhost()) return LOCAL_LLM_PROXY;
  return configuredBase;
}

export function getSettings() {
  const apiKey = readEnv("RPG_API_KEY") || readStoredKey();
  const configuredBase = readEnv("RPG_API_BASE", "https://aigc.sankuai.com/v1/openai/native")
    .replace(/\/$/, "")
    .replace(/\/chat\/completions$/i, "");
  const apiBase = resolveApiBase(configuredBase);
  return {
    apiKey,
    apiBase,
    configuredBase,
    model: readEnv("RPG_MODEL", "LongCat-Flash-Chat-Huawei") || "LongCat-Flash-Chat-Huawei",
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
