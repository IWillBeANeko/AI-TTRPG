import asideSkill from "@/character-engine/skills/aside/SKILL.md?raw";
import { WORLD_KNOWLEDGE, getCharacterPack } from "@/character-engine";
import { briefingProgress, locationById, situationOf } from "@/data/play-stage";
import { getSettings, llmChatRequest, llmFetch } from "./config";
import { isAbortError } from "./page-session";
import { playLogMarkdown } from "./play-log";

export const ASIDE_GAP_MS = 30000;

export async function generateCompanionAside(game, signal) {
  const companion = game?.companion;
  if (!companion?.name) return null;
  const settings = getSettings();
  if (!settings.usesLlm) return fallbackAside(game);
  try {
    const raw = await completeChat(settings, buildPrompt(game), signal);
    const data = extractJson(raw);
    const speech = String(data?.speech || "").trim().slice(0, 90);
    if (!speech || speech === lastAside(game)) return fallbackAside(game);
    return { speech };
  } catch (error) {
    if (isAbortError(error)) throw error;
    return fallbackAside(game);
  }
}

function buildPrompt(game) {
  const companion = game.companion || {};
  const pack = getCharacterPack("mate");
  const here = locationById(game.location);
  const flags = game.routeFlags || {};
  const { current, done } = briefingProgress(flags);
  const prev = (game.playLog?.entries || [])
    .filter((item) => item.kind === "aside")
    .slice(-4)
    .map((item) => `- ${item.text}`)
    .join("\n");
  return `${String(asideSkill || "").trim()}

你就是${companion.name}（id=mate，职业=${companion.occupation || "同行者"}，组织=${companion.org || "未写"}）。按自己的人设开口。不要用助手口吻。

# 你的记忆
${String(pack?.memory || "").trim()}

## 本局生成档案
- 姓名：${companion.name}
- 职业：${companion.occupation || "同行者"}
- 来历：${companion.story || "（尚未写入）"}
- 开场白：${companion.intro || companion.reason || "（尚未写入）"}

# 你的状态
${String(pack?.status || "").trim()}

- 所在地：与玩家相同，现在在${here?.name || game.location || "未知"}
- HP：${companion.hp ?? 10}/${companion.maxHp ?? 10}

# 世界常识（公开，不是你的目击记录）
${WORLD_KNOWLEDGE}

# 眼前
地点：${here?.name || ""} — ${situationOf(here, flags)}
本幕已对上：${done.map((step) => step.todo).join("、") || "还没有"}
当前要做：${current?.todo || "这一幕该对的都对上了"}

# 你们一路上实际发生的事
${playLogMarkdown(game.playLog, game)}

你刚才已经说过、不要再重复：
${prev || "- （还没主动开过口）"}

只输出 JSON：{"speech":"一两句"}`;
}

function fallbackAside(game) {
  const here = locationById(game.location);
  const { current } = briefingProgress(game.routeFlags || {});
  const talks = (game.playLog?.entries || []).filter((item) => item.kind === "talk");
  const lastTalk = talks.at(-1)?.text || "";
  const last = lastAside(game);
  const pool = [
    current ? `我们还没把「${current.todo}」问到能写下来。` : "这一幕该对的，你们已经对上了。",
    here?.name ? `${here.name}这儿，我再听一遍也还是不对劲。` : "你要先走，还是先把刚才听见的对一下。",
    lastTalk ? "刚才那人说的，我记下了。你要是还想问，我跟你。" : "你不问，我就先看。别把我当向导。",
  ].filter((line) => line && line !== last);
  return { speech: pool[0] || "我还在。你决定下一步。" };
}

function lastAside(game) {
  const row = [...(game.playLog?.entries || [])].reverse().find((item) => item.kind === "aside");
  if (!row) return "";
  const text = String(row.text || "");
  const start = text.indexOf("「");
  const end = text.lastIndexOf("」");
  if (start >= 0 && end > start) return text.slice(start + 1, end);
  return text;
}

async function completeChat(settings, prompt, signal) {
  const traceId = crypto.randomUUID();
  const { headers, body } = llmChatRequest(settings, {
    messages: [
      {
        role: "system",
        content: "你是玩家身边的同行者，正在主动开口。只输出 JSON。",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.7,
    json: true,
    user: traceId,
  });
  const response = await llmFetch(
    `${settings.apiBase}/chat/completions`,
    { method: "POST", headers, body },
    { timeoutMs: 20000, signal },
  );
  if (!response.ok) throw new Error(`LLM ${response.status}`);
  const data = await response.json();
  return data?.choices?.[0]?.message?.content || "{}";
}

function extractJson(raw) {
  const text = String(raw || "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1));
  throw new Error("模型未返回 JSON");
}
