import { stepIntentLabels } from "@/data/story-manifest";
import { isFrail } from "./character";
import { CharacterKind, StepIntent, relationshipWith } from "./models";

const DECISION_TO_INTENT = {
  protect_allies: StepIntent.heal,
  complete_quest: StepIntent.follow,
  self_preserve: StepIntent.refuse,
  keep_records: StepIntent.refuse,
  protect_self: StepIntent.warn,
  trade_info: StepIntent.probe,
  watch_the_tide: StepIntent.watch,
  avoid_church: StepIntent.refuse,
  survive: StepIntent.refuse,
  guard_listening: StepIntent.warn,
};

const THREAT_MARKERS = ["抢劫", "打劫", "动手", "杀你", "威胁", "拔刀", "袭击", "交出来"];
const INJURY_MARKERS = ["伤", "倒", "血", "治疗", "包扎"];

export function compileExecutableStrategy(character, actContext, actStrategy, context, situation = "idle") {
  const strategy = actStrategy || {
    allowed_intents: [StepIntent.probe],
    default_intent: StepIntent.probe,
    goal_focus: character.goals[0] || "按人设行事",
    forbidden_say: [],
    unlock_skills: [],
  };
  const stepIntent = resolveStepIntent(character, strategy, context, situation);
  const mustNotSay = compileMustNotSay(character, strategy, context);
  return {
    act: actContext,
    allowed_intents: [...strategy.allowed_intents],
    default_intent: strategy.default_intent,
    goal_focus: strategy.goal_focus,
    step_intent: stepIntent,
    step_intent_label: stepIntentLabels[stepIntent] || stepIntent,
    must_not_say: mustNotSay,
    unlock_skills: [...(strategy.unlock_skills || [])],
    cognition_block: renderCognitionBlock(character),
    strategy_block: renderStrategyBlock(actContext, strategy, stepIntent, mustNotSay),
  };
}

export function resolveStepIntent(character, strategy, context, situation) {
  const allowed = new Set(strategy.allowed_intents || []);
  const pick = (intent) => (allowed.has(intent) ? intent : strategy.default_intent);

  if (situation === "threat") {
    if (character.constitution.decision_order.includes("protect_allies")) return pick(StepIntent.protect);
    if (character.constitution.decision_order.includes("protect_self")) return pick(StepIntent.warn);
    return pick(StepIntent.refuse);
  }

  const injuredPresent = (context.observation?.present_ids || []).some((cid) => {
    const other = context._characters?.[cid];
    return other && other.hp < other.max_hp;
  });
  const healer =
    (character.occupation || "").includes("疗") ||
    character.goals.some((g) => g.includes("保护") || g.includes("治疗"));
  if (injuredPresent && healer && allowed.has(StepIntent.heal)) return StepIntent.heal;

  if (situation === "plot" && allowed.has(StepIntent.trade_info)) return StepIntent.trade_info;
  if (character.follow_player && allowed.has(StepIntent.follow)) return StepIntent.follow;

  for (const key of character.constitution.decision_order || []) {
    const mapped = DECISION_TO_INTENT[key];
    if (mapped && allowed.has(mapped)) return mapped;
  }

  return strategy.default_intent || StepIntent.probe;
}

export function compileMustNotSay(character, strategy, context) {
  const items = [
    ...(strategy.forbidden_say || []),
    ...(character.constitution.taboos || []).map((t) => t.replace(/^不会/, "").replace(/^绝不/, "").trim()),
    ...(context.forbidden_topics || []),
  ];
  return [...new Set(items.filter(Boolean))];
}

export function renderCognitionBlock(character) {
  const cog = character.cognition || {};
  const notice = (cog.notice_first || []).map((item) => `- ${item}`).join("\n") || "- 按职业与现场判断";
  return `【认知剖面】
我先注意：
${notice}
解读习惯：${cog.interpret_bias || "按字面理解对方，再结合关系判断"}
不确定时：${cog.when_uncertain || "短答，不先交底"}`;
}

export function renderStrategyBlock(actContext, strategy, stepIntent, mustNotSay) {
  const intents = (strategy.allowed_intents || [])
    .map((id) => `${stepIntentLabels[id] || id}(${id})`)
    .join("、");
  const banned = mustNotSay.map((item) => `- ${item}`).join("\n") || "- （无额外禁令）";
  return `【本幕可执行策略】第${actContext.order}幕 ${actContext.title}
幕次目标：${actContext.summary}
这一幕你的重点：${strategy.goal_focus}
本回合允许的行动意图：${intents}
系统建议本步意图：${stepIntentLabels[stepIntent] || stepIntent}（${stepIntent}）
绝对不能说出口：
${banned}`;
}

export function renderThinkingGuide() {
  return `【思维步骤 — 必须按顺序填写 JSON 字段，再写反应模块】
1. notice_first：我先注意到什么（只能写认知剖面允许你注意到的）
2. interpret_intent：我把对方意图理解成什么
3. step_intent：本步行动意图，必须是本幕 allowed 之一：heal|probe|warn|refuse|protect|trade_info|watch|follow
4. must_not_say：什么绝对不能说出口（合并策略禁令与秘密）
5. inner_thought：内心独白，可写猜测，禁止说出口
6. 然后才是 facing/gesture/emotion/speech/action...
全部写进同一个 JSON 对象，不要输出括号旁白。`;
}

export function buildRuleThinking(character, executable, context, trigger, situation) {
  const playerId = context._player_id || "player";
  const rel = relationshipWith(character, playerId);
  const notice = pickNotice(character, executable, context, trigger, situation);
  const interpret = pickInterpret(character, executable, rel, trigger, situation);
  return {
    notice_first: notice,
    interpret_intent: interpret,
    step_intent: executable.step_intent,
    must_not_say: executable.must_not_say.join("；") || "未授权的秘密与禁令话题",
    inner_thought: pickInnerThought(character, executable, rel, situation),
  };
}

function pickNotice(character, executable, context, trigger, situation) {
  const notices = character.cognition?.notice_first || [];
  if (situation === "threat") {
    return notices.find((n) => n.includes("武") || n.includes("砸") || n.includes("伤")) || "对方语气不对，像在找麻烦";
  }
  if (situation === "drink" || trigger.includes("酒")) {
    return notices.find((n) => n.includes("酒") || n.includes("钱") || n.includes("潮")) || "来人像是来套话的";
  }
  const injured = (context.observation?.present_ids || []).some((cid) => {
    const other = context._characters?.[cid];
    return other && other.hp < other.max_hp;
  });
  if (injured) return notices.find((n) => n.includes("伤")) || "有人受伤了，得先看清伤势";
  return notices[0] || `对方在说：${trigger.slice(0, 40)}`;
}

function pickInterpret(character, executable, rel, trigger, situation) {
  const bias = character.cognition?.interpret_bias || "";
  if (situation === "threat") return "对方在威胁或抢劫，不是闲聊";
  if (situation === "smalltalk") return rel.trust < 0.2 ? "表面闲聊，未必没有来意" : "普通寒暄";
  if (["什么", "为何", "怎么", "如何", "谁", "哪", "？"].some((m) => trigger.includes(m))) {
    return "对方在追问一个具体概念或刚才的说法，先按字面解释，不要改抛线索碎片";
  }
  if (trigger.includes("预警") || trigger.includes("急件") || trigger.includes("听涌")) {
    return "在打听危险消息，得掂量能给多少";
  }
  if (bias) return bias.split("；")[0];
  return "先按字面理解，再结合关系判断";
}

function pickInnerThought(character, executable, rel, situation) {
  if (situation === "threat") return `本步意图：${executable.step_intent_label}。不能示弱。`;
  if (isFrail(character)) return `身体不允许硬拼。本步：${executable.step_intent_label}。`;
  if (rel.trust < 0.15) return `还不信这人。${executable.goal_focus}`;
  return executable.goal_focus;
}

export function validateThinking(thinking, executable) {
  const errors = [];
  if (!thinking) {
    errors.push("缺少思维步骤字段（notice_first / interpret_intent / step_intent / must_not_say）");
    return errors;
  }
  for (const key of ["notice_first", "interpret_intent", "step_intent", "must_not_say"]) {
    if (!String(thinking[key] || "").trim()) errors.push(`${key} 不能为空`);
  }
  if (thinking.step_intent && !executable.allowed_intents.includes(thinking.step_intent)) {
    errors.push(`step_intent 必须是本幕允许之一：${executable.allowed_intents.join("、")}，你填了 ${thinking.step_intent}`);
  }
  if (thinking.step_intent && thinking.step_intent !== executable.step_intent) {
    // 允许与系统建议不同，但必须在 allowed 内；上面已检查 allowed
  }
  return errors;
}

export function classifySituationForStrategy(trigger) {
  if (THREAT_MARKERS.some((m) => trigger.includes(m))) return "threat";
  if (INJURY_MARKERS.some((m) => trigger.includes(m))) return "injury";
  if (["预警", "急件", "听涌", "灯塔", "议会", "裂隙", "法师塔", "教团", "潮汐", "星辰", "异动"].some((m) => trigger.includes(m))) {
    return "plot";
  }
  if (["酒", "麦酒"].some((m) => trigger.includes(m))) return "drink";
  if (["你好", "帅", "漂亮", "吗"].some((m) => trigger.includes(m))) return "smalltalk";
  return "talk";
}

export function attachEngineToContext(context, engine) {
  context._characters = engine.characters;
  context._player_id = engine.player_id;
  return context;
}
