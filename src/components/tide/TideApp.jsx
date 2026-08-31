import { useEffect, useRef, useState } from "react";
import { TIDE_SCREENS, IMPRINT_FOOTER, TIDE_GUIDES, TIDE_HINTS, NPC_HINTS } from "@/data/tide-screens";
import { openingBriefing } from "@/data/story-manifest";
import {
  addImprint,
  applyDiceToStability,
  createTideState,
  imprintLabel,
  loopBack,
  nextFromChoice,
  pickEnding,
  rollCheck,
} from "@/engine/tide-game";
import { bootstrap, getConversation, newGame, runCommand, applyPlayerSheet, applyCompanionSheet, setStoryAct, rememberPlayerFact, listPlayerFacts } from "@/engine/session";
import { FACES, diceD20, COMPANION_PORTRAITS } from "@/components/rpg/assets";
import { bgForAct, bgForScreen } from "@/components/rpg/ui-assets";
import CharacterSheet from "@/components/tide/CharacterSheet";
import CompanionReveal from "@/components/tide/CompanionReveal";
import PersonalityReport from "@/components/tide/PersonalityReport";
import PlayStage from "@/components/tide/PlayStage";
import { fallbackCompanion, generateCompanion } from "@/engine/companion";
import { reviewAct1Progress } from "@/engine/progress";
import { generateAssessment } from "@/engine/assessment";
import { ASIDE_GAP_MS, generateCompanionAside } from "@/engine/companion-aside";
import { applyRiftEvent, emptyRift, generateHarborRift, RIFT_DWELL_MS } from "@/engine/rift-event";
import { isAbortError, isPageLive, subscribePageLive } from "@/engine/page-session";
import { appendMapEvent } from "@/engine/map-status";
import { clearPlayRecord, recordPlay } from "@/engine/play-log";
import { act1Complete, briefingProgress, locationById } from "@/data/play-stage";
import { kitForCompanion, kitForPlayer } from "@/data/loadout";

const FACE = {
  yongyin: FACES.yongyin,
  ewen: FACES.ewen,
  saltspeaker: FACES.saltspeaker,
  baker: FACES.baker,
  envoy: FACES.envoy,
  player: FACES.player,
};

function noteMap(state, text, mapId) {
  return appendMapEvent(state, mapId || state.location || "world", text);
}

function logAt(state, kind, text, mapId) {
  return noteMap(recordPlay(state, kind, text), text, mapId);
}

function npcFace(npc, companion) {
  if (npc.id === "mate" && companion) {
    return COMPANION_PORTRAITS[companion.gender] || COMPANION_PORTRAITS.female;
  }
  return FACE[npc.id];
}

function choiceHint(choice) {
  if (!choice) return "推进当前剧情。";
  if (choice.hint) return choice.hint;
  if (choice.id && TIDE_HINTS[choice.id]) return TIDE_HINTS[choice.id];
  const bits = [];
  if (choice.skill) bits.push(`先掷骰：${choice.skill} DC${choice.dc}${choice.failGoto ? "，失败会走另一条路" : ""}`);
  if (choice.talk) bits.push("成功后可打开深度对话");
  if (choice.goto) bits.push("随后进入下一幕");
  if (choice.imprint) bits.push("可能留下印记");
  return bits.join("。") || "推进当前剧情。";
}

function Hint({ text }) {
  if (!text) return null;
  return (
    <span
      className="hint-mark"
      role="note"
      tabIndex={0}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      ?
      <i>{text}</i>
    </span>
  );
}

function GuideBoard({ guide }) {
  if (!guide) return null;
  return (
    <aside className="tide-guide">
      <div>
        <b>本幕要做</b>
        <span>{guide.goal}</span>
      </div>
      <div>
        <b>故事背景</b>
        <span>{guide.story}</span>
      </div>
      <div>
        <b>当前环境</b>
        <span>{guide.place}</span>
      </div>
      <div>
        <b>周围的人</b>
        <span>{guide.people}</span>
      </div>
    </aside>
  );
}

function renderBriefMarks(body) {
  return String(body || "")
    .split(/(\*[^*]+\*)/g)
    .map((part, index) => {
      const marked = part.match(/^\*([^*]+)\*$/);
      if (marked) {
        return (
          <em className="brief-key" key={index}>
            {marked[1]}
          </em>
        );
      }
      return <span key={index}>{part}</span>;
    });
}

function OpeningBriefing({ busy, onConfirm }) {
  const [step, setStep] = useState(0);
  const sections = openingBriefing.sections;
  const last = step >= sections.length - 1;
  const section = sections[Math.min(step, sections.length - 1)];

  const goNext = () => {
    if (busy) return;
    if (last) {
      onConfirm();
      return;
    }
    setStep((index) => Math.min(index + 1, sections.length - 1));
  };

  return (
    <section className="boot briefing" aria-label="开局背景介绍">
      <p className="sub">{openingBriefing.kicker}</p>
      <h1>{openingBriefing.title}</h1>
      <article className="briefing-log" key={section.heading}>
        <p className="briefing-step">
          {String(step + 1).padStart(2, "0")} / {String(sections.length).padStart(2, "0")}
        </p>
        <div className="briefing-block">
          <h2>{section.heading}</h2>
          <p>{renderBriefMarks(section.body)}</p>
        </div>
        {last ? <p className="briefing-close">{openingBriefing.closing}</p> : null}
      </article>
      <span className="hint-host" style={{ marginTop: 18 }}>
        <button className="tide-btn gold" type="button" disabled={Boolean(busy)} onClick={goNext}>
          {busy || (last ? openingBriefing.confirm : openingBriefing.next)}
        </button>
        <Hint
          text={
            last
              ? "读完再进广场。港湾今夜具体出了什么事，要到现场才看得到。"
              : "点一下，看下一段。"
          }
        />
      </span>
    </section>
  );
}

export default function TideApp() {
  const [phase, setPhase] = useState("boot");
  const [note, setNote] = useState("");
  const [game, setGame] = useState(() => createTideState());
  const [dice, setDice] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [settle, setSettle] = useState(false);
  const [busy, setBusy] = useState("");
  const [companionError, setCompanionError] = useState("");
  const [companionLoading, setCompanionLoading] = useState(false);
  const [companionSource, setCompanionSource] = useState("");
  const [whisper, setWhisper] = useState(0);
  const [wantTutorial, setWantTutorial] = useState(false);
  const [assessment, setAssessment] = useState(null);
  const [aside, setAside] = useState({ pending: null, shown: "", lastHeardAt: 0 });
  const [siteStay, setSiteStay] = useState({ view: "world", location: "square", tutoring: false });
  const [pageLive, setPageLive] = useState(() => isPageLive());
  const pending = useRef(null);
  const diceLock = useRef(0);
  const generating = useRef(false);
  const gameRef = useRef(game);
  const asideFetch = useRef(false);
  const asideTicket = useRef(0);
  const riftFetch = useRef(false);
  const riftTicket = useRef(0);
  gameRef.current = game;

  useEffect(() => subscribePageLive(setPageLive), []);

  useEffect(() => {
    try {
      const data = bootstrap();
      setNote(data.uses_llm ? `ACTOR · ${data.model}` : "规则演员在线");
    } catch (error) {
      setNote(error.message);
    }
  }, []);

  const start = async () => {
    setBusy("SYNCING…");
    try {
      await newGame();
    } catch {
      /* 引擎可选 */
    }
    clearPlayRecord();
    setGame(createTideState());
    setBusy("");
    setCompanionError("");
    setCompanionLoading(false);
    setCompanionSource("");
    generating.current = false;
    setWantTutorial(false);
    setAssessment(null);
    setAside({ pending: null, shown: "", lastHeardAt: 0 });
    setPhase("briefing");
  };

  const enterWorld = () => {
    setPhase("chargen");
  };

  const finishChargen = async (sheet) => {
    if (generating.current) return;
    generating.current = true;
    const player = { ...sheet, ...kitForPlayer(sheet) };
    setGame((prev) => ({ ...prev, player, companion: null }));
    applyPlayerSheet(player);
    setCompanionError("");
    setCompanionSource("");
    setCompanionLoading(true);
    setPhase("companion");
    const attachCompanion = (raw, briefing) => {
      const companion = { ...raw, ...kitForCompanion(raw) };
      setGame((prev) => ({
        ...prev,
        player: { ...prev.player, personality: briefing || raw.briefing || prev.player?.personality || null },
        companion,
        npcs: {
          mate: {
            id: "mate",
            name: companion.name,
            role: companion.occupation,
            attitude: "trust",
            trust: 72,
          },
          ...prev.npcs,
        },
      }));
      applyCompanionSheet(companion);
      applyPlayerSheet({ ...player, personality: briefing || raw.briefing });
    };
    const started = Date.now();
    const holdLoading = async () => {
      const remain = 1200 - (Date.now() - started);
      if (remain > 0) await new Promise((resolve) => setTimeout(resolve, remain));
    };
    try {
      const result = await generateCompanion(sheet);
      await holdLoading();
      attachCompanion(result.companion, result.briefing);
      setCompanionSource(result.source);
      setCompanionError(result.error || "");
    } catch (error) {
      await holdLoading();
      const fallback = fallbackCompanion(sheet);
      attachCompanion(fallback, fallback.briefing);
      setCompanionSource("fallback");
      setCompanionError(error?.message || "大模型未响应。");
    } finally {
      setCompanionLoading(false);
    }
  };

  const enterPlay = (withTutorial = false) => {
    setWantTutorial(Boolean(withTutorial));
    setStoryAct("act1_omens");
    asideTicket.current += 1;
    asideFetch.current = false;
    riftTicket.current += 1;
    riftFetch.current = false;
    setAside({ pending: null, shown: "", lastHeardAt: Date.now() });
    setSiteStay({ view: "world", location: "square", tutoring: false });
    setPhase("play");
  };

  const openDice = (choice) => {
    const result = rollCheck({
      skill: choice.skill,
      dc: choice.dc,
      aid: game.aidLevel >= 100 ? 1 : 0,
      advantage: game.imprints.some((i) => i.type === "echo"),
      attrs: game.player?.attrs,
    });
    pending.current = choice;
    diceLock.current = Date.now() + 10000;
    setDice({ ...result, rolling: true });
    let ticks = 0;
    const timer = setInterval(() => {
      ticks += 1;
      setDice((prev) => (prev ? { ...prev, show: 1 + Math.floor(Math.random() * 20) } : prev));
      if (ticks > 12) {
        clearInterval(timer);
        diceLock.current = Date.now();
        setDice({ ...result, rolling: false, show: result.roll });
      }
    }, 90);
  };

  const closeDice = () => {
    if (!dice || dice.rolling) return;
    if (Date.now() - diceLock.current < 800) return;
    const choice = pending.current;
    const result = dice;
    setDice(null);
    if (!choice || !result) return;
    setGame((prev) => {
      let next = applyDiceToStability(prev, result);
      if (!result.success && choice.failGoto) {
        return nextFromChoice(next, { ...choice, goto: choice.failGoto });
      }
      if (choice.radar) {
        const explored = next.exploredRadar.includes(choice.radar)
          ? next.exploredRadar
          : [...next.exploredRadar, choice.radar];
        next = { ...next, exploredRadar: explored };
        if (explored.length >= 3) return nextFromChoice(next, { ...choice, goto: "B-1" });
        return next;
      }
      if (!result.success) {
        return logAt(
          nextFromChoice(next, {
            ...choice,
            flag: undefined,
            flags: undefined,
            npc: undefined,
            trustDelta: undefined,
            stability: undefined,
            note: choice.failNote || "没做成。可以换个办法，或稍后再试。",
          }),
          "dice",
          `${choice.title}：失败`,
        );
      }
      if (result.success && choice.talk) {
        setTimeout(() => openDialog(choice.talk, choice.talkText), 200);
      }
      return logAt(nextFromChoice(next, choice), "dice", `${choice.title}：成功`);
    });
  };

  const pick = (choice) => {
    if (choice.locked) return;
    if (choice.go && !choice.skill && !choice.talk) {
      setGame((prev) => {
        const dest = locationById(choice.go);
        const name = dest?.name || choice.go;
        let next = recordPlay(nextFromChoice(prev, choice), "move", `前往${name}`);
        next = noteMap(next, `有人前往${name}`, "world");
        next = noteMap(next, `有人进入${name}`, choice.go);
        return next;
      });
      return;
    }
    if (choice.skill && choice.dc) {
      openDice(choice);
      return;
    }
    if (choice.talk) {
      if (choice.flag || choice.flags?.length || choice.note) {
        setGame((prev) =>
          logAt(nextFromChoice(prev, { ...choice, talk: undefined }), "action", choice.title),
        );
      } else {
        setGame((prev) => logAt(prev, "action", `开口：${choice.title}`));
      }
      openDialog(choice.talk, choice.talkText);
      return;
    }
    if (choice.stealth) {
      setGame((prev) => stealthAct(prev, choice.stealth));
      return;
    }
    if (choice.support) {
      setGame((prev) => {
        const triAdv = { ...prev.triAdv, [choice.support]: (prev.triAdv[choice.support] || 0) + 1 };
        return nextFromChoice({ ...prev, triAdv }, choice);
      });
      return;
    }
    if (choice.echo) {
      setGame((prev) => nextFromChoice({ ...prev, echoSegments: { ...prev.echoSegments, [choice.echo]: true } }, choice));
      return;
    }
    if (game.screen === "B-8") {
      setGame((prev) => ({ ...prev, screen: choice.id }));
      return;
    }
    if (choice.goto === "E-3" || choice.ending) {
      setGame((prev) => nextFromChoice(prev, { ...choice, goto: prev.screen }));
      setSettle(true);
      return;
    }
    setGame((prev) => {
      const next = nextFromChoice(prev, choice);
      if (choice.logMemory && choice.note) {
        rememberPlayerFact(`你亲眼看见：${choice.note}`);
        return logAt(next, "observe", choice.note);
      }
      return logAt(next, "action", choice.title || choice.note || "做了一件事");
    });
  };

  const openDialog = (npcId, preset) => {
    const npc = game.npcs[npcId];
    if (!npc) return;
    let lines = [];
    try {
      lines = getConversation(npcId);
    } catch {
      lines = [];
    }
    setDialog({ npc, lines, draft: preset || "" });
  };

  const sendTalk = async () => {
    if (!dialog?.draft?.trim()) return;
    const npcId = dialog.npc.id;
    const text = dialog.draft.trim();
    setDialog((d) => ({ ...d, draft: "", lines: [...d.lines, { who: "me", text }] }));
    setBusy("角色正在回应");
    try {
      const data = await runCommand({ action: "talk", target: npcId, text });
      let lines = [];
      try {
        lines = getConversation(npcId);
      } catch {
        lines = [];
      }
      if (!lines.length || lines.at(-1)?.who !== "bot") {
        lines = [...lines, { who: "bot", text: pickSpeech(data, npcId) }];
      }
      setDialog((d) => (d ? { ...d, lines } : d));
      const reply = lines.at(-1)?.who === "bot" ? lines.at(-1).text : "";
      const npcName = dialog.npc?.name || npcId;
      rememberPlayerFact(`你对${npcName}说：${text}`);
      if (reply) rememberPlayerFact(`${npcName}对你说：${reply}`);
      setGame((prev) => {
        const logged = recordPlay(
          prev,
          "talk",
          `你对${npcName}说「${text}」。${reply ? `${npcName}说「${reply}」` : ""}`,
        );
        return noteMap(logged, `有人与${npcName}交谈`);
      });
    } catch (error) {
      const quota = /quota|setItem|Storage/i.test(String(error?.message || ""));
      const fallback = quota ? "……她顿了一下，像是把要说的话又咽了回去。" : error.message;
      setDialog((d) => (d ? { ...d, lines: [...d.lines, { who: "bot", text: fallback }] } : d));
    }
    setBusy("");
  };

  const checkBrief = async () => {
    if (busy) return;
    const flags = game.routeFlags || {};
    if (act1Complete(flags)) {
      setGame((prev) => ({ ...prev, sceneNote: "这一幕该对上的都已经记下了。" }));
      return;
    }
    const { current } = briefingProgress(flags);
    if (current?.kind === "observe") {
      setGame((prev) => ({ ...prev, sceneNote: "这一条要自己去现场看，点完四周即可，不用校验。" }));
      return;
    }
    setBusy("对照听到的事");
    try {
      const result = await reviewAct1Progress(flags, listPlayerFacts());
      if (result.gained.length) {
        setGame((prev) =>
          recordPlay(
            {
              ...prev,
              routeFlags: {
                ...prev.routeFlags,
                ...Object.fromEntries(result.gained.map((step) => [step.id, true])),
              },
              sceneNote: result.note || prev.sceneNote,
            },
            "check",
            result.note,
          ),
        );
      } else {
        setGame((prev) =>
          recordPlay(
            {
              ...prev,
              sceneNote: "还没从见闻里对上当前这一条。再去问，或把话问到点子上，然后再点 CHECK。",
            },
            "check",
            "校验未通过：还没对上当前这一条",
          ),
        );
      }
    } catch {
      setGame((prev) => ({ ...prev, sceneNote: "这一次没对上。稍后再试。" }));
    }
    setBusy("");
  };

  const viewAssessment = async () => {
    if (busy) return;
    if (assessment) {
      setPhase("assessment");
      return;
    }
    setBusy("对照这一局");
    try {
      const report = await generateAssessment(game);
      setAssessment(report);
      setPhase("assessment");
    } catch {
      setAssessment(null);
    }
    setBusy("");
  };

  const hearAside = () => {
    const pendingSpeech = aside.pending?.speech;
    if (!pendingSpeech) return;
    const name = game.companion?.name || "同行者";
    setAside({ pending: null, shown: pendingSpeech, lastHeardAt: Date.now() });
    setGame((prev) => recordPlay(prev, "aside", `${name}说：「${pendingSpeech}」`));
  };

  const dismissAside = () => {
    setAside((prev) => (prev.shown ? { ...prev, shown: "" } : prev));
  };

  useEffect(() => {
    if (!pageLive || phase !== "play" || !game.companion?.name) return undefined;
    if (dialog || dice) return undefined;
    if (aside.pending?.speech || asideFetch.current) return undefined;
    const waited = Date.now() - (aside.lastHeardAt || 0);
    const delay = Math.max(400, ASIDE_GAP_MS - waited);
    const ticket = asideTicket.current;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      if (!isPageLive() || asideTicket.current !== ticket || asideFetch.current) return;
      asideFetch.current = true;
      try {
        const result = await generateCompanionAside(gameRef.current, controller.signal);
        if (asideTicket.current !== ticket) return;
        if (result?.speech) {
          setAside((prev) => ({ ...prev, pending: result }));
        } else {
          setAside((prev) => ({ ...prev, lastHeardAt: Date.now() }));
        }
      } catch (error) {
        if (isAbortError(error) || asideTicket.current !== ticket) return;
        setAside((prev) => ({ ...prev, lastHeardAt: Date.now() }));
      } finally {
        if (asideTicket.current === ticket) asideFetch.current = false;
      }
    }, delay);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [pageLive, phase, game.companion?.name, dialog, dice, aside.pending, aside.lastHeardAt]);

  useEffect(() => {
    if (phase === "play") return undefined;
    asideTicket.current += 1;
    asideFetch.current = false;
    riftTicket.current += 1;
    riftFetch.current = false;
    return undefined;
  }, [phase]);

  useEffect(() => {
    if (!pageLive && phase === "play") {
      asideTicket.current += 1;
      asideFetch.current = false;
      riftTicket.current += 1;
      riftFetch.current = false;
    }
  }, [pageLive, phase]);

  useEffect(() => {
    if (!pageLive || phase !== "play") return undefined;
    if (siteStay.tutoring) return undefined;
    if (siteStay.view !== "site" || siteStay.location !== "harbor") return undefined;
    const rift = game.rift || emptyRift();
    if (rift.status === "done" || rift.status === "ready") return undefined;
    if (riftFetch.current) return undefined;
    const ticket = riftTicket.current;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      if (!isPageLive() || riftTicket.current !== ticket || riftFetch.current) return;
      riftFetch.current = true;
      try {
        const event = await generateHarborRift(gameRef.current, controller.signal);
        if (riftTicket.current !== ticket) return;
        if (event) setGame((prev) => ({ ...prev, rift: { status: "ready", event } }));
      } catch (error) {
        if (isAbortError(error) || riftTicket.current !== ticket) return;
      } finally {
        if (riftTicket.current === ticket) riftFetch.current = false;
      }
    }, RIFT_DWELL_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [pageLive, phase, siteStay.view, siteStay.location, siteStay.tutoring, game.rift?.status]);

  const ackRift = () => {
    const event = game.rift?.event;
    if (!event || game.rift?.status !== "ready") return;
    setGame((prev) => {
      let next = applyRiftEvent(prev, event);
      next = recordPlay(next, "action", `异变突生：${event.title}。${event.impact}`);
      return next;
    });
    if (event.player_note) rememberPlayerFact(event.player_note);
  };

  const unlockYongyin = () => {
    setGame((prev) => {
      if (prev.routeFlags?.yongyinUnlocked) return prev;
      let next = {
        ...prev,
        routeFlags: { ...prev.routeFlags, yongyinUnlocked: true },
        sceneNote: "电子锁弹开。对面的人愿意开口了。",
      };
      next = recordPlay(next, "action", "破解了灯塔里那人丢来的电子锁");
      return noteMap(next, "灯塔里的人解开了电子锁，愿意开口", "lighthouse");
    });
    rememberPlayerFact("你解开了灯塔里那人丢来的电子锁，她才肯和你说话。");
  };

  const saveAnchor = () => {
    setGame((prev) =>
      addImprint(
        { ...prev, anchorsUsed: prev.anchorsUsed + 1, saveSlots: [...prev.saveSlots, { loop: prev.loop, screen: prev.screen }] },
        "anchor",
        "主动保存",
        "你记住了这一刻",
      ),
    );
  };

  useEffect(() => {
    if (game.screen === "B-3" && game.awareness >= 100) {
      setGame((prev) => nextFromChoice({ ...prev, capture: true, awareness: 100 }, { id: "cap", goto: "B-4", flag: "captured" }));
    }
  }, [game.awareness, game.screen]);

  useEffect(() => {
    if (game.screen !== "C-4" || whisper >= 3) return;
    const t = setTimeout(() => setWhisper((n) => n + 1), 1600);
    return () => clearTimeout(t);
  }, [game.screen, whisper]);

  if (phase !== "play") {
    return (
      <div className="tide-root">
        <div className={`tide-stage${phase === "briefing" || phase === "chargen" || phase === "companion" || phase === "intermission" || phase === "assessment" ? " is-briefing" : ""}`}>
          <div
            className="tide-bg"
            style={{
              backgroundImage: `url(${phase === "boot" ? bgForScreen("A-1") : bgForAct("map")})`,
            }}
          />
          <div className="tide-veil" />
          {phase === "briefing" ? (
            <OpeningBriefing busy={busy} onConfirm={enterWorld} />
          ) : phase === "chargen" ? (
            <CharacterSheet onConfirm={finishChargen} />
          ) : phase === "companion" ? (
            <CompanionReveal
              companion={game.companion}
              briefing={game.player?.personality}
              loading={companionLoading}
              onDepart={enterPlay}
            />
          ) : phase === "assessment" ? (
            <PersonalityReport report={assessment} onBack={() => setPhase("intermission")} />
          ) : phase === "intermission" ? (
            <section className="boot">
              <p className="sub">TIDE REQUIEM · 第二幕</p>
              <h1>被掩埋的记录</h1>
              <p className="body">急件还锁在驿站柜子里。下一幕尚未开放。</p>
              <span className="hint-host inter-actions">
                <button className="tide-btn gold" type="button" disabled={Boolean(busy)} onClick={viewAssessment}>
                  {busy || "查看性格测评"}
                </button>
                <Hint text="对照这一局里你做过的事、说过的话，以及开局简报和本幕目标，给出一份能落地的结论。" />
              </span>
            </section>
          ) : (
            <section className="boot">
              <p className="sub">TIDE REQUIEM · 潮汐挽歌</p>
              <h1>时隙行者</h1>
              <p className="body">穿过碎掉的时间，落到潮汐还没失控的港湾。</p>
              <span className="hint-host" style={{ marginTop: 28 }}>
                <button className="tide-btn gold" type="button" disabled={Boolean(busy)} onClick={start}>
                  {busy || "开始游戏"}
                </button>
                <Hint text="开始新游戏。先阅读航线简报，再落入黎明纪元。" />
              </span>
            </section>
          )}
          {busy ? <div className="busy">{busy}</div> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="tide-root">
      <div className="tide-stage">
        <div className="tide-bg" style={{ backgroundImage: `url(${bgForAct("map")})` }} />
        <div className="tide-veil" />
        <PlayStage
          game={game}
          note={note}
          startTutorial={wantTutorial}
          aside={aside}
          dialogOpen={Boolean(dialog)}
          diceOpen={Boolean(dice)}
          onMove={(id) =>
            setGame((prev) => {
              if (prev.location === id) return prev;
              const name = locationById(id)?.name || id;
              let next = recordPlay({ ...prev, location: id, sceneNote: "" }, "move", `前往${name}`);
              next = noteMap(next, `有人前往${name}`, "world");
              next = noteMap(next, `有人进入${name}`, id);
              return next;
            })
          }
          onPick={pick}
          onTalk={openDialog}
          onHearAside={hearAside}
          onDismissAside={dismissAside}
          onSiteStay={setSiteStay}
          onAckRift={ackRift}
          onYongyinUnlock={unlockYongyin}
          onCheckBrief={checkBrief}
          onAckAct1={() => {
            setGame((prev) =>
              recordPlay(
                {
                  ...prev,
                  routeFlags: { ...prev.routeFlags, act1Ack: true, act1_closed: true },
                },
                "action",
                "第一幕结束，急件仍锁在驿站柜子里",
              ),
            );
            setPhase("intermission");
          }}
        />
        {busy ? <div className="busy">{busy}</div> : null}
        {dice ? <DiceModal dice={dice} onClose={closeDice} /> : null}
        {dialog ? (
          <DialogModal
            dialog={dialog}
            playerName={game.player?.name || "你"}
            portrait={npcFace(dialog.npc, game.companion)}
            onChange={(draft) => setDialog((d) => ({ ...d, draft }))}
            onSend={sendTalk}
            onClose={() => setDialog(null)}
          />
        ) : null}
        {settle ? (
          <SettleModal
            game={game}
            onPick={(mode) => {
              setSettle(false);
              setGame((prev) => loopBack(prev, mode));
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

function renderLayout(screen, game, pick, ctx) {
  const layout = screen.layout;
  if (layout === "era5") return <Era5 screen={screen} onPick={pick} />;
  if (layout === "act3") return <Act3 screen={screen} onPick={pick} />;
  if (layout === "radar") return <Radar screen={screen} game={game} onPick={pick} />;
  if (layout === "missions") return <Missions screen={screen} onPick={pick} />;
  if (layout === "stealth") return <Stealth screen={screen} game={game} onPick={pick} ctx={ctx} />;
  if (layout === "scale") return <Scale screen={screen} game={game} onPick={pick} />;
  if (layout === "echo") return <Echo screen={screen} game={game} onPick={pick} />;
  if (layout === "ritual") return <Ritual screen={screen} onPick={pick} />;
  if (layout === "tri") return <Tri screen={screen} game={game} onPick={pick} />;
  if (layout === "finale") return <Finale screen={screen} game={game} onPick={pick} />;
  if (layout === "wall") return <Wall screen={screen} game={game} onPick={pick} ctx={ctx} />;
  if (layout === "memory") return <Memory screen={screen} game={game} onPick={pick} />;
  if (layout === "fork") return <Fork screen={screen} game={game} onPick={pick} ctx={ctx} />;
  if (layout === "paradox") return <Paradox screen={screen} onPick={pick} />;
  if (layout === "repair") return <Repair screen={screen} onPick={pick} />;
  if (layout === "karsus") return <Karsus screen={screen} onPick={pick} />;
  if (layout === "multi") return <Multi screen={screen} onPick={pick} />;
  return <Era5 screen={screen} onPick={pick} />;
}

function ChoiceRow({ choices, onPick }) {
  return (
    <div className="choice-row">
      {choices.map((c) => (
        <button key={c.id} className={`choice ${c.color || "cyan"}`} type="button" onClick={() => onPick(c)}>
          <Hint text={choiceHint(c)} />
          <div className="num">{c.num}</div>
          <h4>{c.title}</h4>
          <p>{c.skill ? `${c.skill} DC${c.dc}` : c.label || ""}</p>
          <span className="ico">{c.icon || "›"}</span>
        </button>
      ))}
    </div>
  );
}

function Era5({ screen, onPick }) {
  return (
    <div className="era5">
      <div className="era5-top">
        <div className="panel">
          <h2 className="glitch">{screen.title}</h2>
          <p className="sub">{screen.subtitle}</p>
          <p className="body">{screen.body}</p>
          <p className="prompt">&gt; {screen.prompt}</p>
        </div>
        <div className="panel mag anchor-card">
          <h3>时间锚点</h3>
          {screen.anchor ? (
            <dl>
              <div>强度 {screen.anchor.strength}%</div>
              <div>频率 {screen.anchor.hz}</div>
              <div>{screen.anchor.status}</div>
            </dl>
          ) : (
            <p className="tiny">{screen.imprintHint}</p>
          )}
        </div>
      </div>
      {screen.extraChoices?.length ? <ChoiceRow choices={screen.extraChoices} onPick={onPick} /> : null}
      <ChoiceRow choices={screen.choices} onPick={onPick} />
    </div>
  );
}

function Act3({ screen, onPick }) {
  return (
    <div className="act3">
      <div className="act3-hero">
        <div className="panel">
          <h2 className="glitch">{screen.title}</h2>
          <p className="sub">{screen.subtitle}</p>
          <ul className="plain">
            {screen.body.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
        <div>
          {screen.clues.map((c) => (
            <div className="clue" key={c.id}>
              <b>{c.code}</b>
              <div>{c.text}</div>
            </div>
          ))}
        </div>
        <div className="panel feat-npc">
          <img alt="涌音" src={FACE.yongyin} />
          <b>失明女先知 · 涌音</b>
        </div>
      </div>
      <ChoiceRow choices={screen.choices} onPick={onPick} />
    </div>
  );
}

function Radar({ screen, game, onPick }) {
  return (
    <div className="era5">
      <div className="radar-wrap">
        <div className="panel">
          <h2 className="glitch">{screen.title}</h2>
          <p className="body">{screen.body}</p>
          <div className="radar">
            {screen.radar.map((p) => (
              <button
                key={p.id}
                className={`radar-dot ${game.exploredRadar.includes(p.id) ? "on" : ""}`}
                style={{ left: `${p.x}%`, top: `${p.y}%` }}
                type="button"
                onClick={() => onPick({ id: p.id, skill: "洞察", dc: 12, radar: p.id, title: p.name })}
              >
                <Hint text={choiceHint({ id: p.id, skill: "洞察", dc: 12, title: p.name })} />
                <span>{p.name}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="panel mag alert">警告：时间线即将断裂。已探索 {game.exploredRadar.length}/3</div>
      </div>
      <ChoiceRow choices={screen.choices} onPick={onPick} />
    </div>
  );
}

function Missions({ screen, onPick }) {
  return (
    <div className="missions">
      <div className="panel">
        <h2 className="glitch">{screen.title}</h2>
        <p className="sub">{screen.subtitle}</p>
        <p className="body">{screen.body}</p>
      </div>
      <div className="mission-row">
        {screen.missions.map((m) => (
          <button key={m.id} className={`panel mission choice ${m.color}`} type="button" onClick={() => onPick({ ...m, id: m.id })}>
            <Hint text={choiceHint(m)} />
            <span className="tiny">{m.tag}</span>
            <h4>{m.title}</h4>
            <div className="pips">{"■".repeat(m.diff)}{"□".repeat(5 - m.diff)}</div>
          </button>
        ))}
      </div>
      <ChoiceRow choices={screen.decisions} onPick={onPick} />
    </div>
  );
}

function Stealth({ screen, game, onPick, ctx }) {
  const rotate = (idx) => {
    ctx.setGame((prev) => {
      const runes = [...prev.runes];
      runes[idx] = (runes[idx] + 1) % 4;
      const aligned = runes.every((n) => n === 1);
      if (aligned) return nextFromChoice(prev, { id: "rune", goto: "B-5", title: "符文对齐" });
      return { ...prev, runes, awareness: Math.min(100, prev.awareness + 8) };
    });
  };
  const cover = (id) => {
    ctx.setGame((prev) => ({ ...prev, covers: [...new Set([...prev.covers, id])], awareness: Math.max(0, prev.awareness - 6) }));
  };
  return (
    <div className="stealth">
      <div className="panel">
        <b>小队潜行</b>
        <p className="tiny">夜隼 82% · 影织 76%</p>
        <p className="tiny">加成 +25%</p>
      </div>
      <div className="panel map">
        <h2 className="glitch">{screen.title}</h2>
        <div className="guard" style={{ left: "30%", top: "20%" }} />
        <div className="guard" style={{ left: "58%", top: "40%", animationDelay: "-2s" }} />
        <button className="cover" style={{ left: "18%", top: "55%" }} type="button" onClick={() => cover("a")}>
          <Hint text="左侧掩体。点击躲藏，降低察觉度。" />
        </button>
        <button className="cover" style={{ left: "48%", top: "62%" }} type="button" onClick={() => cover("b")}>
          <Hint text="中央掩体。点击躲藏，降低察觉度。" />
        </button>
        <button className="cover" style={{ left: "72%", top: "48%" }} type="button" onClick={() => cover("c")}>
          <Hint text="右侧掩体。点击躲藏，降低察觉度。" />
        </button>
        <div className="rune">
          {game.runes.map((n, i) => (
            <span className="hint-host" key={i}>
              <button type="button" onClick={() => rotate(i)}>
                {["水", "光", "土", "暗"][n]}
              </button>
              <Hint text="点击旋转符文。三环都转到「光」可打开密道，每次旋转会提高察觉度。" />
            </span>
          ))}
        </div>
      </div>
      <div className="panel mag">
        <b>察觉度 {game.awareness}%</b>
        <div className="tide-bar warn">
          <i style={{ width: `${game.awareness}%` }} />
        </div>
        {game.awareness >= 100 ? <p className="tiny">被俘 → 教廷对峙</p> : null}
      </div>
      <div style={{ gridColumn: "1 / -1" }}>
        <ChoiceRow choices={screen.choices} onPick={onPick} />
      </div>
    </div>
  );
}

function Scale({ screen, game, onPick }) {
  return (
    <div className="scale">
      <div className="scale-hero">
        <div className="panel mag">
          <h3>教廷使者 · 维斯坎特</h3>
          <p className="body">2000 信用点、抹消调查、同伴特赦、临时调阅。</p>
        </div>
        <div className="panel balance">
          <h2 className="glitch">博弈天平</h2>
          <div className="bars">
            <div>
              教廷压力 {game.churchPressure}%
              <div className="tide-bar warn">
                <i style={{ width: `${game.churchPressure}%` }} />
              </div>
            </div>
            <div>
              真相分量 {game.truthWeight}%
              <div className="tide-bar">
                <i style={{ width: `${game.truthWeight}%` }} />
              </div>
            </div>
          </div>
        </div>
        <div className="panel testi">
          {screen.testimonies.map((t) => (
            <p key={t.title}>
              <b>{t.title}</b> {t.who} 信任{t.trust}% — {t.text}
            </p>
          ))}
        </div>
      </div>
      <ChoiceRow choices={screen.choices} onPick={onPick} />
    </div>
  );
}

function Echo({ screen, game, onPick }) {
  return (
    <div className="echo">
      <div className="panel">
        <h2 className="glitch">{screen.title}</h2>
        <p className="body">{screen.body}</p>
      </div>
      <div className="wave">
        <span className="hint-host">
          <button type="button" className="tide-btn">
            ▶
          </button>
          <Hint text="示意正在接入残响。请用下方选项分段聆听，不要只按播放。" />
        </span>
        {[1, 2, 3].map((n) => (
          <div key={n} className={`seg ${game.echoSegments[n] ? "on" : ""} ${n === 3 ? "mag" : ""}`} />
        ))}
      </div>
      <ChoiceRow choices={screen.choices} onPick={onPick} />
    </div>
  );
}

function Ritual({ screen, onPick }) {
  return (
    <div className="ritual">
      <div className="panel">
        <p className="sub">第三幕剧情</p>
        <h2 className="glitch">{screen.title}</h2>
        <p className="body">{screen.body}</p>
      </div>
      <div className="panel">
        <b>仪式草图蓝图</b>
        <svg className="wave-svg" viewBox="0 0 200 60">
          <path d="M0 30 Q 25 5 50 30 T 100 30 T 150 30 T 200 30" stroke="#2ef0ff" fill="none" />
          <path d="M0 30 Q 25 55 50 30 T 100 30 T 150 30 T 200 30" stroke="#ff2ea6" fill="none" />
        </svg>
        <p className="tiny">水 + 暗 = 侵蚀 · 光 + 土 = 中和</p>
      </div>
      <div style={{ gridColumn: "1 / -1" }}>
        <ChoiceRow choices={screen.choices} onPick={onPick} />
      </div>
    </div>
  );
}

function Tri({ screen, game, onPick }) {
  return (
    <div className="tri">
      <h2 className="glitch">{screen.title}</h2>
      <div className="zones">
        {screen.zones.map((z) => (
          <div key={z.id} className={`panel ${z.color === "magenta" ? "mag" : ""}`}>
            <b>{z.title}</b>
            <p className="tiny">危机 {z.danger}/5 · {z.time}</p>
            <div className="tide-bar">
              <i style={{ width: `${z.progress}%` }} />
            </div>
            <p className="tiny">优势 {game.triAdv[z.id] || 0}</p>
          </div>
        ))}
      </div>
      <div className="aid">
        <div className="panel">援助度 {game.aidLevel}%</div>
        <div className="panel mag">满共振 130%</div>
      </div>
      <ChoiceRow choices={screen.choices} onPick={onPick} />
    </div>
  );
}

function Finale({ screen, game, onPick }) {
  const unlocked = {
    "D-1": game.stability >= 60 && game.routeFlags.act4done,
    "D-2": game.paradoxLevel >= 50 || game.stability <= 0 || game.stability < 40,
    "D-3": Boolean(game.routeFlags.forkSeen && game.imprints.length >= 6),
  };
  if (!unlocked["D-1"] && !unlocked["D-2"] && !unlocked["D-3"]) unlocked["D-2"] = true;
  return (
    <div className="finale">
      <div className="panel">
        <p className="sub">第五幕：终局</p>
        <h2 className="glitch">{screen.title}</h2>
        <p className="body">{screen.body}</p>
      </div>
      <div className="acts">
        {["涌动的预兆", "被掩埋的记录", "虚空教团", "三线共鸣", "挽歌之后"].map((t, i) => (
          <div key={t} className={`panel ${i === 4 ? "mag" : ""}`}>
            第{i + 1}幕
            <div>{t}</div>
            <b>完成</b>
          </div>
        ))}
      </div>
      <div className="end-cards">
        {screen.endings.map((e) => (
          <button
            key={e.id}
            className={`panel choice ${e.color}`}
            type="button"
            disabled={!unlocked[e.id]}
            onClick={() => onPick({ id: e.id, goto: e.id })}
          >
            <Hint text={choiceHint(e)} />
            <div className="num">路由 {e.code}</div>
            <h4>{e.title}</h4>
            <p>{e.need}</p>
            <p>{unlocked[e.id] ? "已解锁" : "Locked"}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

function Wall({ screen, game, onPick, ctx }) {
  return (
    <div className="wall">
      <div className="panel">
        <h2 className="glitch">{screen.title}</h2>
        <p className="body">{screen.body}</p>
        <div className="alert">关键线索：时间回溯装置 Ω-7</div>
      </div>
      <div className="panel">证据墙 · 红线由系统判定关联</div>
      <div className="suspect">
        {screen.suspects.map((s) => (
          <button
            key={s.id}
            className="npc-card"
            type="button"
            onClick={() =>
              ctx.setGame((prev) => ({
                ...prev,
                suspicion: { ...prev.suspicion, [s.id]: (prev.suspicion[s.id] || 0) + 1 },
                accused: s.id,
              }))
            }
          >
            <Hint text={`点击给${s.name}加疑点并指认。五人没有预置真凶外观。`} />
            {FACE[s.id] ? <img alt={s.name} src={FACE[s.id]} /> : <div className="npc-ph">{s.name.slice(0, 1)}</div>}
            <div>
              <b>{s.name}</b>
              <span>
                {s.role} · 疑点 {game.suspicion[s.id] || 0}
              </span>
            </div>
          </button>
        ))}
      </div>
      <div style={{ gridColumn: "1 / -1" }}>
        <ChoiceRow choices={screen.choices} onPick={onPick} />
      </div>
    </div>
  );
}

function Memory({ screen, game, onPick }) {
  return (
    <div className="memory">
      <div className="panel">
        <h2 className="glitch">{screen.title}</h2>
        <p className="body">{screen.body}</p>
        {screen.conflicts.map((c) => (
          <p key={c.a} className="tiny">
            冲突：{c.a} / {c.b}
          </p>
        ))}
      </div>
      <div className="panel mag">
        <div className="ring">{game.memoryIntegrity}%</div>
        <p className="tiny">记忆完整度</p>
      </div>
      <div style={{ gridColumn: "1 / -1" }}>
        <ChoiceRow choices={screen.choices} onPick={onPick} />
      </div>
    </div>
  );
}

function Fork({ screen, game, onPick, ctx }) {
  return (
    <div className="fork">
      <div className="panel">
        <h2 className="glitch">{screen.title}</h2>
        <p className="body">{screen.body}</p>
      </div>
      <div className="branches">
        {screen.branches.map((b) => (
          <button
            key={b.id}
            className={`panel ${game.branch === b.id ? "on" : ""}`}
            type="button"
            onClick={() => ctx.setGame((prev) => ({ ...prev, branch: b.id }))}
          >
            <Hint text={choiceHint(b)} />
            <b>{b.title}</b>
            <div className="tiny">{b.stab}%</div>
          </button>
        ))}
      </div>
      <ChoiceRow choices={screen.choices} onPick={onPick} />
    </div>
  );
}

function Paradox({ screen, onPick }) {
  return (
    <div className="paradox">
      <div className="panel">
        <h2 className="glitch">{screen.title}</h2>
        <p className="body">{screen.body}</p>
      </div>
      <div className="panel quote">
        <b>卡尔萨斯</b>
        <p>{screen.quote}</p>
      </div>
      <div className="panel mag">对话历史 · 污染度评估：高</div>
      <div style={{ gridColumn: "1 / -1" }}>
        <ChoiceRow choices={screen.choices} onPick={onPick} />
      </div>
    </div>
  );
}

function Repair({ screen, onPick }) {
  return (
    <div className="repair">
      <div className="panel">
        <h2 className="glitch">{screen.title}</h2>
        <p className="body">{screen.body}</p>
      </div>
      <div className="zones">
        {screen.tracks.map((t) => (
          <button key={t.id} className={`panel choice ${t.color}`} type="button" onClick={() => onPick({ ...t, dc: 15 })}>
            <Hint text={choiceHint(t)} />
            <h4>{t.title}</h4>
            <p>
              {t.skill} DC{t.dc}
            </p>
          </button>
        ))}
      </div>
      <div className="end-cards">
        {screen.variants.map((v) => (
          <div key={v.id} className="panel">
            {v.title} {v.stab}%
          </div>
        ))}
      </div>
      <ChoiceRow choices={screen.choices} onPick={onPick} />
    </div>
  );
}

function Karsus({ screen, onPick }) {
  return (
    <div className="karsus">
      <div className="panel mag">
        卡尔萨斯 · 时蚀主宰
        <div className="boss">
          <i />
        </div>
      </div>
      <div className="panel">
        <h2 className="glitch">{screen.title}</h2>
        <p className="body">{screen.body}</p>
      </div>
      <ChoiceRow choices={screen.choices} onPick={onPick} />
    </div>
  );
}

function Multi({ screen, onPick }) {
  return (
    <div className="multi">
      <h2 className="glitch">{screen.title}</h2>
      <div className="layers">
        <div className="layer-band" style={{ color: "#e8c36a" }}>
          英雄时间线（已守护）
        </div>
        <div className="layer-band" style={{ color: "#ff2ea6" }}>
          反派时间线（未守护）
        </div>
        <div className="layer-band" style={{ color: "#889" }}>
          空白时间线（未探索）
        </div>
      </div>
      <ChoiceRow choices={screen.choices} onPick={onPick} />
    </div>
  );
}

function DiceModal({ dice, onClose }) {
  const ready = !dice.rolling;
  return (
    <div className="overlay">
      <div className="modal">
        <p className="sub">骰子判定 · DICE_ROLL</p>
        <div className="dice-grid">
          <div className="panel">
            <b>
              {dice.skill} DC {dice.dc}
            </b>
            <p className="tiny">修正 +{dice.mod}{dice.aid ? " · 援助" : ""}</p>
          </div>
          <div>
            <img alt="d20" src={diceD20} style={{ width: 64, display: "block", margin: "0 auto 8px" }} />
            <div className="d20">{dice.show ?? dice.roll}</div>
          </div>
          <div className="panel">
            <b>{ready ? { crit: "大成功", success: "成功", fail: "失败", fumble: "大失败" }[dice.state] : "滚动中"}</b>
            {ready ? (
              <p className="tiny">
                {dice.roll} + {dice.mod} = {dice.total} ≥ {dice.dc}
              </p>
            ) : null}
          </div>
        </div>
        <span className="hint-host" style={{ marginTop: 12, display: "inline-block" }}>
          <button className="tide-btn" type="button" disabled={!ready} onClick={onClose}>
            继续
          </button>
          <Hint text="骰子停稳后点此结算。成功推进当前选项，失败可能改道或扣稳定度。" />
        </span>
      </div>
    </div>
  );
}

function DialogModal({ dialog, playerName, portrait, onChange, onSend, onClose }) {
  const npc = dialog.npc;
  const selfName = playerName || "你";
  return (
    <div className="overlay">
      <div className="modal">
        <div className="dialog-grid">
          <div className="panel mag">
            {portrait ? (
              <img className="dialog-face" alt={npc.name} src={portrait} />
            ) : null}
            <h3>{npc.name}</h3>
            <p className="tiny">{npc.role}</p>
            <p>信任 {npc.trust}/100</p>
          </div>
          <div>
            <div className="track">
              <span>敌对</span>
              <span>中立</span>
              <span>友好</span>
              <span>挚友</span>
            </div>
            <div className="chat">
              {dialog.lines.length ? (
                dialog.lines.map((line, i) => (
                  <div key={i} className={line.who}>
                    {line.who === "me" ? selfName : npc.name}：{line.text}
                  </div>
                ))
              ) : (
                <div className="tiny">点击选项或输入，进入深度对话。</div>
              )}
            </div>
            <div className="talk-row">
              <input value={dialog.draft} onChange={(e) => onChange(e.target.value)} onKeyDown={(e) => e.key === "Enter" && onSend()} />
              <span className="hint-host">
                <button className="tide-btn" type="button" onClick={onSend}>
                  说
                </button>
                <Hint text="把输入发给对方，进入深度对话。对方按人设回答，不会替你做决定。" />
              </span>
              <span className="hint-host">
                <button className="tide-btn magenta" type="button" onClick={onClose}>
                  返回
                </button>
                <Hint text="关闭对话，回到当前幕。信任与态度会保留。" />
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettleModal({ game, onPick }) {
  return (
    <div className="overlay">
      <div className="modal">
        <p className="sub">Loop {String(game.loop).padStart(2, "0")} 结算</p>
        <h2 className="glitch">时间线稳定度 {game.stability.toFixed(1)}%</h2>
        <p className="tiny">印记 {game.imprints.map((i) => imprintLabel(i.type)).join(" · ") || "无"}</p>
        <div className="choice-row" style={{ marginTop: 12 }}>
          <button className="choice cyan" type="button" onClick={() => onPick("A")}>
            <Hint text="从最近一次保存的锚点重启本轮，保留锚点印记。" />
            <h4>从最近锚点重启</h4>
            <p>保留锚点印记</p>
          </button>
          <button className="choice magenta" type="button" onClick={() => onPick("B")}>
            <Hint text="随机跳到分叉全景，重新选择一条时间线。" />
            <h4>随机跳转新分支</h4>
            <p>进入分叉全景</p>
          </button>
          <button className="choice gold" type="button" onClick={() => onPick("C")}>
            <Hint text="按当前稳定度、悖论与印记，直接进入已解锁的终局。" />
            <h4>直面终局</h4>
            <p>{pickEnding(game)}</p>
          </button>
        </div>
      </div>
    </div>
  );
}

function stealthAct(prev, kind) {
  let awareness = prev.awareness;
  if (kind === "hide") awareness = Math.max(0, awareness - 12);
  if (kind === "noise") awareness = Math.min(100, awareness + 8);
  if (kind === "disguise") awareness = Math.max(0, awareness - 6);
  const next = { ...prev, awareness };
  if (awareness >= 100) return nextFromChoice({ ...next, capture: true }, { id: "cap", goto: "B-4", flag: "captured" });
  return next;
}

function pickSpeech(data, npcId) {
  const log = data?.state?.log || [];
  for (let i = log.length - 1; i >= 0; i -= 1) {
    if (log[i].speech && log[i].actor_id === npcId) return log[i].speech;
  }
  const output = String(data?.output || "");
  const quoted = output.match(/「([^」]+)」/);
  if (quoted) return quoted[1];
  return output || "……";
}
