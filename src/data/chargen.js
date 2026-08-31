/** 开局创建角色：属性、性格探测题。问题刻意不沾主线剧情。 */

export const ATTR_POINT_TOTAL = 20;
export const ATTR_MIN = 0;
export const ATTR_MAX = 10;

export const ATTR_DEFS = [
  { id: "感知", hint: "察言观色、发现破绽。影响洞察。" },
  { id: "灵巧", hint: "身手与临场反应。影响潜行、战斗。" },
  { id: "智识", hint: "推理、记忆与仪式理解。影响学识、仪式。" },
  { id: "气度", hint: "说服、安抚与气场。影响口才、共情。" },
];

export const SKILL_TO_ATTR = {
  洞察: "感知",
  潜行: "灵巧",
  战斗: "灵巧",
  学识: "智识",
  仪式: "智识",
  口才: "气度",
  共情: "气度",
};

export const CHARGEN_QUESTIONS = [
  {
    id: "q1",
    prompt: "夜里独自行走，忽然觉得有人跟着。你会？",
    options: [
      { id: "a", label: "立刻转身，看清对方是谁", trait: "直面" },
      { id: "b", label: "不回头，改道走进灯火通明处", trait: "谨慎" },
      { id: "c", label: "放慢脚步，等对方靠近再开口", trait: "主动" },
      { id: "d", label: "装作不知，把周围进出记一遍", trait: "观察" },
    ],
  },
  {
    id: "q2",
    prompt: "有人把一件不想让第三个人知道的事托付给你。随后那人来问。你会？",
    options: [
      { id: "a", label: "一口咬定自己什么都不知道", trait: "守密" },
      { id: "b", label: "只说不伤人的那一半", trait: "权衡" },
      { id: "c", label: "先问清对方为什么要知道", trait: "追问" },
      { id: "d", label: "不愿夹在中间，劝托付者自己去说", trait: "界限" },
    ],
  },
  {
    id: "q3",
    prompt: "精心准备的安排中途全乱了。你第一反应是？",
    options: [
      { id: "a", label: "停下来，把顺序重新排好", trait: "筹划" },
      { id: "b", label: "先做眼前能做的，边走边改", trait: "应变" },
      { id: "c", label: "问身边的人现在怎么看", trait: "协作" },
      { id: "d", label: "凭直觉选一个方向冲过去", trait: "直觉" },
    ],
  },
  {
    id: "q4",
    prompt: "当众有人否定你刚说的判断。你会？",
    options: [
      { id: "a", label: "当场把理由说完", trait: "直言" },
      { id: "b", label: "先听对方讲完，再决定要不要辩", trait: "倾听" },
      { id: "c", label: "过后再私下把话说清楚", trait: "内敛" },
      { id: "d", label: "不再争，用接下来的结果说话", trait: "结果" },
    ],
  },
];

/** 选项背后的性格读法。写简报只用这些，不要复述题面情景。 */
export const TRAIT_READINGS = {
  直面: "不确定时宁可把人看清，也不肯把未知留在背后。安全感来自当面问清楚，而不是先给自己留退路。",
  谨慎: "先让自己落在可控的地方，再谈下一步。不把勇气浪费在看不清的局里，行动前要有退路。",
  主动: "习惯把节奏抓在自己手里。与其等事情砸过来，不如先开口、先靠近、先把关系定下来。",
  观察: "不急着表态。先把人、路、进出的细节收进眼里，再决定信谁、走哪。沉默不是退缩，是在收集。",
  守密: "把别人交来的话当成自己的责任。宁可自己扛着不舒服，也不轻易把别人的事交出去。",
  权衡: "说实话之前会先掂量伤害落在谁身上。不是圆滑，是不肯用真话去砸一个还用得着的人。",
  追问: "不接受表面说法。对方要什么、为什么要，比对方说了什么更重要。信任建立在问清楚之后。",
  界限: "不愿当两头的传声筒。谁的事就该谁去说，自己不肯被卷进别人的账里。",
  筹划: "乱了先停。要看见顺序，才肯迈下一步。失控让你烦的不是失败，是无序。",
  应变: "计划作废也不空等。眼前能做的先做，边走边改，靠行动把局面重新拼起来。",
  协作: "一个人想不全时，会把判断摊开给身边的人。不是没主见，是觉得几双眼睛比一口咬定更稳。",
  直觉: "来不及排理由时，会先选一个方向走。对你来说，停在原地比走错更难受。",
  直言: "被顶回去也不会把话吞回去。对的东西要当场说完，事后再解释会觉得自己先输了。",
  倾听: "被否定时先把对方的理听完。不是服软，是要确认自己有没有漏看，再决定要不要硬刚。",
  内敛: "当众撕破脸不划算。真正要说的话，会留到能说清楚的地方。表面让一步，不等于认输。",
  结果: "争赢一场口并不重要。你更信接下来做出来的东西，用结果把刚才的否定压回去。",
};

export function emptyPlayerSheet() {
  return {
    name: "",
    gender: "male",
    attrs: Object.fromEntries(ATTR_DEFS.map((item) => [item.id, 5])),
    answers: {},
    traits: [],
    teammateWish: "",
    hp: 10,
    maxHp: 10,
  };
}

export function spentPoints(attrs) {
  return ATTR_DEFS.reduce((sum, item) => sum + (Number(attrs?.[item.id]) || 0), 0);
}

export function remainingPoints(attrs) {
  return ATTR_POINT_TOTAL - spentPoints(attrs);
}

export function attrModifier(value) {
  return Math.floor(Number(value || 0) / 2);
}

export function compileTraits(answers) {
  return CHARGEN_QUESTIONS.map((question) => {
    const picked = question.options.find((option) => option.id === answers[question.id]);
    return picked?.trait;
  }).filter(Boolean);
}

export function describeAnswers(sheet) {
  return CHARGEN_QUESTIONS.map((question) => {
    const picked = question.options.find((option) => option.id === sheet?.answers?.[question.id]);
    if (!picked) return `${question.prompt} → 未答`;
    return `${question.prompt} → ${picked.label}（气质：${picked.trait}）`;
  }).join("\n");
}

export function describePersonalitySeed(sheet) {
  const traits = sheet?.traits?.length ? sheet.traits : compileTraits(sheet?.answers || {});
  if (!traits.length) return "尚未形成可读的性格倾向。";
  return traits
    .map((trait) => `- ${trait}：${TRAIT_READINGS[trait] || "未标明。"}`)
    .join("\n");
}

export function validateSheet(sheet) {
  const name = (sheet?.name || "").trim();
  if (!name) return "请写下你的名字。";
  if (name.length > 12) return "名字请控制在 12 个字以内。";
  if (remainingPoints(sheet.attrs) !== 0) return `还需分配完 ${ATTR_POINT_TOTAL} 点属性。`;
  const unanswered = CHARGEN_QUESTIONS.find((question) => !sheet.answers[question.id]);
  if (unanswered) return "请答完四个问题。";
  const wish = (sheet?.teammateWish || "").trim();
  if (!wish) return "请写下你希望的队友。";
  if (wish.length > 50) return "对队友的期望请控制在 50 个字以内。";
  return "";
}

export function finalizeSheet(sheet) {
  const name = (sheet.name || "").trim();
  return {
    ...sheet,
    name,
    teammateWish: (sheet.teammateWish || "").trim(),
    traits: compileTraits(sheet.answers),
    hp: 10,
    maxHp: 10,
  };
}
