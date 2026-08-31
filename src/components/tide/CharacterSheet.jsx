import { useMemo, useState } from "react";
import { PLAYER_PORTRAITS } from "@/components/rpg/assets";
import {
  ATTR_DEFS,
  ATTR_MAX,
  ATTR_MIN,
  ATTR_POINT_TOTAL,
  CHARGEN_QUESTIONS,
  attrModifier,
  emptyPlayerSheet,
  finalizeSheet,
  remainingPoints,
  validateSheet,
} from "@/data/chargen";

export default function CharacterSheet({ onConfirm }) {
  const [sheet, setSheet] = useState(() => emptyPlayerSheet());
  const remain = remainingPoints(sheet.attrs);
  const error = useMemo(() => validateSheet(sheet), [sheet]);

  const setAttr = (id, next) => {
    const current = Number(sheet.attrs[id] || 0);
    const clamped = Math.max(ATTR_MIN, Math.min(ATTR_MAX, next));
    const delta = clamped - current;
    if (delta > 0 && remain - delta < 0) return;
    setSheet((prev) => ({
      ...prev,
      attrs: { ...prev.attrs, [id]: clamped },
    }));
  };

  const depart = () => {
    if (error) return;
    onConfirm(finalizeSheet(sheet));
  };

  return (
    <section className="boot chargen" aria-label="创建角色">
      <p className="sub">TIDE REQUIEM · 创建角色</p>
      <h1>写下你是谁</h1>
      <div className="chargen-grid">
        <aside className="chargen-portrait" aria-hidden="true">
          <img
            alt=""
            className={sheet.gender === "male" ? "on" : ""}
            src={PLAYER_PORTRAITS.male}
          />
          <img
            alt=""
            className={sheet.gender === "female" ? "on" : ""}
            src={PLAYER_PORTRAITS.female}
          />
          <span className="chargen-portrait-cap">{sheet.gender === "female" ? "女 · 时隙行者" : "男 · 时隙行者"}</span>
        </aside>

        <div className="chargen-form">
          <label className="chargen-field">
            <b>姓名</b>
            <input
              maxLength={12}
              onChange={(event) => setSheet((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="你希望别人怎么称呼你"
              value={sheet.name}
            />
          </label>

          <div className="chargen-field">
            <b>性别</b>
            <div className="chargen-gender">
              <button
                className={sheet.gender === "male" ? "on" : ""}
                onClick={() => setSheet((prev) => ({ ...prev, gender: "male" }))}
                type="button"
              >
                男
              </button>
              <button
                className={sheet.gender === "female" ? "on" : ""}
                onClick={() => setSheet((prev) => ({ ...prev, gender: "female" }))}
                type="button"
              >
                女
              </button>
            </div>
          </div>

          <div className="chargen-field">
            <b>
              属性 <i>剩余 {remain} / {ATTR_POINT_TOTAL}</i>
            </b>
            <ul className="chargen-attrs">
              {ATTR_DEFS.map((item) => {
                const value = Number(sheet.attrs[item.id] || 0);
                return (
                  <li key={item.id}>
                    <div>
                      <strong>{item.id}</strong>
                      <span>{item.hint}</span>
                    </div>
                    <div className="chargen-stepper">
                      <button
                        disabled={value <= ATTR_MIN}
                        onClick={() => setAttr(item.id, value - 1)}
                        type="button"
                      >
                        −
                      </button>
                      <em>{value}</em>
                      <button
                        disabled={value >= ATTR_MAX || remain <= 0}
                        onClick={() => setAttr(item.id, value + 1)}
                        type="button"
                      >
                        +
                      </button>
                      <small>检定+{attrModifier(value)}</small>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="chargen-field">
            <b>五个问题</b>
            {CHARGEN_QUESTIONS.map((question, index) => (
              <fieldset className="chargen-q" key={question.id}>
                <legend>
                  {index + 1}. {question.prompt}
                </legend>
                <div className="chargen-opts">
                  {question.options.map((option) => (
                    <button
                      className={sheet.answers[question.id] === option.id ? "on" : ""}
                      key={option.id}
                      onClick={() =>
                        setSheet((prev) => ({
                          ...prev,
                          answers: { ...prev.answers, [question.id]: option.id },
                        }))
                      }
                      type="button"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </fieldset>
            ))}
            <fieldset className="chargen-q">
              <legend>5. 如果你有一个队友，你希望他是……</legend>
              <div className="talk-row chargen-wish">
                <input
                  maxLength={50}
                  onChange={(event) => setSheet((prev) => ({ ...prev, teammateWish: event.target.value }))}
                  placeholder="任意写下你希望的队友，不超过 50 个字"
                  value={sheet.teammateWish}
                />
                <span className="tiny">{(sheet.teammateWish || "").length}/50</span>
              </div>
            </fieldset>
          </div>
        </div>
      </div>

      <div className="chargen-foot">
        {error ? <p className="tiny">{error}</p> : <p className="tiny">下一步会根据你的选择写出性格简报，再辨认那位同行者。</p>}
        <button className="tide-btn gold" disabled={Boolean(error)} onClick={depart} type="button">
          下一步
        </button>
      </div>
    </section>
  );
}
