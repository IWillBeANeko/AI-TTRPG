export const TUTOR_STEPS = [
  {
    id: "intro",
    text: "下方是你的角色卡。这里能看到生命、属性，以及物品和技能。接下来请按提示操作，点别处不会有反应。",
    next: "ok",
    reveal: "party",
  },
  {
    id: "skill",
    text: "先点你自己的「技能」，看看现在会什么。",
    target: "player-skill",
    reveal: "party",
  },
  {
    id: "skill-view",
    text: "这是你目前掌握的技能。看完后关掉窗口。",
    target: "kit-close",
    reveal: "party",
  },
  {
    id: "attrs",
    text: "再点你的「属性」，确认四项数值。掷骰时会用到它们。",
    target: "player-attrs",
    reveal: "party",
  },
  {
    id: "talk",
    text: "点队友的角色卡，打开对话。这是你们之间的深度交流。",
    target: "mate-talk",
    reveal: "party",
  },
  {
    id: "brief",
    text: "左侧是本幕简报：只有目的和待做事项。问完人之后，点右上角 CHECK 才会更新。现在请点一次 CHECK。",
    target: "brief-check",
    reveal: "brief",
  },
  {
    id: "map-intro",
    text: "中间是港湾大地图。地点会按简报一步步打开。点地点会进入现场。",
    next: "ok",
    reveal: "map",
  },
  {
    id: "map-go",
    text: "点「星辰广场」，进入这个地点。",
    target: "map-here",
    reveal: "map",
  },
  {
    id: "action",
    text: "右侧是这个地点能做的事。请点其中一个选项。",
    target: "choice",
    reveal: "all",
  },
  {
    id: "done",
    text: "引导结束。之后按左侧简报走：问完人再点右上角 CHECK，对上了才会划掉并写出下一步。要换地方，先返回港湾地图。",
    next: "ok",
    reveal: "all",
  },
];
