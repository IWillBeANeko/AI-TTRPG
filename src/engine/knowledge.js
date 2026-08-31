import { knowledgeEntries } from "@/data/knowledge";
import { applyLearnedFact } from "./character";

export class KnowledgeStore {
  constructor() {
    this.entries = knowledgeEntries.map((item) => ({
      location_ids: [],
      character_ids: [],
      about_ids: [],
      tags: [],
      certainty: 0.5,
      actionable: false,
      ...item,
    }));
  }

  visibleFor(engine, character) {
    return this.entries.filter((entry) => this.allowed(engine, character, entry)).map((entry) => entry.content);
  }

  forbiddenFacts(engine, character) {
    const allowed = new Set(this.visibleFor(engine, character));
    const forbidden = [];
    for (const entry of this.entries) {
      if (allowed.has(entry.content)) continue;
      if (entry.visibility === "secret" || entry.visibility === "character") {
        if (this.alreadyLearned(character, entry.content)) continue;
        forbidden.push(entry.content);
      }
    }
    for (const other of Object.values(engine.characters)) {
      if (other.id === character.id) continue;
      for (const secret of other.secrets) {
        if (this.alreadyLearned(character, secret)) continue;
        forbidden.push(secret);
      }
    }
    return forbidden;
  }

  tryTeach(engine, listener, speakerId, text) {
    if (!text || speakerId === listener.id) return [];
    const learned = [];
    for (const entry of this.entries) {
      if (entry.visibility !== "secret" && entry.visibility !== "character") continue;
      if (this.allowed(engine, listener, entry) || this.alreadyLearned(listener, entry.content)) continue;
      if (!textContainsFact(text, entry.content)) continue;
      if (speakerId && !this.speakerKnows(engine, speakerId, entry.content)) continue;
      this.unlockEntry(listener, entry);
      learned.push(entry.content);
    }
    for (const other of Object.values(engine.characters)) {
      if (other.id === listener.id) continue;
      for (const secret of other.secrets) {
        if (this.alreadyLearned(listener, secret)) continue;
        if (!textContainsFact(text, secret)) continue;
        if (speakerId && !this.speakerKnows(engine, speakerId, secret)) continue;
        applyLearnedFact(listener, secret, {
          aboutIds: [other.id],
          actionable: true,
          certainty: 0.85,
          entryId: `secret_${other.id}`,
        });
        learned.push(secret);
      }
    }
    return learned;
  }

  unlockEntry(listener, entry) {
    if (!listener.known_knowledge_ids.includes(entry.id)) listener.known_knowledge_ids.push(entry.id);
    applyLearnedFact(listener, entry.content, {
      aboutIds: [...(entry.about_ids || [])],
      actionable: entry.actionable || (entry.tags || []).some((tag) => ["hostile", "enemy", "secret"].includes(tag)),
      certainty: entry.certainty,
      entryId: entry.id,
    });
  }

  speakerKnows(engine, speakerId, fact) {
    if (speakerId === engine.player_id) return true;
    const speaker = engine.characters[speakerId];
    if (!speaker) return false;
    if (speaker.secrets.includes(fact) || this.alreadyLearned(speaker, fact)) return true;
    return this.visibleFor(engine, speaker).includes(fact);
  }

  alreadyLearned(character, fact) {
    if (character.learned_facts.includes(fact)) return true;
    const needle = fact.replace(/\s/g, "").slice(0, 12);
    if (!needle) return false;
    return character.learned_facts.some((item) => item.replace(/\s/g, "").includes(needle));
  }

  allowed(engine, character, entry) {
    if (character.known_knowledge_ids.includes(entry.id)) return true;
    if (entry.visibility === "world") return true;
    if (entry.visibility === "location") return (entry.location_ids || []).includes(character.location_id);
    if (entry.visibility === "character" || entry.visibility === "secret") {
      return (entry.character_ids || []).includes(character.id);
    }
    return false;
  }
}

function textContainsFact(text, fact) {
  const compact = text.replace(/\s/g, "");
  const needle = fact.replace(/\s/g, "");
  if (needle.length < 6) return false;
  if (compact.includes(needle.slice(0, 12))) return true;
  const keys = fact.replace(/[，。、]/g, "|").split("|").filter((part) => part.length >= 2);
  return keys.length > 0 && keys.slice(0, 2).every((key) => compact.includes(key));
}
