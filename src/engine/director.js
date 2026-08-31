import { STRENUOUS_MARKERS, isFrail } from "./character";
import { ActionType, CharacterKind, LifeStage, Stance, relationshipWith } from "./models";
import { constitutionViolations } from "./skills";

const VOCATIVE_SPLIT = /[，,：:！!？?\s]+/;

const OCCUPATION_TITLES = {
  听涌先知: ["先知", "女先知"],
  神殿档案吏: ["档案吏", "书记"],
  深涌长老: ["长老", "议会长老"],
  港湾旧识: ["面包师", "烘炉"],
  教廷使者: ["使者", "教廷"],
};

const THREAT_SNIPPETS = ["抢劫", "打劫", "抢钱", "动手", "杀你", "杀掉", "杀死", "拔刀", "拿刀", "袭击", "交出来", "不许动"];

export class Director {
  constructor(engine) {
    this.engine = engine;
  }

  whoShouldAct(triggering, playerAddressed = null) {
    const player = this.engine.characters[this.engine.player_id];
    const present = triggering?.location_id
      ? this.engine.presentIds(triggering.location_id)
      : this.engine.presentIds(player.location_id);
    const presentChars = present.map((cid) => this.engine.characters[cid]);
    let addressed = playerAddressed;
    if (!addressed && triggering?.type === "spoke" && triggering.actor_id === player.id) {
      addressed = inferAddressee((triggering.payload || {}).speech || "", presentChars, player.id);
    }

    if (triggering && ["time_advanced", "moved"].includes(triggering.type)) {
      return present.filter((cid) => cid !== player.id && this.shouldWakeOnIdle(cid, triggering));
    }

    const threat = Boolean(triggering && looksLikeThreat(triggering.text));
    if (addressed && this.engine.characters[addressed]) {
      if (!threat) return [addressed];
      const ordered = [addressed];
      for (const cid of present) {
        const character = this.engine.characters[cid];
        if (character.kind !== CharacterKind.companion || ordered.includes(cid) || cid === player.id) continue;
        if (companionShouldIntervene(character, present, this.engine)) ordered.push(cid);
      }
      return ordered;
    }

    if (triggering?.type === "spoke" && !threat) {
      return present.filter((cid) => cid !== player.id && this.engine.characters[cid].kind === CharacterKind.npc);
    }

    const ordered = [];
    const companions = present.filter((cid) => this.engine.characters[cid].kind === CharacterKind.companion);
    const npcs = present.filter((cid) => this.engine.characters[cid].kind === CharacterKind.npc);
    for (const cid of [...companions, ...npcs]) {
      if (!ordered.includes(cid) && cid !== player.id) ordered.push(cid);
    }
    return ordered;
  }

  resolveCharacterRef(token, presentOnly = true) {
    token = (token || "").trim();
    if (!token) return null;
    if (this.engine.characters[token]) return token;
    const player = this.engine.characters[this.engine.player_id];
    const pool = presentOnly
      ? this.engine.presentIds(player.location_id).map((cid) => this.engine.characters[cid])
      : Object.values(this.engine.characters);
    return inferAddressee(token, pool, player.id);
  }

  checkOmniscience(character, text, forbidden) {
    const leaks = [];
    const compact = text.replace(/\s/g, "");
    for (const fact of forbidden) {
      const needle = fact.replace(/\s/g, "");
      if (needle.length < 6) continue;
      if (compact.includes(needle.slice(0, 12))) leaks.push(fact);
      else {
        const keys = contentKeys(fact).filter((part) => part.length >= 2);
        if (keys.length && keys.slice(0, 2).every((key) => compact.includes(key))) leaks.push(fact);
      }
    }
    return leaks;
  }

  checkConstitution(character, speech, action) {
    return constitutionViolations(character, speech, action);
  }

  checkCapability(character, action) {
    const hits = [];
    const frail = isFrail(character);
    const blob = `${action.action || ""}${action.speech || ""}${action.gesture || ""}`;
    if (action.action_type === ActionType.attack && (frail || character.life_stage === LifeStage.elder)) {
      hits.push("当前身体不允许主动进攻");
    }
    if (frail) {
      for (const marker of STRENUOUS_MARKERS) {
        if (blob.includes(marker)) {
          hits.push(`虚弱状态下不能「${marker}」`);
          break;
        }
      }
    }
    return hits;
  }

  shouldWakeOnIdle(characterId, event) {
    const character = this.engine.characters[characterId];
    if (character.kind === CharacterKind.companion) {
      return ["moved", "damaged", "healed"].includes(event.type) || character.hp < character.max_hp;
    }
    return event.type === "moved" && event.payload?.to === character.location_id;
  }
}

export function inferAddressee(text, present, playerId) {
  const spoken = (text || "").trim();
  if (!spoken) return null;
  const candidates = present.filter((character) => character.id !== playerId);
  if (!candidates.length) return null;
  const head = spoken.split(VOCATIVE_SPLIT)[0].replace(/[「」"']/g, "").trim();
  const hit = matchCharacter(head, candidates);
  if (hit) return hit;
  const scored = [];
  for (const character of candidates) {
    for (const alias of characterAliases(character)) {
      if (alias && spoken.includes(alias)) {
        scored.push([alias.length, character.id]);
        break;
      }
    }
  }
  if (!scored.length) return null;
  scored.sort((a, b) => b[0] - a[0]);
  const [bestLen, bestId] = scored[0];
  if (scored.slice(1).some(([length, cid]) => length === bestLen && cid !== bestId)) return null;
  return bestId;
}

export function characterAliases(character) {
  const aliases = [character.name, character.id];
  const occupation = character.occupation || "";
  if (occupation) aliases.push(occupation);
  aliases.push(...(OCCUPATION_TITLES[occupation] || []));
  if (occupation.endsWith("老板")) aliases.push("老板", "掌柜");
  const seen = [];
  for (const alias of aliases) {
    if (alias && alias.length >= 2 && !seen.includes(alias)) seen.push(alias);
  }
  return seen;
}

function matchCharacter(token, candidates) {
  if (!token || token.length < 2) return null;
  const hits = [];
  for (const character of candidates) {
    for (const alias of characterAliases(character)) {
      if (token === alias || (alias.endsWith(token) && alias.includes(token))) {
        hits.push(character.id);
        break;
      }
    }
  }
  const unique = [...new Set(hits)];
  return unique.length === 1 ? unique[0] : null;
}

function looksLikeThreat(text) {
  return THREAT_SNIPPETS.some((marker) => (text || "").includes(marker));
}

function companionShouldIntervene(character, present, engine) {
  for (const cid of present) {
    if (cid === character.id) continue;
    const other = engine.characters[cid];
    if (!other) continue;
    if (relationshipWith(character, cid).stance === Stance.hostile) return true;
  }
  return false;
}

function contentKeys(fact) {
  return fact.replace(/[，。；、 ]/g, "|").split("|").filter(Boolean);
}
