import worldStatus from "@/character-engine/maps/world/status.md?raw";
import squareStatus from "@/character-engine/maps/square/status.md?raw";
import harborStatus from "@/character-engine/maps/harbor/status.md?raw";
import lighthouseStatus from "@/character-engine/maps/lighthouse/status.md?raw";
import councilStatus from "@/character-engine/maps/council/status.md?raw";
import archiveStatus from "@/character-engine/maps/archive/status.md?raw";

export const MAP_STATUS_IDS = ["world", "square", "harbor", "lighthouse", "council", "archive"];

const TEMPLATES = {
  world: String(worldStatus || "").trim(),
  square: String(squareStatus || "").trim(),
  harbor: String(harborStatus || "").trim(),
  lighthouse: String(lighthouseStatus || "").trim(),
  council: String(councilStatus || "").trim(),
  archive: String(archiveStatus || "").trim(),
};

export function emptyMapStatus() {
  return Object.fromEntries(
    MAP_STATUS_IDS.map((id) => [id, { events: [], overlay: "" }]),
  );
}

export function appendMapEvent(state, mapId, text) {
  const id = MAP_STATUS_IDS.includes(mapId) ? mapId : "world";
  const line = String(text || "").trim();
  if (!line) return state;
  const pack = state.mapStatus?.[id] || { events: [], overlay: "" };
  const last = pack.events?.[pack.events.length - 1];
  if (last === line) return state;
  return {
    ...state,
    mapStatus: {
      ...(state.mapStatus || emptyMapStatus()),
      [id]: {
        ...pack,
        events: [...(pack.events || []), line.slice(0, 220)].slice(-40),
      },
    },
  };
}

export function setMapOverlay(state, mapId, overlay) {
  const id = MAP_STATUS_IDS.includes(mapId) ? mapId : "world";
  const pack = state.mapStatus?.[id] || { events: [], overlay: "" };
  return {
    ...state,
    mapStatus: {
      ...(state.mapStatus || emptyMapStatus()),
      [id]: { ...pack, overlay: String(overlay || "").trim().slice(0, 280) },
    },
  };
}

export function composeMapStatus(mapId, game = {}) {
  const id = MAP_STATUS_IDS.includes(mapId) ? mapId : "world";
  const pack = game.mapStatus?.[id] || { events: [], overlay: "" };
  const lines = [TEMPLATES[id] || ""];
  if (pack.overlay) {
    lines.push("", "## 现状改写（本局）", pack.overlay);
  }
  const events = pack.events || [];
  if (events.length) {
    lines.push("", "## 本局发生过的事");
    for (const item of events) lines.push(`- ${item}`);
  }
  return lines.join("\n");
}

export function mapOverlayOf(game, mapId) {
  return String(game?.mapStatus?.[mapId]?.overlay || "").trim();
}
