const STORAGE_KEY = "tide.play-record.md";
const STORAGE_JSON = "tide.play-record.json";
const MAX_ENTRIES = 180;

export function emptyPlayLog() {
  return { startedAt: new Date().toISOString(), entries: [] };
}

export function appendPlayLog(log, kind, text, extra = {}) {
  const base = log && typeof log === "object" ? log : emptyPlayLog();
  const line = String(text || "").trim();
  if (!line) return base;
  const entry = {
    at: new Date().toISOString(),
    kind: kind || "note",
    text: line.slice(0, 400),
    ...extra,
  };
  const next = {
    startedAt: base.startedAt || entry.at,
    entries: [...(base.entries || []), entry].slice(-MAX_ENTRIES),
  };
  persistPlayRecord(next);
  return next;
}

export function recordPlay(state, kind, text, extra = {}) {
  const playLog = appendPlayLog(state.playLog, kind, text, extra);
  persistPlayRecord(playLog, { ...state, playLog });
  return { ...state, playLog };
}

export function playLogMarkdown(log = {}, game = {}) {
  const name = game.player?.name || "时隙行者";
  const lines = [`# 游玩记录 · ${name}`, ""];
  if (log.startedAt) lines.push(`开始：${log.startedAt}`, "");
  const entries = log.entries || [];
  if (!entries.length) {
    lines.push("（尚无记录）");
    return lines.join("\n");
  }
  for (const item of entries) {
    const label = kindLabel(item.kind);
    lines.push(`- 【${label}】${item.text}`);
  }
  return lines.join("\n");
}

function kindLabel(kind) {
  if (kind === "talk") return "对话";
  if (kind === "action") return "行动";
  if (kind === "move") return "移动";
  if (kind === "dice") return "检定";
  if (kind === "check") return "校验";
  if (kind === "observe") return "观察";
  if (kind === "aside") return "队友";
  return "记录";
}

export function clearPlayRecord() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_JSON);
  } catch {
    /* ignore */
  }
}

function persistPlayRecord(log, game) {
  try {
    localStorage.setItem(STORAGE_KEY, playLogMarkdown(log, game));
    localStorage.setItem(STORAGE_JSON, JSON.stringify(log));
  } catch {
    /* 配额满时不打断游玩 */
  }
}
