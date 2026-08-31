import { characterActStrategies, flagRules, storyActs, awakeningChoices } from "@/data/story-manifest";
import { relationshipWith } from "./models";

export function createStoryState(raw = {}) {
  const legacyMap = {
    act1_arrival: "act1_omens",
    act2_rumors: "act2_buried_records",
    act3_bridge: "act3_void_scheme",
    act4_cellar: "act5_requiem",
  };
  const actId = legacyMap[raw.act_id] || raw.act_id || storyActs[0]?.id || "act0_awakening";
  return {
    act_id: actId,
    flags: [...(raw.flags || [])],
  };
}

export class ActSystem {
  constructor(engine) {
    this.engine = engine;
    if (!engine.story) engine.story = createStoryState();
  }

  currentAct() {
    return storyActs.find((act) => act.id === this.engine.story.act_id) || storyActs[0];
  }

  hasFlag(flag) {
    return this.engine.story.flags.includes(flag);
  }

  setFlag(flag) {
    if (!flag || this.hasFlag(flag)) return false;
    this.engine.story.flags.push(flag);
    return true;
  }

  actContext() {
    const act = this.currentAct();
    return {
      act_id: act.id,
      title: act.title,
      subtitle: act.subtitle || "",
      summary: act.summary,
      narrative: act.narrative || act.summary,
      quote: act.quote || "",
      scene_label: act.scene_label || "",
      scene_coords: act.scene_coords || "",
      warning_banner: act.warning_banner || "",
      narrative_prompt: act.narrative_prompt || "",
      order: act.order,
      era: act.era || "dawn",
      ui_layout: act.ui_layout || "map_explore",
      ui_bg: act.ui_bg || "dawn_city",
      objectives: act.objectives || [],
      clue_fragments: (act.clue_fragments || []).map((clue) => ({
        ...clue,
        unlocked: this.hasFlag(clue.flag),
      })),
      missions: act.missions || [],
      decisions: act.decisions || [],
      eras: act.eras || [],
      endings: act.endings || [],
      awakening_choices: act.id === "act0_awakening" ? awakeningChoices : [],
      flags: [...this.engine.story.flags],
      loop: Math.max(1, act.order + 1),
      stability: this.timelineStability(),
      imprints_used: Math.min(5, this.engine.story.flags.length),
      imprints_max: 5,
    };
  }

  timelineStability() {
    const flags = this.engine.story.flags.length;
    const actOrder = this.currentAct().order || 0;
    return Math.max(18, Math.min(100, 92 - actOrder * 8 - flags * 2));
  }

  characterStrategy(characterId) {
    const actId = this.engine.story.act_id;
    const strategies = characterActStrategies[characterId] || {};
    const strategy = strategies[actId] || strategies[storyActs[0]?.id];
    if (!strategy) return null;
    if (strategy.extra_flags_required?.length) {
      const ok = strategy.extra_flags_required.every((flag) => this.hasFlag(flag));
      if (!ok) {
        return {
          ...strategy,
          goal_focus: `${strategy.goal_focus}（信任不足，仍保持克制）`,
          allowed_intents: strategy.allowed_intents.filter((intent) => intent !== "trade_info"),
          default_intent: strategy.default_intent === "trade_info" ? "probe" : strategy.default_intent,
        };
      }
    }
    return { ...strategy };
  }

  processEvent(event) {
    if (!event) return [];
    const gained = [];
    for (const rule of flagRules) {
      if (this.hasFlag(rule.flag)) continue;
      if (rule.when_text?.length) {
        const text = `${event.text || ""} ${event.payload?.speech || ""}`;
        if (!rule.when_text.some((marker) => text.includes(marker))) continue;
        if (rule.actor === "player" && event.actor_id !== this.engine.player_id) continue;
      }
      if (rule.when_location) {
        const player = this.engine.characters[this.engine.player_id];
        if (player.location_id !== rule.when_location) continue;
      }
      if (rule.when_trust) {
        const { character_id: cid, other_id: oid, min } = rule.when_trust;
        const character = this.engine.characters[cid];
        if (!character) continue;
        const rel = relationshipWith(character, oid);
        if (rel.trust < min) continue;
      }
      if (this.setFlag(rule.flag)) gained.push(rule.flag);
    }
    this.maybeAdvanceAct();
    return gained;
  }

  refreshTrustFlags() {
    const gained = [];
    for (const rule of flagRules) {
      if (!rule.when_trust || this.hasFlag(rule.flag)) continue;
      const { character_id: cid, other_id: oid, min } = rule.when_trust;
      const character = this.engine.characters[cid];
      if (!character) continue;
      const rel = relationshipWith(character, oid);
      if (rel.trust >= min && this.setFlag(rule.flag)) gained.push(rule.flag);
    }
    if (gained.length) this.maybeAdvanceAct();
    return gained;
  }

  maybeAdvanceAct() {
    const act = this.currentAct();
    if (!act?.advance?.next) return false;
    const needed = act.advance.flags || [];
    if (!needed.length) return false;
    const ready = needed.some((flag) => this.hasFlag(flag));
    if (!ready) return false;
    this.engine.story.act_id = act.advance.next;
    return true;
  }
}

export function getActStrategy(characterId, actId) {
  return characterActStrategies[characterId]?.[actId] || null;
}
