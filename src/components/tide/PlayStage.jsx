import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { PLAYER_PORTRAITS, COMPANION_PORTRAITS, FACES } from "@/components/rpg/assets";
import { ATTR_DEFS } from "@/data/chargen";
import { kitForCompanion, kitForPlayer } from "@/data/loadout";
import { ACT1_CLEAR, ACT1_LOCATIONS, HARBOR_OVERVIEW, act1Complete, briefingLines, briefingOf, locationById, nextLocationId, siteChoices, situationOf, travelChoices, unlockedLocationIds } from "@/data/play-stage";
import { TUTOR_STEPS } from "@/data/tutorial";
import { mapOverlayOf } from "@/engine/map-status";
import WarnLock from "@/components/tide/WarnLock";
import mapCity from "@/assets/rpg/map-city.png";
import mapSquare from "@/assets/rpg/星辰广场.png";
import mapHarbor from "@/assets/rpg/潮汐码头.png";
import mapLighthouse from "@/assets/rpg/港湾灯塔.png";
import mapCouncil from "@/assets/rpg/深涌氏族议事厅.png";
import mapArchive from "@/assets/rpg/星辰驿站.png";

const SITE_MAP = {
  square: mapSquare,
  harbor: mapHarbor,
  lighthouse: mapLighthouse,
  council: mapCouncil,
  archive: mapArchive,
};

const NPC_FACE = {
  yongyin: FACES.yongyin,
  ewen: FACES.ewen,
  saltspeaker: FACES.saltspeaker,
  baker: FACES.baker,
  envoy: FACES.envoy,
};

function faceOf(npc, companion) {
  if (!npc) return null;
  if (npc.id === "mate" && companion) return COMPANION_PORTRAITS[companion.gender] || COMPANION_PORTRAITS.female;
  return NPC_FACE[npc.id] || null;
}

function npcIsMasked(npc, flags) {
  return npc?.id === "yongyin" && !flags?.yongyinUnlocked;
}

function npcLabel(npc, flags) {
  if (!npc) return "";
  return npcIsMasked(npc, flags) ? "？" : npc.name;
}

function nextStepId(id) {
  const index = TUTOR_STEPS.findIndex((item) => item.id === id);
  return TUTOR_STEPS[index + 1]?.id || "";
}

function targetSelector(step) {
  if (!step?.target) return "";
  if (step.target === "map-other") return ".map-pin.tutor-hot";
  return `[data-tutor="${step.target}"]`;
}

function overlapArea(box, target) {
  if (!target) return 0;
  const x = Math.max(0, Math.min(box.left + box.width, target.right) - Math.max(box.left, target.left));
  const y = Math.max(0, Math.min(box.top + box.height, target.bottom) - Math.max(box.top, target.top));
  return x * y;
}

function placeCoach(shell, target, coachW, coachH, reveal) {
  const pad = 12;
  const gap = 16;
  const sw = shell.clientWidth;
  const sh = shell.clientHeight;
  const clamp = (left, top) => ({
    left: Math.max(pad, Math.min(left, Math.max(pad, sw - coachW - pad))),
    top: Math.max(pad, Math.min(top, Math.max(pad, sh - coachH - pad))),
    width: coachW,
    height: coachH,
  });
  const sr = shell.getBoundingClientRect();
  const t = target
    ? {
        left: target.getBoundingClientRect().left - sr.left,
        top: target.getBoundingClientRect().top - sr.top,
        right: target.getBoundingClientRect().right - sr.left,
        bottom: target.getBoundingClientRect().bottom - sr.top,
        width: target.getBoundingClientRect().width,
        height: target.getBoundingClientRect().height,
      }
    : null;

  const fallbacks = {
    party: [{ left: (sw - coachW) / 2, top: pad + 8 }],
    brief: [{ left: sw - coachW - pad, top: pad + 8 }],
    map: [{ left: (sw - coachW) / 2, top: sh - coachH - 188 }],
    all: [{ left: pad, top: pad + 8 }],
  };
  const candidates = [];
  if (t) {
    const beside = [
      { left: t.right + gap, top: t.top },
      { left: t.left - coachW - gap, top: t.top },
      { left: t.right + gap, top: t.bottom - coachH },
      { left: t.left - coachW - gap, top: t.bottom - coachH },
    ];
    const vertical = [
      { left: t.left + t.width / 2 - coachW / 2, top: t.bottom + gap },
      { left: t.left + t.width / 2 - coachW / 2, top: t.top - coachH - gap },
    ];
    if (t.width * t.height > 24000) candidates.push(...beside, ...vertical);
    else candidates.push(...vertical, ...beside);
  }
  candidates.push(...(fallbacks[reveal] || fallbacks.party));

  let best = clamp(candidates[0].left, candidates[0].top);
  let bestScore = Number.POSITIVE_INFINITY;
  for (const item of candidates) {
    const placed = clamp(item.left, item.top);
    const score = overlapArea(placed, t);
    if (score < bestScore) {
      best = placed;
      bestScore = score;
      if (score === 0) break;
    }
  }
  return { left: best.left, top: best.top };
}

function TutorCoach({ step, shellRef, kitOpen, onContinue }) {
  const coachRef = useRef(null);
  const drag = useRef(null);
  const [pos, setPos] = useState({ left: 24, top: 16 });
  const [dragged, setDragged] = useState(false);

  useEffect(() => {
    setDragged(false);
  }, [step?.id]);

  useLayoutEffect(() => {
    const shell = shellRef.current;
    const coach = coachRef.current;
    if (!shell || !coach || dragged) return undefined;

    const layout = () => {
      if (drag.current) return;
      const target = step?.target ? shell.querySelector(targetSelector(step)) : null;
      const next = placeCoach(shell, target, coach.offsetWidth || 360, coach.offsetHeight || 140, step?.reveal || "party");
      setPos((prev) => (prev.left === next.left && prev.top === next.top ? prev : next));
    };

    layout();
    const frame = requestAnimationFrame(layout);
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(layout) : null;
    observer?.observe(shell);
    window.addEventListener("resize", layout);
    window.visualViewport?.addEventListener("resize", layout);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", layout);
      window.visualViewport?.removeEventListener("resize", layout);
    };
  }, [step?.id, step?.target, step?.reveal, dragged, kitOpen, shellRef]);

  const onPointerDown = (event) => {
    if (event.button !== 0) return;
    const shell = shellRef.current;
    if (!shell) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const sr = shell.getBoundingClientRect();
    drag.current = {
      x: event.clientX,
      y: event.clientY,
      left: pos.left,
      top: pos.top,
      sw: sr.width,
      sh: sr.height,
    };
  };

  const onPointerMove = (event) => {
    if (!drag.current) return;
    const coach = coachRef.current;
    const dx = event.clientX - drag.current.x;
    const dy = event.clientY - drag.current.y;
    const w = coach?.offsetWidth || 360;
    const h = coach?.offsetHeight || 140;
    const pad = 8;
    setDragged(true);
    setPos({
      left: Math.max(pad, Math.min(drag.current.left + dx, drag.current.sw - w - pad)),
      top: Math.max(pad, Math.min(drag.current.top + dy, drag.current.sh - h - pad)),
    });
  };

  const onPointerUp = (event) => {
    if (!drag.current) return;
    drag.current = null;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
  };

  return (
    <aside
      ref={coachRef}
      className="tutor-coach"
      style={{ left: pos.left, top: pos.top }}
      aria-live="polite"
    >
      <div
        className="tutor-coach-handle"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <p className="sub">新手指引</p>
        <span>拖动挪开</span>
      </div>
      <p>{step.text}</p>
      {step.next === "ok" ? (
        <button className="tide-btn gold tutor-hot" data-tutor="tutor-ok" type="button" onClick={onContinue}>
          {step.id === "done" ? "开始自由行动" : "继续"}
        </button>
      ) : (
        <small>请点击高亮处。点其它地方不会有反应。教学框挡住时，可拖动上方横条挪开。</small>
      )}
    </aside>
  );
}

function ecgTile(ready, x) {
  if (ready) {
    return [
      `H${x + 4} L${x + 7} 12 L${x + 9} 1.5 L${x + 12} 22.5 L${x + 15} 7 L${x + 17} 12`,
      `H${x + 20} L${x + 23} 12 L${x + 25} 1.5 L${x + 28} 22.5 L${x + 31} 7 L${x + 33} 12`,
      `H${x + 40} L${x + 43} 12 L${x + 45} 1.5 L${x + 48} 22.5 L${x + 51} 7 L${x + 53} 12`,
      `H${x + 60} L${x + 63} 12 L${x + 65} 1.5 L${x + 68} 22.5 L${x + 71} 7 L${x + 73} 12 H${x + 80}`,
    ].join(" ");
  }
  return [
    `H${x + 8} L${x + 12} 12 L${x + 14} 5 L${x + 17} 19 L${x + 20} 9 L${x + 22} 12`,
    `H${x + 40} L${x + 44} 12 L${x + 46} 5 L${x + 49} 19 L${x + 52} 9 L${x + 54} 12 H${x + 80}`,
  ].join(" ");
}

function MateEcg({ ready }) {
  const path = `M0 12 ${ecgTile(ready, 0)} ${ecgTile(ready, 80)}`;
  return (
    <div className={`mate-ecg${ready ? " is-ready" : ""}`} aria-hidden="true">
      <svg viewBox="0 0 160 24" preserveAspectRatio="none">
        <path d={path} />
      </svg>
    </div>
  );
}

function PartyCard({
  who,
  title,
  name,
  role,
  portrait,
  kit,
  attrs,
  hotTalk,
  hotSkill,
  hotItems,
  hotAttrs,
  tutoring,
  asideReady,
  asideCue,
  asideSpeech,
  onTalk,
  onHearAside,
  onDismissAside,
  onOpenKit,
  onAttrs,
}) {
  const hp = Number(kit.hp) || 0;
  const maxHp = Number(kit.maxHp) || 10;
  const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
  const hear = () => {
    if (!asideReady || !onHearAside) return false;
    onHearAside();
    return true;
  };
  return (
    <article
      className={`party-card${onTalk ? " can-talk" : ""}${hotTalk ? " tutor-hot" : ""}${who === "mate" ? " has-pulse" : ""}${asideReady ? " is-ready" : ""}`}
      data-tutor={hotTalk ? "mate-talk" : undefined}
      onClick={() => {
        if (tutoring && !hotTalk) return;
        if (!tutoring && hear()) return;
        if (!onTalk) return;
        onTalk();
      }}
    >
      <div className="party-face">
        {portrait ? <img alt="" src={portrait} /> : <div className="npc-ph">{(name || "?").slice(0, 1)}</div>}
        {who === "mate" ? (
          <div
            className={`mate-ecg-slot${asideReady ? " is-ready" : ""}`}
            onClick={(event) => {
              event.stopPropagation();
              if (tutoring) return;
              hear();
            }}
          >
            <MateEcg ready={asideReady} />
          </div>
        ) : null}
      </div>
      <div className="party-body">
        <small>{title}</small>
        <b>{name}</b>
        {asideReady ? (
          <button
            className="mate-cue"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              if (tutoring) return;
              hear();
            }}
          >
            {asideCue || `${name}似乎有话要说`}
          </button>
        ) : (
          <span>{role}</span>
        )}
        <div className="party-hp" aria-label={`生命 ${hp}/${maxHp}`}>
          <strong>HP</strong>
          <i>
            <em style={{ width: `${pct}%` }} />
          </i>
          <em>
            {hp}/{maxHp}
          </em>
        </div>
        {asideSpeech ? (
          <p
            className="mate-bubble"
            role="button"
            onClick={(event) => {
              event.stopPropagation();
              onDismissAside?.();
            }}
          >
            {asideSpeech}
          </p>
        ) : null}
        <div
          className={`party-attrs${hotAttrs ? " tutor-hot" : ""}`}
          data-tutor={hotAttrs ? "player-attrs" : undefined}
          onClick={(event) => {
            event.stopPropagation();
            if (tutoring && !hotAttrs) return;
            onAttrs?.();
          }}
        >
          {ATTR_DEFS.map((item) => (
            <button
              key={item.id}
              className="party-attr"
              disabled={tutoring && !hotAttrs}
              onClick={(event) => {
                event.stopPropagation();
                if (tutoring && !hotAttrs) return;
                onAttrs?.();
              }}
              title={item.hint}
              type="button"
            >
              {item.id} <b>{Number(attrs?.[item.id]) || 0}</b>
            </button>
          ))}
        </div>
        <div className="party-btns" onClick={(event) => event.stopPropagation()}>
          <button
            className={`party-kit${hotItems ? " tutor-hot" : ""}`}
            data-tutor={who === "player" ? "player-items" : "mate-items"}
            disabled={tutoring && !hotItems}
            onClick={() => onOpenKit("items")}
            type="button"
          >
            物品
          </button>
          <button
            className={`party-kit${hotSkill ? " tutor-hot" : ""}`}
            data-tutor={who === "player" ? "player-skill" : "mate-skill"}
            disabled={tutoring && !hotSkill}
            onClick={() => onOpenKit("skills")}
            type="button"
          >
            技能
          </button>
        </div>
      </div>
    </article>
  );
}

function KitModal({ title, kind, list, onClose, hotClose }) {
  return (
    <div className="kit-overlay" onClick={(event) => event.stopPropagation()}>
      <div className="kit-modal" role="dialog" aria-label={title}>
        <p className="sub">{kind === "items" ? "LOADOUT" : "SKILLS"}</p>
        <h3>{title}</h3>
        <ul className="kit-list">
          {(list || []).map((item) => (
            <li key={item.id || item.name}>
              <b>{item.name}</b>
              <span>{item.desc}</span>
            </li>
          ))}
        </ul>
        <button className={`tide-btn${hotClose ? " tutor-hot" : ""}`} data-tutor="kit-close" type="button" onClick={onClose}>
          关闭
        </button>
      </div>
    </div>
  );
}

export default function PlayStage({ game, note, dialogOpen, diceOpen, startTutorial, aside, onPick, onTalk, onHearAside, onDismissAside, onMove, onAckAct1, onCheckBrief, onSiteStay, onAckRift, onYongyinUnlock }) {
  const here = locationById(game.location);
  const flags = game.routeFlags || {};
  const brief = briefingOf();
  const lines = briefingLines(flags);
  const unlocked = unlockedLocationIds(flags);
  const nextSpot = nextLocationId(flags);
  const worldOptions = travelChoices(flags, here.id);
  const options = siteChoices(here, flags);
  const npcMarks = (here.npcMarks || (here.npcs || []).map((id, index) => ({ id, x: 36 + index * 22, y: 52 }))).map((mark) => ({
    ...mark,
    npc: game.npcs[mark.id],
  })).filter((item) => item.npc);
  const [mapView, setMapView] = useState("world");
  const [riftOpen, setRiftOpen] = useState(false);
  const [lockStep, setLockStep] = useState("");
  const player = game.player || {};
  const companion = game.companion;
  const playerFace = PLAYER_PORTRAITS[player.gender] || PLAYER_PORTRAITS.male;
  const playerKit = useMemo(() => kitForPlayer(player), [player]);
  const mateKit = useMemo(() => kitForCompanion(companion || {}), [companion]);
  const [stepId, setStepId] = useState(() => (startTutorial ? "intro" : ""));
  const [kit, setKit] = useState(null);
  const shellRef = useRef(null);
  const step = TUTOR_STEPS.find((item) => item.id === stepId) || null;
  const tutoring = Boolean(step);
  const reveal = step?.reveal || "all";
  const modalUp = Boolean(dialogOpen || diceOpen);
  const showGuide = tutoring && !modalUp;
  const riftReady = game.rift?.status === "ready" && mapView === "site" && here.id === "harbor" && !tutoring;
  const overlay = mapOverlayOf(game, mapView === "world" ? "world" : here.id);

  useEffect(() => {
    onSiteStay?.({ view: mapView, location: here.id, tutoring });
  }, [mapView, here.id, tutoring, onSiteStay]);

  const goNext = () => {
    if (!step) return;
    const next = nextStepId(step.id);
    if (!next) {
      setStepId("");
      return;
    }
    setStepId(next);
  };

  const finishTutor = () => {
    setStepId("");
  };

  const hot = (id) => Boolean(tutoring && step?.target === id);

  const openKit = (who, kind) => {
    const allowed =
      !tutoring ||
      (who === "player" && kind === "skills" && step?.id === "skill") ||
      (step?.id === "skill-view" && kit);
    if (tutoring && !allowed) return;
    const pack = who === "player" ? playerKit : mateKit;
    const name = who === "player" ? player.name || "时隙行者" : companion?.name || "同行者";
    setKit({
      who,
      kind,
      title: `${name} · ${kind === "items" ? "物品" : "技能"}`,
      list: kind === "items" ? pack.items : pack.skills,
    });
    if (step?.id === "skill" && who === "player" && kind === "skills") goNext();
  };

  const closeKit = () => {
    if (tutoring && step?.id !== "skill-view") return;
    setKit(null);
    if (step?.id === "skill-view") goNext();
  };

  const clickAttrs = (who) => {
    if (tutoring && !(who === "player" && step?.id === "attrs")) return;
    if (step?.id === "attrs") goNext();
  };

  const clickTalkMate = () => {
    if (!companion) return;
    if (tutoring && step?.id !== "talk") return;
    onTalk("mate");
    if (step?.id === "talk") goNext();
  };

  const clickBrief = () => {
    if (tutoring && step?.id === "brief") goNext();
  };

  const clickCheck = (event) => {
    event.stopPropagation();
    if (tutoring && step?.id === "brief") {
      goNext();
      return;
    }
    if (tutoring) return;
    onCheckBrief?.();
  };

  const enterSite = (id) => {
    if (id !== here.id) onMove(id);
    setMapView("site");
  };

  const leaveSite = () => {
    if (tutoring) return;
    setRiftOpen(false);
    setLockStep("");
    setMapView("world");
  };

  const openYongyinLock = () => {
    if (flags.yongyinUnlocked) {
      onTalk("yongyin");
      return;
    }
    setLockStep("prompt");
  };

  const clickMove = (id) => {
    if (tutoring && step?.id !== "map-go") return;
    if (tutoring && step?.id === "map-go") {
      if (step.target === "map-here" && id !== here.id) return;
      if (step.target === "map-other" && id === here.id) return;
      if (id !== here.id && !unlocked.has(id)) return;
      enterSite(id);
      goNext();
      return;
    }
    if (id !== here.id && !unlocked.has(id)) return;
    enterSite(id);
  };

  const clickChoice = (choice) => {
    if (tutoring && step?.id !== "action") return;
    if (choice.go) {
      enterSite(choice.go);
      if (step?.id === "action") goNext();
      return;
    }
    if (choice.lock === "yongyin" || (choice.talk === "yongyin" && !flags.yongyinUnlocked)) {
      openYongyinLock();
      if (step?.id === "action") goNext();
      return;
    }
    onPick(choice);
    if (step?.id === "action") goNext();
  };

  const clickNpc = (id) => {
    if (tutoring) return;
    if (id === "yongyin" && !flags.yongyinUnlocked) {
      openYongyinLock();
      return;
    }
    onTalk(id);
  };

  return (
    <div ref={shellRef} className={`play-shell reveal-${reveal}${tutoring ? " tutoring" : ""}`} data-tutor-step={stepId || "free"}>
      {showGuide ? <div className="tutor-veil" aria-hidden="true" /> : null}
      {showGuide ? (
        <TutorCoach
          step={step}
          shellRef={shellRef}
          kitOpen={Boolean(kit)}
          onContinue={step.id === "done" ? finishTutor : goNext}
        />
      ) : null}

      <header className="play-top">
        <div>
          <b>
            {brief.era} · {brief.act}
          </b>
          <span>{brief.title}</span>
        </div>
        <div className="play-stab">
          时间线稳定度 <strong>{game.stability.toFixed(1)}%</strong>
        </div>
        <div className="play-sys">{note || "SYS ONLINE"}</div>
      </header>

      <div className="play-grid">
        <aside
          className={`play-brief${hot("brief") ? " tutor-hot" : ""}`}
          data-tutor="brief"
          aria-label="本幕简报"
          onClick={clickBrief}
        >
          <div className="play-brief-head">
            <p className="sub">TASK BRIEF</p>
            <button
              className={`brief-check${hot("brief-check") ? " tutor-hot" : ""}`}
              data-tutor="brief-check"
              type="button"
              disabled={tutoring && step?.id !== "brief"}
              onClick={clickCheck}
            >
              CHECK
            </button>
          </div>
          <h2>本幕简报</h2>
          <section>
            <b>目的</b>
            {lines.goals.map((item) => (
              <p key={`goal-${item.id}`} className={item.done ? "brief-done" : "brief-now"}>
                {item.text}
              </p>
            ))}
          </section>
          <section>
            <b>待做事项</b>
            {lines.todos.map((item) => (
              <p key={`todo-${item.id}`} className={item.done ? "brief-done" : "brief-now"}>
                {item.text}
              </p>
            ))}
          </section>
        </aside>

        <section className="play-map" aria-label={mapView === "site" ? here.name : "港湾地图"}>
          <div className={`play-map-frame${mapView === "site" ? " is-site" : ""}`}>
            {riftReady ? (
              <button
                className="rift-btn"
                type="button"
                onClick={() => setRiftOpen(true)}
              >
                <span className="rift-glitch" data-text="异变突生">
                  异变突生
                </span>
              </button>
            ) : null}
            <div className="play-map-track">
              <div className="play-map-pane" style={{ backgroundImage: `url(${mapCity})` }}>
                {ACT1_LOCATIONS.map((spot) => {
                  const other = spot.id !== here.id;
                  const open = unlocked.has(spot.id);
                  const pinHot = tutoring && ((step?.id === "map-go" && step.target === "map-other" && other) || (step?.id === "map-go" && step.target === "map-here" && !other));
                  return (
                    <button
                      key={spot.id}
                      className={`map-pin${spot.id === here.id ? " on" : ""}${!open ? " locked" : ""}${spot.id === nextSpot && other && open ? " next" : ""}${pinHot ? " tutor-hot" : ""}`}
                      data-tutor={other ? "map-other" : "map-here"}
                      style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
                      type="button"
                      disabled={!open && other}
                      onClick={() => clickMove(spot.id)}
                    >
                      <em>{spot.mark}</em>
                      <strong>{spot.name}</strong>
                      <span>
                        {(spot.npcs || [])
                          .map((id) => npcLabel(game.npcs[id], flags))
                          .filter(Boolean)
                          .join("、") || "无人"}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="play-map-pane" style={{ backgroundImage: `url(${SITE_MAP[here.id] || mapCity})` }}>
                {tutoring ? null : (
                  <button className="map-back" type="button" onClick={leaveSite}>
                    返回港湾地图
                  </button>
                )}
                {npcMarks.map((item) => {
                  const masked = npcIsMasked(item.npc, flags);
                  const face = masked ? null : faceOf(item.npc, companion);
                  const label = npcLabel(item.npc, flags);
                  return (
                    <button
                      key={item.id}
                      className={`map-npc${masked ? " is-unknown" : ""}`}
                      style={{ left: `${item.x}%`, top: `${item.y}%` }}
                      type="button"
                      onClick={() => clickNpc(item.npc.id)}
                    >
                      {face ? <img alt="" src={face} /> : <i>{label.slice(0, 1)}</i>}
                      <strong>{label}</strong>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <aside className="play-action" aria-label="当前情况">
          <p className="sub">NOW</p>
          {mapView === "world" ? (
            <>
              <h2>{HARBOR_OVERVIEW.title}</h2>
              <p className="play-sit">{HARBOR_OVERVIEW.body}</p>
              {overlay ? <p className="play-sit is-rift">{overlay}</p> : null}
              <b>你可以去</b>
              <div className="play-choices">
                {worldOptions.map((choice) => (
                  <button
                    key={choice.id}
                    className={`play-choice${hot("choice") ? " tutor-hot" : ""}`}
                    data-tutor="choice"
                    type="button"
                    onClick={() => clickChoice(choice)}
                  >
                    <strong>{choice.title}</strong>
                    <span>{choice.hint}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <h2>{here.name}</h2>
              <p className="play-sit">{situationOf(here, flags)}</p>
              {overlay ? <p className="play-sit is-rift">{overlay}</p> : null}
              {game.sceneNote ? <p className="play-note">{game.sceneNote}</p> : null}
              <b>你可以做</b>
              <div className="play-choices">
                {options.map((choice) => (
                  <button
                    key={choice.id}
                    className={`play-choice${hot("choice") ? " tutor-hot" : ""}`}
                    data-tutor="choice"
                    type="button"
                    onClick={() => clickChoice(choice)}
                  >
                    <strong>{choice.title}</strong>
                    <span>{choice.skill ? `${choice.skill} DC${choice.dc}` : choice.hint}</span>
                  </button>
                ))}
                {tutoring ? null : (
                  <button className="play-choice" type="button" onClick={leaveSite}>
                    <strong>返回港湾地图</strong>
                    <span>换一个地点</span>
                  </button>
                )}
              </div>
            </>
          )}
        </aside>
      </div>

      <footer className="play-party" aria-label="同行者">
        <PartyCard
          who="player"
          title="我"
          name={player.name || "时隙行者"}
          role="时隙行者"
          portrait={playerFace}
          kit={playerKit}
          attrs={player.attrs}
          tutoring={tutoring}
          hotSkill={hot("player-skill")}
          hotItems={false}
          hotAttrs={hot("player-attrs")}
          onOpenKit={(kind) => openKit("player", kind)}
          onAttrs={() => clickAttrs("player")}
        />
        <PartyCard
          who="mate"
          title="队友"
          name={companion?.name || "同行者"}
          role={companion ? `${companion.gender === "female" ? "女" : "男"} · ${companion.occupation}` : "尚未辨认"}
          portrait={companion ? COMPANION_PORTRAITS[companion.gender] : null}
          kit={mateKit}
          attrs={companion?.attrs}
          tutoring={tutoring}
          hotTalk={hot("mate-talk")}
          asideReady={Boolean(aside?.pending?.speech)}
          asideCue={aside?.pending?.speech ? `${companion?.name || "同行者"}似乎有话要说` : ""}
          asideSpeech={aside?.pending ? "" : aside?.shown || ""}
          onTalk={companion ? clickTalkMate : undefined}
          onHearAside={onHearAside}
          onDismissAside={onDismissAside}
          onOpenKit={(kind) => openKit("mate", kind)}
        />
      </footer>

      {kit ? (
        <KitModal
          title={kit.title}
          kind={kit.kind}
          list={kit.list}
          hotClose={hot("kit-close")}
          onClose={closeKit}
        />
      ) : null}

      {lockStep === "prompt" ? (
        <div className="rift-veil" role="dialog" aria-label="电子锁">
          <article className="rift-card lock-card">
            <p className="sub">UNKNOWN CONTACT</p>
            <h3>她丢过来一把锁</h3>
            <p className="rift-copy">塔里那人把一个电子锁抛到你手里。看来不破解这个电子锁，她是不会和我们聊天的。</p>
            <div className="lock-card-actions">
              <button className="tide-btn" type="button" onClick={() => setLockStep("")}>
                先走开
              </button>
              <button className="tide-btn gold" type="button" onClick={() => setLockStep("play")}>
                接住电子锁
              </button>
            </div>
          </article>
        </div>
      ) : null}

      {lockStep === "play" ? (
        <div className="rift-veil" role="dialog" aria-label="破解电子锁">
          <WarnLock onSolved={() => setLockStep("done")} />
        </div>
      ) : null}

      {lockStep === "done" ? (
        <div className="rift-veil" role="dialog" aria-label="锁已打开">
          <article className="rift-card lock-card">
            <p className="sub">LOCK OPEN</p>
            <h3>她愿意开口了</h3>
            <p className="rift-copy">电子锁应声弹开。对面的人把脸转过来，愿意和我们说话了。</p>
            <button
              className="tide-btn gold"
              type="button"
              onClick={() => {
                onYongyinUnlock?.();
                setLockStep("");
              }}
            >
              了解
            </button>
          </article>
        </div>
      ) : null}

      {riftOpen && game.rift?.event ? (
        <div className="rift-veil" role="dialog" aria-label="异变突生">
          <article className="rift-card">
            <p className="sub">RIFT EVENT</p>
            <h3>{game.rift.event.title || "异变突生"}</h3>
            <p className="rift-copy">{game.rift.event.event}</p>
            <b>造成的影响</b>
            <p className="rift-copy">{game.rift.event.impact}</p>
            <button
              className="tide-btn gold"
              type="button"
              onClick={() => {
                onAckRift?.();
                setRiftOpen(false);
              }}
            >
              了解
            </button>
          </article>
        </div>
      ) : null}

      {act1Complete(flags) && !flags.act1Ack && !tutoring && !modalUp ? (
        <div className="act-clear" role="dialog" aria-label="第一幕结算">
          <div className="act-clear-card">
            <div className="act-clear-burst" aria-hidden="true" />
            <p className="sub">{ACT1_CLEAR.kicker}</p>
            <h3>{ACT1_CLEAR.title}</h3>
            <p className="act-clear-copy">{ACT1_CLEAR.body}</p>
            <button className="tide-btn gold" type="button" onClick={() => onAckAct1?.()}>
              {ACT1_CLEAR.confirm}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
