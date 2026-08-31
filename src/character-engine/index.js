/**
 * character-engine —— 第一幕人物 / 提示词
 *
 * story/act-1.md                 设计用剧情，不进对话 prompt
 * world/common-knowledge.md    公开世界常识
 * characters/<id>/memory.md   简介、记忆、人设、目的
 * characters/<id>/status.md    身体、属性、物品、信任
 * characters/player/personality.md  性格评测预留，对话不读
 * maps/<id>/status.md              大地图 / 子地图状态，对话不读
 * skills/talk/SKILL.md         和 NPC / 队友说话时调用的规范
 * skills/aside/SKILL.md        队友主动开口，对话不读
 * skills/rift/SKILL.md         码头异变突生，对话不读
 */
import talkSkillRaw from "./skills/talk/SKILL.md?raw";
import worldKnowledge from "./world/common-knowledge.md?raw";
import playerMemory from "./characters/player/memory.md?raw";
import playerStatus from "./characters/player/status.md?raw";
import mateMemory from "./characters/mate/memory.md?raw";
import mateStatus from "./characters/mate/status.md?raw";
import yongyinMemory from "./characters/yongyin/memory.md?raw";
import yongyinStatus from "./characters/yongyin/status.md?raw";
import ewenMemory from "./characters/ewen/memory.md?raw";
import ewenStatus from "./characters/ewen/status.md?raw";
import saltspeakerMemory from "./characters/saltspeaker/memory.md?raw";
import saltspeakerStatus from "./characters/saltspeaker/status.md?raw";
import bakerMemory from "./characters/baker/memory.md?raw";
import bakerStatus from "./characters/baker/status.md?raw";
import envoyMemory from "./characters/envoy/memory.md?raw";
import envoyStatus from "./characters/envoy/status.md?raw";

export const TALK_SKILL_ID = "character-talk";

export const TALK_JSON_EXAMPLE = {
  notice_first: "对方在问灯塔为什么亮",
  interpret_intent: "想听一句能听懂的解释",
  step_intent: "trade_info",
  must_not_say: "急件全文；急件编号",
  inner_thought: "柜子里的信我没见过，只说我看见的",
  facing: "other",
  facing_id: "player",
  gesture: "擦了擦手上的面",
  emotion: "calm",
  speech: "今晚没船进港，灯塔却通宵亮着。那闪法是王都迎船用的。这个港口平时不用。",
  action: "把还热的面包往前推了推",
  action_type: "speak",
  target_id: "player",
  destination: "",
  memory_to_save: "对方在问灯塔为什么亮",
  relationship_deltas: [],
};

const PACKS = {
  player: { memory: playerMemory, status: playerStatus },
  mate: { memory: mateMemory, status: mateStatus },
  yongyin: { memory: yongyinMemory, status: yongyinStatus },
  ewen: { memory: ewenMemory, status: ewenStatus },
  saltspeaker: { memory: saltspeakerMemory, status: saltspeakerStatus },
  baker: { memory: bakerMemory, status: bakerStatus },
  envoy: { memory: envoyMemory, status: envoyStatus },
};

export const CHARACTER_PACK_IDS = Object.keys(PACKS);

export const TALK_SKILL = stripFrontmatter(talkSkillRaw);
export const WORLD_KNOWLEDGE = String(worldKnowledge || "").trim();

export function stripFrontmatter(md) {
  const text = String(md || "");
  if (!text.startsWith("---")) return text.trim();
  const end = text.indexOf("\n---", 3);
  if (end < 0) return text.trim();
  return text.slice(end + 4).trim();
}

export function getCharacterPack(characterId) {
  return PACKS[characterId] || null;
}

/**
 * 组装一次对话调用的系统提示。
 * 不读第一幕剧情全文，不读玩家性格评测。
 */
export function buildTalkPrompt(character, context = {}, extra = "") {
  const pack = getCharacterPack(character?.id);
  const memory = pack?.memory ? String(pack.memory).trim() : fallbackMemory(character);
  const status = pack?.status ? String(pack.status).trim() : fallbackStatus(character);
  const generated = character?.id === "mate" ? renderGeneratedMate(character) : "";
  const live = renderLiveOverlay(character, context);
  const scene = renderScene(character, context);
  const extraBlock = extra ? `\n\n系统提示：${extra}` : "";

  return `${TALK_SKILL}

你就是${character?.name || "无名氏"}（id=${character?.id || "?"}，职业=${character?.occupation || "未知"}）。按上面的规范开口。不要用助手口吻。

# 你的记忆
${memory}
${generated}

# 你的状态
${status}

${live}

# 世界常识（公开，不是你的目击记录）
${WORLD_KNOWLEDGE}

${scene}${extraBlock}`;
}

function fallbackMemory(character) {
  return `# 记忆（无独立档案时的兜底）

你叫${character?.name || "无名氏"}。职业：${character?.occupation || "未知"}。
简介：${character?.summary || "你是这座港湾里的一个人。"}
只说自己经历过的事。不知道就说不知道。`;
}

function fallbackStatus(character) {
  return `# 状态（兜底）

- 角色 id：${character?.id || "?"}
- 姓名：${character?.name || "无名氏"}
- 职业：${character?.occupation || "未知"}
`;
}

function renderGeneratedMate(character) {
  const goals = (character.goals || []).filter(Boolean).join("；");
  const notes = (character.evolved_notes || []).filter(Boolean).join("\n- ");
  return `
## 本局生成档案（覆盖上方模板的简介、人设、目的）

- 姓名：${character.name}
- 职业：${character.occupation || "同行者"}
- 来历：${character.summary || "（尚未写入）"}
- 在这条路上的目的：${goals || "（尚未写入）"}
${notes ? `- 其它已写入：\n- ${notes}` : ""}

你被一个小组织派来接应时隙行者，因为合得来，不是去当工具。主线机密你没有。灯塔改灯号、预警信、账本改口，只能复述你当时在场听见的，不能替涌音、伊文、盐语者作答。`;
}

function renderLiveOverlay(character, context) {
  const obs = context.observation || {};
  const hp = obs.hp ?? character?.hp;
  const maxHp = obs.max_hp ?? character?.max_hp;
  const stamina = obs.stamina ?? character?.stamina;
  const maxStamina = obs.max_stamina ?? character?.max_stamina;
  const rels =
    (context.relationships || [])
      .map((r) => {
        const trust = Number.isFinite(r.trust) ? r.trust.toFixed(2) : r.trust;
        const affection = Number.isFinite(r.affection) ? r.affection.toFixed(2) : r.affection;
        const fear = Number.isFinite(r.fear) ? r.fear.toFixed(2) : r.fear;
        return `- ${r.other_id}：信任${trust} 好感${affection} 惧怕${fear} ${r.note || ""}`;
      })
      .join("\n") || "- （关系空白）";
  const injuries = (character?.injuries || []).filter(Boolean).join("、") || "无（以实时为准）";
  return `## 本局实时状态（数字与关系以此为准，覆盖静态文档里冲突的项）

- 姓名：${character?.name || ""}
- 所在地：${obs.location_name || character?.location_id || ""}
- HP：${hp ?? "?"}/${maxHp ?? "?"}
- 耐力：${stamina ?? "?"}/${maxStamina ?? "?"}
- 情绪：${obs.emotion || character?.emotion || ""}
- 受伤：${injuries}
- 手头活动：${obs.current_activity || "无"}

对在场的人：
${rels}`;
}

function renderScene(character, context) {
  const obs = context.observation || {};
  const present = Object.entries(obs.present_names || {})
    .map(([cid, name]) => `${name}(${cid})`)
    .join("、");
  const utterance = currentUtterance(context);
  const skipEcho = (text) => echoesUtterance(text, utterance);
  const memories =
    uniqueTail(
      (context.memories || [])
        .filter((m) => !String(m.content || "").includes("秘密（不可对无权者透露）"))
        .map((m) => `(${m.kind || "记忆"}) ${m.content}`)
        .filter((item) => !skipEcho(item)),
      6,
    )
      .map((item) => `- ${item}`)
      .join("\n") || "- （本局还没有新的检索记忆）";
  const recent =
    uniqueTail((obs.recent_events || []).filter((item) => !skipEcho(item)), 6)
      .map((e) => `- ${e}`)
      .join("\n") || "- 无";
  const exec = context.executable_strategy || {};
  const allowed = (exec.allowed_intents || []).join("、") || "probe";
  const banned = Array.isArray(exec.must_not_say)
    ? exec.must_not_say.map((item) => `- ${item}`).join("\n")
    : exec.must_not_say
      ? `- ${exec.must_not_say}`
      : "- （无额外禁令）";
  const must = context.must_reply
    ? `【强制】对方正在对你说话。speech 不能为空。问名字就报自己的真名（${character?.name || ""}）。问好不好看就先给评价或打趣。facing 必须是 other，facing_id 填对方 id。`
    : "";

  return `# 本局现场

当前时间：${obs.clock || ""}
地点：${obs.location_name || ""} — ${obs.location_desc || ""}
在场：${present || "（未提供）"}

本回合允许的 step_intent：${allowed}
系统建议本步意图：${exec.step_intent_label || exec.step_intent || "probe"}
绝对不能说出口：
${banned}

${must}

【完整对白】只列出你和玩家之间的对话。结合这些对白回答最新一句。
${renderDialogueLog(character, context)}

本局检索到的记忆（你亲身经历过的，可以提）：
${memories}

最近见闻（不含本轮对白）：
${recent}

【当前原句】${utterance}

输出必须是合法 JSON 对象。字段名必须与规范一致。不要 markdown 代码块。`;
}

function currentUtterance(context) {
  const speech = String(context.triggering_speech || "").trim();
  if (speech) return speech;
  const trigger = String(context.triggering_event || "").trim();
  const start = trigger.indexOf("「");
  const end = trigger.lastIndexOf("」");
  if (start >= 0 && end > start) return trigger.slice(start + 1, end);
  return trigger || "……";
}

function renderDialogueLog(character, context) {
  const turns = context.dialogue_turns || [];
  if (!turns.length) return "- （尚无对白）";
  return turns
    .filter((turn) => turn && String(turn.text || "").trim())
    .map((turn) => {
      const isBot = turn.sender_type === "BOT" || turn.role === "assistant" || turn.speaker_id === character?.id;
      const who = isBot ? character?.name : turn.sender_name || context.player_name || "时隙行者";
      return `- ${who}：${String(turn.text).trim()}`;
    })
    .join("\n");
}

function uniqueTail(items, n) {
  const seen = new Set();
  const out = [];
  for (let i = items.length - 1; i >= 0; i -= 1) {
    const key = String(items[i] || "").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(items[i]);
    if (out.length >= n) break;
  }
  return out.reverse();
}

function echoesUtterance(text, utterance) {
  if (!utterance) return false;
  const raw = String(text || "");
  return raw.includes(`「${utterance}」`) || raw === utterance;
}
