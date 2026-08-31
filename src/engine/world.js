import { composeReactionNarrative, hasReactionModules, reactionPayload } from "./reaction";
import { createStoryState } from "./acts";
import { isFrail } from "./character";
import {
  ActionType,
  CharacterKind,
  EventVisibility,
  LifeStage,
  createGameTime,
  createWorldEvent,
  newId,
  relationshipWith,
  timeClock,
  timeTick,
  advanceTime,
} from "./models";

function clamp(value, low = -1, high = 1) {
  return Math.max(low, Math.min(high, value));
}

export function currentSchedule(character, clock) {
  for (const block of character.schedule || []) {
    if (inTimeRange(clock, block.start, block.end)) return block;
  }
  return null;
}

function inTimeRange(clock, start, end) {
  if (start <= end) return clock >= start && clock < end;
  return clock >= start || clock < end;
}

function findPlayerId(characters) {
  for (const character of Object.values(characters)) {
    if (character.kind === CharacterKind.player) return character.id;
  }
  throw new Error("世界中缺少玩家角色");
}

export class WorldEngine {
  constructor(locations, characters) {
    this.locations = locations;
    this.characters = characters;
    this.time = createGameTime();
    this.events = [];
    this.player_id = findPlayerId(characters);
    this.story = createStoryState();
  }

  snapshot() {
    return {
      time: { ...this.time },
      characters: structuredClone(this.characters),
      player_id: this.player_id,
      story: createStoryState(this.story || {}),
    };
  }

  restore(data) {
    this.time = createGameTime(data.time || {});
    this.characters = structuredClone(data.characters);
    if (data.locations) this.locations = structuredClone(data.locations);
    this.player_id = data.player_id || findPlayerId(this.characters);
    this.story = createStoryState(data.story || {});
  }

  presentIds(locationId) {
    return Object.values(this.characters)
      .filter((c) => c.location_id === locationId && c.hp > 0)
      .map((c) => c.id);
  }

  location(locationId) {
    if (!this.locations[locationId]) throw new Error(`未知地点: ${locationId}`);
    return this.locations[locationId];
  }

  emit(event) {
    if (!event.witness_ids?.length) event.witness_ids = this.defaultWitnesses(event);
    this.events.push(event);
    return event;
  }

  visibleEvents(characterId, limit = 12) {
    return this.events.filter((event) => this.canPerceive(characterId, event)).slice(-limit);
  }

  canPerceive(characterId, event) {
    const character = this.characters[characterId];
    if (event.visibility === EventVisibility.private) {
      return characterId === event.actor_id || event.witness_ids.includes(characterId);
    }
    if (event.visibility === EventVisibility.public) return true;
    if (event.witness_ids.includes(characterId)) return true;
    return character.location_id === event.location_id;
  }

  advanceWorldTime(minutes) {
    this.time = advanceTime(this.time, minutes);
    const events = [
      this.emit(
        createWorldEvent({
          id: newId("evt"),
          tick: timeTick(this.time),
          type: "time_advanced",
          location_id: this.characters[this.player_id].location_id,
          payload: { minutes, clock: timeClock(this.time), day: this.time.day },
          visibility: EventVisibility.public,
          text: `时间来到第${this.time.day}天 ${timeClock(this.time)}`,
        }),
      ),
    ];
    events.push(...this.applySchedules());
    return events;
  }

  moveCharacter(characterId, destination, voluntary = true) {
    const character = this.characters[characterId];
    if (!this.locations[destination]) {
      return { ok: false, reason: "地点不存在", narrative: `没有叫「${destination}」的地方。` };
    }
    const current = this.locations[character.location_id];
    if (destination !== character.location_id && !current.connections.includes(destination)) {
      return {
        ok: false,
        reason: "不相邻",
        narrative: `${character.name}无法从${current.name}直接去${this.locations[destination].name}。`,
      };
    }
    const old = character.location_id;
    character.location_id = destination;
    const followers = [];
    if (character.kind === CharacterKind.player) {
      for (const other of Object.values(this.characters)) {
        if (other.follow_player && !other.separated && other.hp > 0) {
          other.location_id = destination;
          followers.push(other.id);
        }
      }
    }
    const dest = this.locations[destination];
    let text = `${character.name}前往${dest.name}`;
    if (followers.length) {
      text += `，${followers.map((fid) => this.characters[fid].name).join("、")}跟随而来`;
    }
    const event = this.emit(
      createWorldEvent({
        id: newId("evt"),
        tick: timeTick(this.time),
        type: "moved",
        location_id: destination,
        actor_id: characterId,
        payload: { from: old, to: destination, followers, voluntary },
        witness_ids: [...new Set([...this.presentIds(old), ...this.presentIds(destination)])],
        text: `${text}。`,
      }),
    );
    return { ok: true, narrative: event.text, world_changed: true, event };
  }

  applyAction(action) {
    const character = this.characters[action.character_id];
    character.emotion = action.emotion || character.emotion;
    this.applyRelationshipDeltas(action);

    if (action.action_type === ActionType.move && action.destination) {
      const resolution = this.moveCharacter(character.id, action.destination);
      if (action.speech) {
        const speak = this.speak(character, action);
        resolution.narrative = `${speak.narrative} ${resolution.narrative}`.trim();
      }
      return resolution;
    }
    if (action.action_type === ActionType.help && action.target_id) return this.help(character, action);
    if (action.action_type === ActionType.attack && action.target_id) return this.attack(character, action);
    if (action.speech) return this.speak(character, action);
    if (action.action || action.gesture || hasReactionModules(action)) {
      const text = this.compose(character, action);
      const event = this.emit(
        createWorldEvent({
          id: newId("evt"),
          tick: timeTick(this.time),
          type: "acted",
          location_id: character.location_id,
          actor_id: character.id,
          payload: reactionPayload(action),
          text,
        }),
      );
      return { ok: true, narrative: event.text, world_changed: true, event };
    }
    const event = this.emit(
      createWorldEvent({
        id: newId("evt"),
        tick: timeTick(this.time),
        type: "waited",
        location_id: character.location_id,
        actor_id: character.id,
        text: `${character.name}暂且观望。`,
      }),
    );
    return { ok: true, narrative: event.text, event };
  }

  dealDamage(targetId, amount, sourceId = null) {
    const target = this.characters[targetId];
    target.hp = Math.max(0, target.hp - amount);
    target.stamina = Math.max(0, target.stamina - amount);
    if (amount >= 3 && !target.injuries.includes("新伤隐痛")) {
      target.injuries.push("新伤隐痛");
      target.injuries = target.injuries.slice(-4);
    }
    let text = `${target.name}受到${amount}点伤害（剩余${target.hp}/${target.max_hp}）`;
    if (target.hp === 0) text += `，${target.name}倒下了`;
    return this.emit(
      createWorldEvent({
        id: newId("evt"),
        tick: timeTick(this.time),
        type: "damaged",
        location_id: target.location_id,
        actor_id: sourceId,
        payload: { target: targetId, amount, hp: target.hp },
        text: `${text}。`,
      }),
    );
  }

  heal(targetId, amount, sourceId = null) {
    const target = this.characters[targetId];
    target.hp = Math.min(target.max_hp, target.hp + amount);
    target.stamina = Math.min(target.max_stamina, target.stamina + amount);
    const sourceName = sourceId ? this.characters[sourceId].name : "有人";
    return this.emit(
      createWorldEvent({
        id: newId("evt"),
        tick: timeTick(this.time),
        type: "healed",
        location_id: target.location_id,
        actor_id: sourceId,
        payload: { target: targetId, amount, hp: target.hp },
        text: `${sourceName}为${target.name}恢复了${amount}点生命（${target.hp}/${target.max_hp}）。`,
      }),
    );
  }

  namesAt(locationId) {
    const names = {};
    for (const cid of this.presentIds(locationId)) names[cid] = this.characters[cid].name;
    return names;
  }

  compose(character, action) {
    return composeReactionNarrative(character.name, action, this.namesAt(character.location_id));
  }

  speak(character, action) {
    const text = this.compose(character, action);
    const payload = reactionPayload(action);
    payload.speech = action.speech;
    const addressed = action.facing_id || action.target_id;
    if (addressed) payload.address_id = addressed;
    const witnesses = new Set(this.defaultWitnesses({ location_id: character.location_id, actor_id: character.id }));
    witnesses.add(this.player_id);
    if (addressed) witnesses.add(addressed);
    const event = this.emit(
      createWorldEvent({
        id: newId("evt"),
        tick: timeTick(this.time),
        type: "spoke",
        location_id: character.location_id,
        actor_id: character.id,
        payload,
        witness_ids: [...witnesses],
        text,
      }),
    );
    return { ok: true, narrative: text, world_changed: true, event };
  }

  help(character, action) {
    const target = this.characters[action.target_id || ""];
    if (!target) return { ok: false, reason: "目标不存在", narrative: "帮不到那个人。" };
    if (target.location_id !== character.location_id) {
      return { ok: false, reason: "不在场", narrative: `${target.name}不在这里。` };
    }
    const amount = (action.action || "治疗").includes("疗") || character.occupation === "治疗师" ? 3 : 1;
    const event = this.heal(target.id, amount, character.id);
    if (action.speech || hasReactionModules(action)) {
      const speak = this.speak(character, action);
      return { ok: true, narrative: `${speak.narrative} ${event.text}`, world_changed: true, event };
    }
    return { ok: true, narrative: event.text, world_changed: true, event };
  }

  attack(character, action) {
    const target = this.characters[action.target_id || ""];
    if (!target) return { ok: false, reason: "目标不存在", narrative: "攻击落空。" };
    if (target.location_id !== character.location_id) {
      return { ok: false, reason: "不在场", narrative: `${target.name}不在这里。` };
    }
    if (isFrail(character) || character.life_stage === LifeStage.elder) {
      return { ok: false, reason: "身体不允许进攻", narrative: `${character.name}抬手时晃了一下，没能攻出去。` };
    }
    const event = this.dealDamage(target.id, 2, character.id);
    const prefix =
      action.speech || hasReactionModules(action) ? `${this.compose(character, action)} ` : "";
    return {
      ok: true,
      narrative: `${prefix}${character.name}向${target.name}出手。${event.text}`,
      world_changed: true,
      event,
    };
  }

  applyRelationshipDeltas(action) {
    const character = this.characters[action.character_id];
    for (const delta of action.relationship_deltas || []) {
      const rel = relationshipWith(character, delta.other_id);
      rel.trust = clamp(rel.trust + (delta.trust || 0));
      rel.fear = clamp(rel.fear + (delta.fear || 0));
      rel.debt = clamp(rel.debt + (delta.debt || 0));
      rel.affection = clamp(rel.affection + (delta.affection || 0));
      if (delta.note) rel.note = delta.note;
    }
  }

  applySchedules() {
    const events = [];
    const clock = timeClock(this.time);
    for (const character of Object.values(this.characters)) {
      if (character.kind !== CharacterKind.npc || !character.schedule?.length) continue;
      if (this.player_id && character.location_id === this.characters[this.player_id].location_id) continue;
      const block = currentSchedule(character, clock);
      if (!block) continue;
      character.current_activity = block.activity;
      if (character.location_id !== block.location && this.locations[block.location]) {
        const result = this.moveCharacter(character.id, block.location, false);
        if (result.event) events.push(result.event);
      }
    }
    return events;
  }

  defaultWitnesses(event) {
    if (event.visibility === EventVisibility.public) return Object.keys(this.characters);
    const present = this.presentIds(event.location_id);
    if (event.actor_id && !present.includes(event.actor_id)) present.push(event.actor_id);
    return present;
  }
}
