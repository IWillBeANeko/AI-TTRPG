import { absorbReflection, beliefsAboutPlayerRefresh, compileSlice, isFrail } from "./character";
import { currentSchedule } from "./world";
import { CharacterKind, MemoryKind, newId, timeClock, timeTick } from "./models";

const TOKEN_RE = /[\u4e00-\u9fff]|[A-Za-z0-9_]+/g;
const EMBED_DIM = 256;

function simpleHash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function hashEmbed(text, dim = EMBED_DIM) {
  const vec = new Array(dim).fill(0);
  const tokens = String(text).toLowerCase().match(TOKEN_RE) || [text];
  for (const token of tokens) {
    const h = simpleHash(token);
    vec[h % dim] += 1;
    vec[(h >>> 8) % dim] += 0.35;
  }
  let norm = 0;
  for (const v of vec) norm += v * v;
  norm = Math.sqrt(norm);
  if (norm) {
    for (let i = 0; i < dim; i += 1) vec[i] /= norm;
  }
  return vec;
}

export function cosine(a, b) {
  if (!a?.length || !b?.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom ? dot / denom : 0;
}

export class CognitionSystem {
  constructor(engine, store, settings, gameId) {
    this.engine = engine;
    this.store = store;
    this.settings = settings;
    this.gameId = gameId;
    this.cache = {};
  }

  loadCharacterMemories(characterId) {
    if (!this.cache[characterId]) {
      this.cache[characterId] = this.store.listMemories(this.gameId, characterId).map((memory) => ({
        ...memory,
        embedding: memory.embedding?.length ? memory.embedding : hashEmbed(memory.content),
      }));
    }
    return this.cache[characterId];
  }

  remember(characterId, content, { kind = MemoryKind.observation, importance = null, relatedIds = [], locationId = null } = {}) {
    const character = this.engine.characters[characterId];
    const record = {
      id: newId("mem"),
      character_id: characterId,
      kind,
      content,
      tick: timeTick(this.engine.time),
      importance: importance ?? estimateImportance(content),
      location_id: locationId || character.location_id,
      related_ids: relatedIds,
      embedding: hashEmbed(content),
    };
    this.store.addMemory(this.gameId, record);
    if (!this.cache[characterId]) this.cache[characterId] = [];
    this.cache[characterId].push(record);
    character.importance_accumulator += record.importance;
    return record;
  }

  observeEvent(characterId, event) {
    if (!this.engine.canPerceive(characterId, event)) return null;
    if (event.type === "time_advanced") return null;
    const prefix = characterId !== event.actor_id ? "你看到" : "你";
    const memory = this.remember(characterId, `${prefix}：${event.text}`, {
      importance: estimateImportance(event.text, event.type),
      relatedIds: event.actor_id ? [event.actor_id] : [],
      locationId: event.location_id,
    });
    this.maybeFormBelief(this.engine.characters[characterId], event);
    return memory;
  }

  retrieve(characterId, query, k = null) {
    const memories = this.loadCharacterMemories(characterId);
    if (!memories.length) return [];
    k = k || this.settings.memoryRetrieveK;
    const queryVec = hashEmbed(query);
    const now = timeTick(this.engine.time);
    const keys = queryKeys(query);
    return memories
      .map((memory, index) => {
        const recency = Math.exp(-0.0008 * Math.max(0, now - memory.tick));
        const relevance = cosine(queryVec, memory.embedding);
        const overlap = keys.filter((key) => String(memory.content || "").includes(key)).length;
        const secret = isSecretMemory(memory);
        const importance = secret ? Math.min(memory.importance, 0.2) : memory.importance;
        const score = 0.5 * relevance + 0.2 * recency + 0.15 * importance + 0.15 * Math.min(1, overlap / 2);
        return { score, memory, index };
      })
      .sort((a, b) => b.score - a.score || b.index - a.index)
      .slice(0, k)
      .map((item) => item.memory);
  }

  rankTexts(texts, query, k = null) {
    return rankTexts(texts, query, k);
  }

  maybeReflect(characterId) {
    const character = this.engine.characters[characterId];
    if (character.importance_accumulator < this.settings.reflectionImportanceThreshold) return null;
    const recent = this.loadCharacterMemories(characterId).slice(-16);
    if (recent.length < 3) return null;
    const insight = synthesizeReflection(character, recent);
    character.importance_accumulator = 0;
    absorbReflection(character, insight);
    return this.remember(characterId, insight, {
      kind: MemoryKind.reflection,
      importance: 0.85,
      relatedIds: [characterId],
    });
  }

  refreshPlan(character) {
    const clock = timeClock(this.engine.time);
    if (character.kind === CharacterKind.npc) {
      const block = currentSchedule(character, clock);
      if (block) {
        character.current_plan = `按日程在${block.location}：${block.activity}`;
        character.current_activity = block.activity;
        return character.current_plan;
      }
    }
    if (character.follow_player) {
      const player = this.engine.characters[this.engine.player_id];
      character.current_plan = `跟随${player.name}，优先保护队友，当前目标：${character.goals.slice(0, 2).join("；")}`;
    } else if (character.goals.length) {
      character.current_plan = character.goals[0];
    }
    return character.current_plan;
  }

  buildObservation(characterId) {
    const character = this.engine.characters[characterId];
    const location = this.engine.location(character.location_id);
    const present = this.engine.presentIds(character.location_id);
    const names = {};
    for (const cid of present) names[cid] = this.engine.characters[cid].name;
    return {
      character_id: characterId,
      tick: timeTick(this.engine.time),
      clock: `第${this.engine.time.day}天 ${timeClock(this.engine.time)}`,
      location_id: location.id,
      location_name: location.name,
      location_desc: location.description,
      present_ids: present,
      present_names: names,
      recent_events: this.engine.visibleEvents(characterId, this.settings.maxRecentEvents).map((e) => e.text),
      current_activity: character.current_activity,
      hp: character.hp,
      max_hp: character.max_hp,
      age: character.age,
      stamina: character.stamina,
      max_stamina: character.max_stamina,
      injuries: [...character.injuries],
      life_stage: character.life_stage,
      frail: isFrail(character),
      emotion: character.emotion,
    };
  }

  buildContext(characterId, triggeringEvent, visibleKnowledge, skillHints) {
    const character = this.engine.characters[characterId];
    this.refreshPlan(character);
    const observation = this.buildObservation(characterId);
    const query = triggeringEvent;
    const present = observation.present_ids.map((cid) => this.engine.characters[cid]);
    return {
      observation,
      constitution: character.constitution,
      goals: character.goals,
      plan: character.current_plan,
      memories: this.retrieve(characterId, query),
      beliefs: [...character.beliefs],
      visible_knowledge: rankTexts(visibleKnowledge, query),
      relationships: Object.values(character.relationships),
      triggering_event: triggeringEvent,
      skill_hints: skillHints,
      evolved_notes: [...character.evolved_notes],
      persona_slice: compileSlice(character, present),
      must_reply: false,
    };
  }

  maybeFormBelief(character, event) {
    if (!["spoke", "acted", "damaged", "healed", "moved"].includes(event.type)) return;
    if (event.actor_id === character.id) return;
    const beliefId = `b_${event.id}`;
    if (character.beliefs.some((b) => b.id === beliefId)) return;
    character.beliefs.push({
      id: beliefId,
      content: event.text,
      source: event.id,
      about: event.actor_id,
      confidence: 0.45,
    });
    if (character.beliefs.length > 40) character.beliefs = character.beliefs.slice(-40);
  }
}

export function estimateImportance(text, eventType = null) {
  let score = 0.35;
  const keywords = {
    伤: 0.25, 死: 0.4, 背叛: 0.45, 秘密: 0.3, 魔王: 0.2, 崩坏: 0.25, 裂隙: 0.15,
    卡尔萨斯: 0.3, 虚空: 0.2, 跟随: 0.1, 治疗: 0.2, 攻击: 0.2, 抢劫: 0.35, 威胁: 0.25,
    倒下: 0.35, 不信任: 0.3,
  };
  for (const [word, weight] of Object.entries(keywords)) {
    if (text.includes(word)) score += weight;
  }
  const typeBonus = { damaged: 0.2, healed: 0.15, spoke: 0.05, moved: 0.02 };
  if (eventType) score += typeBonus[eventType] || 0;
  return Math.min(1, score);
}

export function synthesizeReflection(character, memories) {
  const joined = memories.slice(-8).map((m) => m.content).join("；");
  const focus = [];
  if (memories.some((m) => m.content.includes("伤") || m.content.includes("治疗"))) {
    focus.push("最近的冲突留下了伤口，必须把同伴的安危放在前面");
  }
  if (memories.some((m) => m.content.includes("背叛") || m.content.includes("不信任"))) {
    focus.push("有人做出过背信的事，不能当作没发生");
  }
  if (character.kind === CharacterKind.companion) {
    focus.push(`继续跟随主角，履行：${character.goals.slice(0, 2).join("、") || "保护队伍"}`);
  }
  if (!focus.length) focus.push("把这些见闻记成对自己处境的判断，而不是旁观者的总结");
  return `${character.name}的反思：${focus.join("；")}。依据：${joined.slice(0, 180)}`;
}

export function queryKeys(text) {
  const stop = [
    "为什么", "什么", "甚么", "怎么", "如何", "为何", "哪个", "哪些", "说明", "一下",
    "这个", "那个", "不是", "可以", "的", "了", "是", "在", "有", "和", "与", "或",
    "也", "都", "就", "不", "没", "这", "那", "我", "你", "他", "她", "想", "请",
    "问", "说", "算", "指", "吗", "呢", "啊", "吧", "谁", "哪",
  ];
  const remaining = String(text || "").replace(/[，。！？、；：""''「」?\s]/g, "");
  const pattern = new RegExp(stop.sort((a, b) => b.length - a.length).map(escapeRegExp).join("|"), "g");
  return [...new Set(remaining.split(pattern).filter((part) => part.length >= 2))];
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function rankTexts(texts, query, k = null) {
  const list = (texts || []).filter(Boolean);
  if (!list.length) return [];
  const queryVec = hashEmbed(query);
  const keys = queryKeys(query);
  const ranked = list
    .map((text, index) => {
      const overlap = keys.filter((key) => String(text).includes(key)).length;
      const semantic = cosine(queryVec, hashEmbed(text));
      return { text, index, score: semantic + overlap * 0.4 };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((item) => item.text);
  if (k == null || k >= ranked.length) return ranked;
  return ranked.slice(0, k);
}

function isSecretMemory(memory) {
  return String(memory?.content || "").includes("秘密（不可对无权者透露）");
}

export { beliefsAboutPlayerRefresh as refreshPersonality };
