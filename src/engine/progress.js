import { getSettings } from "./config";
import { ACT1_STEPS, briefingProgress } from "@/data/play-stage";

export async function judgeStep(step, memories) {
  if (!step?.evidence) return { done: false, reason: "" };
  const lines = (memories || []).map((item) => String(item || "").trim()).filter(Boolean);
  if (!lines.length) return { done: false, reason: "还没有记下任何见闻" };
  return askModel(step, lines);
}

export async function reviewAct1Progress(flags = {}, memories = []) {
  const next = { ...flags };
  const gained = [];
  for (let i = 0; i < ACT1_STEPS.length; i += 1) {
    const { current } = briefingProgress(next);
    if (!current) break;
    if (current.kind === "observe") break;
    if (next[current.id]) continue;
    const result = await judgeStep(current, memories);
    if (!result.done) break;
    next[current.id] = true;
    gained.push(current);
  }
  return {
    flags: next,
    gained,
    note: gained.length ? `简报更新：${gained.map((item) => item.todo).join("；")}` : "",
  };
}

function keywordHit(step, text) {
  const keys = step.hints || [];
  if (!keys.length) return false;
  const need = step.hintNeed || Math.min(2, keys.length);
  return keys.filter((key) => text.includes(key)).length >= need;
}

async function askModel(step, lines) {
  const settings = getSettings();
  if (!settings.usesLlm) {
    return { done: keywordHit(step, lines.join("\n")), reason: "" };
  }
  const recent = lines.slice(-20);
  const prompt = `你在判定一个玩家是否已经「知道」当前待做事项要求的信息。
只看记忆原文，不要脑补他没听到的话。寒暄、问路、没问到点子上，一律不算完成。

待做事项：${step.todo}
判定标准：${step.evidence}

玩家记忆（从旧到新）：
${recent.map((line, index) => `${index + 1}. ${line}`).join("\n")}

只输出 JSON：{"done":true或false,"reason":"一句话说明依据"}`;
  try {
    const raw = await completeChat(settings, prompt);
    const data = extractJson(raw);
    return {
      done: Boolean(data.done),
      reason: String(data.reason || "").slice(0, 80),
    };
  } catch {
    return { done: keywordHit(step, lines.join("\n")), reason: "" };
  }
}

async function completeChat(settings, prompt) {
  const traceId = crypto.randomUUID();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(`${settings.apiBase}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.apiKey}`,
        "M-TraceId": traceId,
      },
      body: JSON.stringify({
        model: settings.model,
        temperature: 0.1,
        stream: false,
        messages: [
          {
            role: "system",
            content: "你是严格的进度判定员。记忆里没有明确事实就判定未完成。只输出 JSON。",
          },
          { role: "user", content: prompt },
        ],
        user: traceId,
      }),
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
