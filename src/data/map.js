export const locations = [
  {
    id: "harbor",
    name: "潮汐港湾码头",
    description:
      "东南沿海的自由贸易港。码头贴着本月潮汐时刻表。今夜水位和表对不上，船帮撞在露出的石阶上。空气里有盐、鱼市和炉火。",
    connections: ["lighthouse", "canal", "council"],
    tags: ["town", "outdoor", "safe", "dawn", "tide"],
  },
  {
    id: "lighthouse",
    name: "港湾灯塔",
    description:
      "灯塔由一位失明女先知看守。无雾、无船进港时不该通宵点主灯。今夜主灯按三长一短闪，那是王都才用的进港暗号。",
    connections: ["harbor"],
    tags: ["landmark", "indoor", "tide", "rift"],
  },
  {
    id: "council",
    name: "深涌议事厅",
    description:
      "深涌氏族议会在此议事。墙上挂着每天的潮汐账本：实测水位、满潮时刻。外人空手来要秘密，很难被理会。",
    connections: ["harbor", "archive"],
    tags: ["indoor", "town", "tide"],
  },
  {
    id: "archive",
    name: "神殿驻港档案室",
    description:
      "星辰神殿在港湾的急件驿站。木架上锁着封存卷宗，蜡印写着「扰乱人心」。年轻档案吏把钥匙扣在腕上。",
    connections: ["council"],
    tags: ["indoor", "private", "church"],
  },
  {
    id: "canal",
    name: "运河裂隙水道",
    description:
      "港湾内侧的运河通向水路时之裂隙。水位忽高忽低，船帮上有虚空教团留下的共振符号。远处能听见时钟塔在水下走动。",
    connections: ["harbor", "sunken_clock"],
    tags: ["wild", "outdoor", "danger", "rift", "tide"],
  },
  {
    id: "sunken_clock",
    name: "沉没时钟塔",
    description:
      "海面下若隐若现的巨型时钟塔。传说星辰王都曾考虑把法师塔设在此处。齿轮仍在无水的时间里转动，空气发颤，像即将破碎的玻璃球。",
    connections: ["canal"],
    tags: ["wild", "outdoor", "rift", "danger"],
  },
];
