/**
 * 剧情与分幕配置 — 对齐 trpg-ai-assistant/references/story-templates.md
 * 「潮汐挽歌」主线：三位关键 NPC 为涌音、伊文、盐语者
 */

export const ERAS = {
  dawn: { id: "dawn", label: "黎明纪元", subtitle: "时之觉醒", color: "cyan" },
  splendor: { id: "splendor", label: "辉煌纪元", subtitle: "灰烬中的希望", color: "amber" },
  end: { id: "end", label: "终末纪元", subtitle: "世界的尽头", color: "magenta" },
};

export const IMPRINT_TYPES = {
  echo: "信息回响",
  chain: "因果链",
  butterfly: "蝴蝶效应",
  anchor: "锚点锁定",
};

/** 五幕主线 + 开场 */
export const storyActs = [
  {
    id: "act0_awakening",
    order: 0,
    era: "dawn",
    title: "黎明纪元 · 时之觉醒",
    subtitle: "潮汐港湾码头",
    summary:
      "你从裂隙落到黎明纪元的潮汐港湾。码头上的潮汐时刻表和实际水位对不上，灯塔却通宵亮着。大崩坏还没发生，但港湾已经出事。",
    narrative:
      "你感到一阵撕裂，像被从别处拽到这里。记忆里还残留着灰烬和另一段时间的画面。你是时隙行者，能在碎开的时间之间行走。眼前的任务很具体：先弄清这座港湾今夜出了什么事。",
    quote: "灯塔亮着，告示却写一切正常。",
    ui_layout: "era_hub",
    ui_bg: "dawn_city",
    advance: { flags: ["awakening_complete"], next: "act1_omens" },
    objectives: ["确认自己的身份与处境", "选择第一个调查方向"],
    clue_fragments: [],
  },
  {
    id: "act1_omens",
    order: 1,
    era: "dawn",
    title: "第一幕 · 涌动的预兆",
    subtitle: "灯塔、驿站与议事厅",
    summary:
      "灯塔昨夜用了王都才用的暗号。先知写过预警信，被驿站定为谣言。议会账本还记着退潮，广场告示却写成正常。",
    narrative:
      "港湾昨夜出过三件能对上的事：灯塔改过灯号、涌音把预警交给驿站、议会账本和对外告示不一致。卡尔萨斯仍是后面要面对的主因；神殿压过这封信，是被盖住的补充事实。第一幕只把柜子亮出来，不打开急件正文。",
    quote: "信我写了。驿站盖章退回。",
    advance: { flags: ["act1_closed"], next: "act2_buried_records" },
    objectives: ["问清灯号、预警信和账本三件事", "与在场的人建立第一层接触"],
    clue_fragments: [
      { id: "clue_1", flag: "clueLamp", text: "灯塔昨夜用了王都才用的进港暗号。" },
      { id: "clue_2", flag: "clueLetter", text: "预警信被驿站退回，锁在档案室。" },
      { id: "clue_3", flag: "clueLedger", text: "议会账本仍记着昨夜退潮，广场告示却写成正常。" },
    ],
    scene_label: "潮汐港湾",
    scene_coords: "TIDE-PORT · 深度 17M",
    ui_layout: "clue_board",
    ui_bg: "tide_port",
  },
  {
    id: "act2_buried_records",
    order: 2,
    era: "dawn",
    title: "第二幕 · 被掩埋的记录",
    subtitle: "调查中枢 · 被掩埋的记录",
    summary:
      "星辰神殿不希望预警急件曝光。伊文知道手续漏洞，盐语者握有潮汐对照本——真相与秩序开始撕扯。",
    narrative:
      "玩家要让预警从单一指控变成可被验证的历史事实，同时保留其复杂性：卡尔萨斯仍是主因，但预警曾被压下。彻底揭露、私下托管或选择隐瞒，没有正确答案。",
    quote: "「时间的涟漪仍在扩散，每一个抉择都将刻入未来。」",
    warning_banner: "教廷正在阻挠调查",
    ui_layout: "investigation_hub",
    ui_bg: "archive",
    advance: { flags: ["records_investigated"], next: "act3_void_scheme" },
    objectives: ["取得或验证预警急件", "决定真相的去向"],
    missions: [
      { id: "m_dawn", era: "dawn", title: "黎明 · 星辰神殿档案室", tags: ["潜行", "解谜"], risk: "中", go: "archive", say: "我想查阅被封存的潮汐港湾预警急件" },
      { id: "m_splendor", era: "splendor", title: "辉煌 · 钟塔聚落证词", tags: ["社交", "博弈"], risk: "中", go: "sunken_clock", say: "我想对照辉煌纪元钟塔聚落留下的潮汐证词" },
      { id: "m_end", era: "end", title: "终末 · 深渊灯塔聆听残响", tags: ["情感", "真相"], risk: "高", go: "lighthouse", say: "我想在灯塔聆听当年那一夜的时间残响" },
    ],
    decisions: [
      { id: "reveal", label: "彻底揭露真相", color: "cyan", risks: ["蝴蝶效应", "教廷分裂"], say: "我要把预警被压下的记录公之于众" },
      { id: "watchers", label: "私下告知时之守望者", color: "amber", risks: ["因果链", "内部分歧"], say: "我把这些记录交给时之守望者，作为战略情报" },
      { id: "conceal", label: "选择隐瞒", color: "magenta", risks: ["蝴蝶效应", "议会失望"], say: "我决定暂时隐瞒这段记录，先处理眼前的危机" },
    ],
  },
  {
    id: "act3_void_scheme",
    order: 3,
    era: "dawn",
    title: "第三幕 · 虚空教团的算计",
    subtitle: "运河 · 仪式草图",
    summary:
      "虚空教团觊觎深涌氏族的听涌能力，企图制造第二次时间震荡。潮汐港湾从支线调查地点变成战略要地。",
    narrative:
      "他们不关心预警被压下的道德问题，而是发现听涌可被逆用。共振草图显示：潮汐与时之裂隙的频率被故意扭曲，只为帮卡尔萨斯提前挣脱封印。盐语者可提供装置知识，但不替你承担风险。",
    quote: "「潮汐并未背叛我们，是时之裂隙被污染了……」",
    ui_layout: "mission_cards",
    ui_bg: "void_ritual",
    advance: { flags: ["void_ritual_disrupted"], next: "act4_tide_resonance" },
    objectives: ["阻止教团取得听涌媒介", "取得仪式草图"],
    missions: [
      { id: "raid", label: "战斗突袭", color: "red", risk: "高战损", say: "我正面突袭虚空教团，阻止他们的仪式" },
      { id: "infiltrate", label: "潜入救援", color: "cyan", risk: "察觉度判定", say: "我潜入教团据点，先保护听涌媒介再破坏仪式装置" },
      { id: "negotiate", label: "谈判交换", color: "amber", risk: "需筹码", say: "我尝试与教团谈判，用情报拖延他们启动计划" },
    ],
  },
  {
    id: "act4_tide_resonance",
    order: 4,
    era: "dawn",
    title: "第四幕 · 潮汐与仪式的共鸣",
    subtitle: "三个纪元同时异常涌动",
    summary:
      "港湾、废港与灯塔同时出现异常涌动。虚空教团想把三路裂隙绑成一根导火索，为卡尔萨斯的完全释放提供能量。",
    narrative:
      "黎明港湾的潮汐、辉煌废港的残响、终末灯塔的微光在同一时刻脉动。不要求分头守住固定纪元——可以一人主导、依次处理，或放弃一个据点换取更大战略收益。保住的路线成为资源，失守的区域成为风险。",
    quote: "深涌氏族议会求援：「请在潮汐吞噬港湾之前，切断共振。」",
    ui_layout: "tri_era",
    ui_bg: "tri_crisis",
    advance: { flags: ["resonance_stabilized"], next: "act5_requiem" },
    objectives: ["稳定至少两处裂隙节点", "保留跨纪元通道"],
    eras: [
      { id: "e1", title: "黎明 · 潮汐港湾", location: "harbor", danger: "中", countdown: "28:47", action: "go", target: "harbor" },
      { id: "e2", title: "辉煌 · 潮汐废港", location: "sunken_clock", danger: "高", countdown: "19:22", action: "go", target: "sunken_clock" },
      { id: "e3", title: "终末 · 深渊灯塔", location: "lighthouse", danger: "低", countdown: "09:58", action: "go", target: "lighthouse" },
    ],
  },
  {
    id: "act5_requiem",
    order: 5,
    era: "dawn",
    title: "第五幕 · 挽歌之后",
    subtitle: "终局衔接 · 时间线抉择",
    summary:
      "潮汐危机告一段落。你如何处置真相、如何对待深涌氏族与教廷，将决定终局走向。涌音与盐语者的命运必须被明确交代。",
    narrative:
      "无论是否阻止了仪式，深涌氏族的命运都悬于一线。修复时间线、释放卡尔萨斯、或接受多重时间线——你必须做出选择。公开或隐瞒的记录，会改变谁愿意响应你们。",
    quote: "「无论选哪条——都会有无数个你，承担后果。」",
    ui_layout: "ending_select",
    ui_bg: "ending",
    advance: null,
    objectives: ["选择时间线走向", "为深涌氏族与先知写下结局"],
    endings: [
      { id: "repair", label: "选择修复时间线", color: "gold", desc: "三纪元融合，王都与港湾被承认为共同起点", say: "我选择修复时间线，哪怕失去时隙行者的能力" },
      { id: "save_all", label: "保存所有时间线", color: "cyan", desc: "多线共存，冲突仍潜伏", say: "我要找到让多条时间线共存的方法" },
      { id: "new_line", label: "创造新的时间线", color: "magenta", desc: "结合优点，需要巨大牺牲", say: "我愿牺牲一部分记忆，创造新的时间线" },
      { id: "guardian", label: "成为跨时空守护者", color: "blue", desc: "永远穿行，平衡所有涟漪", say: "我接受成为跨时间线的守护者" },
    ],
  },
];

/** 黎明纪元开场五选一（act0）— 对齐 UI 图与开场模板 */
export const awakeningChoices = [
  { id: "c1", num: "01", title: "调查皇家时之法师塔", risk: "因果链", risk_level: "中", riskTags: ["因果链", "影响塔防御状态"], tags: ["时钟塔", "法师塔"], action: "go", target: "sunken_clock" },
  { id: "c2", num: "02", title: "寻找时间隐士", risk: "未知", risk_level: "低", riskTags: ["未知", "信息缺失"], tags: ["灯塔", "先知"], action: "go", target: "lighthouse", say: "我想打听灯塔先知和时间隐士的下落" },
  { id: "c3", num: "03", title: "接触时之守望者", risk: "观测偏差", risk_level: "中", riskTags: ["观测偏差", "引起注意"], tags: ["守望", "裂隙"], action: "say", text: "我想找到时之守望者，了解时间线的状态" },
  { id: "c4", num: "04", title: "探索世界树", risk: "时间回响", risk_level: "中", riskTags: ["时间回响", "迷失风险"], tags: ["水路", "回响"], action: "go", target: "canal" },
  { id: "c5", num: "05", title: "调查虚空教团", risk: "因果崩塌", risk_level: "高", riskTags: ["因果崩塌", "高风险"], tags: ["教团", "裂隙"], action: "say", text: "我听说虚空教团在暗中活动，他们的目标是什么？" },
];

export const flagRules = [
  { flag: "awakening_complete", when_text: ["法师塔", "灯塔", "港湾", "议会", "守望", "教团", "隐士", "时钟塔", "运河", "水路", "世界树"], actor: "player" },
  { flag: "asked_about_warning", when_text: ["预警", "急件", "听涌", "大崩坏", "压下", "潮汐"], actor: "player" },
  { flag: "clueLamp", when_text: ["三长一短", "王都暗号", "王都的进港"], actor: "player" },
  { flag: "clueLetter", when_text: ["预警信", "盖章退回", "扰乱人心"], actor: "player" },
  { flag: "clueLedger", when_text: ["账本", "公示牌", "低两尺"], actor: "player" },
  { flag: "met_yongyin", when_location: "lighthouse", actor: "player" },
  { flag: "trusted_by_ewen", when_trust: { character_id: "ewen", other_id: "player", min: 0.35 } },
  { flag: "trusted_by_yongyin", when_trust: { character_id: "yongyin", other_id: "player", min: 0.45 } },
  { flag: "trusted_by_saltspeaker", when_trust: { character_id: "saltspeaker", other_id: "player", min: 0.35 } },
  { flag: "dispatch_hinted", when_text: ["急件", "封存", "编号", "蜡印", "档案"], actor: "player" },
  { flag: "records_investigated", when_text: ["公之于众", "时之守望者", "隐瞒这段记录", "查阅被封存", "预警急件"], actor: "player" },
  { flag: "void_ritual_disrupted", when_text: ["正面突袭", "潜入教团", "潜入救援", "谈判交换", "破坏仪式", "听涌媒介"], actor: "player" },
  { flag: "resonance_stabilized", when_text: ["稳定", "共振", "切断", "潮汐危机"], actor: "player" },
];

export const characterActStrategies = {
  yongyin: {
    act0_awakening: { allowed_intents: ["warn", "follow", "probe"], default_intent: "warn", goal_focus: "确认来人是时隙行者。问什么先答什么。灯号、水位、信件都用白话说，不要用谜语代替解释", forbidden_say: ["预警信全文", "急件编号", "该公开还是隐瞒"], unlock_skills: ["hear_the_tide"] },
    act1_omens: { allowed_intents: ["warn", "follow", "probe", "protect"], default_intent: "warn", goal_focus: "问灯就说昨夜把主灯改成王都暗号；问信就说写过预警、驿站盖章退回、信在档案室。比喻最多一句，后面必须跟直说。不替对方决定该不该公开", forbidden_say: ["预警信全文", "该公开还是隐瞒", "急件编号"], unlock_skills: ["hear_the_tide"] },
    act2_buried_records: { allowed_intents: ["warn", "follow", "probe", "protect"], default_intent: "warn", goal_focus: "只作意见来源，不指定真相去向", forbidden_say: ["该公开还是隐瞒"], unlock_skills: ["hear_the_tide"] },
    act3_void_scheme: { allowed_intents: ["warn", "protect", "refuse", "follow"], default_intent: "warn", goal_focus: "阻止教团逆用听涌，自己不替玩家冲阵", forbidden_say: ["关闭阀门的完整步骤"], unlock_skills: ["hear_the_tide"] },
    act4_tide_resonance: { allowed_intents: ["warn", "protect", "follow"], default_intent: "protect", goal_focus: "用听涌指引稳定裂隙，仍不替人做优先级", forbidden_say: [], unlock_skills: ["hear_the_tide"] },
    act5_requiem: { allowed_intents: ["warn", "follow", "probe"], default_intent: "probe", goal_focus: "支持玩家的终局抉择，但要听见自己的结局", forbidden_say: [], unlock_skills: ["hear_the_tide"] },
  },
  ewen: {
    act0_awakening: { allowed_intents: ["probe", "refuse"], default_intent: "probe", goal_focus: "打量新来的外乡人，不交封存柜", forbidden_say: ["急件编号", "未盖印副本", "第三层"], unlock_skills: ["archive_procedure"] },
    act1_omens: { allowed_intents: ["probe", "refuse", "trade_info"], default_intent: "probe", goal_focus: "可谈手续和台账封面：来件人、去向、分类。不宣读正文，不给未盖印副本，不让进柜子里层", forbidden_say: ["急件全文", "未盖印副本", "第三层"], unlock_skills: ["archive_procedure"] },
    act2_buried_records: { allowed_intents: ["probe", "trade_info", "refuse"], default_intent: "trade_info", goal_focus: "交换条件后可暗示漏洞，仍可不冒险", forbidden_say: ["急件全文"], unlock_skills: ["archive_procedure"] },
    act3_void_scheme: { allowed_intents: ["probe", "refuse", "warn"], default_intent: "refuse", goal_focus: "守档案室，不被卷进教团仪式", forbidden_say: ["未盖印副本"], unlock_skills: ["archive_procedure"] },
    act4_tide_resonance: { allowed_intents: ["probe", "refuse", "warn"], default_intent: "warn", goal_focus: "保住证据或接受销毁，陈述代价即可", forbidden_say: [], unlock_skills: ["archive_procedure"] },
    act5_requiem: { allowed_intents: ["probe", "trade_info", "refuse"], default_intent: "trade_info", goal_focus: "信任足够时可交出副本编号", forbidden_say: ["急件全文"], unlock_skills: ["archive_procedure"], extra_flags_required: ["trusted_by_ewen"] },
  },
  saltspeaker: {
    act0_awakening: { allowed_intents: ["watch", "refuse"], default_intent: "watch", goal_focus: "远观潮位，不交水路地图", forbidden_say: ["三处阀门", "关闭方法", "对照本"], unlock_skills: [] },
    act1_omens: { allowed_intents: ["watch", "warn", "refuse"], default_intent: "warn", goal_focus: "用账本说话：昨夜亥时水位比时刻表低两尺；神殿要对外口径改成正常，公示牌换了，账本没改。不交阀门位置，不讲关装置的步骤", forbidden_say: ["三处阀门", "关闭方法全文"], unlock_skills: ["tide_navigation"] },
    act2_buried_records: { allowed_intents: ["watch", "warn", "refuse", "trade_info"], default_intent: "warn", goal_focus: "可对读潮汐记录，不强迫议会站队", forbidden_say: ["关闭方法全文"], unlock_skills: ["tide_navigation"] },
    act3_void_scheme: { allowed_intents: ["warn", "refuse", "trade_info"], default_intent: "warn", goal_focus: "可提供装置知识，不替玩家承担风险", forbidden_say: [], unlock_skills: ["tide_navigation"] },
    act4_tide_resonance: { allowed_intents: ["warn", "watch", "trade_info"], default_intent: "warn", goal_focus: "陈述救援、守塔、追击的代价，优先级由玩家定", forbidden_say: [], unlock_skills: ["tide_navigation"] },
    act5_requiem: { allowed_intents: ["warn", "probe", "trade_info"], default_intent: "probe", goal_focus: "交代议会与灯塔的最终命运", forbidden_say: [], unlock_skills: ["tide_navigation"], extra_flags_required: ["trusted_by_saltspeaker"] },
  },
  baker: {
    act0_awakening: { allowed_intents: ["trade_info", "probe", "watch"], default_intent: "trade_info", goal_focus: "把热面包和街坊闲话给面善的人", forbidden_say: ["急件全文", "未盖印副本"], unlock_skills: [] },
    act1_omens: { allowed_intents: ["trade_info", "probe", "warn"], default_intent: "trade_info", goal_focus: "只谈见闻：没有船进港、灯号是王都的、驿站后半夜在灯塔底下拦过问灯的人。态度好才多说一句。不编急件正文，不报编号", forbidden_say: ["急件全文", "急件编号"], unlock_skills: [] },
    act2_buried_records: { allowed_intents: ["trade_info", "probe", "warn"], default_intent: "probe", goal_focus: "可提旧识后代，不离开烘炉去冒险", forbidden_say: ["急件全文"], unlock_skills: [] },
    act3_void_scheme: { allowed_intents: ["warn", "refuse", "probe"], default_intent: "warn", goal_focus: "守摊，不掺和教团仪式", forbidden_say: ["关闭阀门的完整步骤"], unlock_skills: [] },
    act4_tide_resonance: { allowed_intents: ["warn", "watch", "trade_info"], default_intent: "watch", goal_focus: "让街坊有热面包，陈述潮乱的代价", forbidden_say: [], unlock_skills: [] },
    act5_requiem: { allowed_intents: ["probe", "trade_info", "watch"], default_intent: "probe", goal_focus: "交代烘炉与后代的下落", forbidden_say: [], unlock_skills: [] },
  },
  envoy: {
    act0_awakening: { allowed_intents: ["probe", "refuse", "warn"], default_intent: "probe", goal_focus: "压住外来者，试探会不会把先知交出来", forbidden_say: ["急件原文", "教廷压下预警是过错"], unlock_skills: [] },
    act1_omens: { allowed_intents: ["probe", "refuse", "trade_info", "warn"], default_intent: "warn", goal_focus: "把昨夜灯号和退潮说成误报。可开条件：临时调阅只给盖印摘要、帮同伴开证明、把名字从问询名单划掉。条件是停止打听那封信。不承认驿站压信压错了", forbidden_say: ["急件原文", "教廷压下预警是过错"], unlock_skills: [] },
    act2_buried_records: { allowed_intents: ["trade_info", "refuse", "warn"], default_intent: "trade_info", goal_focus: "用天平施压，把调查收回教廷可控范围", forbidden_say: ["急件原文"], unlock_skills: [] },
    act3_void_scheme: { allowed_intents: ["warn", "refuse", "probe"], default_intent: "warn", goal_focus: "把教团与先知都当成可交易的棋子，不承认教廷有错", forbidden_say: ["急件原文"], unlock_skills: [] },
    act4_tide_resonance: { allowed_intents: ["warn", "refuse", "trade_info"], default_intent: "warn", goal_focus: "要求选边：接受收买或按扰乱人心收走线索", forbidden_say: [], unlock_skills: [] },
    act5_requiem: { allowed_intents: ["probe", "refuse", "warn"], default_intent: "refuse", goal_focus: "交代教廷对终局的立场", forbidden_say: ["急件原文"], unlock_skills: [] },
  },
};

export const stepIntentLabels = {
  heal: "救人",
  probe: "试探",
  warn: "警告",
  refuse: "拒绝",
  protect: "保护",
  trade_info: "交换信息",
  watch: "观察",
  follow: "跟随",
};

export function briefingPlain(body) {
  return String(body || "").replace(/\*([^*]+)\*/g, "$1");
}

/** 开局简报：第一人称、四段公开信息。*词* 为画面上放大的重点。不剧透需调查才得知的情节。 */
export const openingBriefing = {
  kicker: "TIDE REQUIEM · 航线简报",
  title: "在时间碎裂之前",
  next: "继续",
  sections: [
    {
      heading: "我是谁",
      body: "我在南岸一座小港长大。父亲是在猫头抄写*潮汐时刻表*的海员，我从小就会认时间，靠石阶上的水线涨会到第几级，而不是墙上的钟。长大以后，我成为了沿海各港的*时刻校对员*：哪天满潮、哪夜点灯，都需要我一点点校对潮汐表和眼前的海水。如果对不上，就有大麻烦。那天，*世界被撕开之后*，我发现自己突然能走进已经裂开的三段历史里。听说有人把我这种人叫作*时隙行者*···",
    },
    {
      heading: "这个世界",
      body: "我在的这个世界叫*埃忒尔维亚*。大崩坏之后，历史被撕成三截，同时存在着，时隙行者可以走进任何一截：*黎明*还相对完整，潮汐港湾存在于这个片段；*辉煌*已经是燃烧之后的样子9i；*终末*则是世界烧掉之后剩下的尽头。官方史书只记载了一条原因：法师*卡尔萨斯*在星辰王都法师塔顶层做「永恒升华」仪式，仪式失控之后，时间就碎裂了。后人把这场灾变叫*大崩坏*。教廷却对外说这是神明的考验。",
    },
    {
      heading: "最近发生了什么",
      body: "我曾在*三个时段*之间来回穿行。*黎明*时分，潮汐港湾还完好无损；可到了后两个时段，它已经只剩一片*废墟*。最近，我甚至能在裂隙边缘直接看见那些*不该存在的错位*：钟声会突然跳字；黎明时段的海水，明明正值满潮，却反而*开始退去*；港湾的灯塔彻夜不灭，还不断闪烁着*王都的进港暗号*——可这座港口平时根本不用那套信号。这些异常叠在一起，只说明了一件事：*大崩坏*尚未降临的那一夜，潮汐港湾就已经先一步失控了。我必须现在进去。不能等它变成我记忆中那片死灰。",
    },
    {
      heading: "因此我打算",
      body: "所以，我要穿过*裂隙*，抵达*黎明纪元*的*潮汐港湾*。先登上*星辰广场*，亲眼核对*时刻表*，确认海水的潮汐是否异常、灯塔是否无故亮起，再听听港里的人究竟如何描述今夜。若有人已经察觉异样，我就去找到他。我的目标只有一个：查清*时间为何碎裂*，并在这座港湾被烈焰吞没之前，设法将破碎的时间*接回原位*。",
    },
  ],
  closing: "星辰广场就在前面。告示、灯塔、码头，都要我自己去看。",
  confirm: "确认，落入黎明纪元",
};

export function getActById(actId) {
  return storyActs.find((act) => act.id === actId) || storyActs[0];
}

export function getActUiMeta(actId) {
  const act = getActById(actId);
  return {
    act_id: act.id,
    order: act.order,
    era: act.era,
    title: act.title,
    subtitle: act.subtitle,
    summary: act.summary,
    narrative: act.narrative,
    quote: act.quote,
    ui_layout: act.ui_layout,
    ui_bg: act.ui_bg,
    objectives: act.objectives || [],
    clue_fragments: act.clue_fragments || [],
    flags: [],
  };
}
