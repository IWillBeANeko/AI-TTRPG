import { getSettings, llmChatRequest, llmFetch } from "./config";
import { ATTR_DEFS, ATTR_MAX, ATTR_MIN, ATTR_POINT_TOTAL, compileTraits, describePersonalitySeed, TRAIT_READINGS } from "@/data/chargen";
import { briefingPlain, openingBriefing } from "@/data/story-manifest";

const BANNED_NAMES = ["涌音", "伊文", "盐语者", "面包师", "维斯坎特", "卡尔萨斯", "时隙行者"];
const STOCK_NAMES = ["岑岚", "顾衡"];
const STOCK_JOBS = ["裂隙测绘员", "港湾守夜人"];
const BANNED_ORGS = ["星辰神殿", "深涌议会", "虚空教团", "教廷"];

const NAME_POOL = {
  female: ["祁霜", "江蘅", "沈烛", "裴织", "苏晚", "阮青"],
  male: ["陆岑", "霍衡", "晏北", "程岸", "叶溯", "韩渚"],
};
const JOB_POOL = {
  female: ["潮汐书记", "残页修复师", "港湾向导", "残响听录", "灯塔测绘"],
  male: ["锚点看守", "残章校对", "裂隙引路人", "潮灯守夜", "残页掮客"],
};
const ORG_POOL = ["残页司", "时隙驿", "锚点署", "裂隙观测处"];

const PAIR_SCHEMA = {
  briefing: {
    headline: "4到8字的性格称呼，不要用人名，不要罗列气质词",
    core: "120到180字。性格内核：这个人信什么、怕什么、怎样才觉得安全。禁止提及跟踪、托付、计划被打乱、当众否定等题面",
    pressure: "60到100字。压力、冲突、被顶回去时会怎样。仍禁止复述题面",
    with_people: "60到100字。对信任、秘密、别人的话会怎样处理",
    wish_read: "50到90字。把对队友的期望读成相处需求，不要复述职业名称",
  },
  companion: {
    name: "原创姓名，2到4个汉字",
    gender: "男或女",
    occupation: "原创身份",
    org: "派出这个人的组织，必须原创",
    attrs: { 感知: "0-10整数", 灵巧: "0-10整数", 智识: "0-10整数", 气度: "0-10整数" },
    story: "约120字第三人称小传：来历、习惯、未了之事，要有具体细节",
    intro: "第一人称自我介绍，140到220字。刚见面开口：我是谁、哪个组织派我来、为什么是我来而不是别人、我自己还要办什么。必须用我。禁止分析玩家、禁止第三人称、禁止说互补短板",
  },
};

const STORY_MAX = 220;
const INTRO_MAX = 320;
const CORE_MAX = 280;
const PARA_MAX = 140;
const WISH_MAX = 120;

const FALLBACK_LIVES = [
  {
    org: "残页司",
    story: "港湾南栈长大，夜里帮人抄潮汐时刻表。某次实际水位比表上早了半个时辰，家里人说是看错了。她把那一页撕下来缝进衣襟，进了残页司，专管对不上号的记录。",
    intro: "我是残页司的人。抄潮汐表那几年，对不上的记录比人对得上的还多。他们让我来接你，不是因为我会保护谁，是因为我习惯把事情问到能写下来为止。我自己还欠着一页没对上的表，这条路我本来就要走。你要是问我信不信你，我得先看你怎么把话说完。",
  },
  {
    org: "时隙驿",
    story: "在辉煌纪元的废码头修了两年灯。灯油越来越稀，工头让他装看不见。他把最后一盏还能亮的灯拆下来揣走，后来被时隙驿收编，专门把人从裂隙口带到还能涨落的海。",
    intro: "时隙驿让我来接刚落下的人。废码头修灯的时候，工头让我装看不见，我没装成。口袋里这盏灯还亮着，我要赶在它熄掉以前看见真正的潮汐。你顺路。我会把该说的说完，也会先听完你要去哪。别把我当向导，我只是不想一个人把灯油耗完。",
  },
  {
    org: "锚点署",
    story: "原先在钟塔抄钟点，后来发现自己记下的时辰和墙上的对不上。同事劝她把笔放下。她把对不上的那几行抄进袖管，被锚点署要去对日出。离开的时候没跟任何人告别。",
    intro: "锚点署派我来。钟塔里我抄过对不上的时辰，袖管里还缝着那几行。他们挑我，是因为我不当众把话说破，但会把结果拿出来。我要去星辰广场对一次日出。你要是问我为什么是我，不是别人——我跟你这种把判断咬住不放的人，走一段不会太费话。",
  },
  {
    org: "裂隙观测处",
    story: "盐工出身，手背全是白霜。教廷征用码头那年，他把自家的测盐秤藏进船板缝里。后来船被拖走，秤还在。裂隙观测处要一个不怕脏活的人守裂隙口，他应了，沿河找了很久。",
    intro: "裂隙观测处让我来接你。我是盐工出身，手背还是白的。我来找那杆藏进船板缝里的秤，不是来当保镖。你刚从缝里摔出来，别挡路。三步之后我会放慢一点。要问为什么派我：我会先把来意问清楚，也不会把人丢在裂隙边上。",
  },
];

export function emptyCompanion() {
  return {
    name: "",
    gender: "female",
    occupation: "同行者",
    org: "",
    intro: "",
    dispatch: "",
    attrs: Object.fromEntries(ATTR_DEFS.map((item) => [item.id, 5])),
    story: "",
    reason: "",
  };
}

export function emptyBriefing() {
  return { headline: "", core: "", pressure: "", with_people: "", wish_read: "" };
}

export function fallbackBriefing(sheet) {
  const traits = sheet?.traits?.length ? sheet.traits : compileTraits(sheet?.answers || {});
  const wish = (sheet?.teammateWish || "").trim() || "一个能把话说清楚的人";
  const readings = traits.map((trait) => TRAIT_READINGS[trait]).filter(Boolean);
  const core = readings.slice(0, 2).join("") || "你先把自己看清楚，再决定把哪一步交给别人。";
  const pressure = readings[2] || readings[0] || "局面一乱，你会先抓住一个还能做的动作，而不是停在原地辩解。";
  const withPeople = readings[1] || readings[3] || "对人，你不会把信任随口交出去，也不肯拿别人的秘密去换自己的轻松。";
  return {
    headline: (traits.slice(0, 2).join("与") || "时隙行者").slice(0, 8),
    core: `${core}这些习惯指向同一个人：要把未知看清，把别人的话问透，乱了也要往前走。`,
    pressure,
    with_people: withPeople,
    wish_read: `你写下「${wish}」，要的往往不是这张标签本身，而是一个能在乱局里把事情拆开、跟你把话说完的人。`,
  };
}

export function fallbackCompanion(sheet) {
  const playerGender = sheet?.gender === "female" ? "female" : "male";
  const gender = playerGender === "female" ? "male" : "female";
  const life = pick(FALLBACK_LIVES);
  return {
    name: pick(NAME_POOL[gender]),
    gender,
    occupation: pick(JOB_POOL[gender]),
    org: life.org,
    intro: life.intro,
    attrs: complementAttrs(sheet?.attrs),
    story: life.story,
    reason: life.intro,
    hp: 10,
    maxHp: 10,
    briefing: fallbackBriefing(sheet),
  };
}

export async function generateCompanion(sheet) {
  const settings = getSettings();
  const briefingFallback = fallbackBriefing(sheet);
  if (!settings.usesLlm) {
    const companion = withSource(fallbackCompanion(sheet), "fallback");
    return {
      companion,
      briefing: companion.briefing || briefingFallback,
      source: "fallback",
      error: "未写入 API Key，大模型未调用。",
    };
  }
  try {
    let raw = await completePair(settings, sheet);
    let data = extractJson(raw);
    let pair = splitPair(data);
    if (
      looksLikeStock(pair.companion) ||
      looksLikeTool(pair.companion) ||
      looksLikeBannedOrg(pair.companion) ||
      looksLikeRecap(pair.briefing) ||
      looksLikeBadIntro(pair.companion)
    ) {
      raw = await completePair(
        settings,
        sheet,
        "上一份不合格。简报禁止复述题面情景，禁止把气质词排成清单，要写性格内核。自我介绍必须第一人称，用我开口，禁止第三人称分析玩家。",
      );
      data = extractJson(raw);
      pair = splitPair(data);
    }
    const briefing = normalizeBriefing(pair.briefing, sheet);
    const companion = withSource(normalizeCompanion(pair.companion, sheet, briefing), "llm");
    companion.briefing = briefing;
    return { companion, briefing, source: "llm", error: "" };
  } catch (error) {
    const companion = withSource(fallbackCompanion(sheet), "fallback");
    return {
      companion,
      briefing: companion.briefing || briefingFallback,
      source: "fallback",
      error: error?.message || "大模型未响应。",
    };
  }
}

function splitPair(data) {
  if (data?.companion && typeof data.companion === "object") {
    return { briefing: data.briefing, companion: data.companion };
  }
  const { briefing, ...companion } = data && typeof data === "object" ? data : {};
  return { briefing, companion };
}

function withSource(companion, source) {
  return { ...companion, source };
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function looksLikeStock(data) {
  const name = String(data?.name || "").replace(/\s+/g, "");
  const occupation = String(data?.occupation || "");
  const story = String(data?.story || "");
  return (
    STOCK_NAMES.includes(name) ||
    STOCK_JOBS.some((job) => occupation.includes(job)) ||
    /原创|汉字|0-10|不超过|约100|未了之事|个人来历/.test(`${name}${occupation}${story}`)
  );
}

function looksLikeTool(data) {
  const text = `${data?.story || ""}${data?.reason || ""}${data?.dispatch || ""}${data?.intro || ""}`;
  return /短板|填补弱点|工具人|按你的期望生成|补你|较弱所以|性格非常契合|提供极大的帮助/.test(text);
}

function looksLikeBannedOrg(data) {
  const org = String(data?.org || "");
  return BANNED_ORGS.some((item) => org.includes(item));
}

function briefingText(briefing) {
  const data = briefing && typeof briefing === "object" ? briefing : {};
  return `${data.headline || ""}${data.core || ""}${data.summary || ""}${data.pressure || ""}${data.with_people || ""}${data.how || ""}${data.wish_read || ""}${data.need || ""}`;
}

function looksLikeRecap(briefing) {
  const text = briefingText(briefing);
  if (/跟踪|转身看|托付|计划被打乱|当众否定|灯火通明|不回头|精心准备|第三人/.test(text)) return true;
  const traits = Object.keys(TRAIT_READINGS);
  const hits = traits.filter((trait) => text.includes(trait)).length;
  return hits >= 3;
}

function looksLikeBadIntro(data) {
  const intro = String(data?.intro || data?.reason || "").trim();
  if (!intro) return true;
  const me = (intro.match(/我/g) || []).length;
  if (me < 2) return true;
  if (/她擅长|他擅长|与.+性格|因此选择亲自|非常契合/.test(intro) && me < 3) return true;
  return false;
}

function parseGender(value) {
  const text = String(value || "").toLowerCase();
  if (text.includes("女") || text === "female") return "female";
  if (text.includes("男") || text === "male") return "male";
  return "";
}

function complementAttrs(playerAttrs = {}) {
  const values = ATTR_DEFS.map((item) => ({
    id: item.id,
    player: Number(playerAttrs[item.id] || 0),
  }));
  const ranked = [...values].sort((a, b) => a.player - b.player);
  const result = Object.fromEntries(ATTR_DEFS.map((item) => [item.id, 5]));
  result[ranked[0].id] = 8;
  result[ranked[1].id] = 6;
  result[ranked[2].id] = 4;
  result[ranked[3].id] = 2;
  return normalizeAttrSpend(result);
}

function normalizeAttrSpend(attrs) {
  const next = {};
  for (const item of ATTR_DEFS) {
    next[item.id] = Math.max(ATTR_MIN, Math.min(ATTR_MAX, Math.round(Number(attrs?.[item.id]) || 0)));
  }
  let total = ATTR_DEFS.reduce((sum, item) => sum + next[item.id], 0);
  let guard = 0;
  while (total !== ATTR_POINT_TOTAL && guard < 40) {
    if (total > ATTR_POINT_TOTAL) {
      const key = ATTR_DEFS.map((item) => item.id).sort((a, b) => next[b] - next[a])[0];
      if (next[key] > ATTR_MIN) {
        next[key] -= 1;
        total -= 1;
      }
    } else {
      const key = ATTR_DEFS.map((item) => item.id).sort((a, b) => next[a] - next[b])[0];
      if (next[key] < ATTR_MAX) {
        next[key] += 1;
        total += 1;
      }
    }
    guard += 1;
  }
  return next;
}

export function normalizeBriefing(raw, sheet) {
  const data = raw && typeof raw === "object" ? raw : {};
  const fallback = fallbackBriefing(sheet);
  const headline = String(data.headline || "").replace(/\s+/g, "").slice(0, 16);
  const core = String(data.core || data.summary || "").trim();
  const pressure = String(data.pressure || data.how || "").trim();
  const withPeople = String(data.with_people || "").trim();
  const wishRead = String(data.wish_read || data.need || "").trim();
  const briefing = {
    headline: headline || fallback.headline,
    core: (core || fallback.core).slice(0, CORE_MAX),
    pressure: (pressure || fallback.pressure).slice(0, PARA_MAX),
    with_people: (withPeople || fallback.with_people).slice(0, PARA_MAX),
    wish_read: (wishRead || fallback.wish_read).slice(0, WISH_MAX),
  };
  if (looksLikeRecap(briefing)) return fallback;
  return briefing;
}

export function normalizeCompanion(raw, sheet, briefing = null) {
  const data = raw && typeof raw === "object" ? raw : {};
  const gender = parseGender(data.gender) || (sheet?.gender === "female" ? "male" : "female");
  let name = String(data.name || "").replace(/\s+/g, "").slice(0, 6);
  if (
    !name ||
    BANNED_NAMES.includes(name) ||
    STOCK_NAMES.includes(name) ||
    name === sheet?.name ||
    /原创|汉字/.test(name)
  ) {
    name = pick(NAME_POOL[gender]);
  }
  let occupation = String(data.occupation || "").slice(0, 12);
  if (!occupation || STOCK_JOBS.includes(occupation) || /原创|测绘员|守夜人/.test(occupation)) {
    occupation = pick(JOB_POOL[gender]);
  }
  let org = String(data.org || "").replace(/\s+/g, "").slice(0, 12);
  if (!org || BANNED_ORGS.some((item) => org.includes(item)) || /原创|组织/.test(org)) {
    org = pick(ORG_POOL);
  }
  const fallback = fallbackCompanion(sheet);
  const story = String(data.story || fallback.story).slice(0, STORY_MAX);
  let intro = String(data.intro || "").trim();
  if (!intro || looksLikeBadIntro({ intro })) intro = fallback.intro;
  intro = intro.slice(0, INTRO_MAX);
  if (name && !intro.includes(name)) intro = `我是${name}。${intro}`;
  return {
    name,
    gender,
    occupation,
    org,
    intro,
    dispatch: intro,
    attrs: normalizeAttrSpend(data.attrs || {}),
    story,
    reason: intro,
    hp: 10,
    maxHp: 10,
    briefing: briefing || fallbackBriefing(sheet),
  };
}

function buildPrompt(sheet, extra = "") {
  const world = openingBriefing.sections
    .map((section) => `${section.heading}：${briefingPlain(section.body)}`)
    .join("\n");
  const genderLabel = sheet?.gender === "female" ? "女" : "男";
  const attrs = ATTR_DEFS.map((item) => `${item.id} ${sheet?.attrs?.[item.id] ?? 0}`).join("，");
  const salt = Math.random().toString(36).slice(2, 8);
  return `世界公开信息：
${world}

玩家：
姓名 ${sheet?.name || "时隙行者"}，性别 ${genderLabel}
属性 ${attrs}
性格读法（只写性格，禁止提及跟踪、转身、托付、计划被打乱、当众否定这些题面）：
${describePersonalitySeed(sheet)}
对队友的期望（读成相处需求，不要当成招聘广告）：${sheet?.teammateWish || "未写"}
本次创作编号：${salt}

先写性格简报，再写同行者。

【性格简报】
- 像人物评论，不要像问卷回放
- 把四条读法合成一个人，写清：信什么、怕什么、怎样才觉得安全、压力下会怎样、对人怎样
- 禁止复述任何题面情景
- 禁止把气质词排成「直面、追问、直觉」这种清单
- wish_read 要读出期望背后要的相处方式。若对方写了「法师」，不要重复职业名，而要写他要一个能在乱局里把规则和线索拆开的人

【同行者】
- 属于某个原创小组织，被派来接应。禁止星辰神殿、深涌议会、虚空教团、教廷
- story 用第三人称写小传
- intro 必须是这个人刚见面时的第一人称开口，像在对玩家说话
- intro 里要有：我是谁、哪个组织派我、为什么是我来（合得来，不要分析玩家性格）、我自己还要办什么
- 禁止在 intro 里写「她/他擅长」「与某某性格契合」「提供极大帮助」
- 姓名原创，2到4个汉字。属性每项 0-10，总和 20
- 不要剧透预警、急件、教团计划
${extra ? `\n${extra}\n` : ""}
只输出 JSON 对象，不要 markdown。结构必须是：
${JSON.stringify(PAIR_SCHEMA)}`;
}

async function completePair(settings, sheet, extra = "") {
  const messages = [
    {
      role: "system",
      content: "你是人物评论作者兼角色扮演作者。简报只写性格内核，禁止复述问卷情景。自我介绍必须第一人称。只输出合法 JSON。不要解释。",
    },
    { role: "user", content: buildPrompt(sheet, extra) },
  ];
  const traceId = crypto.randomUUID();
  const { headers, body } = llmChatRequest(settings, {
    messages,
    temperature: 0.9,
    json: true,
    user: traceId,
  });
  const response = await llmFetch(
    `${settings.apiBase}/chat/completions`,
    { method: "POST", headers, body },
    { timeoutMs: 60000 },
  );
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`LLM ${response.status}${detail ? `: ${detail.slice(0, 180)}` : ""}`);
  }
  const data = await response.json();
  return data?.choices?.[0]?.message?.content || "{}";
}

function extractJson(raw) {
  const text = String(raw || "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1));
  throw new Error("模型未返回 JSON 对象");
}
