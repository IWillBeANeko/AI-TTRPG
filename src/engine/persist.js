const KEY = "chronodeck.store.v2";
const MAX_GAMES = 2;
const MAX_EVENTS = 180;
const MAX_MEMORIES = 80;

function emptyDb() {
  return { games: {}, memories: {}, events: {}, trajectories: [], currentId: null };
}

function isQuotaError(err) {
  return err?.name === "QuotaExceededError" || err?.code === 22 || err?.code === 1014;
}

function stripEmbedding(memory) {
  if (!memory || typeof memory !== "object") return memory;
  const { embedding, ...rest } = memory;
  return rest;
}

function slimSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return snapshot;
  const { locations, ...rest } = snapshot;
  return rest;
}

function keepIds(db, limit) {
  const ranked = Object.values(db.games || {}).sort((a, b) =>
    String(b.updated_at || "").localeCompare(String(a.updated_at || "")),
  );
  const keep = new Set(ranked.slice(0, limit).map((row) => row.id));
  if (db.currentId) keep.add(db.currentId);
  return keep;
}

function compactDb(db, { gameLimit = MAX_GAMES, eventLimit = MAX_EVENTS, memoryLimit = MAX_MEMORIES } = {}) {
  const keep = keepIds(db, gameLimit);
  const games = {};
  for (const id of keep) {
    const row = db.games?.[id];
    if (!row) continue;
    games[id] = {
      id: row.id,
      tick: row.tick,
      updated_at: row.updated_at,
      snapshot: slimSnapshot(row.snapshot),
    };
  }

  const memories = {};
  for (const [key, list] of Object.entries(db.memories || {})) {
    const gameId = key.split(":")[0];
    if (!keep.has(gameId)) continue;
    memories[key] = (Array.isArray(list) ? list : []).slice(-memoryLimit).map(stripEmbedding);
  }

  const events = {};
  for (const [gameId, list] of Object.entries(db.events || {})) {
    if (!keep.has(gameId)) continue;
    events[gameId] = (Array.isArray(list) ? list : []).slice(-eventLimit);
  }

  return {
    games,
    memories,
    events,
    trajectories: [],
    currentId: db.currentId || rankedCurrent(games),
  };
}

function rankedCurrent(games) {
  const rows = Object.values(games);
  if (!rows.length) return null;
  rows.sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")));
  return rows[0].id;
}

function writeLocal(db) {
  const payload = JSON.stringify(db);
  localStorage.setItem(KEY, payload);
  return payload.length;
}

function saveDb(db) {
  const compact = compactDb(db);
  Object.assign(db, compact);
  try {
    writeLocal(compact);
    return;
  } catch (err) {
    if (!isQuotaError(err)) return;
  }

  const pruned = compactDb(db, { gameLimit: 1, eventLimit: 80, memoryLimit: 40 });
  Object.assign(db, pruned);
  try {
    writeLocal(pruned);
    return;
  } catch (err) {
    if (!isQuotaError(err)) return;
  }

  try {
    localStorage.removeItem(KEY);
    const last = compactDb(db, { gameLimit: 1, eventLimit: 40, memoryLimit: 20 });
    Object.assign(db, last);
    writeLocal(last);
  } catch {
    /* 存档写不进去时继续游戏，不打断对话 */
  }
}

function loadDb() {
  let parsed = emptyDb();
  try {
    parsed = { ...emptyDb(), ...JSON.parse(localStorage.getItem(KEY) || "{}") };
  } catch {
    return emptyDb();
  }
  const compact = compactDb(parsed);
  if ((parsed.trajectories || []).length || Object.keys(parsed.games || {}).length > MAX_GAMES) {
    try {
      writeLocal(compact);
    } catch {
      /* 下次 persist 再清 */
    }
  }
  return compact;
}

export class Store {
  constructor() {
    this.db = loadDb();
    this.liveTrajectories = [];
  }

  persist() {
    try {
      saveDb(this.db);
    } catch {
      /* 配额或序列化失败时不打断对话 */
    }
  }

  saveSnapshot(gameId, tick, snapshot) {
    this.db.games[gameId] = {
      id: gameId,
      tick,
      snapshot: slimSnapshot(snapshot),
      updated_at: new Date().toISOString(),
    };
    this.persist();
  }

  loadSnapshot(gameId) {
    return this.db.games[gameId]?.snapshot ?? null;
  }

  latestGameId() {
    const rows = Object.values(this.db.games);
    if (!rows.length) return null;
    rows.sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
    return rows[0].id;
  }

  listGames() {
    return Object.values(this.db.games)
      .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))
      .map((row) => {
        const snap = row.snapshot || {};
        const time = snap.time || {};
        const playerId = snap.player_id || "player";
        const player = (snap.characters || {})[playerId] || {};
        const locId = player.location_id || "";
        const loc = (snap.locations || {})[locId] || {};
        const hour = Number(time.hour ?? 8);
        const minute = Number(time.minute ?? 0);
        return {
          id: row.id,
          tick: row.tick,
          updated_at: row.updated_at,
          day: time.day || 1,
          clock: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
          location_id: locId,
          location_name: loc.name || locId,
        };
      });
  }

  listEvents(gameId) {
    const rows = this.db.events[gameId] || [];
    return [...rows].sort((a, b) => a.tick - b.tick || (a.seq ?? 0) - (b.seq ?? 0));
  }

  addMemory(gameId, memory) {
    const key = `${gameId}:${memory.character_id}`;
    if (!this.db.memories[key]) this.db.memories[key] = [];
    this.db.memories[key].push(stripEmbedding(memory));
    if (this.db.memories[key].length > MAX_MEMORIES) {
      this.db.memories[key] = this.db.memories[key].slice(-MAX_MEMORIES);
    }
    this.persist();
  }

  listMemories(gameId, characterId) {
    return [...(this.db.memories[`${gameId}:${characterId}`] || [])];
  }

  addEvent(gameId, event) {
    if (!this.db.events[gameId]) this.db.events[gameId] = [];
    if (event.seq == null) event.seq = this.db.events[gameId].length;
    this.db.events[gameId].push(event);
    if (this.db.events[gameId].length > MAX_EVENTS) {
      this.db.events[gameId] = this.db.events[gameId].slice(-MAX_EVENTS);
    }
    this.persist();
  }

  addTrajectory(record) {
    this.liveTrajectories.push(record);
    if (this.liveTrajectories.length > 24) this.liveTrajectories = this.liveTrajectories.slice(-24);
  }

  setCurrent(gameId) {
    this.db.currentId = gameId;
    this.persist();
  }

  currentId() {
    return this.db.currentId || this.latestGameId();
  }
}
