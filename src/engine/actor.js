import { buildTalkPrompt, TALK_JSON_EXAMPLE, TALK_SKILL } from "@/character-engine";
import { frailFallbackAction, isFrail } from "./character";
import { getSettings, llmChatRequest, llmFetch } from "./config";
import { queryKeys } from "./cognition";
import {
  ActionType,
  CharacterKind,
  FacingKind,
  Stance,
  StepIntent,
  createCharacterAction,
  createThinking,
  relationshipWith,
} from "./models";
import { normalizeReaction } from "./reaction";
import {
  buildRuleThinking,
  classifySituationForStrategy,
  validateThinking,
} from "./strategy";

export const ACTOR_JSON_EXAMPLE = TALK_JSON_EXAMPLE;
export const ACTOR_SYSTEM = TALK_SKILL;

export const ACTOR_JSON_GLYPH = {
  type: "json_value",
  json_properties: {
    notice_first: { type: "string" },
    interpret_intent: { type: "string" },
    step_intent: { type: "string" },
    must_not_say: { type: "string" },
    inner_thought: { type: "string" },
    facing: { type: "string" },
    facing_id: { type: "string" },
    gesture: { type: "string" },
    emotion: { type: "string" },
    speech: { type: "string" },
    action: { type: "string" },
    action_type: { type: "string" },
    target_id: { type: "string" },
    destination: { type: "string" },
    memory_to_save: { type: "string" },
  },
};

const MINIMAX_ACTOR_TAIL = `你接入的是结构化对话接口，不是角色聊天。每一次回复必须是规范里的 JSON，不能演对手戏。
messages 是你和玩家之间按时间排列的完整对白，不含其他人的对话。最后一条 USER 是对方刚刚说的原句，必须直接回应这一句，不要回答更早轮次的话。
若对方在追问名词、局限或你刚才提到的说法，必须先给能懂的解释，禁止用无关谜语或线索碎片顶替。
`;

const THREAT_MARKERS = [
  "抢劫", "打劫", "抢钱", "抢你们", "动手", "杀你", "杀掉", "杀死", "威胁", "拔刀", "拿刀",
  "举刀", "袭击", "打你", "砍你", "把钱", "交出来", "不许动", "要钱还是要命",
];
const DRINK_MARKERS = ["酒", "麦酒", "喝一杯", "来一杯"];
const GREETING_MARKERS = ["你好", "大家好", "早上好", "晚上好", "打个招呼"];
const QUESTION_MARKERS = ["吗", "？", "什么", "谁", "哪", "为何", "为什么"];
const NAME_QUESTION_MARKERS = ["叫什么", "叫甚么", "名字", "怎么称呼", "贵姓", "你是谁", "你叫啥", "怎么叫"];
const APPEARANCE_MARKERS = ["帅", "漂亮", "好看", "美吗", "丑吗", "可爱", "难看"];
const PLOT_MARKERS = ["预警", "急件", "听涌", "灯塔", "议会", "虚空", "教团", "裂隙", "档案", "潮汐", "星辰", "异动"];
const MOTIVE_PROBE_MARKERS = ["想让我笑", "想让我担心", "你问这", "你问这个", "为什么问", "问这个是想", "什么意思"];
const CLUE_DUMP_MARKERS = ["潮水会记得", "即使石头忘记", "王都的灯", "闭上耳朵", "有人听见了，却让所有人"];

export class Actor {
  constructor(settings, engine) {
    this.settings = settings || getSettings();
    this.engine = engine;
  }

  async decide(character, context) {
    this.settings = getSettings();
    if (!this.settings.usesLlm) return ruleBasedAction(character, context, this.engine);
    let lastError = "";
    let lastParsed = null;
    const attempts = Math.max(2, this.settings.actorMaxRetries);
    for (let i = 0; i < attempts; i += 1) {
      const lastTry = i === attempts - 1;
      try {
        const raw = await this.complete(character, context, lastError);
        const action = parseAction(character.id, raw);
        lastParsed = action;
        const thinkingErrors = validateThinking(action.thinking, context.executable_strategy || { allowed_intents: [] });
        if (thinkingErrors.length && !lastTry) {
          lastError = `思维步骤不合规：${thinkingErrors.join("；")}`;
          continue;
        }
        const banned = (action.thinking?.must_not_say || "").replace(/[；;、]/g, "|").split("|").filter((s) => s.trim().length >= 2);
        const speech = action.speech || "";
        const leaked = banned.find((topic) => speech.includes(topic.trim()));
        if (leaked && !lastTry) {
          lastError = `speech 触犯了 must_not_say 禁令「${leaked}」，请改写台词。`;
          continue;
        }
        if (context.must_reply && !(action.speech || "").trim() && !lastTry) {
          lastError = "对方正在对你说话，speech 不能为空，必须开口回答。";
          continue;
        }
        const miss =
          casualReplyRetryReason(context.triggering_speech || context.triggering_event, action.speech || "") ||
          questionReplyRetryReason(context.triggering_speech || context.triggering_event, action.speech || "");
        if (miss && !lastTry) {
          lastError = miss;
          continue;
        }
        return this.normalize(action, context);
      } catch (exc) {
        lastError = `上一次调用失败：${exc}。请只输出合法 JSON。`;
      }
    }
    if (lastParsed) return this.normalize(lastParsed, context);
    if (context.must_reply) throw new Error(lastError || "大模型未能生成回应");
    return this.normalize(
      createCharacterAction({
        character_id: character.id,
        speech: null,
        action: "停顿了一下",
        action_type: ActionType.wait,
        emotion: character.emotion,
      }),
      context,
    );
  }

  normalize(action, context) {
    const obs = context.observation;
    return normalizeReaction(action, {
      presentIds: obs.present_ids,
      presentNames: obs.present_names,
      playerId: this.engine.player_id,
    });
  }

  isOllama() {
    const base = (this.settings.configuredBase || this.settings.apiBase || "").toLowerCase();
    const key = this.settings.apiKey.trim().toLowerCase();
    return base.includes("11434") || base.includes("ollama") || key === "ollama";
  }

  isMinimax() {
    const base = (this.settings.configuredBase || this.settings.apiBase || "").toLowerCase();
    const model = (this.settings.model || "").toLowerCase();
    return base.includes("minimax") || model.startsWith("abab");
  }

  supportsJsonObject() {
    const model = (this.settings.model || "").toLowerCase();
    if (model.includes("longcat")) return false;
    return !this.isMinimax();
  }

  async complete(character, context, extra) {
    const packed = packActorContext(character, context, extra);
    const turns = ensureUserFirst(buildDialogueTurns(character, context).map((turn) => ({ ...turn })));
    const messages = [
      { role: "system", content: packed },
      ...turns.map((turn) => ({ role: turn.role, content: apiTurnContent(turn, character) })),
    ];
    if (this.isOllama()) return this.completeOllama(messages);
    if (this.isMinimax()) return this.completeMinimax(character, packed, turns);

    const traceId = crypto.randomUUID();
    const { headers, body } = llmChatRequest(this.settings, {
      messages,
      temperature: this.settings.actorTemperature,
      json: this.supportsJsonObject(),
      user: traceId,
    });
    const response = await llmFetch(
      `${this.settings.apiBase}/chat/completions`,
      { method: "POST", headers, body },
      { timeoutMs: 60000 },
    );
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`LLM ${response.status}${detail ? `: ${detail.slice(0, 180)}` : ""}`);
    }
    const data = await response.json();
    return data?.choices?.[0]?.message?.content || "{}";
  }

  async completeMinimax(character, packed, turns) {
    const botName = (character.name || "演员").slice(0, 32);
    const messages = ensureUserFirst(turns).map((turn) => ({
      sender_type: turn.sender_type,
      sender_name: turn.sender_type === "BOT" ? botName : turn.sender_name,
      text: apiTurnContent(turn, character),
    }));
    const payload = {
      model: this.settings.model,
      stream: false,
      bot_setting: [{ bot_name: botName, content: `${packed}\n\n${MINIMAX_ACTOR_TAIL}` }],
      messages,
      reply_constraints: {
        sender_type: "BOT",
        sender_name: botName,
        glyph: ACTOR_JSON_GLYPH,
      },
      tokens_to_generate: 1536,
      temperature: this.settings.actorTemperature,
      top_p: 0.95,
    };
    let data = null;
    try {
      data = await postMinimax(this.settings.apiBase, this.settings.apiKey, payload);
    } catch (exc) {
      const kind = String(exc?.name || exc).toLowerCase();
      const message = String(exc?.message || exc);
      if (
        ["typeerror", "aborterror"].includes(kind) ||
        /connect|timeout|network|failed to fetch|abort/i.test(kind + message)
      ) {
        throw exc;
      }
      if (!payload.reply_constraints.glyph) throw exc;
    }
    if ((!data || minimaxFailed(data)) && payload.reply_constraints.glyph) {
      const retry = {
        ...payload,
        reply_constraints: { sender_type: "BOT", sender_name: botName },
      };
      data = await postMinimax(this.settings.apiBase, this.settings.apiKey, retry);
    }
    if (!data || minimaxFailed(data)) {
      throw new Error(data?.base_resp?.status_msg || `MiniMax status ${data?.base_resp?.status_code || "empty"}`);
    }
    return pickMinimaxReply(data);
  }

  async completeOllama(messages) {
    const configured = (this.settings.configuredBase || "").replace(/\/v1\/?$/, "") || "http://127.0.0.1:11434";
    const root = String(this.settings.apiBase || "").startsWith("/") ? this.settings.apiBase : configured;
    const payload = {
      model: this.settings.model,
      messages,
      stream: false,
      think: false,
      format: "json",
      keep_alive: "10m",
      options: {
        temperature: this.settings.actorTemperature,
        num_predict: 512,
      },
    };
    if (payload.model.toLowerCase().includes("qwen3")) {
      const user = messages[messages.length - 1];
      if (!String(user.content || "").includes("/no_think")) {
        user.content = `${user.content || ""}\n/no_think`;
      }
    }
    const response = await llmFetch(
      `${root}/api/chat`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      { timeoutMs: 60000 },
    );
    if (!response.ok) throw new Error(`Ollama ${response.status}`);
    const data = await response.json();
    return data?.message?.content || "{}";
  }
}

export function parseAction(characterId, raw) {
  const data = typeof raw === "object" && raw ? raw : JSON.parse(extractJson(raw));
  let actionType = data.action_type || "wait";
  if (!Object.values(ActionType).includes(actionType)) {
    actionType = data.speech ? ActionType.speak : ActionType.wait;
  }
  const facing = parseFacing(data.facing);
  let facingId = nullableText(data.facing_id);
  if (facing === FacingKind.self) facingId = null;
  const deltas = Array.isArray(data.relationship_deltas)
    ? data.relationship_deltas.filter((item) => item && item.other_id)
    : [];
  return createCharacterAction({
    character_id: characterId,
    speech: nullableText(data.speech),
    action: nullableText(data.action),
    gesture: nullableText(data.gesture),
    facing,
    facing_id: facingId,
    action_type: actionType,
    target_id: nullableText(data.target_id),
    destination: nullableText(data.destination),
    emotion: nullableText(data.emotion) || "calm",
    memory_to_save: nullableText(data.memory_to_save),
    relationship_deltas: deltas,
    inner_thought: nullableText(data.inner_thought),
    thinking: createThinking({
      notice_first: nullableText(data.notice_first) || "",
      interpret_intent: nullableText(data.interpret_intent) || "",
      step_intent: normalizeStepIntent(data.step_intent),
      must_not_say: nullableText(data.must_not_say) || "",
    }),
  });
}

function parseFacing(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (["self", "自己", "自身"].includes(raw)) return FacingKind.self;
  return FacingKind.other;
}

export function currentUtterance(context) {
  const speech = String(context.triggering_speech || "").trim();
  if (speech) return speech;
  const trigger = String(context.triggering_event || "").trim();
  const quoted = spokenText(trigger);
  if (quoted && quoted !== trigger) return quoted;
  return trigger || "……";
}

export function buildDialogueTurns(character, context) {
  const playerName = context.player_name || "时隙行者";
  const utterance = currentUtterance(context);
  const turns = (context.dialogue_turns || [])
    .filter((turn) => turn && String(turn.text || "").trim())
    .map((turn) => {
      const isBot = turn.sender_type === "BOT" || turn.role === "assistant" || turn.speaker_id === character.id;
      return {
        role: isBot ? "assistant" : "user",
        sender_type: isBot ? "BOT" : "USER",
        sender_name: isBot ? character.name : turn.sender_name || playerName,
        speaker_id: turn.speaker_id || (isBot ? character.id : ""),
        text: String(turn.text).trim(),
      };
    });
  const last = turns.at(-1);
  if (!last || last.sender_type !== "USER" || last.text !== utterance) {
    turns.push({
      role: "user",
      sender_type: "USER",
      sender_name: playerName,
      speaker_id: "",
      text: utterance,
    });
  }
  return turns;
}

function ensureUserFirst(turns) {
  if (!turns.length || turns[0].sender_type === "USER") return turns;
  return [
    {
      role: "user",
      sender_type: "USER",
      sender_name: "系统",
      speaker_id: "",
      text: "（以下为已发生的完整对白，请结合上下文回应最后一句）",
    },
    ...turns,
  ];
}

function apiTurnContent(turn, character) {
  const raw = String(turn.text || "").trim();
  if (!raw) return "";
  const isSelf = turn.sender_type === "BOT" || turn.speaker_id === character.id;
  if (isSelf) return raw;
  const name = turn.sender_name || "";
  if (!name || name === "系统") return raw;
  if (raw.startsWith(`${name}：`) || raw.startsWith(`${name}:`)) return raw;
  return `${name}：${raw}`;
}

export function packActorContext(character, context, extra = "") {
  return buildTalkPrompt(character, context, extra);
}

export function renderActorPrompt(character, context) {
  return packActorContext(character, context);
}

function spokenText(trigger) {
  const start = trigger.indexOf("「");
  const end = trigger.lastIndexOf("」");
  if (start >= 0 && end > start) return trigger.slice(start + 1, end);
  return trigger;
}

export function classifySituation(trigger) {
  const spoken = spokenText(trigger);
  if (THREAT_MARKERS.some((m) => trigger.includes(m))) return "threat";
  if (DRINK_MARKERS.some((m) => trigger.includes(m))) return "drink";
  if (APPEARANCE_MARKERS.some((m) => spoken.includes(m))) return "smalltalk";
  if (isShortCasualQuestion(spoken)) return "smalltalk";
  if (QUESTION_MARKERS.some((m) => trigger.includes(m))) return "question";
  let leftover = spoken;
  for (const greeting of GREETING_MARKERS) leftover = leftover.replace(greeting, "");
  leftover = leftover.replace(/[ ，。！!?、]/g, "").trim();
  if (spoken && !leftover) return "greeting";
  if (trigger.includes("说")) return "talk";
  return "idle";
}

export function ruleBasedAction(character, context, engine) {
  const trigger = context.triggering_event;
  const player = engine.characters[engine.player_id];
  const intent = classifySituation(trigger);
  const situationKind = classifySituationForStrategy(trigger);
  const injured = context.observation.present_ids
    .map((cid) => engine.characters[cid])
    .filter((c) => c.hp < c.max_hp);

  const wrap = (action) =>
    withThinking(withReaction(action, context, engine), character, context, trigger, situationKind);

  if (intent === "threat") return wrap(threatAction(character, trigger, player));

  if (character.kind === CharacterKind.companion && injured.length) {
    const others = injured.filter((c) => c.id !== character.id);
    const target = others.find((c) => c.id === player.id) || others[0];
    if (
      target &&
      (character.occupation.includes("疗") || character.goals.some((g) => g.includes("保护") || g.includes("治疗")))
    ) {
      return wrap(
        createCharacterAction({
          character_id: character.id,
          facing: FacingKind.other,
          facing_id: target.id,
          gesture: "蹲下身，按住伤口",
          speech: companionHealLine(character, target),
          action: `为${target.name}包扎止血`,
          action_type: ActionType.help,
          target_id: target.id,
          emotion: "worried",
          memory_to_save: `${target.name}受伤了，我必须先救人`,
        }),
      );
    }
  }

  if (["drink", "greeting", "question", "talk", "smalltalk"].includes(intent)) {
    const rival = hostilePresent(character, context, engine);
    if (rival && character.kind === CharacterKind.companion) {
      return wrap(
        createCharacterAction({
          character_id: character.id,
          facing: FacingKind.other,
          facing_id: rival.id,
          gesture: "拉了拉旅人的袖子",
          speech: companionHostileLine(character, rival),
          action: `把${rival.name}挡在视线里`,
          action_type: ActionType.speak,
          target_id: rival.id,
          emotion: "wary",
          memory_to_save: `${rival.name}不是普通过客，必须先问来意`,
        }),
      );
    }
    const smalltalk = intent === "smalltalk";
    if (character.kind === CharacterKind.npc) {
      return wrap(
        createCharacterAction({
          character_id: character.id,
          facing: FacingKind.other,
          facing_id: player.id,
          gesture: smalltalk ? "看了来人一眼" : "擦了擦手",
          speech: npcReply(character, trigger, intent, player.id, context),
          action: smalltalk ? "继续手头的活" : "暂停手头的活",
          action_type: ActionType.speak,
          emotion: smalltalk ? "calm" : intent === "question" ? "alert" : "calm",
          memory_to_save: trigger.slice(0, 80),
        }),
      );
    }
    return wrap(
      createCharacterAction({
        character_id: character.id,
        facing: FacingKind.other,
        facing_id: player.id,
        gesture: smalltalk ? "看了他一眼" : "侧过身听着",
        speech: companionReply(character, trigger, intent, player.id, context),
        action: smalltalk ? "站在原处" : "站在旅人身侧",
        action_type: ActionType.speak,
        emotion: smalltalk ? "calm" : character.emotion,
        memory_to_save: trigger.slice(0, 80),
      }),
    );
  }

  if (context.must_reply) {
    if (character.kind === CharacterKind.npc) {
      return wrap(
        createCharacterAction({
          character_id: character.id,
          facing: FacingKind.other,
          facing_id: player.id,
          gesture: "抬眼看过来",
          speech: npcReply(character, trigger, intent, player.id, context),
          action: "放下手头的活",
          action_type: ActionType.speak,
          emotion: "alert",
          memory_to_save: trigger.slice(0, 80),
        }),
      );
    }
    return wrap(
      createCharacterAction({
        character_id: character.id,
        facing: FacingKind.other,
        facing_id: player.id,
        gesture: "转过身来",
        speech: companionReply(character, trigger, intent, player.id, context),
        action: "走到旅人跟前",
        action_type: ActionType.speak,
        emotion: character.emotion,
        memory_to_save: trigger.slice(0, 80),
      }),
    );
  }

  if (character.kind === CharacterKind.companion) {
    return wrap(
      createCharacterAction({
        character_id: character.id,
        facing: FacingKind.other,
        facing_id: player.id,
        gesture: "扫视四周",
        speech: companionIdle(character, context),
        action: "跟上队伍",
        action_type: ActionType.wait,
        emotion: "alert",
      }),
    );
  }

  return wrap(
    createCharacterAction({
      character_id: character.id,
      facing: FacingKind.self,
      gesture: "低着头",
      speech: null,
      action: character.current_activity || "做自己手头的事",
      action_type: ActionType.wait,
      emotion: character.emotion,
    }),
  );
}

function withThinking(action, character, context, trigger, situationKind) {
  const executable = context.executable_strategy;
  if (!executable) return action;
  const thinking = buildRuleThinking(character, executable, context, trigger, situationKind);
  action.thinking = thinking;
  if (!action.inner_thought) action.inner_thought = thinking.inner_thought;
  return action;
}

function withReaction(action, context, engine) {
  const obs = context.observation;
  return normalizeReaction(action, {
    presentIds: obs.present_ids,
    presentNames: obs.present_names,
    playerId: engine.player_id,
  });
}

function companionHealLine(character, target) {
  return `${target.name}先别动，我来处理伤口。`;
}

function threatAction(character, trigger, player) {
  const delta = {
    other_id: player.id,
    trust: -0.3,
    fear: 0.15,
    affection: -0.15,
    note: "当众扬言抢劫或动武",
  };
  if (isFrail(character)) {
    return createCharacterAction({
      character_id: character.id,
      facing: FacingKind.other,
      facing_id: player.id,
      gesture: "咬紧牙关，没有上前",
      speech: frailThreatLine(character),
      action: frailFallbackAction(character),
      action_type: ActionType.speak,
      emotion: character.kind === CharacterKind.npc ? "angry" : "alarmed",
      memory_to_save: `${player.name}当众扬言抢劫，但我现在伤着，不能硬拼`,
      relationship_deltas: [delta],
    });
  }
  if (character.kind === CharacterKind.npc) {
    return createCharacterAction({
      character_id: character.id,
      facing: FacingKind.other,
      facing_id: player.id,
      gesture: "眯起眼睛",
      speech: npcThreatLine(character),
      action: isArchivist(character) ? "护住蜡印台账" : isElder(character) ? "拄紧权杖挡住门口" : "抄起手边能防身的东西",
      action_type: ActionType.speak,
      emotion: "angry",
      memory_to_save: `${player.name}当众扬言抢劫，不能当玩笑`,
      relationship_deltas: [delta],
    });
  }
  return createCharacterAction({
    character_id: character.id,
    facing: FacingKind.other,
    facing_id: player.id,
    gesture: "伸手拦住",
    speech: companionThreatLine(character),
    action: "挡在冲突中间",
    action_type: ActionType.speak,
    emotion: "alarmed",
    memory_to_save: `${player.name}刚进门就要抢劫，必须先把人拦住`,
    relationship_deltas: [delta],
  });
}

function isArchivist(character) {
  return (character.occupation || "").includes("档案");
}

function isElder(character) {
  return (character.occupation || "").includes("长老");
}

function frailThreatLine(character) {
  if (isArchivist(character)) return "档案室不接待强盗。我这身子硬拼只会先把蜡印赔进去——把念头收回去。";
  if (isElder(character)) return "议会不吃这一套。我拦得住话，拦不住刀。先把念头收回去。";
  return "我拦不住。先别硬拼，伤口撑不住。";
}

function hostilePresent(character, context, engine) {
  for (const cid of context.observation.present_ids) {
    if (cid === character.id || cid === engine.player_id) continue;
    const other = engine.characters[cid];
    if (!other) continue;
    if (relationshipWith(character, cid).stance === Stance.hostile) return other;
  }
  return null;
}

function companionHostileLine(character, rival) {
  return `先把来意问清楚。${rival.name}不是普通过客。`;
}

function companionReply(character, trigger, intent = "talk", playerId = "player", context = null) {
  const rel = relationshipWith(character, playerId);
  const guarded =
    character.evolved_notes.some((note) => note.includes("对旅人戒备")) ||
    [Stance.wary, Stance.hostile].includes(rel.stance);
  if (guarded && intent !== "smalltalk") return "你刚才那句话我还记着。先把来意说清楚。";
  if (isNameQuestion(trigger)) return `我是${character.name}。`;
  if (intent === "smalltalk" || isAppearanceQuestion(trigger)) return companionSmalltalkLine(character, rel);
  const fromKnowledge = pickKnowledgeAnswer(context, trigger);
  if (fromKnowledge) return fromKnowledge;
  if (intent === "question") return "我在。你问，我尽量答。";
  return "我在。你说，我跟着。";
}

function companionSmalltalkLine(character, rel) {
  return rel.affection >= 0.3 ? "还行。你自己心里没数？" : "这种时候问这个。过得去。";
}

function companionIdle() {
  return "我跟上了。有情况我先挡。";
}

function companionThreatLine() {
  return "先住手。刚进门就动手，这不是野地，谁都会受伤。";
}

function npcReply(character, trigger, intent = "talk", playerId = "player", context = null) {
  const rel = relationshipWith(character, playerId);
  const guarded =
    character.evolved_notes.some((note) => note.includes("对旅人戒备")) || rel.stance === Stance.hostile;
  if (isNameQuestion(trigger)) {
    if (isArchivist(character)) return `${character.name}。蜡印台账上就写这个名字。`;
    if (isElder(character)) return `${character.name}。议会记录里，他们这样称呼我。`;
    return `${character.name}。问名字，我就答这个。`;
  }
  if (intent === "smalltalk" || isAppearanceQuestion(trigger)) {
    if (isArchivist(character)) return "还过得去。编号对上了再照镜子。";
    if (isElder(character)) return "还行。账本不问这个。";
    return "还行。";
  }
  if (guarded) {
    if (isArchivist(character)) return "手续还没完。想查可以，想再闹事就出去。";
    if (isElder(character)) return "我还记得你上次怎么说话的。议会不吃这一套。";
    return "我还记得你上次怎么说话的。";
  }
  const fromKnowledge = pickKnowledgeAnswer(context, trigger);
  if (fromKnowledge && intent === "question") return fromKnowledge;
  if (isArchivist(character)) {
    if (intent === "greeting") return "新面孔？查阅要编号，闲话请往后排。";
    if (intent === "question") return "问可以。先说用途，手续后办。";
    return "话我听见了。档案室里先把来意说清楚，再谈封存。";
  }
  if (isElder(character)) {
    if (intent === "greeting") return "嗯。账本还在。";
    if (intent === "question") return "问可以。我只说账上记了什么，不替你选下一步。";
    return "话我听见了。议会先看你怎么对待这些记录。";
  }
  if (intent === "greeting") return "嗯。";
  return "嗯，我听着。";
}

function isNameQuestion(trigger) {
  const spoken = spokenText(trigger);
  return NAME_QUESTION_MARKERS.some((marker) => spoken.includes(marker));
}

function isAppearanceQuestion(trigger) {
  const spoken = spokenText(trigger);
  return APPEARANCE_MARKERS.some((marker) => spoken.includes(marker));
}

function isShortCasualQuestion(spoken) {
  const text = (spoken || "").trim();
  if (text.length > 10) return false;
  if (!text.includes("吗") && !text.includes("？") && !text.includes("?")) return false;
  if (isNameQuestion(text)) return false;
  return !PLOT_MARKERS.some((marker) => text.includes(marker));
}

export function casualReplyRetryReason(trigger, speech) {
  const spoken = spokenText(trigger);
  if (!(isAppearanceQuestion(spoken) || isShortCasualQuestion(spoken))) return "";
  if (!MOTIVE_PROBE_MARKERS.some((marker) => speech.includes(marker))) return "";
  return "对方在闲聊。不要追问动机。先按人设给一句能当回答的话（评价或打趣），动作也别突然靠近或戒备。";
}

export function questionReplyRetryReason(trigger, speech) {
  const spoken = spokenText(trigger).trim();
  if (!isContentQuestion(spoken)) return "";
  if (isNameQuestion(spoken) || isAppearanceQuestion(spoken) || isShortCasualQuestion(spoken)) return "";
  const keys = queryKeys(spoken);
  if (!keys.length) return "";
  const dump = CLUE_DUMP_MARKERS.find((marker) => speech.replace(/\s/g, "").includes(marker.replace(/\s/g, "")));
  const hits = keys.filter((key) => speech.includes(key));
  if (dump && hits.length === 0) {
    return `对方在追问「${spoken}」。不要用空比喻或无关线索顶替。先用自己记忆里的事实直接解释这句话在问的概念。`;
  }
  if (hits.length === 0) {
    return `对方在问「${spoken}」。speech 必须正面解释其中的概念（至少点到：${keys.slice(0, 3).join("、")}），禁止答非所问、禁止用谜语顶替回答。`;
  }
  return "";
}

function isContentQuestion(spoken) {
  return QUESTION_MARKERS.some((marker) => spoken.includes(marker));
}

function pickKnowledgeAnswer(context, trigger) {
  const spoken = spokenText(trigger);
  const keys = queryKeys(spoken);
  if (!keys.length || !context?.visible_knowledge?.length) return "";
  let best = "";
  let bestScore = 0;
  for (const item of context.visible_knowledge) {
    const score = keys.filter((key) => String(item).includes(key)).length;
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }
  if (bestScore < 1 || !best) return "";
  const sentence = String(best)
    .split(/[。！]/)
    .map((part) => part.trim())
    .find((part) => keys.some((key) => part.includes(key)));
  return sentence ? `${sentence}。` : "";
}

function npcThreatLine(character) {
  if (isArchivist(character)) {
    return "档案室不接待强盗。把念头收回去，否则蜡印以外的东西也会记到你头上。";
  }
  if (isElder(character)) {
    return "议会不接待强盗。把念头收回去。";
  }
  return "收手。这儿不吃这一套。";
}

function extractJson(raw) {
  raw = String(raw || "").trim();
  if (raw.startsWith("```")) {
    raw = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  }
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end >= start) return raw.slice(start, end + 1);
  throw new Error("模型未返回 JSON 对象");
}

function nullableText(value) {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text || /^(null|none|undefined|nil|无|空)$/i.test(text)) return null;
  return text;
}

const STEP_INTENT_ALIASES = {
  救人: StepIntent.heal,
  治疗: StepIntent.heal,
  试探: StepIntent.probe,
  警告: StepIntent.warn,
  拒绝: StepIntent.refuse,
  保护: StepIntent.protect,
  交换信息: StepIntent.trade_info,
  观察: StepIntent.watch,
  跟随: StepIntent.follow,
};

function normalizeStepIntent(value) {
  const text = nullableText(value) || "";
  if (Object.values(StepIntent).includes(text)) return text;
  return STEP_INTENT_ALIASES[text] || text;
}

function minimaxFailed(data) {
  const code = data?.base_resp?.status_code;
  return Boolean(code && code !== 0);
}

function pickMinimaxReply(data) {
  const glyph = data?.choices?.[0]?.glyph_result;
  if (glyph && typeof glyph === "object" && !Array.isArray(glyph)) {
    if (glyph.notice_first || glyph.speech || glyph.step_intent || glyph.inner_thought) {
      return JSON.stringify(glyph);
    }
  }
  const text =
    data?.reply ||
    data?.choices?.[0]?.messages?.[0]?.text ||
    data?.choices?.[0]?.message?.content ||
    "";
  if (typeof text === "object") return JSON.stringify(text);
  return String(text || "{}");
}

async function postMinimax(apiBase, apiKey, payload) {
  const response = await llmFetch(
    `${apiBase}/text/chatcompletion_pro`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "M-TraceId": crypto.randomUUID(),
      },
      body: JSON.stringify(payload),
    },
    { timeoutMs: 60000 },
  );
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`MiniMax ${response.status}${detail ? `: ${detail.slice(0, 180)}` : ""}`);
  }
  return response.json();
}