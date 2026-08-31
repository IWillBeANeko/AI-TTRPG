import { useEffect, useRef, useState } from "react";

const LETTERS = ["W", "A", "R", "N"];
const TICK_MS = 560;
const MISS_MS = 500;

export default function WarnLock({ onSolved }) {
  const [phase, setPhase] = useState(0);
  const [solved, setSolved] = useState(0);
  const [miss, setMiss] = useState(false);
  const lock = useRef({ phase: 0, solved: 0, busy: false, done: false });

  useEffect(() => {
    const timer = setInterval(() => {
      if (lock.current.busy || lock.current.done) return;
      setPhase((prev) => {
        const next = (prev + 1) % LETTERS.length;
        lock.current.phase = next;
        return next;
      });
    }, TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const press = () => {
    if (lock.current.busy || lock.current.done) return;
    if (lock.current.phase === lock.current.solved) {
      const next = lock.current.solved + 1;
      lock.current.solved = next;
      lock.current.phase = 0;
      setSolved(next);
      setPhase(0);
      if (next >= LETTERS.length) {
        lock.current.done = true;
        lock.current.busy = true;
        window.setTimeout(() => onSolved?.(), 380);
      }
      return;
    }
    lock.current.busy = true;
    setMiss(true);
    window.setTimeout(() => {
      setMiss(false);
      lock.current.busy = false;
    }, MISS_MS);
  };

  return (
    <div className="warn-lock" aria-label="电子锁">
      <p className="warn-lock-brand">WARN LOCK</p>
      <div className={`warn-lock-slots${miss ? " is-miss" : ""}`}>
        {LETTERS.map((letter, index) => {
          const locked = index < solved;
          const active = index === solved && !lock.current.done;
          const shown = locked ? letter : active ? LETTERS[phase] : "";
          const hit = active && phase === index;
          return (
            <span
              key={letter}
              className={`warn-slot${locked ? " is-set" : ""}${hit ? " is-hit" : ""}${!locked && !active ? " is-idle" : ""}`}
            >
              {shown}
            </span>
          );
        })}
      </div>
      <p className="warn-lock-cap">{solved}/{LETTERS.length} 已对齐</p>
      <button className="warn-lock-ok" type="button" onClick={press} disabled={miss}>
        确定
      </button>
    </div>
  );
}
