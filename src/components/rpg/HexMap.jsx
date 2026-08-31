import { useEffect, useMemo, useRef, useState } from "react";
import { HEX_LOCS } from "./assets";

function hexPixel(q, r, size, ox, oy) {
  return [size * Math.sqrt(3) * (q + r / 2) + ox, size * 1.5 * r + oy];
}

function hexPath(cx, cy, size) {
  const pts = [];
  for (let i = 0; i < 6; i += 1) {
    const a = (Math.PI / 180) * (60 * i - 30);
    pts.push(`${cx + size * Math.cos(a)},${cy + size * Math.sin(a)}`);
  }
  return pts.join(" ");
}

export default function HexMap({ state, onSelect }) {
  const wrapRef = useRef(null);
  const [sizeBox, setSizeBox] = useState({ w: 320, h: 280 });

  useEffect(() => {
    const node = wrapRef.current;
    if (!node) return undefined;
    const update = () => {
      const w = node.clientWidth;
      const h = node.clientHeight;
      if (w > 40 && h > 40) setSizeBox({ w, h });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [state]);

  const { cells, markers, size } = useMemo(() => {
    const { w, h } = sizeBox;
    const hexSize = Math.min(w, h) * 0.062;
    const ox = w * 0.22;
    const oy = h * 0.22;
    const nextCells = [];
    for (let q = -2; q <= 6; q += 1) {
      for (let r = -1; r <= 5; r += 1) {
        const [x, y] = hexPixel(q, r, hexSize, ox, oy);
        if (x < -20 || y < -20 || x > w + 20 || y > h + 20) continue;
        nextCells.push({ q, r, x, y });
      }
    }
    const byQR = {};
    for (const [id, loc] of Object.entries(HEX_LOCS)) byQR[`${loc.q},${loc.r}`] = id;
    const nextMarkers = (state?.map || [])
      .map((loc) => {
        const hex = HEX_LOCS[loc.id];
        if (!hex) return null;
        const [x, y] = hexPixel(hex.q, hex.r, hexSize, ox, oy);
        return { ...loc, x, y, mark: hex.mark };
      })
      .filter(Boolean);
    return { cells: nextCells.map((cell) => ({ ...cell, id: byQR[`${cell.q},${cell.r}`] || "" })), markers: nextMarkers, size: hexSize };
  }, [sizeBox, state]);

  if (!state) return <div className="hex-markers" ref={wrapRef} />;

  return (
    <div className="hex-grid" ref={wrapRef} style={{ position: "absolute", inset: 0 }}>
      <svg
        id="hex-grid"
        className="hex-grid"
        viewBox={`0 0 ${sizeBox.w} ${sizeBox.h}`}
      >
        {cells.map((cell) => {
          const loc = cell.id ? state.map.find((item) => item.id === cell.id) : null;
          const cls = ["hex-cell", loc ? "loc" : "", loc?.here ? "here" : "", loc?.reachable ? "reach" : ""]
            .filter(Boolean)
            .join(" ");
          return (
            <g key={`${cell.q},${cell.r}`}>
              <polygon
                className={cls}
                points={hexPath(cell.x, cell.y, size * 0.92)}
                onClick={() => loc && onSelect?.(loc)}
              />
              {loc ? (
                <text className="hex-label" x={cell.x} y={cell.y + size * 0.72} textAnchor="middle">
                  {loc.name}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      <div className="hex-markers">
        {markers.map((loc) =>
          loc.here ? (
            <div key={loc.id} className="marker here" style={{ left: loc.x, top: loc.y }} />
          ) : (
            <div key={loc.id} className={`marker ${loc.mark}`} style={{ left: loc.x, top: loc.y }}>
              {loc.mark === "alert" ? "!" : loc.mark === "hub" ? "▲" : "◆"}
            </div>
          ),
        )}
      </div>
    </div>
  );
}

export function MiniMap({ state }) {
  if (!state) return null;
  return (
    <svg viewBox="0 0 72 72">
      <text x="36" y="10" textAnchor="middle" fill="#2ef0ff" fontSize="7">
        N
      </text>
      {(state.map || []).map((loc) => {
        const hex = HEX_LOCS[loc.id];
        if (!hex) return null;
        return (
          <circle
            key={loc.id}
            cx={18 + hex.q * 9}
            cy={16 + hex.r * 10}
            r={loc.here ? 3.2 : 2}
            fill={loc.here ? "#2ef0ff" : loc.reachable ? "#3dff9a" : "#4a6a80"}
          />
        );
      })}
    </svg>
  );
}
