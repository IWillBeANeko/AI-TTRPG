import { SKILL_TO_ATTR, attrModifier } from "@/data/chargen";

export function kitForPlayer(sheet = {}) {
  return {
    hp: Number(sheet.hp) || 10,
    maxHp: Number(sheet.maxHp) || 10,
    items: sheet.items?.length
      ? sheet.items
      : [
          { id: "token", name: "裂隙信物", desc: "穿过裂隙时还握在手里的石片，还带着余温。" },
          { id: "ration", name: "干粮", desc: "够撑过今晚。热面包要自己去码头买。" },
        ],
    skills: sheet.skills?.length ? sheet.skills : defaultSkills(sheet.attrs),
  };
}

export function kitForCompanion(companion = {}) {
  const job = companion.occupation || "同行者";
  return {
    hp: Number(companion.hp) || 10,
    maxHp: Number(companion.maxHp) || 10,
    items: companion.items?.length
      ? companion.items
      : [
          { id: "note", name: "随身残页", desc: `${job}路上会用到的记录，不给外人看全文。` },
          { id: "cord", name: "潮绳", desc: "防滑、可临时固定，不是武器。" },
        ],
    skills: companion.skills?.length ? companion.skills : defaultSkills(companion.attrs),
  };
}

function defaultSkills(attrs = {}) {
  return Object.entries(SKILL_TO_ATTR).map(([skill, attr]) => ({
    id: skill,
    name: skill,
    desc: `受${attr}影响。检定修正 +${attrModifier(attrs[attr])}。`,
  }));
}
