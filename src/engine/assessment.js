import assessmentSkill from "@/character-engine/characters/player/personality.md?raw";
import { WORLD_KNOWLEDGE } from "@/character-engine";
import { describePersonalitySeed } from "@/data/chargen";
import { ACT1_STEPS } from "@/data/play-stage";
import { briefingPlain, openingBriefing } from "@/data/story-manifest";
import { getSettings, llmChatRequest, llmFetch } from "./config";
import { playLogMarkdown } from "./play-log";

const SCHEMA = {
  headline: "4到8字称呼",
  opening: "对照开局简报，这一局里实际怎么走",
  with_people: "对人",
  under_pressure: "压力下",
  method: "查案方式",
  verdict: "总结",
};

export async function generateAssessment(game) {
  const settings = getSettings();
  if (!settings.usesLlm) return fallbackReport(game);
  try {
    const raw = await completeChat(settings, buildPrompt(game));
    const data = extractJson(raw);
    return normalizeReport(data, game);
  } catch {
    return fallbackReport(game);
  }
}

function buildPrompt(game) {
  const player = game.player || {};
  const brief = player.personality || {};
  const world = openingBriefing.sections.map((section) => `${section.heading}：${briefingPlain(section.body)}`).join("\n");
  const goals = ACT1_STEPS.map((step, index) => `${index + 1}. ${step.todo}`).join("\n");
  const flags = Object.entries(game.routeFlags || {})
    .filter(([, on]) => on)
    .map(([id]) => id)
    .join("、");
  return `${String(assessmentSkill || "").trim()}

世界观：
${WORLD_KNOWLEDGE}

开场已知：
${world}

本幕目标：
${goals}

开局性格读法：
${describePersonalitySeed(player)}

开局性格简报：
${[brief.headline, brief.core || brief.summary, brief.pressure, brief.with_people, brief.wish_read].filter(Boolean).join("\n")}

已记下的进度旗标：${flags || "无"}

游玩记录：
${playLogMarkdown(game.playLog, game)}

只输出 JSON：${JSON.stringify(SCHEMA)}`;
}

function normalizeReport(raw, game) {
  const data = raw && typeof raw === "object" ? raw : {};
  const fallback = fallbackReport(game);
  return {
    headline: String(data.headline || fallback.headline).slice(0, 12),
    opening: String(data.opening || fallback.opening).slice(0, 280),
    with_people: String(data.with_people || fallback.with_people).slice(0, 220),
    under_pressure: String(data.under_pressure || fallback.under_pressure).slice(0, 220),
    method: String(data.method || fallback.method).slice(0, 220),
    verdict: String(data.verdict || fallback.verdict).slice(0, 280),
  };
}

function fallbackReport(game) {
  const name = game.player?.name || "时隙行者";
  const flags = game.routeFlags || {};
  const talks = (game.playLog?.entries || []).filter((item) => item.kind === "talk").length;
  const dice = (game.playLog?.entries || []).filter((item) => item.kind === "dice");
  const failed = dice.filter((item) => /失败/.test(item.text)).length;
  const method = flags.lookedAround
    ? "这一局里先把现场看清，再拿去问人。"
    : "记录里还没看见你把广场四周看完。";
  return {
    headline: "先问后定",
    opening: `${name}这一夜按简报走进了潮汐港湾。开局那份性格简报只是入口，真正显出来的，是你有没有把灯、水和告示问到能写下来。`,
    with_people: talks
      ? `你开过口，记下了 ${talks} 段对话。对人时你更靠把话问完，而不是先下判断。`
      : "记录里几乎没有对话。对人这一项还看不真。",
    under_pressure: failed
      ? `检定里有 ${failed} 次没成。失败之后你没有把同一件事再劝一遍，这和「一次就收」是对得上的。`
      : "压力记录不多。能看见的是：该问的还是去问了。",
    method,
    verdict: flags.sawCabinet
      ? "你把这一幕该对上的对上了：灯、信、账本、柜子。下一步不是性格测验，是打开那封还锁着的急件。"
      : "这一幕还没全部对上。现在能下的结论只到你已经走过的那些选择为止。",
  };
}

async function completeChat(settings, prompt) {
  const traceId = crypto.randomUUID();
  const { headers, body } = llmChatRequest(settings, {
    messages: [
      {
        role: "system",
        content: "你是性格评测员。只根据游玩记录下判断。只输出 JSON。",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.4,
    json: true,
    user: traceId,
  });
  const response = await llmFetch(
    `${settings.apiBase}/chat/completions`,
    { method: "POST", headers, body },
    { timeoutMs: 45000 },
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
