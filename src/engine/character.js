import { characterCards } from "@/data/characters";
import { locations as locationList } from "@/data/map";
import { LifeStage, Stance, createRelationship, relationshipWith } from "./models";

export const HOSTILE_MARKERS = [
  "坏人", "魔王", "出卖", "敌人", "逆用", "绑架", "仪式草图",
  "不是普通", "虚空教团", "卡尔萨斯",
];

export const STRENUOUS_MARKERS = [
  "冲刺", "冲上", "猛扑", "扑上去", "扛人", "扛着", "通宵", "硬刚", "抄起", "拦住", "挡在冲突",
];

export function inferLifeStage(age, override) {
  if (override) return override;
  if (age >= 55) return LifeStage.elder;
  if (age <= 23) return LifeStage.youth;
  return LifeStage.adult;
}

export function hpRatio(character) {
  return character.hp / Math.max(1, character.max_hp);
}

export function staminaRatio(character) {
  return character.stamina / Math.max(1, character.max_stamina);
}

export function isFrail(character) {
  if (hpRatio(character) < 0.3 || staminaRatio(character) < 0.3) return true;
  if (character.life_stage === LifeStage.elder && hpRatio(character) < 0.6) return true;
  return false;
}

export function beliefsAbout(character, otherId, otherName = null) {
  return character.beliefs.filter((belief) => {
    if (belief.about === otherId) return true;
    if (otherName && belief.content.includes(otherName) && (!belief.about || belief.about === otherId)) {
      return true;
    }
    return false;
  });
}

export function inferredStanceFromFact(fact) {
  if (HOSTILE_MARKERS.some((marker) => fact.includes(marker))) return Stance.hostile;
  return Stance.wary;
}

export function deriveStance(rel, beliefs) {
  const hostileBeliefs = beliefs.filter(
    (b) => b.stance === Stance.hostile || inferredStanceFromFact(b.content) === Stance.hostile,
  );
  if (hostileBeliefs.some((b) => (b.confidence ?? 0) >= 0.6)) return Stance.hostile;
  if (rel.trust <= -0.45 || rel.fear >= 0.55) return Stance.hostile;
  if (rel.trust <= -0.2 || rel.fear >= 0.35) return Stance.wary;
  const explicitWary = beliefs.filter((b) => b.stance === Stance.wary);
  if (explicitWary.length && rel.trust < 0.4) return Stance.wary;
  if (rel.debt >= 0.3 && rel.trust >= 0.15) return Stance.indebted;
  if (rel.trust >= 0.55 && rel.affection >= 0.35) return Stance.allied;
  if (rel.trust >= 0.35 || rel.affection >= 0.3) return Stance.allied;
  if (rel.trust < 0.15) return Stance.wary;
  return Stance.neutral;
}

export function compileVoice(character, frail) {
  const parts = character.constitution.voice ? [character.constitution.voice] : [];
  if (character.life_stage === LifeStage.elder) parts.push("说话偏慢，爱用旧称和规矩，不急着下断语");
  else if (character.life_stage === LifeStage.youth) parts.push("句子更快，比喻更新，少客套");
  if (frail) parts.push("句子更短，可能带喘，不用轻松口吻");
  else if (hpRatio(character) < 0.6) parts.push("语气发紧，少闲话");
  return parts.join("；") || "按人设说话";
}

export function compileBans(character, frail) {
  const bans = [];
  if (frail) {
    bans.push("禁止冲刺、扛人跑、通宵守夜、主动近身硬刚（attack）");
    bans.push("禁止抄起武器冲上前或挡在冲突中间");
  }
  if (character.life_stage === LifeStage.elder) {
    bans.push("禁止徒手搏斗；走急路要歇，不一次赶很远");
  }
  return bans;
}

export function compilePriorities(character, frail) {
  let priorities = [...(character.constitution.decision_order || [])];
  const healer =
    (character.occupation || "").includes("疗") ||
    character.goals.some((goal) => goal.includes("保护") || goal.includes("治疗"));
  if (frail) {
    if (healer) priorities = ["治疗同伴仍优先", ...priorities];
    priorities = ["先找掩体或出声警告", ...priorities.filter((p) => p !== "self_preserve"), "self_preserve"];
  }
  return priorities;
}

export function compileBody(character, frail) {
  const bits = [
    `${character.age}岁（${character.life_stage}）`,
    `HP ${character.hp}/${character.max_hp}`,
    `耐力 ${character.stamina}/${character.max_stamina}`,
  ];
  if (character.injuries.length) bits.push(`旧伤：${character.injuries.join("、")}`);
  if (frail) bits.push("此刻虚弱，不能冲刺、不能长时间格挡");
  else if (hpRatio(character) < 0.6) bits.push("身上有伤，动作会发沉");
  return `${bits.join("。")}。`;
}

export function compileSlice(character, present) {
  const frail = isFrail(character);
  const views = [];
  const stanceById = {};
  for (const other of present) {
    if (other.id === character.id) continue;
    const rel = relationshipWith(character, other.id);
    const about = beliefsAbout(character, other.id, other.name);
    const stance = deriveStance(rel, about);
    rel.stance = stance;
    stanceById[other.id] = stance;
    const known = about.map((b) => b.content).join("；") || "没有关于此人的具体判断";
    views.push(
      `- ${other.name}(${other.id})：立场=${stance}。你知道的：${known}。关系：信任${rel.trust.toFixed(2)} 好感${rel.affection.toFixed(2)} 惧怕${rel.fear.toFixed(2)}`,
    );
  }
  return {
    life_stage: character.life_stage,
    hp_ratio: hpRatio(character),
    stamina_ratio: staminaRatio(character),
    frail,
    body: compileBody(character, frail),
    voice: compileVoice(character, frail),
    bans: compileBans(character, frail),
    priorities: compilePriorities(character, frail),
    present_views: views,
    stance_by_id: stanceById,
  };
}

export function renderSliceBlock(slice) {
  const bans = slice.bans.map((item) => `- ${item}`).join("\n") || "- （无额外身体禁令）";
  const views = slice.present_views.join("\n") || "- （在场无人需要特别判断）";
  const priorities = slice.priorities.join("、") || "按人设";
  return `【此刻的你】
${slice.body}
此刻声口：${slice.voice}
身体禁令（不可推翻）：
${bans}
此刻优先：${priorities}

【你对在场的人】
${views}
没写出来的身份和秘密，不要当成你知道的真相说出口。`;
}

export function frailFallbackAction(character) {
  if ((character.occupation || "").includes("长老")) return "扶住权杖，停在原地，开口警告";
  if ((character.occupation || "").includes("先知")) return "潮声乱了，先停步，只出声指引";
  if ((character.occupation || "").includes("档案")) return "护住蜡印台账，停在原地，开口拒绝";
  return "先护住伤口、找掩护，只出声警告";
}

export function upsertBelief(character, incoming) {
  const kept = character.beliefs.filter((belief) => {
    if (belief.id === incoming.id) return false;
    if (incoming.about && belief.about === incoming.about && incoming.confidence >= 0.7) return false;
    return true;
  });
  kept.push(incoming);
  character.beliefs = kept.slice(-40);
}

export function applyLearnedFact(character, fact, { aboutIds = [], actionable = false, certainty = 0.7, entryId = null } = {}) {
  if (!character.learned_facts.includes(fact)) character.learned_facts.push(fact);
  const ids = (aboutIds || []).filter(Boolean);
  const confidence = Math.max(0.7, certainty);
  const stance = actionable ? inferredStanceFromFact(fact) : null;
  if (!ids.length) {
    upsertBelief(character, {
      id: `learned_${entryId || character.learned_facts.length}`,
      content: `我得知：${fact}`,
      source: "told",
      confidence,
    });
    return;
  }
  for (const about of ids) {
    upsertBelief(character, {
      id: `learned_${entryId || character.learned_facts.length}_${about}`,
      content: fact,
      source: "told",
      about,
      confidence,
      stance,
    });
    const rel = relationshipWith(character, about);
    if (stance === Stance.hostile) {
      rel.stance = Stance.hostile;
      rel.trust = Math.min(rel.trust, -0.15);
      rel.fear = Math.max(rel.fear, 0.2);
      rel.note = `得知：${fact.slice(0, 40)}`;
      mergeNote(character, `对${about}戒备加深，不再把对方当普通过客`);
    } else if (stance === Stance.wary || actionable) {
      rel.stance = Stance.wary;
      rel.trust = Math.min(rel.trust, 0.1);
      rel.note = `得知：${fact.slice(0, 40)}`;
      mergeNote(character, `对${about}开始留心，不再随口把对方当自己人`);
    } else if (stance) {
      rel.stance = stance;
    }
  }
}

function mergeNote(character, note) {
  if (note && !character.evolved_notes.includes(note)) character.evolved_notes.push(note);
  character.evolved_notes = character.evolved_notes.slice(-8);
}

export function cardToState(card) {
  const rels = {};
  for (const rel of card.relationships || []) {
    rels[rel.other_id] = createRelationship(rel);
  }
  return {
    id: card.id,
    name: card.name,
    kind: card.kind,
    follow_player: Boolean(card.follow_player),
    location_id: card.location,
    hp: card.hp ?? 10,
    max_hp: card.max_hp ?? 10,
    age: card.age ?? 30,
    life_stage: inferLifeStage(card.age ?? 30, card.life_stage),
    stamina: card.stamina || card.hp || 10,
    max_stamina: card.max_stamina || card.max_hp || 10,
    injuries: [...(card.injuries || [])],
    emotion: card.emotion || "calm",
    occupation: card.occupation || "",
    summary: card.summary || "",
    constitution: {
      rules: [...(card.constitution?.rules || [])],
      decision_order: [...(card.constitution?.decision_order || [])],
      voice: card.constitution?.voice || "",
      taboos: [...(card.constitution?.taboos || [])],
    },
    goals: [...(card.goals || [])],
    schedule: [...(card.schedule || [])],
    relationships: rels,
    beliefs: (card.beliefs || []).map((b) => ({ ...b })),
    secrets: [...(card.secrets || [])],
    known_knowledge_ids: [...(card.known_knowledge_ids || [])],
    learned_facts: [],
    evolved_notes: [],
    current_plan: "",
    current_activity: "",
    separated: false,
    importance_accumulator: 0,
    cognition: {
      notice_first: [...(card.cognition?.notice_first || [])],
      interpret_bias: card.cognition?.interpret_bias || "",
      when_uncertain: card.cognition?.when_uncertain || "",
    },
  };
}

export function loadLocations() {
  const map = {};
  for (const loc of locationList) {
    map[loc.id] = { ...loc, connections: [...loc.connections], tags: [...(loc.tags || [])] };
  }
  return map;
}

export function loadCharacterCards() {
  return characterCards.map((card) => structuredClone(card));
}

export function loadCharacters() {
  const cards = loadCharacterCards();
  const states = {};
  for (const card of cards) states[card.id] = cardToState(card);
  return { cards, states };
}

export function migrateCharacterProfiles(characters, cards = loadCharacterCards()) {
  const byId = Object.fromEntries(cards.map((card) => [card.id, card]));
  for (const card of cards) {
    if (!characters[card.id]) characters[card.id] = cardToState(card);
  }
  for (const character of Object.values(characters)) {
    const card = byId[character.id];
    if (!card) continue;
    if (card.constitution) character.constitution = structuredClone(card.constitution);
    if (card.cognition) {
      character.cognition = {
        notice_first: [...(card.cognition.notice_first || [])],
        interpret_bias: card.cognition.interpret_bias || "",
        when_uncertain: card.cognition.when_uncertain || "",
      };
    }
    if (Array.isArray(card.known_knowledge_ids)) {
      const known = new Set(character.known_knowledge_ids || []);
      for (const id of card.known_knowledge_ids) known.add(id);
      character.known_knowledge_ids = [...known];
    }
    if (Array.isArray(card.beliefs)) {
      const have = new Set((character.beliefs || []).map((belief) => belief.id).filter(Boolean));
      for (const belief of card.beliefs) {
        if (belief?.id && !have.has(belief.id)) character.beliefs.push(structuredClone(belief));
      }
    }
  }
}

export function beliefsAboutPlayerRefresh(character, playerId) {
  const rel = relationshipWith(character, playerId);
  const notes = [];
  if (rel.trust <= -0.2 || rel.fear >= 0.2) {
    notes.push("对旅人戒备加深，语气更硬，不再把对方当普通过客");
  } else if (rel.trust >= 0.55 && rel.affection >= 0.4) {
    notes.push("对旅人逐渐打开心扉，愿意多说一点心里话");
  } else if (rel.affection >= 0.25 || rel.trust >= 0.35) {
    notes.push("开始把旅人当同伴，而不只是过客");
  }
  if (rel.debt >= 0.3) notes.push("觉得欠旅人一份人情，关键时刻更愿意伸手");
  rel.stance = deriveStance(rel, beliefsAbout(character, playerId));
  for (const note of notes) {
    if (note && !character.evolved_notes.includes(note)) character.evolved_notes.push(note);
  }
  character.evolved_notes = character.evolved_notes.slice(-8);
}

export function absorbReflection(character, insight) {
  if (!insight) return;
  let snippet = insight.replace("依据：", "").trim();
  if (snippet.length > 60) snippet = snippet.slice(0, 60);
  const note = `经历留下的变化：${snippet}`;
  if (!character.evolved_notes.includes(note)) character.evolved_notes.push(note);
  character.evolved_notes = character.evolved_notes.slice(-8);
}
