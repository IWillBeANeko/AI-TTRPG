/** 第一幕：线性简报。每步完成后划掉旧项，再写出下一项。 */

export const ACT1_STEPS = [
  {
    id: "lookedAround",
    kind: "observe",
    location: "square",
    goal: "我刚落到潮汐港湾。先把眼前能看见的对一遍：时刻表写没写满潮、灯塔亮没亮、公示牌写了什么。",
    todo: "在星辰广场把四周看清楚",
  },
  {
    id: "sawTideDrop",
    kind: "talk",
    location: "harbor",
    goal: "时刻表写今晚亥时满潮，海水却退到了台阶中间。我要去码头问清楚水位，不能只凭眼睛猜。",
    todo: "去潮汐码头，向面包师问清水深",
    evidence: "玩家已经从对话里得知：水位一夜间大约掉了两尺，不是风也不是雨。只看见水退了、没问到具体深浅，不算完成。",
    hints: ["两尺", "水位"],
    hintNeed: 2,
  },
  {
    id: "clueLamp",
    kind: "talk",
    location: "lighthouse",
    goal: "面包师说水位一夜间掉了两尺，不是风也不是雨。灯塔还在闪王都才用的暗号。我得去问守塔的人，昨夜为什么这样亮灯。",
    todo: "去港湾灯塔，问清灯为什么亮成这样",
    evidence: "玩家已经得知：灯塔昨夜把主灯改成了王都才用的进港暗号（三长一短），不是迎船，而是想让王都看见这边也出事了。只看见灯在闪、没问到为什么，不算完成。",
    hints: ["王都", "暗号", "三长一短"],
    hintNeed: 2,
  },
  {
    id: "clueLetter",
    kind: "talk",
    location: "lighthouse",
    goal: "涌音说她把主灯改成王都暗号，是想让王都看见这边也出事了。我还要问清她有没有向驿站报过信，信现在在哪。",
    todo: "问涌音：那封预警信现在在哪",
    evidence: "玩家已经得知：涌音写过预警信交给驿站，信被盖了「扰乱人心」退回，现在锁在驿站档案室。只听说「有封信」、不知道现在在哪，不算完成。",
    hints: ["档案", "驿站", "退回", "扰乱人心"],
    hintNeed: 2,
  },
  {
    id: "clueLedger",
    kind: "talk",
    location: "council",
    goal: "预警信被驿站盖了「扰乱人心」退回，锁在档案室里。广场告示却写成「潮位正常」。我要去议事厅对照账本，看议会到底记没记下昨夜。",
    todo: "去深涌议事厅，对照账本和广场告示",
    evidence: "玩家已经得知：议会账本仍记着昨夜亥时水位比时刻表低两尺，广场公示牌是今早被换成「正常」的，账本没改。只进了议事厅、没对上账本和告示，不算完成。",
    hints: ["账本", "两尺", "公示"],
    hintNeed: 2,
  },
  {
    id: "sawCabinet",
    kind: "talk",
    location: "archive",
    goal: "账本还记着昨夜退潮两尺，告示是今早被换成「正常」的。信在柜子里，我没有神殿签章。先去档案室确认这封急件还锁着、现在开不了。",
    todo: "去驿站档案室，确认那封急件还在柜子里",
    evidence: "玩家已经得知：那封加急信确实在驿站柜子里，分类是「扰乱人心」，调阅要神殿签章，现在开不了、也看不见正文。只进了档案室、没问到柜子和手续，不算完成。",
    hints: ["柜子", "签章", "扰乱人心"],
    hintNeed: 2,
  },
];

export const ACT1_CLUES = ACT1_STEPS.map((item) => ({ id: item.id, label: item.todo }));

export const ACT1_BRIEFING = {
  act: "第一幕",
  era: "黎明纪元",
  title: "涌动的预兆",
};

export const ACT1_CLEAR = {
  kicker: "ACT 01 CLEAR",
  title: "第一幕 · 涌动的预兆",
  body: "昨夜潮水和时刻表对不上。涌音听见王都方向像有仪式在响，把灯改成王都暗号，写了预警交给驿站。驿站盖了「扰乱人心」退回，广场告示也改成「一切正常」。议会的账本没改，对得上面包师说的水位。信还锁在档案室，没有神殿签章，伊文不敢开。要核实信上写了什么，只能进入下一幕，打开那份急件。",
  confirm: "进入下一幕",
};

export const ACT1_LOCATIONS = [
  {
    id: "square",
    name: "星辰广场",
    mark: "广场",
    x: 48,
    y: 62,
    npcs: ["baker", "envoy"],
    npcMarks: [
      { id: "baker", x: 36, y: 58 },
      { id: "envoy", x: 62, y: 46 },
    ],
    situation: (flags) =>
      flags.lookedAround
        ? "公示牌新纸写着「今夜潮位正常，勿信谣言」。底下旧纸还没撕干净，露出「潮时不准」。灯塔仍在按三长一短闪。"
        : "你刚落到这里。码头方向贴着潮汐时刻表，灯塔通宵亮着，广场有人围着公示牌吵。身边这个人是和你一起落下的。",
    choices: [
      {
        id: "sq_look",
        title: "先把四周看清楚",
        hint: "看时刻表、灯号和公示牌。不掷骰。",
        flag: "lookedAround",
        hideIf: "lookedAround",
        logMemory: true,
        note: "时刻表写今晚亥时满潮，海水却已退到台阶中间。灯塔在闪三长一短——那是王都进港暗号，这个港口平时不用。公示牌刚换过。",
      },
      {
        id: "sq_calm",
        title: "劝开围观的人",
        hint: "共情判定。无论成败，只能劝这一次。",
        skill: "共情",
        dc: 10,
        flag: "calmedCrowd",
        attemptFlag: "triedCalm",
        npc: "baker",
        attitude: "friendly",
        trustDelta: 12,
        stability: 4,
        need: ["lookedAround"],
        hideIf: "triedCalm",
        note: "人散开一点。有人说灯塔乱亮，有人说驿站不让往灯塔走。",
        failNote: "人没散。有人白了你一眼，把公示牌挡得更紧。你不宜再劝一次。",
      },
      {
        id: "sq_baker",
        title: "向卖面包的人打听",
        hint: "打开与面包师的对话。",
        talk: "baker",
        talkText: (flags) =>
          flags.calmedCrowd
            ? "广场上刚劝开一拨人。今晚水位和灯塔到底怎么了？"
            : "今晚码头和灯塔都不对劲。你看见什么了？",
        flag: "askedBaker",
        need: ["lookedAround"],
      },
      {
        id: "sq_envoy",
        title: "听灰袍的人怎么说",
        hint: "打开与教廷使者的对话。他在拦往灯塔走的人。",
        talk: "envoy",
        talkText: "灯塔亮着，你们为什么不让人过去？",
        flag: "metEnvoy",
        need: ["lookedAround"],
      },
      { id: "sq_to_dock", title: "下到码头", hint: "去看水位和时刻表。", go: "harbor", need: ["lookedAround"] },
      { id: "sq_to_light", title: "去灯塔", hint: "去问守塔的人。", go: "lighthouse", need: ["sawTideDrop"] },
      { id: "sq_to_council", title: "去议事厅", hint: "深涌氏族议事的地方。", go: "council", need: ["clueLetter"] },
      { id: "sq_to_archive", title: "去驿站档案室", hint: "神殿驻港的急件驿站。", go: "archive", need: ["clueLedger"] },
    ],
  },
  {
    id: "harbor",
    name: "潮汐码头",
    mark: "码头",
    x: 22,
    y: 76,
    npcs: ["baker"],
    npcMarks: [{ id: "baker", x: 40, y: 62 }],
    situation: () =>
      "时刻表写着亥时满潮。水已经退到台阶中间，船帮一下一下撞在石阶上。街角烘炉还开着，买面包的人不多。",
    choices: [
      {
        id: "hk_ask",
        title: "向烘炉的人打听",
        hint: "打开与面包师的对话。",
        talk: "baker",
        talkText: (flags) =>
          flags.calmedCrowd
            ? "广场上刚劝开一拨人。今晚码头和灯塔到底怎么了？"
            : "水位和时刻表对不上。今晚码头怎么了？",
        flag: "askedBaker",
      },
      {
        id: "hk_depth",
        title: "向面包师问清水深",
        hint: "打开与面包师的对话。问水位。",
        talk: "baker",
        talkText: "时刻表写满潮，水却退到台阶中间。今晚水到底退了多少？",
        hideIf: "sawTideDrop",
      },
      {
        id: "hk_buy",
        title: "买一块还热的面包",
        hint: "不掷骰。他会把你当肯说话的过客。",
        flag: "askedBaker",
        npc: "baker",
        trustDelta: 6,
        note: "面包还热。他说没有船进港，所以炉子空着。灯塔信号他认得出：那是王都的，这个港口平时不用。",
      },
      { id: "hk_back", title: "回到广场", go: "square" },
      { id: "hk_to_light", title: "去灯塔", go: "lighthouse", need: ["sawTideDrop"] },
      { id: "hk_to_council", title: "去议事厅", go: "council", need: ["clueLetter"] },
    ],
  },
  {
    id: "lighthouse",
    name: "港湾灯塔",
    mark: "灯塔",
    x: 70,
    y: 20,
    npcs: ["yongyin"],
    npcMarks: [{ id: "yongyin", x: 54, y: 36 }],
    situation: (flags) =>
      flags.clueLamp
        ? "主灯仍按三长一短闪。涌音说这是她改成的王都暗号，想让王都看见这边也出事了。"
        : flags.yongyinUnlocked
        ? "无雾、无船进港，主灯却通宵亮着，并且按三长一短闪。塔里有人守着，并不急着报上名字。"
        : "无雾、无船进港，主灯却通宵亮着，并且按三长一短闪。塔里站着一个人，脸看不清，也不肯报上名字。",
    choices: [
      {
        id: "lh_lock",
        title: "向塔里那人开口",
        hint: "她把一个电子锁丢了过来。",
        lock: "yongyin",
        hideIf: "yongyinUnlocked",
      },
      {
        id: "lh_signal",
        title: "问她灯为什么亮成这样",
        hint: "打开与涌音的对话。问灯号。",
        talk: "yongyin",
        talkText: "无雾也没有船进港，这座灯为什么亮着，还在闪三长一短？",
        flags: ["metYongyin"],
        need: ["yongyinUnlocked"],
        hideIf: "clueLamp",
      },
      {
        id: "lh_letter",
        title: "问她有没有向驿站报过信",
        hint: "打开与涌音的对话。问信。",
        talk: "yongyin",
        talkText: "有人说你连夜把一封信交给了驿站。那封信现在在哪？",
        flags: ["metYongyin"],
        need: ["clueLamp", "yongyinUnlocked"],
        hideIf: "clueLetter",
      },
      {
        id: "lh_talk",
        title: "向守塔的人开口",
        hint: "打开与涌音的对话。",
        talk: "yongyin",
        talkText: "我想知道今夜这座灯塔出了什么事。",
        flag: "metYongyin",
        need: ["yongyinUnlocked"],
        hideIf: "sawTideDrop",
      },
      { id: "lh_back", title: "返回广场", go: "square" },
      { id: "lh_to_archive", title: "去驿站档案室", go: "archive", need: ["clueLedger"] },
      { id: "lh_to_council", title: "去议事厅", go: "council", need: ["clueLetter"] },
    ],
  },
  {
    id: "council",
    name: "深涌议事厅",
    mark: "议事厅",
    x: 30,
    y: 38,
    npcs: ["saltspeaker"],
    npcMarks: [{ id: "saltspeaker", x: 42, y: 44 }],
    situation: (flags) =>
      flags.clueLedger
        ? "墙上的潮汐账本仍写着昨夜亥时水位比时刻表低两尺。盐语者没按神殿的要求改账本。"
        : "厅里挂着每天的潮汐账本：实测水位、满潮时刻。长老在，并不欢迎空手来要秘密的人。",
    choices: [
      {
        id: "co_ledger",
        title: "请他对照账本和广场告示",
        hint: "打开与盐语者的对话。",
        talk: "saltspeaker",
        talkText: (flags) =>
          flags.lookedAround || flags.clueLamp
            ? "广场告示写成潮位正常。我想看你们账本上昨夜到底记了什么。"
            : "我想看昨夜的潮汐记录。广场告示和码头上的说法不一样。",
        flags: ["metSaltspeaker"],
        need: ["clueLetter"],
        hideIf: "clueLedger",
      },
      {
        id: "co_ask",
        title: "向长老说明来意",
        hint: "打开与盐语者的对话。",
        talk: "saltspeaker",
        talkText: "我刚落到港湾。灯塔乱亮，水位和时刻表对不上。议会怎么看今夜的事？",
        flag: "metSaltspeaker",
        hideIf: "clueLetter",
      },
      { id: "co_back", title: "回到广场", go: "square" },
      { id: "co_to_archive", title: "去驿站档案室", hint: "灯塔的信进了驿站。", go: "archive", need: ["clueLedger"] },
      { id: "co_to_dock", title: "去码头", go: "harbor" },
    ],
  },
  {
    id: "archive",
    name: "驿站档案室",
    mark: "档案室",
    x: 80,
    y: 48,
    npcs: ["ewen", "envoy"],
    npcMarks: [
      { id: "ewen", x: 46, y: 48 },
      { id: "envoy", x: 68, y: 42 },
    ],
    situation: (flags) =>
      flags.sawCabinet
        ? "台账封面看过了：来件人港湾灯塔，去向王都星辰神殿，分类「扰乱人心」。柜子没开，正文没看见。"
        : "蜡印、编号柜、年轻档案吏把钥匙扣在腕上。门外有时能看见灰袍的人。",
    choices: [
      {
        id: "ar_file",
        title: "要求查看昨夜那封加急信",
        hint: "打开与伊文的对话。他可能只让你看台账封面。",
        talk: "ewen",
        talkText: "灯塔昨夜交过一封加急信。我要看那份急件。",
        flags: ["metEwen"],
        need: ["clueLedger"],
        hideIf: "sawCabinet",
      },
      {
        id: "ar_talk",
        title: "问清调阅手续",
        hint: "打开与伊文的对话。",
        talk: "ewen",
        talkText: "调阅一份昨夜入柜的加急信，需要什么手续？",
        flag: "metEwen",
        hideIf: "sawCabinet",
      },
      {
        id: "ar_envoy",
        title: "听使者开条件",
        hint: "打开与维斯坎特的对话。",
        talk: "envoy",
        talkText: "你们把灯塔的信定为谣言。我想知道你们要我做什么。",
        flag: "metEnvoy",
      },
      { id: "ar_back", title: "回到广场", go: "square" },
      { id: "ar_to_light", title: "去灯塔", go: "lighthouse" },
      { id: "ar_to_council", title: "去议事厅", go: "council" },
    ],
  },
];

function resolve(value, flags) {
  return typeof value === "function" ? value(flags || {}) : value;
}

export function locationById(id) {
  return ACT1_LOCATIONS.find((item) => item.id === id) || ACT1_LOCATIONS[0];
}

export function situationOf(location, flags = {}) {
  return resolve(location.situation, flags) || "";
}

export function unlockedLocationIds(flags = {}) {
  const unlocked = new Set(["square"]);
  if (flags.lookedAround) unlocked.add("harbor");
  if (flags.sawTideDrop) unlocked.add("lighthouse");
  if (flags.clueLetter) unlocked.add("council");
  if (flags.clueLedger) unlocked.add("archive");
  return unlocked;
}

export function briefingProgress(flags = {}) {
  const done = [];
  let current = null;
  for (const step of ACT1_STEPS) {
    if (flags[step.id]) done.push(step);
    else {
      current = step;
      break;
    }
  }
  return { done, current, complete: !current && done.length === ACT1_STEPS.length };
}

export function nextLocationId(flags = {}) {
  return briefingProgress(flags).current?.location || null;
}

export function choicesOf(location, flags = {}) {
  const unlocked = unlockedLocationIds(flags);
  return (location.choices || [])
    .filter((choice) => {
      if (choice.hideIf && flags[choice.hideIf]) return false;
      if (choice.need?.length && !choice.need.every((id) => flags[id])) return false;
      if (choice.go && choice.go !== location.id && !unlocked.has(choice.go)) return false;
      return true;
    })
    .map((choice) => ({
      ...choice,
      hint: resolve(choice.hint, flags),
      talkText: resolve(choice.talkText, flags),
      note: resolve(choice.note, flags),
    }));
}

export function briefingLines(flags = {}) {
  const { done, current } = briefingProgress(flags);
  const rows = [...done.map((step) => ({ ...step, done: true })), ...(current ? [{ ...current, done: false }] : [])];
  return {
    goals: rowsOf(rows, "goal"),
    todos: rowsOf(rows, "todo"),
  };
}

function rowsOf(rows, key) {
  return rows.map((step) => ({
    id: step.id,
    text: step[key],
    done: step.done,
  }));
}

export function todosOf(flags = {}) {
  return briefingLines(flags).todos.map((item) => ({
    id: item.id,
    label: item.text,
    done: item.done,
  }));
}

export function act1Complete(flags = {}) {
  return ACT1_STEPS.every((item) => flags[item.id]);
}

export function briefingOf() {
  return ACT1_BRIEFING;
}

export const HARBOR_OVERVIEW = {
  title: "潮汐港湾",
  body: "港湾还在夜里。地点会按简报一步步打开。点地图上的地方进入现场，或从右侧前往。",
};

export function travelChoices(flags = {}, currentId) {
  const unlocked = unlockedLocationIds(flags);
  return ACT1_LOCATIONS.filter((spot) => unlocked.has(spot.id)).map((spot) => ({
    id: `go_${spot.id}`,
    title: `去${spot.name}`,
    hint: spot.id === currentId ? "进入这里" : "前往这个地点",
    go: spot.id,
  }));
}

export function siteChoices(location, flags = {}) {
  return choicesOf(location, flags).filter((choice) => !choice.go);
}
