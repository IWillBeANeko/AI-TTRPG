import { Actor } from "./actor";
import { ActSystem } from "./acts";
import { frailFallbackAction, cardToState, loadCharacterCards, loadCharacters, loadLocations, migrateCharacterProfiles } from "./character";
import { CognitionSystem, refreshPersonality } from "./cognition";
import { getSettings } from "./config";
import { Director } from "./director";
import { KnowledgeStore } from "./knowledge";
import {
  ActionType,
  CharacterKind,
  FacingKind,
  MemoryKind,
  createCharacterAction,
  EventVisibility,
  newId,
  scoreTrajectory,
  timeClock,
  timeTick,
} from "./models";
import { Store } from "./persist";
import { SkillSystem } from "./skills";
import { attachEngineToContext, classifySituationForStrategy, compileExecutableStrategy } from "./strategy";
import { WorldEngine } from "./world";

export class GameSession {
  constructor({ settings = getSettings(), gameId = null } = {}) {
    this.settings = settings;
    this.store = new Store();
    this.game_id = gameId || `game_${newId("g").slice(2, 10)}`;
    const locations = loadLocations();
    const { cards, states } = loadCharacters();
    this.cards = cards;
    this.engine = new WorldEngine(locations, states);
    this.cognition = new CognitionSystem(this.engine, this.store, this.settings, this.game_id);
    this.knowledge = new KnowledgeStore();
    this.skills = new SkillSystem();
    this.director = new Director(this.engine);
    this.acts = new ActSystem(this.engine);
    this.actor = new Actor(this.settings, this.engine);
    this.persist_as_current = true;
    this.seedInitialMemories();
  }

  static loadLatest(settings = getSettings()) {
    const store = new Store();
    const gameId = store.currentId() || `game_${newId("g").slice(2, 10)}`;
    const session = new GameSession({ settings, gameId });
    const snapshot = store.loadSnapshot(session.game_id);
    if (snapshot) {
      session.engine.restore(snapshot);
      migrateCharacterProfiles(session.engine.characters);
      session.engine.events = store.listEvents(session.game_id);
      session.seedInitialMemories();
    }
    return session;
  }

  save(makeCurrent = null) {
    this.store.saveSnapshot(this.game_id, timeTick(this.engine.time), this.engine.snapshot());
    if (makeCurrent ?? this.persist_as_current) this.store.setCurrent(this.game_id);
  }

  look() {
    const player = this.engine.characters[this.engine.player_id];
    const location = this.engine.location(player.location_id);
    const names = this.engine
      .presentIds(player.location_id)
      .filter((cid) => cid !== player.id)
      .map((cid) => this.engine.characters[cid].name);
    const who = names.length ? names.join("、") : "没有别人";
    const exits = location.connections.map((cid) => `${this.engine.locations[cid].name}(${cid})`).join("、");
    return `【${location.name}】第${this.engine.time.day}天 ${timeClock(this.engine.time)}\n${location.description}\n在场：${who}\n出口：${exits || "无"}`;
  }

  view() {
    const player = this.engine.characters[this.engine.player_id];
    const location = this.engine.location(player.location_id);
    const presentIds = this.engine.presentIds(player.location_id);
    const present = presentIds.map((cid) => this.characterPublic(this.engine.characters[cid], true));
    const party = Object.values(this.engine.characters)
      .filter((character) => character.kind === CharacterKind.player || character.follow_player)
      .map((character) => this.characterPublic(character, character.location_id === player.location_id));
    const story = this.acts.actContext();
    return {
      game_id: this.game_id,
      look: this.look(),
      time: {
        day: this.engine.time.day,
        hour: this.engine.time.hour,
        minute: this.engine.time.minute,
        clock: timeClock(this.engine.time),
        tick: timeTick(this.engine.time),
      },
      location: {
        id: location.id,
        name: location.name,
        description: location.description,
        tags: location.tags,
      },
      present,
      party,
      exits: location.connections.map((lid) => ({ id: lid, name: this.engine.locations[lid].name })),
      map: Object.values(this.engine.locations).map((loc) => ({
        id: loc.id,
        name: loc.name,
        connections: loc.connections,
        here: loc.id === player.location_id,
        reachable: location.connections.includes(loc.id),
        tags: loc.tags,
      })),
      log: this.visibleLog(),
      uses_llm: getSettings().usesLlm,
      model: getSettings().usesLlm ? getSettings().model : "",
      story,
    };
  }

  visibleLog(limit = 80) {
    const events = this.store.listEvents(this.game_id);
    const source = events.length ? events : this.engine.visibleEvents(this.engine.player_id, limit);
    const log = [];
    for (const event of source) {
      if (!this.playerWitnessed(event)) continue;
      const actor = this.engine.characters[event.actor_id || ""];
      log.push({
        id: event.id,
        tick: event.tick,
        type: event.type,
        location_id: event.location_id,
        location_name: this.engine.locations[event.location_id]?.name || event.location_id,
        actor_id: event.actor_id,
        actor_name: actor?.name || null,
        text: event.text,
        speech: event.payload?.speech,
        action: event.payload?.action || event.payload?.physical,
        gesture: event.payload?.gesture,
        emotion: event.payload?.emotion || actor?.emotion,
        facing: event.payload?.facing,
        facing_id: event.payload?.facing_id,
      });
    }
    return log.slice(-limit);
  }

  memoriesView(characterId) {
    characterId = (characterId || "").trim();
    if (!this.engine.characters[characterId]) {
      const found = Object.values(this.engine.characters).find((c) => c.name === characterId);
      if (found) characterId = found.id;
    }
    if (!this.engine.characters[characterId]) return { ok: false, error: `找不到角色 ${characterId}` };
    const character = this.engine.characters[characterId];
    const player = this.engine.characters[this.engine.player_id];
    if (character.location_id !== player.location_id && !character.follow_player) {
      return { ok: false, error: `${character.name}不在你身边，无法回想共同经历。` };
    }
    const memories = this.cognition
      .loadCharacterMemories(characterId)
      .filter((memory) => !memory.content.startsWith("秘密（不可对无权者透露）"))
      .slice(-24);
    return {
      ok: true,
      character_id: character.id,
      name: character.name,
      memories: memories.map((memory) => ({
        kind: memory.kind,
        importance: memory.importance,
        tick: memory.tick,
        content: memory.content,
      })),
    };
  }

  characterPublic(character, here) {
    const playerId = this.engine.player_id;
    const rel = character.relationships?.[playerId];
    const attitude = rel
      ? Math.round((rel.trust + 0.5) * 40 + rel.affection * 30 - rel.fear * 20)
      : 0;
    let attitudeLabel = "中立";
    if (attitude >= 35) attitudeLabel = "信任";
    else if (attitude >= 15) attitudeLabel = "好奇";
    else if (attitude <= -25) attitudeLabel = "敌意";
    else if (attitude <= -5) attitudeLabel = "戒备";
    return {
      id: character.id,
      name: character.name,
      kind: character.kind,
      occupation: character.occupation,
      summary: character.summary,
      emotion: character.emotion,
      age: character.age,
      hp: character.hp,
      max_hp: character.max_hp,
      stamina: character.stamina,
      max_stamina: character.max_stamina,
      injuries: [...character.injuries],
      follow_player: character.follow_player,
      is_player: character.id === this.engine.player_id,
      here,
      attitude,
      attitude_label: attitudeLabel,
    };
  }

  playerWitnessed(event) {
    const playerId = this.engine.player_id;
    if (event.visibility === EventVisibility.public) return true;
    if (event.actor_id === playerId) return true;
    if ((event.witness_ids || []).includes(playerId)) return true;
    const payload = event.payload || {};
    return payload.address_id === playerId || payload.facing_id === playerId || payload.target_id === playerId;
  }

  status() {
    const lines = [`游戏 ${this.game_id}  时间 第${this.engine.time.day}天 ${timeClock(this.engine.time)}`];
    for (const character of Object.values(this.engine.characters)) {
      const flag = character.follow_player ? "跟随" : character.kind;
      const loc = this.engine.locations[character.location_id].name;
      const extra = character.evolved_notes.length ? `  变化:${character.evolved_notes.at(-1)}` : "";
      lines.push(
        `- ${character.name} [${flag}] @ ${loc}  ${character.age}岁/${character.life_stage}  HP ${character.hp}/${character.max_hp}  耐力 ${character.stamina}/${character.max_stamina}  情绪 ${character.emotion}${extra}`,
      );
    }
    return lines.join("\n");
  }

  async handle(raw) {
    raw = (raw || "").trim();
    if (!raw) return "……";
    const [command, ...restParts] = raw.split(" ");
    const rest = restParts.join(" ");
    const cmd = command.toLowerCase();
    if (["look", "看", "l"].includes(cmd)) return this.look();
    if (["status", "状态"].includes(cmd)) return this.status();
    if (["go", "去"].includes(cmd)) return this.playerGo(rest.trim());
    if (["say", "说"].includes(cmd)) return this.playerSay(rest.trim());
    if (["talk", "对"].includes(cmd)) return this.playerTalk(rest.trim());
    if (["act", "做"].includes(cmd)) return this.playerAct(rest.trim());
    if (["wait", "等待"].includes(cmd)) return this.wait();
    if (["hurt", "伤"].includes(cmd)) return this.debugHurt(rest.trim());
    if (["memories", "记忆"].includes(cmd)) return this.showMemories(rest.trim());
    if (["help", "帮助"].includes(cmd)) return this.helpText();
    return this.playerSay(raw);
  }

  helpText() {
    return "命令：look / go <地点id> / say <话> / talk <角色id> <话> / act <动作> / wait / status / memories <角色id>\n调试：hurt <角色id>  [给该角色造成伤害以测试治疗与记忆]";
  }

  async playerGo(dest) {
    const aliases = Object.fromEntries(Object.values(this.engine.locations).map((loc) => [loc.name, loc.id]));
    const destination = aliases[dest] || dest;
    const result = this.engine.moveCharacter(this.engine.player_id, destination);
    if (!result.ok) return result.narrative;
    if (result.event) {
      this.store.addEvent(this.game_id, result.event);
      this.broadcast(result.event);
    }
    const parts = [result.narrative, this.look(), await this.runActors(result.event, null)];
    this.save();
    return parts.filter(Boolean).join("\n");
  }

  async playerSay(text, addressId = null) {
    const player = this.engine.characters[this.engine.player_id];
    if (!addressId) addressId = this.director.resolveCharacterRef(text);
    const action = createCharacterAction({
      character_id: player.id,
      speech: text,
      action_type: ActionType.speak,
      facing: addressId ? FacingKind.other : FacingKind.self,
      facing_id: addressId || null,
      target_id: addressId || null,
    });
    const result = this.engine.applyAction(action);
    if (result.event) {
      this.store.addEvent(this.game_id, result.event);
      this.broadcast(result.event);
    }
    const parts = [result.narrative, await this.runActors(result.event, addressId)];
    this.save();
    return parts.filter(Boolean).join("\n");
  }

  async playerTalk(rest) {
    const [targetToken, ...textParts] = rest.split(" ");
    let targetId = targetToken;
    const resolved = this.director.resolveCharacterRef(targetId, false);
    if (resolved) targetId = resolved;
    if (!this.engine.characters[targetId]) return `找不到角色 ${targetId}`;
    return this.playerSay(textParts.join(" ").trim() || "……", targetId);
  }

  async playerAct(text) {
    const player = this.engine.characters[this.engine.player_id];
    const action = createCharacterAction({
      character_id: player.id,
      action: text,
      action_type: ActionType.interact,
    });
    const result = this.engine.applyAction(action);
    if (result.event) {
      this.store.addEvent(this.game_id, result.event);
      this.broadcast(result.event);
    }
    const parts = [result.narrative, await this.runActors(result.event)];
    this.save();
    return parts.filter(Boolean).join("\n");
  }

  async wait(minutes = 30) {
    const events = this.engine.advanceWorldTime(minutes);
    for (const event of events) {
      this.store.addEvent(this.game_id, event);
      this.broadcast(event);
    }
    const last = events.at(-1) || null;
    const parts = [`时间推进 ${minutes} 分钟。第${this.engine.time.day}天 ${timeClock(this.engine.time)}`, await this.runActors(last)];
    this.save();
    return parts.filter(Boolean).join("\n");
  }

  async debugHurt(targetId) {
    targetId = (targetId || "").trim() || this.engine.player_id;
    if (!this.engine.characters[targetId]) {
      const found = Object.values(this.engine.characters).find((c) => c.name === targetId);
      if (found) targetId = found.id;
    }
    const event = this.engine.dealDamage(targetId, 4, null);
    this.store.addEvent(this.game_id, event);
    this.broadcast(event);
    const parts = [event.text, await this.runActors(event)];
    this.save();
    return parts.filter(Boolean).join("\n");
  }

  showMemories(characterId) {
    characterId = (characterId || "").trim();
    if (!characterId) return "用法：memories <角色id>";
    if (!this.engine.characters[characterId]) {
      const found = Object.values(this.engine.characters).find((c) => c.name === characterId);
      if (found) characterId = found.id;
    }
    const memories = this.cognition.loadCharacterMemories(characterId);
    if (!memories.length) return `${characterId} 尚无记忆。`;
    const lines = [`${this.engine.characters[characterId].name} 的记忆（${memories.length}）：`];
    for (const memory of memories.slice(-20)) {
      lines.push(`- [${memory.kind} i=${memory.importance.toFixed(2)} t=${memory.tick}] ${memory.content}`);
    }
    return lines.join("\n");
  }

  async runActors(triggering, playerAddressed = null) {
    if (!triggering) return "";
    const actorIds = this.director.whoShouldAct(triggering, playerAddressed);
    if (!playerAddressed && triggering.type === "spoke") {
      playerAddressed = this.director.resolveCharacterRef((triggering.payload || {}).speech || "");
    }
    const turns = [];
    for (const characterId of actorIds) {
      const character = this.engine.characters[characterId];
      if (character.kind === CharacterKind.player || character.hp <= 0) continue;
      const visible = this.knowledge.visibleFor(this.engine, character);
      const forbidden = this.knowledge.forbiddenFacts(this.engine, character);
      const situation = `${triggering.text} ${character.current_activity} ${character.occupation}`;
      const context = this.cognition.buildContext(characterId, triggering.text, visible, []);
      attachEngineToContext(context, this.engine);
      this.attachDialogue(context, characterId, triggering);
      const query = context.triggering_speech || triggering.text;
      if (query) {
        context.memories = this.cognition.retrieve(characterId, query);
        context.visible_knowledge = this.cognition.rankTexts(visible, query);
      }
      const actContext = this.acts.actContext();
      const actStrategy = this.acts.characterStrategy(characterId);
      const situationKind = classifySituationForStrategy(triggering.text);
      const executable = compileExecutableStrategy(character, actContext, actStrategy, context, situationKind);
      context.act = actContext;
      context.executable_strategy = executable;
      context.forbidden_topics = executable.must_not_say;
      context.skill_hints = this.skills.hintsFor(character, situation, {
        actId: actContext.act_id,
        stepIntent: executable.step_intent,
        unlockIds: executable.unlock_skills,
      });
      context.must_reply = characterId === playerAddressed;
      turns.push({ characterId, context, forbidden });
    }

    const actions = {};
    await Promise.all(
      turns.map(async ({ characterId, context }) => {
        actions[characterId] = await this.actor.decide(this.engine.characters[characterId], context);
      }),
    );

    const narratives = [];
    for (const { characterId, context, forbidden } of turns) {
      const narrative = this.applyCharacterAction(characterId, context, actions[characterId], forbidden);
      if (narrative) narratives.push(narrative);
      this.cognition.maybeReflect(characterId);
    }
    return narratives.join("\n");
  }

  applyCharacterAction(characterId, context, action, forbidden) {
    const character = this.engine.characters[characterId];
    const leaks = this.director.checkOmniscience(
      character,
      `${action.speech || ""} ${action.action || ""} ${action.gesture || ""}`,
      forbidden,
    );
    if (leaks.length) {
      action.speech = `${action.speech || ""}……有些事我并不清楚。`;
      action.inner_thought = `全知拦截：试图提及 ${leaks[0].slice(0, 20)}`;
      action.memory_to_save = action.memory_to_save || "有人问起我不知道的事";
    }

    const violations = this.director.checkConstitution(
      character,
      action.speech || "",
      `${action.gesture || ""} ${action.action || ""}`,
    );
    if (violations.length && character.follow_player) {
      action.action_type = ActionType.wait;
      action.destination = null;
      action.speech = action.speech || "我不走。还有人需要我。";
    }

    const capability = this.director.checkCapability(character, action);
    if (capability.length) {
      if (action.action_type === ActionType.attack) {
        action.action_type = ActionType.speak;
        action.target_id = null;
      }
      action.action = frailFallbackAction(character);
      action.inner_thought = `身体不允许：${capability[0]}`;
    }

    if (character.follow_player && action.destination) {
      const playerLoc = this.engine.characters[this.engine.player_id].location_id;
      if (action.destination !== playerLoc && !character.separated) {
        action.action_type = ActionType.wait;
        action.destination = null;
      }
    }

    const resolution = this.engine.applyAction(action);
    if (resolution.event) {
      this.store.addEvent(this.game_id, resolution.event);
      this.broadcast(resolution.event);
    }
    if (action.memory_to_save) this.cognition.remember(characterId, action.memory_to_save);

    if (action.relationship_deltas?.length) this.acts.refreshTrustFlags();

    this.store.addTrajectory({
      game_id: this.game_id,
      character_id: characterId,
      tick: timeTick(this.engine.time),
      action: {
        speech: action.speech,
        action: action.action,
        action_type: action.action_type,
      },
      feedback: {
        ok: resolution.ok,
        reason: resolution.reason,
        narrative: resolution.narrative,
      },
      scores: scoreTrajectory(leaks, violations, resolution.ok),
    });

    if (resolution.ok && action.action_type === "help") {
      this.skills.learn({
        id: `help_${characterId}`,
        name: `${character.name}的急救`,
        description: "在同伴受伤时立即治疗",
        when: "受伤 治疗 倒下",
        steps: ["靠近", "包扎", "安抚"],
        owner_id: characterId,
        tags: ["治疗", "保护"],
        success_count: 0,
      });
    }
    return resolution.narrative;
  }

  broadcast(event) {
    this.acts.processEvent(event);
    for (const characterId of Object.keys(this.engine.characters)) {
      this.cognition.observeEvent(characterId, event);
      const listener = this.engine.characters[characterId];
      const learned = this.knowledge.tryTeach(this.engine, listener, event.actor_id, event.text);
      if (learned.length) {
        this.cognition.remember(characterId, `从他人处得知：${learned[0].slice(0, 80)}`, { importance: 0.9 });
      }
      refreshPersonality(listener, this.engine.player_id);
    }
    this.acts.refreshTrustFlags();
  }

  attachDialogue(context, characterId, triggering) {
    const player = this.engine.characters[this.engine.player_id];
    const speech = String((triggering.payload || {}).speech || "").trim();
    context.triggering_speech = speech;
    context.triggering_type = triggering.type;
    context.triggering_actor_id = triggering.actor_id;
    context.player_name = player?.name || "时隙行者";
    context.dialogue_turns = this.collectDialogueTurns(characterId);
  }

  collectDialogueTurns(characterId) {
    const self = this.engine.characters[characterId];
    const playerId = this.engine.player_id;
    const playerName = this.engine.characters[playerId]?.name || "时隙行者";
    const turns = [];
    for (const event of this.allDialogueEvents()) {
      const text = String((event.payload || {}).speech || "").trim();
      if (!text) continue;
      if (event.actor_id === characterId) {
        turns.push({
          role: "assistant",
          sender_type: "BOT",
          sender_name: self?.name || event.actor_id,
          speaker_id: characterId,
          text,
        });
        continue;
      }
      if (event.actor_id !== playerId) continue;
      if (!this.playerLineFor(characterId, event)) continue;
      turns.push({
        role: "user",
        sender_type: "USER",
        sender_name: playerName,
        speaker_id: playerId,
        text,
      });
    }
    return turns;
  }

  playerLineFor(characterId, event) {
    const payload = event.payload || {};
    const addressed = payload.address_id || payload.facing_id || payload.target_id;
    if (addressed) return addressed === characterId;
    return this.engine.canPerceive(characterId, event);
  }

  allDialogueEvents() {
    const stored = this.store.listEvents(this.game_id);
    const live = this.engine.events || [];
    const seen = new Set();
    const events = [];
    for (const event of [...live, ...stored]) {
      if (!event || event.type !== "spoke") continue;
      const key = event.id || `${event.tick}:${event.seq ?? ""}:${event.actor_id}:${event.payload?.speech || ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      events.push(event);
    }
    events.sort((a, b) => (a.tick - b.tick) || ((a.seq ?? 0) - (b.seq ?? 0)));
    return events;
  }

  seedInitialMemories() {
    const cards = Object.fromEntries(loadCharacterCards().map((card) => [card.id, card]));
    for (const character of Object.values(this.engine.characters)) {
      if (this.store.listMemories(this.game_id, character.id).length) continue;
      const card = cards[character.id];
      if (!card) continue;
      for (const text of card.initial_memories || []) {
        this.cognition.remember(character.id, text, { importance: 0.7 });
      }
      for (const secret of character.secrets) {
        this.cognition.remember(character.id, `秘密（不可对无权者透露）：${secret}`, { importance: 0.9 });
      }
    }
  }
}

export function toCommand({ text = "", action = "", target = "" } = {}) {
  if (action) {
    const act = action.trim().toLowerCase();
    const tgt = (target || "").trim();
    const body = (text || "").trim();
    if (["go", "去"].includes(act)) return `go ${tgt}`;
    if (["talk", "对"].includes(act)) return `talk ${tgt} ${body}`.trim();
    if (["say", "说"].includes(act)) return `say ${body}`;
    if (["act", "做"].includes(act)) return `act ${body}`;
    if (["wait", "等待"].includes(act)) return "wait";
    if (["look", "看"].includes(act)) return "look";
    if (["status", "状态"].includes(act)) return "status";
    if (["hurt", "伤"].includes(act)) return `hurt ${tgt || "player"}`;
    if (body) return `${act} ${tgt} ${body}`.trim();
    return act;
  }
  return (text || "").trim();
}

let currentSession = null;

export function getCurrentSession() {
  if (currentSession) return currentSession;
  const store = new Store();
  if (store.currentId()) {
    currentSession = GameSession.loadLatest();
    return currentSession;
  }
  return null;
}

export function requireSession() {
  const session = getCurrentSession();
  if (!session) throw new Error("还没有进行中的旅程");
  return session;
}

export function bootstrap() {
  const settings = getSettings();
  const store = new Store();
  const currentId = store.currentId();
  return {
    has_current: Boolean(currentId),
    current_id: currentId,
    saves: store.listGames(),
    uses_llm: settings.usesLlm,
    model: settings.usesLlm ? settings.model : "",
  };
}

export async function newGame() {
  const session = new GameSession();
  session.save();
  currentSession = session;
  return { output: session.look(), state: session.view() };
}

export async function loadGame(gameId) {
  const store = new Store();
  const snapshot = store.loadSnapshot(gameId);
  if (!snapshot) throw new Error("找不到这份存档");
  const session = new GameSession({ gameId });
  session.engine.restore(snapshot);
  migrateCharacterProfiles(session.engine.characters);
  session.engine.events = store.listEvents(gameId);
  session.seedInitialMemories();
  session.save(true);
  currentSession = session;
  return { output: session.look(), state: session.view() };
}

export function saveGame() {
  const session = requireSession();
  session.save();
  return { ok: true, game_id: session.game_id };
}

export function getState() {
  return requireSession().view();
}

export async function runCommand(body) {
  const raw = toCommand(body);
  if (!raw) throw new Error("请输入要做的事");
  const session = requireSession();
  const output = await session.handle(raw);
  return { output, state: session.view() };
}

export function getConversation(characterId) {
  return requireSession().collectDialogueTurns(characterId).map((turn) => ({
    who: turn.sender_type === "BOT" ? "bot" : "me",
    text: turn.text,
  }));
}

export function getMemories(characterId) {
  const result = requireSession().memoriesView(characterId);
  if (!result.ok) throw new Error(result.error || "无法查看记忆");
  return result;
}

export function rememberPlayerFact(content) {
  try {
    const session = getCurrentSession();
    if (!session) return;
    const text = String(content || "").trim();
    if (!text) return;
    session.cognition.remember(session.engine.player_id, text, {
      kind: MemoryKind.fact,
      importance: 0.8,
    });
  } catch {
    /* 引擎可选 */
  }
}

export function listPlayerFacts() {
  try {
    const session = getCurrentSession();
    if (!session) return [];
    return session.cognition
      .loadCharacterMemories(session.engine.player_id)
      .map((memory) => memory.content)
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function setStoryAct(actId) {
  try {
    const session = getCurrentSession();
    if (!session?.engine?.story || !actId) return;
    session.engine.story.act_id = actId;
    session.save();
  } catch {
    /* 引擎可选 */
  }
}

export function applyPlayerSheet(sheet) {
  try {
    const session = getCurrentSession();
    if (!session || !sheet) return;
    const player = session.engine.characters[session.engine.player_id];
    if (!player) return;
    if (sheet.name) player.name = sheet.name.trim();
    if (sheet.gender) player.occupation = sheet.gender === "female" ? "时隙行者" : player.occupation || "时隙行者";
    if (sheet.traits?.length) {
      player.evolved_notes = [...(player.evolved_notes || []), `气质：${sheet.traits.join("、")}`].slice(-8);
    }
    if (sheet.personality?.headline || sheet.personality?.core || sheet.personality?.summary) {
      const brief = [sheet.personality.headline, sheet.personality.core || sheet.personality.summary].filter(Boolean).join("：");
      player.evolved_notes = [...(player.evolved_notes || []), `性格简报：${brief}`].slice(-8);
    }
    session.save();
  } catch {
    /* 引擎可选 */
  }
}

export function applyCompanionSheet(companion) {
  try {
    const session = getCurrentSession();
    if (!session || !companion) return;
    const player = session.engine.characters[session.engine.player_id];
    const attrLine = companion.attrs
      ? Object.entries(companion.attrs).map(([key, value]) => `${key}${value}`).join("、")
      : "";
    const mate = cardToState({
      id: "mate",
      name: companion.name,
      kind: "companion",
      follow_player: true,
      location: player?.location_id || "harbor",
      hp: 10,
      max_hp: 10,
      age: 26,
      stamina: 10,
      max_stamina: 10,
      emotion: "determined",
      occupation: companion.occupation || "同行者",
      summary: companion.story || "",
      constitution: {
        rules: ["按自己的来历与组织交代行事", "不替别人做终局选择", "说话像一个活人，不要像说明书"],
        decision_order: ["self_preserve", "protect_allies"],
        voice: "短句，带着自己未说完的事",
        taboos: ["不会声称自己是涌音、伊文或盐语者", "不会把玩家说成需要被补短板的人"],
      },
      cognition: {
        notice_first: ["自己要找的东西有没有线索", "眼前的人可不可信"],
        interpret_bias: "先用自己未了的事衡量这句话值不值得开口",
        when_uncertain: "先看，少下判断",
      },
      goals: [companion.reason || "把未了的事做完", companion.dispatch || "把组织交代的接应做完"],
      relationships: [
        { other_id: "player", trust: 0.55, affection: 0.25, note: companion.dispatch || "组织派我来接应，因为我们合得来" },
      ],
      beliefs: [],
      secrets: [],
      known_knowledge_ids: ["tide_harbor_lore", "aethervia_three_eras", "great_fracture_official"],
    });
    if (attrLine) mate.evolved_notes.push(`基础属性：${attrLine}`);
    if (companion.org) mate.evolved_notes.push(`所属：${companion.org}`);
    if (companion.intro) mate.evolved_notes.push(companion.intro);
    else if (companion.reason) mate.evolved_notes.push(companion.reason);
    session.engine.characters.mate = mate;
    session.save();
  } catch {
    /* 引擎可选 */
  }
}
