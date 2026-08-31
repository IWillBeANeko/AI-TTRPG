import riftSkill from "@/character-engine/skills/rift/SKILL.md?raw";
import { WORLD_KNOWLEDGE, getCharacterPack } from "@/character-engine";
import { briefingProgress } from "@/data/play-stage";
import { getSettings, llmChatRequest } from "./config";
import { appendMapEvent, composeMapStatus, setMapOverlay } from "./map-status";
import { playLogMarkdown } from "./play-log";

export const RIFT_DWELL_MS = 30000;

export function emptyRift() {
  return { status: "idle", event: null };
}

export async function generateHarborRift(game) {
  const settings = getSettings();
  if (!settings.usesLlm) return fallbackRift(game);
  try {
    const raw = await completeChat(settings, buildPrompt(game));
    return normalizeRift(extractJson(raw), game);
  } catch {
    return fallbackRift(game);
  }
}

export function applyRiftEvent(state, event) {
  const rift = event || state.rift?.event;
  if (!rift) return { ...state, rift: { status: "done", event: state.rift?.event || null } };
  const maxHp = Number(state.player?.maxHp) || 10;
  const hp = clamp((Number(state.player?.hp) || 10) + (rift.hp_delta || 0), 1, maxHp);
  let next = {
    ...state,
    player: { ...state.player, hp },
    stability: clamp((Number(state.stability) || 0) + (rift.stability_delta || 0), 0, 100),
    sceneNote: rift.impact,
    rift: { status: "done", event: rift },
  };
  next = appendMapEvent(next, "harbor", rift.map_note || rift.event);
  if (rift.map_note || rift.event) next = setMapOverlay(next, "harbor", rift.map_note || rift.event);
  return next;
}

function buildPrompt(game) {
  const player = game.player || {};
  const companion = game.companion || {};
  const playerPack = getCharacterPack("player");
  const matePack = getCharacterPack("mate");
  const flags = game.routeFlags || {};
  const { current, done } = briefingProgress(flags);
  const attrs = player.attrs
    ? Object.entries(player.attrs).map(([key, value]) => `${key}${value}`).join("、")
    : "未写";
  return `${String(riftSkill || "").trim()}

# 世界常识
${WORLD_KNOWLEDGE}

# 本幕进度
已对上：${done.map((step) => step.todo).join("、") || "还没有"}
当前要做：${current?.todo || "这一幕该对的都对上了"}

# 时隙行者
${String(playerPack?.status || "").trim()}

- 姓名：${player.name || "时隙行者"}
- HP：${player.hp ?? 10}/${player.maxHp ?? 10}
- 属性：${attrs}

# 同行者
${String(matePack?.status || "").trim()}

- 姓名：${companion.name || "同行者"}
- 职业：${companion.occupation || "同行者"}
- HP：${companion.hp ?? 10}/${companion.maxHp ?? 10}

# 潮汐码头地图状态
${composeMapStatus("harbor", game)}

# 游玩记录（节选）
${playLogMarkdown(game.playLog, game)}

只输出 JSON：{"title":"","event":"","impact":"","map_note":"","player_note":"","hp_delta":0,"stability_delta":0}`;
}

function normalizeRift(raw, game) {
  const data = raw && typeof raw === "object" ? raw : {};
  const fallback = fallbackRift(game);
  const hpDelta = clampInt(data.hp_delta, -2, 0);
  const stabDelta = clampInt(data.stability_delta, -6, 2);
  return {
    title: String(data.title || fallback.title).slice(0, 12),
    event: String(data.event || fallback.event).slice(0, 280),
    impact: String(data.impact || fallback.impact).slice(0, 180),
    map_note: String(data.map_note || fallback.map_note).slice(0, 160),
    player_note: String(data.player_note || fallback.player_note).slice(0, 160),
    hp_delta: hpDelta,
    stability_delta: stabDelta,
  };
}

function fallbackRift() {
  return {
    title: "缆绳自断",
    event: "空泊位上一根还绷着的缆绳突然绷断，抽在石阶上。水比刚才又低了一指，船帮把台阶撞出一声闷响。远处时钟塔的轮廓亮了一下，又沉回去。",
    impact: "断缆擦过你小臂，火辣辣的。鞋也湿了。码头比进场时更空。",
    map_note: "一根空泊位的缆绳自行绷断。水位又低了一指。",
    player_note: "码头一根缆绳自己断了，擦到你的小臂。水又退了一指。",
    hp_delta: -1,
    stability_delta: -3,
  };
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function clampInt(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return clamp(Math.round(n), min, max);
}

async function completeChat(settings, prompt) {
  const traceId = crypto.randomUUID();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  const { headers, body } = llmChatRequest(settings, {
    messages: [
      { role: "system", content: "你在码头写一次小变故。只输出 JSON。" },
      { role: "user", content: prompt },
    ],
    temperature: 0.8,
    json: true,
    user: traceId,
  });
  try {
    const response = await fetch(`${settings.apiBase}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers,
      body,
    });
    if (!response.ok) throw new Error(`LLM ${response.status}`);
    const data = await response.json();
    return data?.choices?.[0]?.message?.content || "{}";
  } finally {
    clearTimeout(timer);
  }
}

function extractJson(raw) {
  const text = String(raw || "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1));
  throw new Error("模型未返回 JSON");
}
