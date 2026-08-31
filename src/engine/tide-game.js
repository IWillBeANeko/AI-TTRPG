import { emptyPlayerSheet, SKILL_TO_ATTR, attrModifier } from "@/data/chargen";
import { emptyPlayLog } from "./play-log";
import { emptyMapStatus } from "./map-status";
import { emptyRift } from "./rift-event";

export const SKILL_MOD = {
  洞察: 2,
  潜行: 2,
  口才: 1,
  学识: 2,
  共情: 1,
  战斗: 1,
  仪式: 1,
};

export function skillModifier(skill, attrs, aid = 0) {
  if (!attrs) return (SKILL_MOD[skill] || 0) + aid;
  const attrName = SKILL_TO_ATTR[skill];
  if (!attrName) return (SKILL_MOD[skill] || 0) + aid;
  return attrModifier(attrs[attrName]) + aid;
}

export function createTideState(overrides = {}) {
  return {
    loop: 1,
    era: "dawn",
    stability: 87.3,
    paradoxLevel: 0,
    aidLevel: 60,
    screen: "A-1",
    act: 1,
    routeFlags: {},
    imprints: [],
    history: [],
    exploredRadar: [],
    fragments: {},
    echoSegments: {},
    ritualPairs: {},
    triAdv: { dawn: 0, glory: 0, end: 0 },
    suspicion: { yongyin: 2, ewen: 3, saltspeaker: 2, baker: 1, envoy: 4 },
    accused: null,
    memoryIntegrity: 72,
    branch: "current",
    paradoxMode: false,
    polluted: false,
    capture: false,
    churchPressure: 68,
    truthWeight: 32,
    awareness: 38,
    covers: [],
    runes: [0, 0, 0],
    anchorsUsed: 0,
    saveSlots: [],
    lastDice: null,
    sceneNote: "",
    playLog: emptyPlayLog(),
    mapStatus: emptyMapStatus(),
    rift: emptyRift(),
    player: emptyPlayerSheet(),
    companion: null,
    location: "square",
    npcs: {
      yongyin: { id: "yongyin", name: "涌音", role: "听涌先知", attitude: "neutral", trust: 40 },
      ewen: { id: "ewen", name: "伊文", role: "档案吏", attitude: "wary", trust: 22 },
      saltspeaker: { id: "saltspeaker", name: "盐语者", role: "深涌长老", attitude: "neutral", trust: 18 },
      baker: { id: "baker", name: "面包师", role: "港湾旧识", attitude: "friendly", trust: 48 },
      envoy: { id: "envoy", name: "维斯坎特", role: "教廷使者", attitude: "hostile", trust: 8 },
    },
    ...overrides,
  };
}

export function rollCheck({ skill = "洞察", dc = 12, aid = 0, advantage = false, attrs = null } = {}) {
  const r1 = 1 + Math.floor(Math.random() * 20);
  const r2 = advantage ? 1 + Math.floor(Math.random() * 20) : r1;
  const roll = Math.max(r1, r2);
  const mod = skillModifier(skill, attrs, aid);
  const total = roll + mod;
  const crit = roll === 20;
  const fumble = roll === 1;
  const success = crit || (!fumble && total >= dc);
  let state = "success";
  if (crit) state = "crit";
  else if (fumble) state = "fumble";
  else if (!success) state = "fail";
  return { roll, roll2: r2, mod, total, dc, skill, crit, fumble, success, state, aid };
}

export function applyDiceToStability(state, dice) {
  const next = { ...state, lastDice: dice, history: [...state.history, { t: Date.now(), dice, screen: state.screen }] };
  let delta = 0;
  if (dice.state === "crit") delta = 5;
  else if (dice.state === "fail") delta = -8;
  else if (dice.state === "fumble") delta = -15;
  next.stability = clamp(next.stability + delta, 0, 100);
  if (next.stability <= 0) next.routeFlags = { ...next.routeFlags, collapse: true };
  return next;
}

export function addImprint(state, type, trigger, consequence) {
  const imprint = {
    id: `imp_${state.imprints.length + 1}`,
    type,
    trigger,
    consequence,
    loopCreated: state.loop,
    permanent: type === "anchor",
  };
  const next = { ...state, imprints: [...state.imprints, imprint] };
  if (type === "butterfly") next.stability = clamp(next.stability - 10, 0, 100);
  return next;
}

export function nextFromChoice(state, choice) {
  let next = { ...state, routeFlags: { ...state.routeFlags } };
  if (choice.flag) next.routeFlags[choice.flag] = true;
  if (choice.attemptFlag) next.routeFlags[choice.attemptFlag] = true;
  if (choice.flags?.length) {
    for (const id of choice.flags) next.routeFlags[id] = true;
  }
  if (choice.note) next.sceneNote = choice.note;
  if (choice.imprint) {
    next = addImprint(next, choice.imprint, choice.label || choice.id, choice.imprintText || choice.label);
  }
  if (choice.npc) {
    const npc = { ...next.npcs[choice.npc] };
    if (choice.attitude) npc.attitude = choice.attitude;
    if (typeof choice.trustDelta === "number") npc.trust = clamp((npc.trust || 0) + choice.trustDelta, 0, 100);
    next.npcs = { ...next.npcs, [choice.npc]: npc };
  }
  if (choice.stability) next.stability = clamp(next.stability + choice.stability, 0, 100);
  if (choice.aid) next.aidLevel = clamp(next.aidLevel + choice.aid, 0, 130);
  if (choice.pressure) next.churchPressure = clamp(next.churchPressure + choice.pressure, 0, 100);
  if (choice.truth) next.truthWeight = clamp(next.truthWeight + choice.truth, 0, 100);
  if (choice.paradox) next.paradoxLevel = clamp(next.paradoxLevel + choice.paradox, 0, 100);
  if (choice.polluted) next.polluted = true;
  if (choice.go) next.location = choice.go;
  if (choice.note) next.sceneNote = choice.note;
  else if (choice.go) next.sceneNote = "";
  if (choice.goto) next.screen = resolveGoto(next, choice.goto);
  next.act = actForScreen(next.screen);
  next.era = eraForScreen(next.screen);
  return maybeInsertTwist(next);
}

function resolveGoto(state, goto) {
  if (goto === "B-3or4") return state.routeFlags.stealthPath ? "B-3" : "B-4";
  if (goto === "B-4or5") return state.capture || state.routeFlags.forcedChurch ? "B-4" : "B-5";
  if (goto === "ending") return pickEnding(state);
  return goto;
}

export function pickEnding(state) {
  if (state.stability <= 0 || state.paradoxLevel >= 50) return "D-2";
  if (state.routeFlags.forkSeen && state.imprints.length >= 6) return "D-3";
  if (state.stability >= 60 && state.routeFlags.act4done) return "D-1";
  if (state.stability >= 60) return "D-1";
  return "D-2";
}

function maybeInsertTwist(state) {
  const hostile = Object.values(state.npcs).filter((n) => n.attitude === "hostile").length;
  if (state.screen === "B-2" && hostile >= 2 && !state.routeFlags.twistTraitor) {
    return { ...state, screen: "C-1", routeFlags: { ...state.routeFlags, twistTraitor: true } };
  }
  if (state.anchorsUsed >= 2 && state.screen === "B-5" && !state.routeFlags.twistAnchor) {
    return { ...state, screen: "C-2", routeFlags: { ...state.routeFlags, twistAnchor: true } };
  }
  if (state.routeFlags.ritualKnown && !state.routeFlags.twistFork && state.screen === "B-7") {
    return { ...state, screen: "C-3", routeFlags: { ...state.routeFlags, twistFork: true, forkSeen: true } };
  }
  if (state.stability < 40 && !state.routeFlags.twistParadox && ["B-7", "B-8"].includes(state.screen)) {
    return { ...state, screen: "C-4", routeFlags: { ...state.routeFlags, twistParadox: true } };
  }
  return state;
}

export function loopBack(state, mode) {
  const kept = state.imprints.filter((i) => i.permanent || i.type === "anchor");
  return {
    ...state,
    loop: state.loop + 1,
    stability: mode === "A" ? clamp(state.stability + 10, 0, 100) : 70,
    imprints: kept,
    screen: mode === "C" ? pickEnding(state) : mode === "B" ? "C-3" : "A-1",
    location: "square",
    capture: false,
    awareness: 20,
    paradoxMode: false,
  };
}

function actForScreen(id) {
  if (id.startsWith("A")) return 1;
  if (["B-1", "B-2"].includes(id)) return 2;
  if (["B-3", "B-4", "B-5", "B-6"].includes(id)) return 3;
  if (id === "B-7") return 4;
  if (id === "B-8" || id.startsWith("D")) return 5;
  return 2;
}

function eraForScreen(id) {
  if (id === "A-1") return "dawn";
  if (id === "A-2" || id === "B-2") return "glory";
  if (id === "A-3") return "end";
  return "dawn";
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, Number(n.toFixed(1))));
}

export function imprintLabel(type) {
  return { causal: "因果链", echo: "信息回响", butterfly: "蝴蝶效应", anchor: "锚点锁定" }[type] || type;
}
