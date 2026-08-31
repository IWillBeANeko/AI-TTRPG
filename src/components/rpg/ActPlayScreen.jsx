import { useMemo, useState } from "react";
import { ERAS } from "@/data/story-manifest";
import { FACES } from "./assets";
import HexMap from "./HexMap";
import { bgForAct } from "./ui-assets";

function runChoiceBody(choice) {
  if (choice.go) {
    return { action: "go", target: choice.go, text: choice.say || choice.text || "" };
  }
  if (choice.action === "go" && choice.target) {
    return { action: "go", target: choice.target, text: choice.say || choice.text || "" };
  }
  if (choice.say) {
    return choice.target
      ? { action: "talk", target: choice.target, text: choice.say }
      : { action: "say", text: choice.say };
  }
  if (choice.text) return { action: "say", text: choice.text };
  return { action: "say", text: choice.label || "……" };
}

const CHOICE_ICONS = {
  tower: "🗼",
  hermit: "🧙",
  guardian: "⚔",
  tree: "🌳",
  cult: "△",
  talk: "💬",
  council: "⚖",
  ignore: "⚠",
  stealth: "◎",
  social: "⚖",
  truth: "👁",
  raid: "⚔",
  infiltrate: "◎",
  negotiate: "🤝",
};

function collectChoiceCards(story, layout) {
  if (layout === "era_hub") {
    const icons = ["tower", "hermit", "guardian", "tree", "cult"];
    return (story.awakening_choices || []).map((c, i) => ({
      id: c.id,
      num: c.num,
      title: c.title,
      icon: icons[i],
      color: c.risk_level === "高" ? "magenta" : "cyan",
      risk: c.risk,
      riskTags: c.riskTags || [c.risk],
      choice: c,
    }));
  }
  if (layout === "clue_board") {
    return [
      { id: "c1", num: "01", title: "与先知深入交流", icon: "talk", color: "cyan", riskTags: ["信息回响", "零碎线索"], choice: { say: "我想向涌音确认预警不是潮汐传闻" } },
      { id: "c2", num: "02", title: "争取深涌氏族议会认可", icon: "council", color: "blue", riskTags: ["因果链", "后续协助"], choice: { action: "go", target: "council", say: "我想请盐语者说明听涌的局限" } },
      { id: "c3", num: "03", title: "忽视线索", icon: "ignore", color: "magenta", riskTags: ["蝴蝶效应", "竞争者截获"], choice: { say: "这些线索不重要，我先处理眼前的事" } },
    ];
  }
  if (layout === "investigation_hub") {
    const missionIcons = ["stealth", "social", "truth"];
    const missions = (story.missions || []).map((m, i) => ({
      id: m.id,
      num: `0${i + 1}`,
      title: m.title,
      icon: missionIcons[i],
      color: ["cyan", "amber", "purple"][i],
      risk: `风险：${m.risk}`,
      riskTags: m.tags,
      kind: "mission",
      choice: m,
    }));
    const decisionIcons = ["truth", "guardian", "cult"];
    const decisions = (story.decisions || []).map((d, i) => ({
      id: d.id,
      num: `0${i + 4}`,
      title: d.label,
      icon: decisionIcons[i],
      color: d.color,
      riskTags: d.risks,
      kind: "decision",
      choice: d,
    }));
    return { missions, decisions };
  }
  if (layout === "mission_cards") {
    return (story.missions || []).map((m, i) => ({
      id: m.id,
      num: `0${i + 1}`,
      title: m.label,
      color: m.color,
      risk: m.risk,
      riskTags: [m.risk],
      choice: m,
    }));
  }
  if (layout === "tri_era") {
    return (story.eras || []).map((era, i) => ({
      id: era.id,
      num: `0${i + 1}`,
      title: era.title,
      color: ["cyan", "amber", "magenta"][i],
      risk: `危险：${era.danger}`,
      extra: era.countdown,
      choice: { action: era.action, target: era.location, say: `前往${era.title}，稳定裂隙共振` },
    }));
  }
  if (layout === "ending_select") {
    return (story.endings || []).map((end, i) => ({
      id: end.id,
      num: `0${i + 1}`,
      title: end.label,
      desc: end.desc,
      color: end.color,
      choice: end,
    }));
  }
  return [];
}

function Waveform() {
  return (
    <svg className="stability-wave" viewBox="0 0 120 24" aria-hidden="true">
      <polyline
        fill="none"
        points="0,12 12,8 24,14 36,6 48,16 60,10 72,14 84,7 96,13 108,9 120,12"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function HudTopBar({ story, state, onOpenInteract, onOpenMap, onOpenSystem }) {
  const era = ERAS[story.era] || ERAS.dawn;
  const serial = `TS-1197-${String(story.loop || 1).padStart(2, "0")}-0A`;
  return (
    <header className="hud-topbar">
      <div className="hud-brand">
        <span className="hud-logo" aria-hidden="true">
          ✦
        </span>
        <div>
          <b className="hud-game-title">潮汐挽歌</b>
          <small>
            {era.label} · {story.title}
          </small>
        </div>
      </div>

      <div className="hud-center-stats">
        <div className="loop-badge">
          <span>LOOP</span>
          <strong>{String(story.loop || 1).padStart(2, "0")}</strong>
        </div>
        <div className="stability-block">
          <label>时间线稳定度</label>
          <div className="stability-row">
            <strong>{story.stability}%</strong>
            <Waveform />
          </div>
        </div>
      </div>

      <div className="hud-anchor">
        <div className="anchor-widget">
          <span className="anchor-icon">⌖</span>
          <div>
            <label>时间锚点</label>
            <em>{state.location.name}</em>
          </div>
        </div>
        {story.order > 0 ? (
          <div className="hud-era-meta">
            <span>纪元：{era.label} 1197年</span>
            <code>{serial}</code>
          </div>
        ) : null}
        <nav className="hud-nav">
          <button onClick={onOpenInteract} type="button">
            交互
          </button>
          <button onClick={onOpenMap} type="button">
            地图
          </button>
          <button onClick={onOpenSystem} type="button">
            系统
          </button>
        </nav>
      </div>
    </header>
  );
}

function ChoiceCard({ card, busy, onPick, tall }) {
  return (
    <button
      className={`hud-choice-card ${card.color}${card.num === "05" && card.color === "magenta" ? " danger" : ""}${tall ? " tall" : ""}`}
      disabled={busy}
      onClick={() => onPick(card.choice)}
      type="button"
    >
      {card.icon ? (
        <span className="hud-choice-icon" aria-hidden="true">
          {CHOICE_ICONS[card.icon] || "◆"}
        </span>
      ) : null}
      <span className="hud-choice-num">{card.num}</span>
      <b>{card.title}</b>
      {card.desc ? <p>{card.desc}</p> : null}
      {card.extra ? <span className="hud-choice-extra">{card.extra}</span> : null}
      {card.risk ? <span className="hud-risk-line">{card.risk}</span> : null}
      {card.riskTags?.length ? (
        <span className="hud-risk-tags">
          {card.riskTags.map((tag) => (
            <em key={tag}>{tag}</em>
          ))}
        </span>
      ) : null}
      <span className="hud-choice-chevron">{">>"}</span>
    </button>
  );
}

function HudNpcRow({ people, onSelect }) {
  const slots = [...people];
  while (slots.length < 4) slots.push(null);
  return (
    <section className="hud-npc-row">
      <header>相关人物 · 态度与状态</header>
      <div className="hud-npc-grid">
        {slots.slice(0, 4).map((person, index) =>
          person ? (
            <button className="hud-npc-card" key={person.id} onClick={() => onSelect(person.id)} type="button">
              <img alt={person.name} src={FACES[person.id] || FACES.player} />
              <div className="hud-npc-meta">
                <b>{person.name}</b>
                <small>{person.occupation}</small>
                <span className={`hud-attitude ${person.attitude >= 0 ? "pos" : "neg"}`}>
                  态度值 {person.attitude_label} {person.attitude > 0 ? "+" : ""}
                  {person.attitude}
                </span>
                <div className="hud-att-bar">
                  <span style={{ width: `${Math.max(8, Math.min(100, 50 + person.attitude))}%` }} />
                </div>
              </div>
            </button>
          ) : (
            <div className="hud-npc-card empty" key={`empty-${index}`} />
          ),
        )}
      </div>
    </section>
  );
}

function HudImprintFooter({ story, onOpenInteract }) {
  return (
    <footer className="hud-imprint-footer">
      <span className="hud-hourglass" aria-hidden="true">
        ⏳
      </span>
      <div className="hud-imprint-text">
        <b>时间印记</b>
        <p>每一次选择，都会在时间线上留下不可磨灭的印记。</p>
      </div>
      <div className="hud-imprint-actions">
        <span className="hud-imprint-count">
          当前可用 {story.imprints_max - story.imprints_used}/{story.imprints_max}
        </span>
        <button className="hud-imprint-btn" onClick={onOpenInteract} type="button">
          查看印记 {">>"}
        </button>
      </div>
    </footer>
  );
}

export default function ActPlayScreen({
  state,
  busy,
  sendCommand,
  showMemories,
  onOpenInteract,
  onOpenSystem,
  lastOutput,
}) {
  const [mapMode, setMapMode] = useState(false);
  const story = state.story || {};
  const layout = mapMode ? "map_explore" : story.ui_layout || "era_hub";
  const bg = bgForAct(story.ui_bg);
  const choiceData = useMemo(() => collectChoiceCards(story, layout), [story, layout]);
  const choiceCards = Array.isArray(choiceData) ? choiceData : [];
  const investigationHub = !Array.isArray(choiceData) ? choiceData : null;

  const npcPeople = useMemo(() => {
    const seen = new Set();
    const list = [];
    for (const person of [...state.party, ...state.present]) {
      if (person.is_player || seen.has(person.id)) continue;
      seen.add(person.id);
      list.push(person);
    }
    return list.slice(0, 4);
  }, [state]);

  const handleChoice = async (choice) => {
    const body = runChoiceBody(choice);
    if (body.action === "go" && body.target) {
      await sendCommand({ action: "go", target: body.target });
      if (body.text) await sendCommand({ action: "say", text: body.text }, { reopen: "interact" });
      return;
    }
    await sendCommand(body, { reopen: "interact" });
  };

  const sceneTitle =
    layout === "era_hub" ? "时之觉醒" : story.scene_label || story.subtitle || story.title;
  const clues = story.clue_fragments || [];
  const narrativePrompt =
    story.narrative_prompt || (layout === "era_hub" ? "你，准备好做出第一个选择了吗？" : "");

  return (
    <section className="layer play-layer landscape-hud" style={{ "--act-bg": `url(${bg})` }}>
      <div className="landscape-bg" aria-hidden="true" />
      <div className="landscape-vignette" aria-hidden="true" />

      <HudTopBar
        state={state}
        story={story}
        onOpenInteract={onOpenInteract}
        onOpenMap={() => setMapMode((v) => !v)}
        onOpenSystem={onOpenSystem}
      />

      <div className={`hud-body${investigationHub ? " is-investigation" : ""}`}>
        <div className="hud-scene-zone">
          {mapMode ? (
            <div className="hud-map-panel hud-panel">
              <header>感知雷达 · 扇区罗盘</header>
              <div className="hud-map-inner">
                <HexMap state={state} onSelect={(loc) => sendCommand({ action: "go", target: loc.id })} />
              </div>
              <p className="hud-map-hint">点击六边形移动 · 当前：{state.location.name}</p>
            </div>
          ) : (
            <article className={`hud-narrative hud-panel${layout === "clue_board" ? " with-portrait" : ""}`}>
              {layout === "clue_board" ? (
                <div className="hud-portrait-col">
                  <img alt="涌音" src={FACES.yongyin || FACES.player} />
                  <span>涌音 · 失明的先知</span>
                </div>
              ) : null}
              <div className="hud-narrative-inner">
                <header className="hud-scene-label">
                  {layout === "era_hub" ? `—— ${sceneTitle} ——` : `[ ${sceneTitle} ]`}
                </header>
                {story.scene_coords ? <p className="hud-scene-coords">坐标：{story.scene_coords}</p> : null}
                {layout !== "era_hub" ? <h2>{story.subtitle || story.title}</h2> : null}
                <p className="hud-narrative-text">{story.narrative}</p>
                {narrativePrompt ? <p className="hud-narrative-prompt">{narrativePrompt}</p> : null}
                {story.quote ? <blockquote className="hud-quote">{story.quote}</blockquote> : null}
                {clues.length ? (
                  <div className="hud-clue-strip">
                    <span className="hud-clue-label">线索碎片 »</span>
                    {clues.map((clue, index) => (
                      <div className={`hud-clue-chip${clue.unlocked ? " on" : ""}`} key={clue.id}>
                        <b>0{index + 1}</b>
                        <p>{clue.unlocked ? clue.text : "未解锁"}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
                {story.objectives?.length ? (
                  <ul className="hud-objectives">
                    {story.objectives.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </article>
          )}

          {lastOutput ? (
            <button className="hud-output-ticker" onClick={onOpenInteract} type="button">
              {lastOutput}
            </button>
          ) : null}
        </div>

        {!mapMode && investigationHub ? (
          <section className="hud-investigation-zone">
            {story.warning_banner ? <div className="hud-warning-banner">⚠ {story.warning_banner} ⚠</div> : null}
            <div className="hud-mission-track">
              <header>纪元入口 · 调查任务</header>
              <div className="hud-choice-track count-3">
                {investigationHub.missions.map((card) => (
                  <ChoiceCard busy={busy} card={card} key={card.id} onPick={handleChoice} tall />
                ))}
              </div>
            </div>
            <div className="hud-decision-track">
              <header>调查走向 · 请选择你的抉择</header>
              <div className="hud-choice-track count-3">
                {investigationHub.decisions.map((card) => (
                  <ChoiceCard busy={busy} card={card} key={card.id} onPick={handleChoice} />
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {!mapMode && choiceCards.length ? (
          <section className="hud-choice-zone">
            <header>
              {layout === "clue_board" ? "你的选择 »" : "交互选择 · 你的选择"}
            </header>
            <div className={`hud-choice-track count-${choiceCards.length}`}>
              {choiceCards.map((card) => (
                <ChoiceCard busy={busy} card={card} key={card.id} onPick={handleChoice} />
              ))}
            </div>
          </section>
        ) : null}
      </div>

      <HudNpcRow onSelect={showMemories} people={npcPeople} />
      <HudImprintFooter onOpenInteract={onOpenInteract} story={story} />

      {busy ? <div className="hud-busy-overlay">{busy}</div> : null}
    </section>
  );
}
