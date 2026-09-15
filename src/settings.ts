import OBR from "@owlbear-rodeo/sdk";
import { getPluginId } from "./pluginId";
import { isPlainObject } from "./util";
import type { Metadata } from "@owlbear-rodeo/sdk";
import type { Language, StringKey } from "./i18n";
import type { AltitudeLevel, IconShape, LevelPreset, Position, RenderMode } from "./altitude";
import { DEFAULT_THEME, ICON_SHAPES, POSITIONS, THEMES, daggerheartLevels, legacyLevelsFromColors } from "./altitude";

export interface AltitudeSettings {
  iconShape: IconShape;
  iconSize: number;
  iconDistance: number;
  /** The level list actually used to render markers - see levels-main.ts for how presets/themes feed into it */
  levels: AltitudeLevel[];
  activePresetId: string;
  activeThemeId: string;
  /** DM-created presets, shared with everyone in the room; built-in presets (Daggerheart/Dragons) aren't stored, they're recomputed from the active theme */
  customPresets: LevelPreset[];
  position: Position;
  scaleWithToken: boolean;
  showDown: boolean;
  showRankLabels: boolean;
}

export const MAX_ICON_DISTANCE = 0.4;

export const DEFAULT_SETTINGS: AltitudeSettings = {
  iconShape: "TRIANGLE",
  iconSize: 1,
  iconDistance: 0.12,
  levels: daggerheartLevels(DEFAULT_THEME),
  activePresetId: "daggerheart",
  activeThemeId: DEFAULT_THEME.id,
  customPresets: [],
  position: "LEFT",
  scaleWithToken: true,
  showDown: true,
  showRankLabels: true,
};

const SETTINGS_KEY = getPluginId("settings");
const LANGUAGE_KEY = getPluginId("language");

/** Levels/presets are mutated in place by the editor, so callers must never hand out a shared array reference (e.g. DEFAULT_SETTINGS.levels itself) */
export function cloneLevels(levels: AltitudeLevel[]): AltitudeLevel[] {
  return levels.map((level) => ({ ...level }));
}

function isRenderMode(value: unknown): value is RenderMode {
  return value === "ICONS" || value === "TEXT";
}

function sanitizeLevel(value: unknown): AltitudeLevel | undefined {
  if (
    !isPlainObject(value) ||
    typeof value.id !== "string" ||
    typeof value.label !== "string" ||
    typeof value.color !== "string" ||
    !isRenderMode(value.renderMode)
  ) {
    return undefined;
  }
  const level: AltitudeLevel = {
    id: value.id,
    label: value.label,
    color: value.color,
    renderMode: value.renderMode,
  };
  if (typeof value.labelKey === "string") {
    level.labelKey = value.labelKey as StringKey;
  }
  return level;
}

function sanitizeLevels(value: unknown): AltitudeLevel[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const levels = value
    .map(sanitizeLevel)
    .filter((level): level is AltitudeLevel => level !== undefined);
  return levels.length > 0 ? levels : undefined;
}

function sanitizePreset(value: unknown): LevelPreset | undefined {
  if (!isPlainObject(value) || typeof value.id !== "string" || typeof value.name !== "string") {
    return undefined;
  }
  const levels = sanitizeLevels(value.levels);
  if (!levels) {
    return undefined;
  }
  return {
    id: value.id,
    name: value.name,
    builtIn: false,
    colorStartIndex: typeof value.colorStartIndex === "number" ? value.colorStartIndex : 0,
    levels,
  };
}

function sanitizePresets(value: unknown): LevelPreset[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map(sanitizePreset)
    .filter((preset): preset is LevelPreset => preset !== undefined);
}

function mergeSettings(stored: unknown): AltitudeSettings {
  if (!isPlainObject(stored)) {
    return {
      ...DEFAULT_SETTINGS,
      levels: cloneLevels(DEFAULT_SETTINGS.levels),
      customPresets: [],
    };
  }
  const iconShape = ICON_SHAPES.some((shape) => shape.id === stored.iconShape)
    ? (stored.iconShape as IconShape)
    : DEFAULT_SETTINGS.iconShape;
  const iconSize =
    typeof stored.iconSize === "number" && Number.isFinite(stored.iconSize)
      ? Math.min(2, Math.max(0.5, stored.iconSize))
      : DEFAULT_SETTINGS.iconSize;
  const iconDistance =
    typeof stored.iconDistance === "number" && Number.isFinite(stored.iconDistance)
      ? Math.min(MAX_ICON_DISTANCE, Math.max(0, stored.iconDistance))
      : DEFAULT_SETTINGS.iconDistance;
  // Rooms saved before custom levels existed have `colors` (a fixed
  // Record<RankId,string>) instead of `levels` - migrate them so the DM's
  // existing color customizations survive instead of resetting to defaults.
  const levels =
    sanitizeLevels(stored.levels) ??
    (isPlainObject(stored.colors) ? legacyLevelsFromColors(stored.colors) : cloneLevels(DEFAULT_SETTINGS.levels));
  const activePresetId =
    typeof stored.activePresetId === "string" ? stored.activePresetId : DEFAULT_SETTINGS.activePresetId;
  const activeThemeId = THEMES.some((theme) => theme.id === stored.activeThemeId)
    ? (stored.activeThemeId as string)
    : DEFAULT_SETTINGS.activeThemeId;
  const customPresets = sanitizePresets(stored.customPresets);
  const position = POSITIONS.includes(stored.position as Position)
    ? (stored.position as Position)
    : DEFAULT_SETTINGS.position;
  const scaleWithToken =
    typeof stored.scaleWithToken === "boolean"
      ? stored.scaleWithToken
      : DEFAULT_SETTINGS.scaleWithToken;
  const showDown =
    typeof stored.showDown === "boolean" ? stored.showDown : DEFAULT_SETTINGS.showDown;
  const showRankLabels =
    typeof stored.showRankLabels === "boolean"
      ? stored.showRankLabels
      : DEFAULT_SETTINGS.showRankLabels;
  return {
    iconShape,
    iconSize,
    iconDistance,
    levels,
    activePresetId,
    activeThemeId,
    customPresets,
    position,
    scaleWithToken,
    showDown,
    showRankLabels,
  };
}

export async function getSettings(): Promise<AltitudeSettings> {
  const metadata = await OBR.room.getMetadata();
  return mergeSettings(metadata[SETTINGS_KEY]);
}

export async function setSettings(settings: AltitudeSettings): Promise<void> {
  await OBR.room.setMetadata({ [SETTINGS_KEY]: settings });
}

export function onSettingsChange(
  callback: (settings: AltitudeSettings) => void
): () => void {
  return OBR.room.onMetadataChange((metadata) => {
    callback(mergeSettings(metadata[SETTINGS_KEY]));
  });
}

export function resolveLanguage(metadata: Metadata): Language {
  return metadata[LANGUAGE_KEY] === "es" ? "es" : "en";
}

export async function getLanguage(): Promise<Language> {
  const metadata = await OBR.player.getMetadata();
  return resolveLanguage(metadata);
}

export async function setLanguage(language: Language): Promise<void> {
  await OBR.player.setMetadata({ [LANGUAGE_KEY]: language });
}
