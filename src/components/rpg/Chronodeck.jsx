import { useEffect, useMemo, useRef, useState } from "react";
import {
  bootstrap,
  getMemories,
  getState,
  loadGame,
  newGame,
  runCommand,
  saveGame,
} from "@/engine/session";
import { getSettings, setApiKey } from "@/engine/config";
import { diceD20, FACES } from "./assets";
import ActPlayScreen from "./ActPlayScreen";

function quests(state, visited) {
  const story = state.story || {};
  const objs = story.objectives || [];
  if (objs.length) {
    return objs.map((desc, index) => ({
      ico: ["!", "◆", "▲", "▣"][index] || "·",
      color: ["#ff4d6d", "#2ef0ff", "#3dff9a", "#b44cff"][index] || "#2ef0ff",
      title: `目标 ${index + 1}`,
      desc,
      n: story.flags?.length ? `${Math.min(story.flags.length, index + 1)}/1` : "0/1",
    }));
  }
  const talked = (state.log || []).some(
    (entry) => entry.type === "spoke" && (entry.actor_id === "ewen" || (entry.text || "").includes("伊文")),
  );
  return [
    { ico: "!", color: "#ff4d6d", title: "听涌预兆", desc: "向涌音确认预警不是潮汐传闻", n: visited.has("lighthouse") ? "1/1" : "0/1" },
    { ico: "◆", color: "#2ef0ff", title: "被压下的急件", desc: "向伊文打听封存柜里的预警急件", n: talked ? "1/1" : "0/1" },
    { ico: "▲", color: "#3dff9a", title: "议会认可", desc: "请盐语者说明听涌的局限与水路", n: visited.has("council") ? "1/1" : "0/1" },
    { ico: "▣", color: "#b44cff", title: "沉没时钟塔", desc: "抵达海面下的时钟塔", n: visited.has("sunken_clock") ? "1/1" : "0/1" },
  ];
}

function lastLogLine(state) {
  const last = (state.log || []).at(-1);
  if (!last) return `> 扇区锁定：${state.location.name}`;
  return `> ${last.text || (last.speech ? `${last.actor_name}：「${last.speech}」` : "")}`;
}

function chatEntries(log) {
  return (log || []).filter((entry) => entry.type === "spoke" && String(entry.speech || "").trim());
}

const BOOT_LINES = [
  "> LINKING RIFT ANCHOR…… OK",
  "> WORLD ENGINE ………… ONLINE",
  "> PERCEPTION FIREWALL … ACTIVE",
  "> ACTOR CHANNEL ……… STANDBY",
];

export default function Chronodeck() {
  const [screen, setScreen] = useState("title");
  const [bootLog, setBootLog] = useState("");
  const [bootClock, setBootClock] = useState("00:00");
  const [engineNote, setEngineNote] = useState("");
  const [hasCurrent, setHasCurrent] = useState(false);
  const [saves, setSaves] = useState([]);
  const [state, setState] = useState(null);
  const [mode, setMode] = useState("explore");
  const [talkTarget, setTalkTarget] = useState(null);
  const [visited, setVisited] = useState(() => new Set());
  const [lastOutput, setLastOutput] = useState("");
  const lastLogId = useRef("");
  const [sheet, setSheet] = useState(null);
  const [busy, setBusy] = useState(null);
  const [toast, setToast] = useState("");
  const [questCollapsed, setQuestCollapsed] = useState(false);
  const [questHidden, setQuestHidden] = useState(false);
  const [diceNum, setDiceNum] = useState("");
  const [diceRolling, setDiceRolling] = useState(false);
  const [talkText, setTalkText] = useState("");
  const [combatText, setCombatText] = useState("把剑放在桌上，盯着对方");
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const transcriptRef = useRef(null);
  const toastTimer = useRef(null);
  const busyTimer = useRef(null);

  const showToast = (message) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2400);
  };

  const rememberVisit = (nextState) => {
    setVisited((prev) => {
      const next = new Set(prev);
      next.add(nextState.location.id);
      for (const entry of nextState.log || []) {
        if (entry.location_id) next.add(entry.location_id);
      }
      return next;
    });
  };

  const applyState = (nextState) => {
    rememberVisit(nextState);
    setState(nextState);
  };

  const withBusy = async (label, fn) => {
    const start = Date.now();
    setBusy(`${label} · 0s`);
    clearInterval(busyTimer.current);
    busyTimer.current = setInterval(() => {
      setBusy(`${label} · ${Math.round((Date.now() - start) / 1000)}s`);
    }, 250);
    try {
      return await fn();
    } finally {
      clearInterval(busyTimer.current);
      setBusy(null);
    }
  };

  useEffect(() => {
    let i = 0;
    const timer = setInterval(() => {
      if (i >= BOOT_LINES.length) {
        clearInterval(timer);
        return;
      }
      setBootLog((prev) => `${prev}${BOOT_LINES[i]}\n`);
      i += 1;
    }, 280);
    const clock = setInterval(() => {
      const now = new Date();
      setBootClock(`${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`);
    }, 1000);
    try {
      const data = bootstrap();
      setHasCurrent(Boolean(data.has_current));
      setSaves(data.saves || []);
      setEngineNote(data.uses_llm ? `ACTOR LINK · ${data.model}` : "NO API KEY · 规则演员在线");
    } catch (error) {
      setEngineNote(error.message);
    }
    return () => {
      clearInterval(timer);
      clearInterval(clock);
      clearTimeout(toastTimer.current);
      clearInterval(busyTimer.current);
    };
  }, []);

  useEffect(() => {
    if (transcriptRef.current) transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
  }, [state, sheet]);

  const player = useMemo(() => {
    if (!state) return null;
    return state.party.find((person) => person.is_player) || state.present.find((person) => person.is_player);
  }, [state]);

  const sendCommand = async (body, { reopen } = {}) => {
    const talking = body.action === "say" || body.action === "talk" || mode === "interact";
    try {
      const data = await withBusy(talking && body.text ? "角色正在回应" : "正在结算", () => runCommand(body));
      setLastOutput(data.output || "");
      const lastId = data.state.log.at(-1)?.id || "";
      applyState(data.state);
      if (talking || reopen === "interact") setSheet("interact");
      else if (data.output && lastId === lastLogId.current) showToast(data.output);
      lastLogId.current = lastId;
    } catch (error) {
      showToast(error.message);
    }
  };

  const enterPlay = (payload) => {
    const next = payload.state || payload;
    applyState(next);
    setQuestHidden(false);
    setScreen("play");
  };

  const handleNew = async () => {
    try {
      const data = await withBusy("SYNCING ACTOR…", () => newGame());
      setVisited(new Set());
      setTalkTarget(null);
      enterPlay(data);
      showToast("新时间线已展开");
      setSheet("explore");
    } catch (error) {
      showToast(error.message);
    }
  };

  const handleContinue = async () => {
    try {
      const next = await withBusy("SYNCING ACTOR…", () => getState());
      enterPlay({ state: next });
    } catch (error) {
      showToast(error.message);
    }
  };

  const handleLoad = async (gameId) => {
    try {
      const data = await withBusy("SYNCING ACTOR…", () => loadGame(gameId));
      enterPlay(data);
      showToast("时间残片已载入");
    } catch (error) {
      showToast(error.message);
    }
  };

  const handleSave = () => {
    try {
      const data = saveGame();
      showToast(`已写入 ${data.game_id}`);
    } catch (error) {
      showToast(error.message);
    }
  };

  const showMemories = async (characterId) => {
    try {
      const data = await withBusy("读取记忆扇区", () => getMemories(characterId));
      setSheet({ kind: "memories", data });
    } catch (error) {
      showToast(error.message);
    }
  };

  const rollDice = () => {
    if (diceRolling) return;
    setDiceRolling(true);
    let ticks = 0;
    const timer = setInterval(() => {
      setDiceNum(String(1 + Math.floor(Math.random() * 20)));
      ticks += 1;
      if (ticks > 8) {
        clearInterval(timer);
        setDiceRolling(false);
        sendCommand({ action: "wait" });
      }
    }, 70);
  };

  const onHexSelect = (loc) => {
    if (loc.here) {
      setSheet("explore");
      return;
    }
    if (!loc.reachable) {
      showToast(`无法从${state.location.name}直达${loc.name}`);
      return;
    }
    sendCommand({ action: "go", target: loc.id });
  };

  const changeMode = (nextMode) => {
    setMode(nextMode);
    if (!state) return;
    if (nextMode === "explore") {
      setQuestHidden(false);
      setSheet("explore");
    }
    if (nextMode === "combat") setSheet("combat");
    if (nextMode === "interact") setSheet("interact");
    if (nextMode === "inventory") setSheet("inventory");
  };

  const others = (state?.present || []).filter((person) => !person.is_player);
  const dialogue = useMemo(() => chatEntries(state?.log), [state]);
  const partySlots = useMemo(() => {
    if (!state) return [];
    const people = [...state.party];
    for (const person of state.present) {
      if (!people.some((item) => item.id === person.id)) people.push(person);
    }
    const slots = people.slice(0, 4);
    while (slots.length < 4) slots.push(null);
    return slots;
  }, [state]);

  const sheetOpen = Boolean(sheet);
  const sheetKind = typeof sheet === "string" ? sheet : sheet?.kind;
  const inlineBusy = Boolean(busy && sheetOpen);

  return (
    <div className="bezel">
      <div className="stage" id="stage">
        <div className="scanlines" aria-hidden="true" />
        <div className="crt" aria-hidden="true" />

        {screen === "title" ? (
          <section className="layer boot-layer">
            <div className="boot-sys">
              <span>CHRONODECK v2.7.13</span>
              <span>{bootClock}</span>
            </div>
            <p className="boot-eyebrow">TIDE REQUIEM · 潮汐挽歌</p>
            <h1>时隙行者</h1>
            <p className="boot-sub">潮汐挽歌 · 黎明纪元 · 潮汐港湾</p>
            <pre className="boot-log">{bootLog}</pre>
            <div className="boot-actions">
              <button className="hud-btn cyan" onClick={handleNew} type="button">
                初始化新航线
              </button>
              <button className="hud-btn" disabled={!hasCurrent} onClick={handleContinue} type="button">
                恢复同步
              </button>
              <button
                className="hud-btn magenta"
                onClick={() => {
                  setSaves(bootstrap().saves || []);
                  setScreen("saves");
                }}
                type="button"
              >
                时间残片
              </button>
            </div>
            <p className="boot-note">{engineNote}</p>
          </section>
        ) : null}

        {screen === "saves" ? (
          <section className="layer boot-layer">
            <div className="sheet sheet-center">
              <header className="sheet-head">
                <h2>时间残片</h2>
                <button className="icon-btn" onClick={() => setScreen("title")} type="button">
                  ✕
                </button>
              </header>
              <div className="saves-list">
                {saves.length ? (
                  saves.map((save) => (
                    <button className="save-card" key={save.id} onClick={() => handleLoad(save.id)} type="button">
                      <b>{save.location_name}</b>
                      <br />
                      <small>
                        DAY {save.day} {save.clock} · {save.id}
                      </small>
                    </button>
                  ))
                ) : (
                  <p>没有可载入的时间残片。</p>
                )}
              </div>
            </div>
          </section>
        ) : null}

        {screen === "play" && state ? (
          <ActPlayScreen
            busy={busy}
            lastOutput={lastOutput}
            onOpenInteract={() => {
              setMode("interact");
              setSheet("interact");
            }}
            onOpenSystem={() => {
              setMode("inventory");
              setSheet("inventory");
            }}
            sendCommand={sendCommand}
            showMemories={showMemories}
            state={state}
          />
        ) : null}

        {sheetOpen ? (
          <div className={`sheet-wrap${sheetKind === "help" ? " center" : ""}`} onClick={(event) => event.target === event.currentTarget && setSheet(null)}>
            <div className="sheet">
              <header className="sheet-head">
                <h2>
                  {sheetKind === "explore" && `探索 · ${state.location.name}`}
                  {sheetKind === "interact" && "交互频道"}
                  {sheetKind === "combat" && "战斗模块"}
                  {sheetKind === "inventory" && "系统背包"}
                  {sheetKind === "help" && "任务指引"}
                  {sheetKind === "memories" && `${sheet.data.name} · 记忆`}
                </h2>
                <button className="icon-btn" onClick={() => setSheet(null)} type="button">
                  ✕
                </button>
              </header>
              <div className="sheet-body">
                {sheetKind === "explore" ? (
                  <>
                    <p className="mono">{(state.location.tags || []).join(" / ") || "扇区"}</p>
                    <p>{state.location.description}</p>
                    <p>在场：{others.map((person) => person.name).join("、") || "无其他生命体"}</p>
                    <div className="exit-row">
                      {state.exits.map((exit) => (
                        <button
                          className="chip"
                          key={exit.id}
                          onClick={() => {
                            setSheet(null);
                            sendCommand({ action: "go", target: exit.id });
                          }}
                          type="button"
                        >
                          前往 {exit.name}
                        </button>
                      ))}
                    </div>
                  </>
                ) : null}

                {sheetKind === "interact" ? (
                  <>
                    <div className="transcript" ref={transcriptRef}>
                      {dialogue.map((entry) => {
                        const mine = entry.actor_id === "player";
                        return (
                          <article className={`line ${mine ? "me" : "npc"}`} key={entry.id}>
                            <span className="who">{entry.actor_name || (mine ? "你" : "对方")}</span>
                            <p>{entry.speech}</p>
                          </article>
                        );
                      })}
                      {!dialogue.length ? <p>频道静默。选中对象后说话，对话会按时间从上往下排列。</p> : null}
                    </div>
                    <p>选择对象后输入对白。主角一句，对方回一句。</p>
                    <div className="who-row">
                      {others.length ? (
                        others.map((person) => (
                          <button
                            className={`chip${talkTarget === person.id ? " on" : ""}`}
                            key={person.id}
                            onClick={() => setTalkTarget((prev) => (prev === person.id ? null : person.id))}
                            type="button"
                          >
                            {person.name}
                          </button>
                        ))
                      ) : (
                        <span>此扇区没有可交互对象</span>
                      )}
                    </div>
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        const text = talkText.trim();
                        if (!text) return;
                        const body = talkTarget ? { action: "talk", target: talkTarget, text } : { action: "say", text };
                        setTalkText("");
                        sendCommand(body, { reopen: "interact" });
                      }}
                    >
                      {inlineBusy ? <p className="wait-status">{busy}</p> : null}
                      <textarea
                        onChange={(event) => setTalkText(event.target.value)}
                        placeholder={talkTarget ? `对 ${others.find((p) => p.id === talkTarget)?.name || ""} 说…` : "对在场众人说…"}
                        value={talkText}
                      />
                      <button className="hud-btn cyan" disabled={Boolean(busy)} style={{ marginTop: 10, width: "100%" }} type="submit">
                        发送
                      </button>
                    </form>
                  </>
                ) : null}

                {sheetKind === "combat" ? (
                  <>
                    <p>完整遭遇尚未上线。你仍可用行动描述出手；试伤可测试队友治疗。</p>
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        setSheet(null);
                        sendCommand({ action: "act", text: combatText });
                      }}
                    >
                      <textarea onChange={(event) => setCombatText(event.target.value)} value={combatText} />
                      <button className="hud-btn magenta" style={{ marginTop: 10, width: "100%" }} type="submit">
                        执行行动
                      </button>
                    </form>
                    <button
                      className="hud-btn"
                      onClick={() => {
                        setSheet(null);
                        sendCommand({ action: "hurt", target: "player" });
                      }}
                      style={{ marginTop: 8, width: "100%" }}
                      type="button"
                    >
                      试伤（自己）
                    </button>
                  </>
                ) : null}

                {sheetKind === "inventory" ? (
                  <>
                    <p>CHRONODECK 没有独立背包表。这里是同步、记忆与存档。</p>
                    <p>
                      HP {player ? `${player.hp}/${player.max_hp}` : "--"} · STA {player ? `${player.stamina}/${player.max_stamina}` : "--"} · {state.location.name}
                    </p>
                    <button className="hud-btn cyan" onClick={handleSave} style={{ width: "100%", marginTop: 8 }} type="button">
                      写入存档
                    </button>
                    <button
                      className="hud-btn"
                      onClick={() => {
                        setSheet(null);
                        sendCommand({ action: "wait" });
                      }}
                      style={{ width: "100%", marginTop: 8 }}
                      type="button"
                    >
                      等待 30 分钟
                    </button>
                    <button className="hud-btn" onClick={() => setSheet("help")} style={{ width: "100%", marginTop: 8 }} type="button">
                      任务指引
                    </button>
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        setApiKey(apiKeyDraft);
                        const settings = getSettings();
                        setEngineNote(settings.usesLlm ? `ACTOR LINK · ${settings.model}` : "NO API KEY · 规则演员在线");
                        showToast(settings.usesLlm ? "Actor 链路已写入本机" : "已清除覆盖 Key，改用 .env 配置");
                      }}
                      style={{ marginTop: 8 }}
                    >
                      <textarea
                        onChange={(event) => setApiKeyDraft(event.target.value)}
                        placeholder="默认已内置智谱 GLM Key。若要覆盖，粘贴你自己的 Key..."
                        value={apiKeyDraft}
                      />
                      <button className="hud-btn" style={{ width: "100%", marginTop: 8 }} type="submit">
                        保存 Actor Key
                      </button>
                    </form>
                    <button
                      className="hud-btn magenta"
                      onClick={() => {
                        setSheet(null);
                        const data = bootstrap();
                        setHasCurrent(Boolean(data.has_current));
                        setEngineNote(data.uses_llm ? `ACTOR LINK · ${data.model}` : "NO API KEY · 规则演员在线");
                        setScreen("title");
                      }}
                      style={{ width: "100%", marginTop: 8 }}
                      type="button"
                    >
                      返回启动屏
                    </button>
                  </>
                ) : null}

                {sheetKind === "help" ? (
                  <>
                    <p>
                      当前：<strong>{state.story?.title}</strong> — {state.story?.summary}
                    </p>
                    <ul className="help-objectives">
                      {(state.story?.objectives || []).map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                    <p>点「扇区地图」移动；点「交互频道」对在场人物说话。骰子推进时间。</p>
                    <p>主线：查清大崩坏前夜预警为何被压下，揭开被掩埋的记录，阻止虚空教团逆用听涌。</p>
                  </>
                ) : null}

                {sheetKind === "memories" ? (
                  sheet.data.memories.length ? (
                    sheet.data.memories.map((memory, index) => (
                      <div className="quest-item" key={`${memory.tick}-${index}`}>
                        <span />
                        <span>
                          <b>{memory.kind}</b>
                          <small>{memory.content}</small>
                        </span>
                      </div>
                    ))
                  ) : (
                    <p>记忆扇区为空。</p>
                  )
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {busy && !inlineBusy ? (
          <div className="busy">
            <div className="busy-ring" />
            <p>{busy}</p>
          </div>
        ) : null}
        {toast ? <div className="toast">{toast}</div> : null}
      </div>
    </div>
  );
}
