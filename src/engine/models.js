export const CharacterKind = {
  player: "player",
  npc: "npc",
  companion: "companion",
};

export const MemoryKind = {
  observation: "observation",
  reflection: "reflection",
  plan: "plan",
  fact: "fact",
};

export const EventVisibility = {
  public: "public",
  witnesses: "witnesses",
  private: "private",
};

export const ActionType = {
  speak: "speak",
  move: "move",
  interact: "interact",
  wait: "wait",
  skill: "skill",
  attack: "attack",
  help: "help",
};

export const FacingKind = {
  self: "self",
  other: "other",
};

export const LifeStage = {
  youth: "youth",
  adult: "adult",
  elder: "elder",
};

export const Stance = {
  allied: "allied",
  wary: "wary",
  hostile: "hostile",
  indebted: "indebted",
  neutral: "neutral",
};

/** 本步行动意图（思维步骤第 3 步） */
export const StepIntent = {
  heal: "heal",
  probe: "probe",
  warn: "warn",
  refuse: "refuse",
  protect: "protect",
  trade_info: "trade_info",
  watch: "watch",
  follow: "follow",
};

export function createThinking(raw = {}) {
  return {
    notice_first: raw.notice_first ?? "",
    interpret_intent: raw.interpret_intent ?? "",
    step_intent: raw.step_intent ?? "",
    must_not_say: raw.must_not_say ?? "",
  };
}

export function timeTick(time) {
  return (time.day - 1) * 24 * 60 + time.hour * 60 + time.minute;
}

export function timeClock(time) {
  return `${String(time.hour).padStart(2, "0")}:${String(time.minute).padStart(2, "0")}`;
}

export function createGameTime({ day = 1, hour = 8, minute = 0 } = {}) {
  return { day, hour, minute };
}

export function advanceTime(time, minutes) {
  const total = timeTick(time) + minutes;
  const day = Math.floor(total / (24 * 60));
  const rem = total % (24 * 60);
  const hour = Math.floor(rem / 60);
  const minute = rem % 60;
  return createGameTime({ day: day + 1, hour, minute });
}

export function createRelationship(raw = {}) {
  return {
    other_id: raw.other_id,
    trust: raw.trust ?? 0,
    fear: raw.fear ?? 0,
    debt: raw.debt ?? 0,
    affection: raw.affection ?? 0,
    note: raw.note ?? "",
    stance: raw.stance ?? Stance.neutral,
  };
}

export function relationshipWith(character, otherId) {
  if (!character.relationships[otherId]) {
    character.relationships[otherId] = createRelationship({ other_id: otherId });
  }
  return character.relationships[otherId];
}

export function createCharacterAction(raw = {}) {
  return {
    character_id: raw.character_id,
    speech: raw.speech ?? null,
    action: raw.action ?? null,
    gesture: raw.gesture ?? null,
    facing: raw.facing ?? FacingKind.other,
    facing_id: raw.facing_id ?? null,
    action_type: raw.action_type ?? ActionType.wait,
    target_id: raw.target_id ?? null,
    destination: raw.destination ?? null,
    emotion: raw.emotion ?? "calm",
    memory_to_save: raw.memory_to_save ?? null,
    relationship_deltas: raw.relationship_deltas ?? [],
    inner_thought: raw.inner_thought ?? null,
    thinking: raw.thinking ? createThinking(raw.thinking) : null,
  };
}

export function createWorldEvent(raw = {}) {
  return {
    id: raw.id,
    tick: raw.tick ?? 0,
    type: raw.type,
    location_id: raw.location_id,
    actor_id: raw.actor_id ?? null,
    payload: raw.payload ?? {},
    visibility: raw.visibility ?? EventVisibility.witnesses,
    witness_ids: raw.witness_ids ?? [],
    text: raw.text ?? "",
  };
}

export function newId(prefix = "e") {
  const hex = crypto.randomUUID().replace(/-/g, "");
  return `${prefix}_${hex.slice(0, 10)}`;
}

export function scoreTrajectory(leaks, violations, ok) {
  return {
    omniscience: leaks.length ? 0 : 1,
    constitution: violations.length ? 0 : 1,
    legal_action: ok ? 1 : 0,
    quality: (leaks.length ? 0 : 0.4) + (violations.length ? 0 : 0.4) + (ok ? 0.2 : 0),
  };
}
