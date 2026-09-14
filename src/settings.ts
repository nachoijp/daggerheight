import OBR from "@owlbear-rodeo/sdk";
import { getPluginId } from "./pluginId";
import { isPlainObject } from "./util";
import type { Metadata } from "@owlbear-rodeo/sdk";
import type { Language } from "./i18n";
import type { IconShape, Position, RankId } from "./altitude";
import { DEFAULT_COLORS, ICON_SHAPES, POSITIONS } from "./altitude";

export interface AltitudeSettings {
  iconShape: IconShape;
  iconSize: number;
  iconDistance: number;
  colors: Record<RankId, string>;
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
  colors: { ...DEFAULT_COLORS },
  position: "LEFT",
  scaleWithToken: true,
  showDown: true,
  showRankLabels: true,
};

const SETTINGS_KEY = getPluginId("settings");
const LANGUAGE_KEY = getPluginId("language");

function mergeSettings(stored: unknown): AltitudeSettings {
  if (!isPlainObject(stored)) {
    return {
      iconShape: DEFAULT_SETTINGS.iconShape,
      iconSize: DEFAULT_SETTINGS.iconSize,
      iconDistance: DEFAULT_SETTINGS.iconDistance,
      colors: { ...DEFAULT_SETTINGS.colors },
      position: DEFAULT_SETTINGS.position,
      scaleWithToken: DEFAULT_SETTINGS.scaleWithToken,
      showDown: DEFAULT_SETTINGS.showDown,
      showRankLabels: DEFAULT_SETTINGS.showRankLabels,
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
  const colors = {
    ...DEFAULT_SETTINGS.colors,
    ...(isPlainObject(stored.colors) ? stored.colors : {}),
  } as Record<RankId, string>;
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
    colors,
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
