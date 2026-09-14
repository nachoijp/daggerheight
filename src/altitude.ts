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

export interface ColorPreset {
  id: string;
  name: string;
  colors: Record<RankId, string>;
}

/**
 * Color palettes matching the Owlbear Rodeo "Ranges" extension's built-in
 * themes (github.com/owlbear-rodeo/ranges), so users can visually pair the
 * two extensions' colors by hand. Ranges' ring 0 is always "Melee", which we
 * have no icon for, so we skip it and take its rings 1-4 (Very Close, Close,
 * Far, Very Far) to match our 4 rank bands.
 */
export const COLOR_PRESETS: ColorPreset[] = [
  {
    id: "base",
    name: "Base",
    colors: { MUY_CERCA: "#198de6", CERCA: "#6cbf15", LEJOS: "#deaa19", MUY_LEJOS: "#e16919" },
  },
  {
    id: "deuteranopia",
    name: "Deuteranopia",
    colors: { MUY_CERCA: "#e68919", CERCA: "#15a5bf", LEJOS: "#19de76", MUY_LEJOS: "#b419e1" },
  },
  {
    id: "tritanopia",
    name: "Tritanopia",
    colors: { MUY_CERCA: "#b819e6", CERCA: "#1572bf", LEJOS: "#de7d19", MUY_LEJOS: "#3be119" },
  },
  {
    id: "protanopia",
    name: "Protanopia",
    colors: { MUY_CERCA: "#19e672", CERCA: "#157fbf", LEJOS: "#dede19", MUY_LEJOS: "#e119d9" },
  },
];

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

function rectVertices(left: number, top: number, width: number, height: number): Point[] {
  return [
    { x: left, y: top },
    { x: left + width, y: top },
    { x: left + width, y: top + height },
    { x: left, y: top + height },
  ];
}

function diamondVertices(cx: number, cy: number, size: number): Point[] {
  const r = size / 2;
  return [
    { x: cx, y: cy - r },
    { x: cx + r, y: cy },
    { x: cx, y: cy + r },
    { x: cx - r, y: cy },
  ];
}

function circleVertices(cx: number, cy: number, size: number, sides = 24): Point[] {
  const r = size / 2;
  const points: Point[] = [];
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
    points.push({ x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) });
  }
  return points;
}

function starVertices(cx: number, cy: number, size: number, spikes = 5): Point[] {
  const outerR = size / 2;
  const innerR = outerR * 0.45;
  const points: Point[] = [];
  const step = Math.PI / spikes;
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = -Math.PI / 2 + i * step;
    points.push({ x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) });
  }
  return points;
}

const CORNER_RADIUS_RATIO = 0.22;

/**
 * Feather (UP) and shovel (DOWN) silhouettes, converted from Phosphor Icons'
 * "feather-fill"/"shovel-fill" SVGs (github.com/phosphor-icons/core, MIT
 * license, no attribution required) and normalized to a centered -0.5..0.5
 * unit box. Unlike the other cell shapes these are baked vector art (with
 * curves), not something built from simple polygon math.
 */
const FEATHER_COMMANDS: PathCommand[] = [
  [0, 0.3275, 0.0266], [1, 0.0939, 0.2628], [1, 0.0939, 0.2628],
  [4, 0.0824, 0.2745, 0.0666, 0.2811, 0.0502, 0.2811], [1, -0.2058, 0.2811], [1, -0.3216, 0.3971],
  [4, -0.3339, 0.4093, -0.3536, 0.4093, -0.3659, 0.3971], [4, -0.3781, 0.3849, -0.3781, 0.3651, -0.3659, 0.3529],
  [1, -0.2776, 0.2647], [1, -0.2776, 0.2647], [1, -0.0129, 0], [1, 0.3164, 0],
  [4, 0.3227, 0, 0.3284, 0.0038, 0.3308, 0.0096], [4, 0.3332, 0.0154, 0.3319, 0.0221, 0.3275, 0.0266],
  [5],
  [0, 0.3465, -0.3806], [4, 0.2471, -0.4623, 0.102, -0.4553, 0.0109, -0.3644], [1, -0.0266, -0.3274],
  [4, -0.0295, -0.3245, -0.0312, -0.3205, -0.0312, -0.3164], [1, -0.0312, -0.0703], [1, 0.1836, -0.2852],
  [4, 0.1959, -0.2968, 0.2152, -0.2966, 0.2272, -0.2846], [4, 0.2392, -0.2726, 0.2394, -0.2533, 0.2278, -0.241],
  [1, 0.0496, -0.0625], [1, 0.3949, -0.0625], [4, 0.4007, -0.0625, 0.4061, -0.0657, 0.4088, -0.0709],
  [4, 0.464, -0.1759, 0.438, -0.3052, 0.3465, -0.3806],
  [5],
  [0, -0.2546, 0.1532], [1, -0.0937, -0.0076], [1, -0.0937, -0.2236],
  [4, -0.0938, -0.2299, -0.0975, -0.2356, -0.1034, -0.238], [4, -0.1092, -0.2404, -0.1159, -0.2391, -0.1204, -0.2347],
  [1, -0.2629, -0.0937], [4, -0.2747, -0.0821, -0.2813, -0.0662, -0.2812, -0.0496], [1, -0.2812, 0.1422],
  [4, -0.2813, 0.1485, -0.2774, 0.1542, -0.2716, 0.1566], [4, -0.2658, 0.1591, -0.259, 0.1577, -0.2546, 0.1532],
  [5],
] as unknown as PathCommand[];

const SHOVEL_COMMANDS: PathCommand[] = [
  [0, 0.4596, -0.2279], [4, 0.4537, -0.222, 0.4458, -0.2187, 0.4375, -0.2187],
  [4, 0.4292, -0.2187, 0.4213, -0.222, 0.4154, -0.2279], [1, 0.3438, -0.2996], [1, 0.0664, -0.0222],
  [1, 0.0221, -0.0664], [1, 0.2995, -0.3437], [1, 0.2279, -0.4154],
  [4, 0.2157, -0.4276, 0.2157, -0.4474, 0.2279, -0.4596], [4, 0.2401, -0.4718, 0.2599, -0.4718, 0.2721, -0.4596],
  [1, 0.4596, -0.2721], [4, 0.4655, -0.2662, 0.4688, -0.2583, 0.4688, -0.25],
  [4, 0.4688, -0.2417, 0.4655, -0.2338, 0.4596, -0.2279],
  [5],
  [0, -0.1562, 0.1875], [4, -0.1689, 0.1875, -0.1803, 0.1799, -0.1851, 0.1682],
  [4, -0.19, 0.1565, -0.1873, 0.1431, -0.1784, 0.1341], [1, 0.0221, -0.0664], [1, -0.1121, -0.2005],
  [4, -0.1365, -0.2249, -0.176, -0.2249, -0.2004, -0.2005], [1, -0.4192, 0.0183],
  [4, -0.431, 0.03, -0.4376, 0.0459, -0.4375, 0.0625], [1, -0.4375, 0.375],
  [4, -0.4375, 0.4095, -0.4095, 0.4375, -0.375, 0.4375], [1, -0.0625, 0.4375],
  [4, -0.0459, 0.4376, -0.03, 0.431, -0.0183, 0.4192], [1, 0.2004, 0.2004],
  [4, 0.2248, 0.176, 0.2248, 0.1365, 0.2004, 0.1121], [1, 0.0664, -0.0221], [1, -0.1341, 0.1784],
  [4, -0.14, 0.1842, -0.148, 0.1875, -0.1562, 0.1875],
  [5],
] as unknown as PathCommand[];

function transformNormalizedCommands(
  commands: PathCommand[],
  cx: number,
  cy: number,
  width: number,
  height: number
): PathCommand[] {
  const tx = (x: number) => cx + x * width;
  const ty = (y: number) => cy + y * height;
  return commands.map((cmd): PathCommand => {
    if (cmd[0] === Command.MOVE || cmd[0] === Command.LINE) {
      return [cmd[0], tx(cmd[1]), ty(cmd[2])];
    }
    if (cmd[0] === Command.CUBIC) {
      return [cmd[0], tx(cmd[1]), ty(cmd[2]), tx(cmd[3]), ty(cmd[4]), tx(cmd[5]), ty(cmd[6])];
    }
    return cmd;
  });
}

/** The visual silhouette drawn for each icon in a stack */
export type CellShape = "TRIANGLE" | "BAR" | "CIRCLE" | "DIAMOND" | "SQUARE" | "STAR" | "WING_DRILL";

/**
 * A shape offered in the settings picker. Most cell shapes are symmetric, so
 * (unlike the pointed triangle) they can't show UP/DOWN by which way they
 * point — instead their whole stack tapers, growing toward the "big" end.
 * TRIANGLE additionally has a stepped variant of itself for users who want
 * both cues (pointing *and* tapering) at once.
 */
export type IconShape =
  | "TRIANGLE"
  | "TRIANGLE_STEPPED"
  | "BAR"
  | "CIRCLE"
  | "DIAMOND"
  | "SQUARE"
  | "STAR"
  | "WING_DRILL";

interface ShapeConfig {
  cell: CellShape;
  /** Whether the stack tapers in size to show direction, instead of the cell shape pointing */
  stepped: boolean;
}

const SHAPE_CONFIG: Record<IconShape, ShapeConfig> = {
  TRIANGLE: { cell: "TRIANGLE", stepped: false },
  TRIANGLE_STEPPED: { cell: "TRIANGLE", stepped: true },
  BAR: { cell: "BAR", stepped: true },
  CIRCLE: { cell: "CIRCLE", stepped: true },
  DIAMOND: { cell: "DIAMOND", stepped: true },
  SQUARE: { cell: "SQUARE", stepped: true },
  STAR: { cell: "STAR", stepped: true },
  // Direction is already shown by which pictogram is used, so this doesn't taper.
  WING_DRILL: { cell: "WING_DRILL", stepped: false },
};

export const ICON_SHAPES: { id: IconShape; labelKey: StringKey }[] = [
  { id: "TRIANGLE", labelKey: "shapeTriangle" },
  { id: "TRIANGLE_STEPPED", labelKey: "shapeTriangleStepped" },
  { id: "BAR", labelKey: "shapeBar" },
  { id: "CIRCLE", labelKey: "shapeCircle" },
  { id: "DIAMOND", labelKey: "shapeDiamond" },
  { id: "SQUARE", labelKey: "shapeSquare" },
  { id: "STAR", labelKey: "shapeStar" },
  { id: "WING_DRILL", labelKey: "shapeWingDrill" },
];

const SHAPE_SIZE_RATIO: Record<CellShape, { width: number; height: number }> = {
  TRIANGLE: { width: 0.4, height: 0.34 },
  BAR: { width: 0.5, height: 0.16 },
  SQUARE: { width: 0.32, height: 0.32 },
  DIAMOND: { width: 0.38, height: 0.38 },
  CIRCLE: { width: 0.32, height: 0.32 },
  STAR: { width: 0.36, height: 0.36 },
  WING_DRILL: { width: 0.36, height: 0.36 },
};

const SHAPE_GAP_RATIO: Record<CellShape, number> = {
  TRIANGLE: 0.08,
  BAR: 0.08,
  SQUARE: 0.08,
  DIAMOND: 0.08,
  CIRCLE: 0.08,
  STAR: 0.08,
  WING_DRILL: 0.08,
};

/**
 * Outline width ratio (of dpi) for the on-board marker's stroke. The baked
 * feather/shovel art has fine internal details, so the same stroke used on
 * the simple polygon shapes would visually thicken and muddy them.
 */
const SHAPE_STROKE_RATIO: Record<CellShape, number> = {
  TRIANGLE: 0.035,
  BAR: 0.035,
  SQUARE: 0.035,
  DIAMOND: 0.035,
  CIRCLE: 0.035,
  STAR: 0.035,
  WING_DRILL: 0.012,
};

export function getStrokeWidthRatio(shape: IconShape): number {
  return SHAPE_STROKE_RATIO[SHAPE_CONFIG[shape].cell];
}

/** How much a stepped stack's cells shrink from its biggest to its smallest */
const STEPPED_MIN_SCALE = 0.5;
const STEPPED_MAX_SCALE = 1.15;

/**
 * Scale of the icon at `index` in a stack of `count`. In a vertical stack
 * (index 0 at the top) UP is biggest at the top, DOWN biggest at the bottom.
 * In a horizontal stack (index 0 at the left) that reads backwards, so the
 * growth direction is flipped: UP biggest at the right, DOWN at the left.
 */
function taperScale(index: number, count: number, direction: Direction, horizontal: boolean): number {
  if (count <= 1) {
    return 1;
  }
  const t = index / (count - 1);
  const up = direction === "UP";
  const grow = horizontal ? (up ? t : 1 - t) : up ? 1 - t : t;
  return STEPPED_MIN_SCALE + grow * (STEPPED_MAX_SCALE - STEPPED_MIN_SCALE);
}

type PolygonCellShape = Exclude<CellShape, "WING_DRILL">;

function cellVertices(
  cell: PolygonCellShape,
  cx: number,
  cy: number,
  width: number,
  height: number,
  direction: Direction
): Point[] {
  switch (cell) {
    case "TRIANGLE":
      return triangleVertices(cx - width / 2, cy - height / 2, width, height, direction);
    case "BAR":
    case "SQUARE":
      return rectVertices(cx - width / 2, cy - height / 2, width, height);
    case "DIAMOND":
      return diamondVertices(cx, cy, Math.min(width, height));
    case "CIRCLE":
      return circleVertices(cx, cy, Math.min(width, height));
    case "STAR":
      return starVertices(cx, cy, Math.min(width, height));
  }
}

function cellCornerRadius(cell: PolygonCellShape, width: number, height: number): number {
  switch (cell) {
    case "TRIANGLE":
    case "SQUARE":
      return Math.min(width, height) * CORNER_RADIUS_RATIO;
    case "BAR":
      // Fully round the short ends, turning the rectangle into a capsule/pill
      return height / 2;
    case "DIAMOND":
      return Math.min(width, height) * CORNER_RADIUS_RATIO * 0.6;
    case "CIRCLE":
    case "STAR":
      return 0;
  }
}

/** Builds the full path for one icon in the stack, in absolute local coordinates */
function cellCommands(
  cell: CellShape,
  cx: number,
  cy: number,
  width: number,
  height: number,
  direction: Direction
): PathCommand[] {
  if (cell === "WING_DRILL") {
    const normalized = direction === "UP" ? FEATHER_COMMANDS : SHOVEL_COMMANDS;
    return transformNormalizedCommands(normalized, cx, cy, width, height);
  }
  return roundedPolygonCommands(
    cellVertices(cell, cx, cy, width, height, direction),
    cellCornerRadius(cell, width, height)
  );
}

/**
 * Geometry, in local path units, of an icon stack anchored at (0, 0) — the
 * point of the stack closest to the token. For LEFT/RIGHT positions the
 * stack is a vertical column; for TOP/BOTTOM it's a horizontal row. Stepped
 * shapes taper in size along the stack instead of pointing, to show
 * direction: biggest at the near end for UP, at the far end for DOWN.
 */
export function buildIconStackCommands(
  shape: IconShape,
  count: number,
  direction: Direction,
  dpi: number,
  sizeScale: number,
  position: Position
): PathCommand[] {
  const { cell, stepped } = SHAPE_CONFIG[shape];
  const ratio = SHAPE_SIZE_RATIO[cell];
  const baseWidth = ratio.width * dpi * sizeScale;
  const baseHeight = ratio.height * dpi * sizeScale;
  const gap = SHAPE_GAP_RATIO[cell] * dpi * sizeScale;
  const horizontal = position === "TOP" || position === "BOTTOM";

  const scales = Array.from({ length: count }, (_, i) =>
    stepped ? taperScale(i, count, direction, horizontal) : 1
  );
  const widths = scales.map((s) => baseWidth * s);
  const heights = scales.map((s) => baseHeight * s);
  const stackSizes = horizontal ? widths : heights;
  const totalStack = stackSizes.reduce((a, b) => a + b, 0) + gap * Math.max(0, count - 1);
  // All cells share one centerline on the cross axis (sized to the biggest
  // cell) instead of each hugging the anchor with its own size, which would
  // leave smaller cells looking pushed to one side once sizes start to vary.
  const maxWidth = Math.max(...widths);
  const maxHeight = Math.max(...heights);
  const crossCenterX = position === "LEFT" ? -maxWidth / 2 : maxWidth / 2;
  const crossCenterY = position === "TOP" ? -maxHeight / 2 : maxHeight / 2;

  const commands: PathCommand[] = [];
  let cursor = -totalStack / 2;
  for (let i = 0; i < count; i++) {
    const width = widths[i];
    const height = heights[i];
    let cx: number;
    let cy: number;
    if (horizontal) {
      cx = cursor + width / 2;
      cy = crossCenterY;
    } else {
      cy = cursor + height / 2;
      cx = crossCenterX;
    }
    commands.push(...cellCommands(cell, cx, cy, width, height, direction));
    cursor += stackSizes[i] + gap;
  }
  return commands;
}

function forEachCommandPoint(commands: PathCommand[], fn: (x: number, y: number) => void) {
  for (const cmd of commands) {
    if (cmd[0] === Command.MOVE || cmd[0] === Command.LINE) {
      fn(cmd[1], cmd[2]);
    } else if (cmd[0] === Command.QUAD) {
      fn(cmd[1], cmd[2]);
      fn(cmd[3], cmd[4]);
    } else if (cmd[0] === Command.CUBIC) {
      fn(cmd[1], cmd[2]);
      fn(cmd[3], cmd[4]);
      fn(cmd[5], cmd[6]);
    }
  }
}

function translateCommands(commands: PathCommand[], dx: number, dy: number): PathCommand[] {
  return commands.map((cmd): PathCommand => {
    if (cmd[0] === Command.MOVE || cmd[0] === Command.LINE) {
      return [cmd[0], cmd[1] + dx, cmd[2] + dy];
    }
    if (cmd[0] === Command.QUAD) {
      return [cmd[0], cmd[1] + dx, cmd[2] + dy, cmd[3] + dx, cmd[4] + dy];
    }
    if (cmd[0] === Command.CUBIC) {
      return [cmd[0], cmd[1] + dx, cmd[2] + dy, cmd[3] + dx, cmd[4] + dy, cmd[5] + dx, cmd[6] + dy];
    }
    return cmd;
  });
}

/** Small fixed-size SVG preview used inside the picker buttons */
export function iconStackPreviewSvg(
  shape: IconShape,
  count: number,
  direction: Direction,
  color: string
): string {
  // Matches the on-board sizing at dpi=1, sizeScale=27.5 (chosen so a plain
  // triangle preview comes out ~11x9px, the size the original art used).
  const commands = buildIconStackCommands(shape, count, direction, 1, 27.5, "LEFT");

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  forEachCommandPoint(commands, (x, y) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  });
  const width = maxX - minX;
  const height = maxY - minY;
  const d = pathCommandsToSvgD(translateCommands(commands, -minX, -minY));

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg"><path d="${d}" fill="${color}" /></svg>`;
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
      case Command.CUBIC:
        d += `C ${cmd[1]} ${cmd[2]} ${cmd[3]} ${cmd[4]} ${cmd[5]} ${cmd[6]} `;
        break;
      case Command.CLOSE:
        d += "Z ";
        break;
    }
  }
  return d;
}
