import { useEffect, useState } from "react";
import { COMPANION_PORTRAITS } from "@/components/rpg/assets";
import { ATTR_DEFS, ATTR_POINT_TOTAL, attrModifier } from "@/data/chargen";

const FATE_LINES = [
  "正在编制命运网",
  "正在呼唤队友",
  "正在匹配旗鼓相当的队友",
  "正在核对潮汐回响",
  "正在把同行者从裂隙里捞出",
];

export default function CompanionReveal({ companion, briefing, loading, onDepart }) {
  const [view, setView] = useState("load");
  const [line, setLine] = useState(0);
  const [meetOn, setMeetOn] = useState(false);
  const [meetVisible, setMeetVisible] = useState(false);
  const profile = briefing || companion?.briefing || null;
  const portrait = companion ? COMPANION_PORTRAITS[companion.gender] || COMPANION_PORTRAITS.female : null;

  useEffect(() => {
    if (loading) {
      setView("load");
      setMeetOn(false);
      setMeetVisible(false);
      return undefined;
    }
    if (companion) setView("brief");
    return undefined;
  }, [loading, companion]);

  useEffect(() => {
    if (!loading) return undefined;
    setLine(0);
    const timer = setInterval(() => {
      setLine((index) => (index + 1) % FATE_LINES.length);
    }, 1700);
    return () => clearInterval(timer);
  }, [loading]);

  useEffect(() => {
    if (!meetOn) {
      setMeetVisible(false);
      return undefined;
    }
    const frame = requestAnimationFrame(() => setMeetVisible(true));
    return () => cancelAnimationFrame(frame);
  }, [meetOn]);

  if (loading || view === "load") {
    return (
      <section className="boot companion-fate" aria-live="polite" aria-label="正在编制命运">
        <div className="fate-ring" aria-hidden="true" />
        <p className="sub">TIDE REQUIEM</p>
        <p className="fate-line" key={line}>
          {FATE_LINES[line]}
        </p>
      </section>
    );
  }

  if (view === "brief") {
    return (
      <section className="boot companion-brief-stage" aria-label="性格简报">
        <article className="brief-card">
          <p className="sub">TIDE REQUIEM · 性格简报</p>
          <h1>先看清你是谁</h1>
          {profile ? (
            <div className="companion-brief">
              <p className="companion-brief-title">{profile.headline}</p>
              <p>{profile.core || profile.summary}</p>
              {profile.pressure ? <p>{profile.pressure}</p> : null}
              {profile.with_people ? <p>{profile.with_people}</p> : null}
              {profile.wish_read || profile.need ? <p>{profile.wish_read || profile.need}</p> : null}
            </div>
          ) : (
            <p className="body">简报尚未写就。</p>
          )}
          <p className="tiny">命运网已经编好。接下来，去见那个被派来的人。</p>
          <button className="tide-btn gold" type="button" onClick={() => setMeetOn(true)}>
            查看我的队友
          </button>
        </article>
        {meetOn && companion ? (
          <div className={`meet-veil${meetVisible ? " on" : ""}`} role="dialog" aria-label="遇见同行者">
            <article className="meet-banner">
              <div className="meet-portrait">
                {portrait ? <img alt="" src={portrait} /> : <div className="chargen-portrait-wait" />}
              </div>
              <div className="meet-speech">
                <small>
                  {companion.gender === "female" ? "女" : "男"}
                  {companion.org ? ` · ${companion.org}` : ""}
                </small>
                <h2>{companion.name}</h2>
                <p className="meet-intro">{companion.intro || companion.reason}</p>
                <button className="tide-btn gold" type="button" onClick={() => setView("detail")}>
                  继续
                </button>
              </div>
            </article>
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <section className="boot chargen companion-reveal" aria-label="同行者详情">
      <p className="sub">TIDE REQUIEM · 同行者</p>
      <h1>{companion.name}</h1>
      <div className="chargen-grid">
        <aside className="chargen-portrait">
          {portrait ? <img alt="" className="on" src={portrait} /> : null}
          <span className="chargen-portrait-cap reveal on">
            {companion.gender === "female" ? "女" : "男"} · {companion.occupation}
          </span>
        </aside>
        <div className="chargen-form">
          <div className="companion-block">
            <b>身份</b>
            <p>
              {companion.gender === "female" ? "女" : "男"} · {companion.occupation}
              {companion.org ? ` · ${companion.org}` : ""}
            </p>
          </div>
          <div className="companion-block">
            <b>属性 · {ATTR_POINT_TOTAL} 点</b>
            <ul className="chargen-attrs">
              {ATTR_DEFS.map((item) => {
                const value = Number(companion.attrs?.[item.id] || 0);
                return (
                  <li key={item.id}>
                    <div>
                      <strong>{item.id}</strong>
                      <span>{item.hint}</span>
                    </div>
                    <div className="chargen-stepper">
                      <em>{value}</em>
                      <small>检定+{attrModifier(value)}</small>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="companion-block">
            <b>来历</b>
            <p>{companion.story}</p>
          </div>
        </div>
      </div>
      <div className="chargen-foot">
        <p className="tiny">组织派来的是这个人。可以选择先走一遍界面教程，或直接落入黎明纪元。</p>
        <div className="chargen-foot-btns">
          <button className="tide-btn" type="button" onClick={() => onDepart(false)}>
            跳过教程直接开始
          </button>
          <button className="tide-btn gold" type="button" onClick={() => onDepart(true)}>
            进入教程
          </button>
        </div>
      </div>
    </section>
  );
}
