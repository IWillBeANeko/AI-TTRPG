import { FacingKind } from "./models";

const EMOTION_ZH = {
  amused: "觉得有趣",
  calm: "平静",
  angry: "愤怒",
  alarmed: "惊惕",
  worried: "担忧",
  wary: "戒备",
  alert: "警醒",
  determined: "坚定",
  afraid: "恐惧",
  sad: "悲伤",
  happy: "愉快",
  ashamed: "羞愧",
  curious: "好奇",
  tired: "疲惫",
  cold: "冷淡",
  hostile: "敌意",
};

export function emotionLabel(emotion) {
  const raw = (emotion || "").trim();
  if (!raw) return "";
  return EMOTION_ZH[raw.toLowerCase()] || raw;
}

export function reactionPayload(action) {
  return {
    speech: action.speech,
    physical: action.action,
    action: action.action,
    gesture: action.gesture,
    emotion: action.emotion,
    facing: action.facing || FacingKind.other,
    facing_id: action.facing_id,
    type: action.action_type,
  };
}

export function hasReactionModules(action) {
  return Boolean(action.gesture || action.facing_id || action.facing === FacingKind.self);
}

export function composeReactionNarrative(name, action, presentNames = {}) {
  const facingBit = facingClause(action, presentNames);
  let gesture = clean(action.gesture);
  const deed = clean(action.action);
  const speech = (action.speech || "").trim();
  const emotion = emotionLabel(action.emotion);

  if (deed && gesture && overlaps(deed, gesture)) gesture = "";

  if (!facingBit && !gesture) {
    if (speech && deed) return `${name}一边${deed}，说道：「${speech}」`;
    if (speech) return `${name}说道：「${speech}」`;
    if (deed) return `${name}${deed}。`;
    return `${name}暂且观望。`;
  }

  const parts = [facingBit ? `${name}${facingBit}` : name];
  if (gesture) parts.push(gesture);
  if (emotion) parts.push(`神情${emotion}`);
  if (deed) parts.push(deed);

  let text = parts.filter(Boolean).join("，");
  if (speech) return `${text}，说道：「${speech}」`;
  if (!text.endsWith("。")) text += "。";
  return text;
}

export function normalizeReaction(action, { presentIds, presentNames, playerId }) {
  let facing = action.facing;
  if (facing === "self" || facing === "自己") facing = FacingKind.self;
  else facing = FacingKind.other;
  action.facing = facing;

  if (facing === FacingKind.self) {
    action.facing_id = null;
    return action;
  }

  action.facing = FacingKind.other;
  const resolved = resolveFacingId(action.facing_id || action.target_id, presentIds, presentNames);
  if (resolved) {
    action.facing_id = resolved;
    return action;
  }
  if (presentIds.includes(playerId)) action.facing_id = playerId;
  return action;
}

function facingClause(action, presentNames) {
  if (action.facing === FacingKind.self) return "看向自己";
  const targetId = action.facing_id || action.target_id;
  if (!targetId) return "";
  return presentNames[targetId] ? `看向${presentNames[targetId]}` : "看向对方";
}

function resolveFacingId(token, presentIds, presentNames) {
  if (!token) return null;
  token = String(token).trim();
  if (presentIds.includes(token)) return token;
  for (const [cid, name] of Object.entries(presentNames || {})) {
    if (token === name || token === cid) return cid;
  }
  return null;
}

function clean(text) {
  return (text || "").trim().replace(/[。，,]+$/g, "");
}

function overlaps(left, right) {
  return left.includes(right) || right.includes(left);
}
