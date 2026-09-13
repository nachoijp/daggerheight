import { Command } from "@owlbear-rodeo/sdk";
import type { PathCommand } from "@owlbear-rodeo/sdk";
import type { StringKey } from "./i18n";

export type Direction = "UP" | "DOWN";
export type RankId = "MUY_CERCA" | "CERCA" | "LEJOS" | "MUY_LEJOS";
export type Position = "LEFT" | "RIGHT" | "TOP" | "BOTTOM";

export const POSITIONS: Position[] = ["LEFT", "RIGHT", "TOP", "BOTTOM"];

export interface AltitudeRank {
  id: RankId;
  count: number;
  labelKey: StringKey;
}

/** The four Daggerheart range bands, from nearest to farthest */
export const RANKS: AltitudeRank[] = [
  { id: "MUY_CERCA", count: 1, labelKey: "rankMuyCerca" },
  { id: "CERCA", count: 2, labelKey: "rankCerca" },
  { id: "LEJOS", count: 3, labelKey: "rankLejos" },
  { id: "MUY_LEJOS", count: 4, labelKey: "rankMuyLejos" },
];

export const DEFAULT_COLORS: Record<RankId, string> = {
  MUY_CERCA: "#3b82f6",
  CERCA: "#22c55e",
  LEJOS: "#eab308",
  MUY_LEJOS: "#f97316",
};

export const DIRECTIONS: { id: Direction; labelKey: StringKey }[] = [
  { id: "UP", labelKey: "directionUp" },
  { id: "DOWN", labelKey: "directionDown" },
];

export interface AltitudeMarkerState {
  rank: RankId;
  direction: Direction;
}

export function buttonId(rankId: string, direction: Direction) {
  return `altitude-btn-${rankId}-${direction}`;
}

interface Point {
  x: number;
  y: number;
}

function normalize(v: Point): Point {
  const len = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / len, y: v.y / len };
}

/** Build a rounded-corner polygon as a closed path (line + quad-curve per corner) */
function roundedPolygonCommands(points: Point[], radius: number): PathCommand[] {
  const n = points.length;
  const starts: Point[] = points.map((p, i) => {
    const prev = points[(i - 1 + n) % n];
    const dir = normalize({ x: prev.x - p.x, y: prev.y - p.y });
    return { x: p.x + dir.x * radius, y: p.y + dir.y * radius };
  });
  const ends: Point[] = points.map((p, i) => {
    const next = points[(i + 1) % n];
    const dir = normalize({ x: next.x - p.x, y: next.y - p.y });
    return { x: p.x + dir.x * radius, y: p.y + dir.y * radius };
  });

  const commands: PathCommand[] = [[Command.MOVE, starts[0].x, starts[0].y]];
  for (let i = 0; i < n; i++) {
    commands.push([Command.QUAD, points[i].x, points[i].y, ends[i].x, ends[i].y]);
    const j = (i + 1) % n;
    if (j !== 0) {
      commands.push([Command.LINE, starts[j].x, starts[j].y]);
    }
  }
  commands.push([Command.CLOSE]);
  return commands;
}

function triangleVertices(
  left: number,
  top: number,
  width: number,
  height: number,
  direction: Direction
): Point[] {
  const midX = left + width / 2;
  if (direction === "UP") {
    return [
      { x: midX, y: top },
      { x: left + width, y: top + height },
      { x: left, y: top + height },
    ];
  }
  return [
    { x: left, y: top },
    { x: left + width, y: top },
    { x: midX, y: top + height },
  ];
}

const TRIANGLE_WIDTH_RATIO = 0.4;
const TRIANGLE_HEIGHT_RATIO = 0.34;
const TRIANGLE_GAP_RATIO = 0.08;
const CORNER_RADIUS_RATIO = 0.22;

/**
 * Geometry, in local path units, of a triangle stack anchored at (0, 0) —
 * the point of the stack closest to the token. For LEFT/RIGHT positions the
 * stack is a vertical column; for TOP/BOTTOM it's a horizontal row.
 */
export function buildTriangleStackCommands(
  count: number,
  direction: Direction,
  dpi: number,
  sizeScale: number,
  position: Position
): PathCommand[] {
  const width = TRIANGLE_WIDTH_RATIO * dpi * sizeScale;
  const height = TRIANGLE_HEIGHT_RATIO * dpi * sizeScale;
  const gap = TRIANGLE_GAP_RATIO * dpi * sizeScale;
  const radius = Math.min(width, height) * CORNER_RADIUS_RATIO;

  const commands: PathCommand[] = [];
  const horizontal = position === "TOP" || position === "BOTTOM";

  if (horizontal) {
    const totalWidth = count * width + (count - 1) * gap;
    const top = position === "TOP" ? -height : 0;
    for (let i = 0; i < count; i++) {
      const left = -totalWidth / 2 + i * (width + gap);
      commands.push(
        ...roundedPolygonCommands(
          triangleVertices(left, top, width, height, direction),
          radius
        )
      );
    }
  } else {
    const totalHeight = count * height + (count - 1) * gap;
    const left = position === "LEFT" ? -width : 0;
    for (let i = 0; i < count; i++) {
      const top = -totalHeight / 2 + i * (height + gap);
      commands.push(
        ...roundedPolygonCommands(
          triangleVertices(left, top, width, height, direction),
          radius
        )
      );
    }
  }
  return commands;
}

/** Small fixed-size SVG preview used inside the picker buttons */
export function trianglesPreviewSvg(
  count: number,
  direction: Direction,
  color: string
): string {
  const triW = 11;
  const triH = 9;
  const gap = 2;
  const radius = Math.min(triW, triH) * CORNER_RADIUS_RATIO;
  const totalHeight = count * triH + (count - 1) * gap;

  let path = "";
  for (let i = 0; i < count; i++) {
    const top = i * (triH + gap);
    const commands = roundedPolygonCommands(
      triangleVertices(0, top, triW, triH, direction),
      radius
    );
    path += pathCommandsToSvgD(commands) + " ";
  }

  return `<svg width="${triW}" height="${totalHeight}" viewBox="0 0 ${triW} ${totalHeight}" xmlns="http://www.w3.org/2000/svg"><path d="${path.trim()}" fill="${color}" /></svg>`;
}

function pathCommandsToSvgD(commands: PathCommand[]): string {
  let d = "";
  for (const cmd of commands) {
    switch (cmd[0]) {
      case Command.MOVE:
        d += `M ${cmd[1]} ${cmd[2]} `;
        break;
      case Command.LINE:
        d += `L ${cmd[1]} ${cmd[2]} `;
        break;
      case Command.QUAD:
        d += `Q ${cmd[1]} ${cmd[2]} ${cmd[3]} ${cmd[4]} `;
        break;
      case Command.CLOSE:
        d += "Z ";
        break;
    }
  }
  return d;
}
