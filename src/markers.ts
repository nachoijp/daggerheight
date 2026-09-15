import OBR, { buildLabel, buildPath, isLabel, isPath } from "@owlbear-rodeo/sdk";
import type { Image, Item, Label, Path } from "@owlbear-rodeo/sdk";
import { getPluginId } from "./pluginId";
import { buildIconStackCommands, directionalLabel, getStrokeWidthRatio, readableTextColor, resolveLevelLabel } from "./altitude";
import type { AltitudeLevel, AltitudeMarkerState, Direction } from "./altitude";
import type { AltitudeSettings } from "./settings";
import type { Language } from "./i18n";
import { isPlainObject } from "./util";

export const METADATA_KEY = getPluginId("metadata");

export type AltitudeMarker = Path | Label;

export function getMarkerState(item: Item): AltitudeMarkerState | undefined {
  const metadata = item.metadata[METADATA_KEY];
  if (
    isPlainObject(metadata) &&
    typeof metadata.levelId === "string" &&
    (metadata.direction === "UP" || metadata.direction === "DOWN")
  ) {
    return {
      levelId: metadata.levelId,
      direction: metadata.direction,
    };
  }
  return undefined;
}

export function isAltitudeMarker(item: Item): item is AltitudeMarker {
  return (isPath(item) || isLabel(item)) && getMarkerState(item) !== undefined;
}

export async function getAltitudeMarkers(): Promise<AltitudeMarker[]> {
  return OBR.scene.items.getItems<AltitudeMarker>(isAltitudeMarker);
}

interface Anchor {
  x: number;
  y: number;
}

function computeAnchor(token: Image, dpi: number, settings: AltitudeSettings): Anchor {
  const dpiScale = dpi / token.grid.dpi;
  const width = token.image.width * dpiScale;
  const height = token.image.height * dpiScale;
  const offsetX = (token.grid.offset.x / token.image.width) * width;
  const offsetY = (token.grid.offset.y / token.image.height) * height;
  const scaledWidth = width * token.scale.x;
  const scaledHeight = height * token.scale.y;

  const topLeft = {
    x: token.position.x - offsetX * token.scale.x,
    y: token.position.y - offsetY * token.scale.y,
  };
  const margin = settings.iconDistance * dpi;
  const anchor = (() => {
    switch (settings.position) {
      case "RIGHT":
        return { x: topLeft.x + scaledWidth + margin, y: topLeft.y + scaledHeight / 2 };
      case "TOP":
        return { x: topLeft.x + scaledWidth / 2, y: topLeft.y - margin };
      case "BOTTOM":
        return { x: topLeft.x + scaledWidth / 2, y: topLeft.y + scaledHeight + margin };
      case "LEFT":
      default:
        return { x: topLeft.x - margin, y: topLeft.y + scaledHeight / 2 };
    }
  })();

  return anchor;
}

function buildIconMarker(
  token: Image,
  level: AltitudeLevel,
  count: number,
  direction: Direction,
  dpi: number,
  anchor: Anchor,
  settings: AltitudeSettings
): Path {
  const commands = buildIconStackCommands(
    settings.iconShape,
    count,
    direction,
    dpi,
    settings.iconSize,
    settings.position
  );

  return buildPath()
    .commands(commands)
    .fillRule("nonzero")
    .fillColor(level.color)
    .fillOpacity(1)
    .strokeColor("#111827")
    .strokeOpacity(0.65)
    .strokeWidth(dpi * getStrokeWidthRatio(settings.iconShape))
    .position(anchor)
    .scale(
      settings.scaleWithToken
        ? { x: token.scale.x, y: token.scale.y }
        : { x: 1, y: 1 }
    )
    .attachedTo(token.id)
    .layer("ATTACHMENT")
    .disableHit(true)
    .locked(true)
    .visible(token.visible)
    .disableAttachmentBehavior(settings.scaleWithToken ? [] : ["SCALE"])
    .name(`Daggerheight: ${level.id} (${direction})`)
    .metadata({
      [METADATA_KEY]: { levelId: level.id, direction } satisfies AltitudeMarkerState,
    })
    .build();
}

/** Build a new altitude marker attached to the given token image */
export function buildAltitudeMarker(
  token: Image,
  level: AltitudeLevel,
  levelIndex: number,
  direction: Direction,
  dpi: number,
  settings: AltitudeSettings,
  language: Language
): AltitudeMarker {
  const anchor = computeAnchor(token, dpi, settings);

  if (level.renderMode === "TEXT") {
    return buildTextLabelMarker(token, level, direction, dpi, anchor, settings, language);
  }
  return buildIconMarker(token, level, levelIndex + 1, direction, dpi, anchor, settings);
}

function buildTextLabelMarker(
  token: Image,
  level: AltitudeLevel,
  direction: Direction,
  dpi: number,
  anchor: Anchor,
  settings: AltitudeSettings,
  language: Language
): Label {
  return buildLabel()
    .plainText(directionalLabel(resolveLevelLabel(level, language), direction))
    .fontSize(dpi * settings.iconSize * 0.18)
    .padding(dpi * 0.05)
    .cornerRadius(dpi * 0.5)
    .pointerWidth(0)
    .pointerHeight(0)
    .fillColor(readableTextColor(level.color))
    .fillOpacity(1)
    .backgroundColor(level.color)
    .backgroundOpacity(1)
    .position(anchor)
    .scale(
      settings.scaleWithToken
        ? { x: token.scale.x, y: token.scale.y }
        : { x: 1, y: 1 }
    )
    .attachedTo(token.id)
    .layer("ATTACHMENT")
    .disableHit(true)
    .locked(true)
    .visible(token.visible)
    .disableAttachmentBehavior(settings.scaleWithToken ? [] : ["SCALE"])
    .name(`Daggerheight: ${level.id} (${direction})`)
    .metadata({
      [METADATA_KEY]: { levelId: level.id, direction } satisfies AltitudeMarkerState,
    })
    .build();
}

/**
 * Rebuild every altitude marker currently in the scene using new settings.
 * `language` is only used to re-bake TEXT-mode markers' displayed text (a
 * placed scene item can't translate itself per-viewer, so it's fixed at
 * whatever language whoever triggered this refresh currently has).
 */
export async function refreshAllMarkers(settings: AltitudeSettings, language: Language): Promise<void> {
  const markers = await getAltitudeMarkers();
  if (markers.length === 0) {
    return;
  }

  const tokenIds = Array.from(
    new Set(
      markers
        .map((marker) => marker.attachedTo)
        .filter((id): id is string => Boolean(id))
    )
  );
  const [tokens, dpi] = await Promise.all([
    OBR.scene.items.getItems<Image>(tokenIds),
    OBR.scene.grid.getDpi(),
  ]);
  const tokenById = new Map(tokens.map((token) => [token.id, token]));

  const toDelete: string[] = [];
  const toAdd: AltitudeMarker[] = [];
  for (const marker of markers) {
    const state = getMarkerState(marker);
    const token = marker.attachedTo ? tokenById.get(marker.attachedTo) : undefined;
    const levelIndex = state ? settings.levels.findIndex((l) => l.id === state.levelId) : -1;
    const level = levelIndex >= 0 ? settings.levels[levelIndex] : undefined;
    // A level the DM has since deleted from settings.levels: leave the
    // marker exactly as it is rather than deleting it out from under
    // whoever placed it.
    if (!state || !token || !level) {
      continue;
    }
    toDelete.push(marker.id);
    toAdd.push(buildAltitudeMarker(token, level, levelIndex, state.direction, dpi, settings, language));
  }

  if (toDelete.length > 0) {
    await OBR.scene.items.deleteItems(toDelete);
  }
  if (toAdd.length > 0) {
    await OBR.scene.items.addItems(toAdd);
  }
}
