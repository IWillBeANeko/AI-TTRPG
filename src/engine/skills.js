import { skillLibrary } from "@/data/skills";

export class SkillSystem {
  constructor() {
    this.skills = skillLibrary.map((item) => ({
      steps: [],
      tags: [],
      success_count: 0,
      act_ids: [],
      step_intents: [],
      ...item,
    }));
  }

  hintsFor(character, situation, { actId = null, stepIntent = null, unlockIds = [] } = {}) {
    const hints = [];
    for (const skill of this.skills) {
      if (skill.owner_id && skill.owner_id !== character.id && skill.owner_id !== "*") continue;
      if (unlockIds.length && !unlockIds.includes(skill.id)) continue;
      if (actId && skill.act_ids?.length && !skill.act_ids.includes(actId)) continue;
      if (stepIntent && skill.step_intents?.length && !skill.step_intents.includes(stepIntent)) continue;
      const blob = `${skill.name} ${skill.description} ${skill.when} ${(skill.tags || []).join(" ")}`;
      if (tokens(skill.when).some((token) => situation.includes(token)) || skill.tags.some((tag) => situation.includes(tag))) {
        hints.push(`${skill.name}：${skill.description}；步骤：${skill.steps.join(" → ")}`);
      } else if (tokens(situation).some((word) => word.length >= 2 && blob.includes(word))) {
        hints.push(`${skill.name}：${skill.description}`);
      }
    }
    const constitution = character.constitution.rules.map((rule) => `宪法：${rule}`);
    return [...constitution, ...hints.slice(0, 4)];
  }

  learn(skill) {
    const existing = this.skills.find((s) => s.id === skill.id);
    if (existing) {
      existing.success_count += 1;
      return;
    }
    this.skills.push(skill);
  }
}

export function constitutionViolations(character, speech, action) {
  const text = `${speech} ${action}`;
  const hits = [];
  for (const taboo of character.constitution.taboos || []) {
    const key = taboo.replace("不会", "").replace("绝不", "").replace("禁止", "").trim();
    if (key && text.includes(key)) hits.push(taboo);
  }
  if (text.includes("丢下") && character.constitution.rules.some((rule) => rule.includes("丢下") || rule.includes("重伤"))) {
    hits.push("可能违反保护重伤同伴的原则");
  }
  return hits;
}

function tokens(text) {
  return String(text || "")
    .replace(/[，。]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}
