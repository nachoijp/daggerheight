import OBR, { buildPath, isPath } from "@owlbear-rodeo/sdk";
import type { Image, Item, Path } from "@owlbear-rodeo/sdk";
import { getPluginId } from "./pluginId";
import { RANKS, buildTriangleStackCommands } from "./altitude";
import type { AltitudeMarkerState, AltitudeRank, Direction } from "./altitude";
import type { AltitudeSettings } from "./settings";
import { isPlainObject } from "./util";

export const METADATA_KEY = getPluginId("metadata");

/** How far, in grid cells, the marker sits from the token's edge */
const MARGIN_RATIO = 0.12;

export function getMarkerState(item: Item): AltitudeMarkerState | undefined {
  const metadata = item.metadata[METADATA_KEY];
  if (
    isPlainObject(metadata) &&
    typeof metadata.rank === "string" &&
    (metadata.direction === "UP" || metadata.direction === "DOWN")
  ) {
    return {
      rank: metadata.rank as AltitudeMarkerState["rank"],
      direction: metadata.direction,
    };
  }
  return undefined;
}

export function isAltitudeMarker(item: Item): item is Path {
  return isPath(item) && getMarkerState(item) !== undefined;
}

export async function getAltitudeMarkers(): Promise<Path[]> {
  return OBR.scene.items.getItems<Path>(isAltitudeMarker);
}

/** Build a new altitude marker attached to the given token image */
export function buildAltitudeMarker(
  token: Image,
  rank: AltitudeRank,
  direction: Direction,
  dpi: number,
  settings: AltitudeSettings
): Path {
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
  const margin = MARGIN_RATIO * dpi;
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

  const commands = buildTriangleStackCommands(
    rank.count,
    direction,
    dpi,
    settings.iconSize,
    settings.position
  );
  const color = settings.colors[rank.id];

  return buildPath()
    .commands(commands)
    .fillRule("nonzero")
    .fillColor(color)
    .fillOpacity(1)
    .strokeColor("#111827")
    .strokeOpacity(0.65)
    .strokeWidth(dpi * 0.035)
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
    .name(`Daggerheart Altitude: ${rank.id} (${direction})`)
    .metadata({
      [METADATA_KEY]: { rank: rank.id, direction } satisfies AltitudeMarkerState,
    })
    .build();
}

/** Rebuild every altitude marker currently in the scene using new settings */
export async function refreshAllMarkers(settings: AltitudeSettings): Promise<void> {
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
  const toAdd: Path[] = [];
  for (const marker of markers) {
    const state = getMarkerState(marker);
    const token = marker.attachedTo ? tokenById.get(marker.attachedTo) : undefined;
    const rank = state && RANKS.find((r) => r.id === state.rank);
    if (!state || !token || !rank) {
      continue;
    }
    toDelete.push(marker.id);
    toAdd.push(buildAltitudeMarker(token, rank, state.direction, dpi, settings));
  }

  if (toDelete.length > 0) {
    await OBR.scene.items.deleteItems(toDelete);
  }
  if (toAdd.length > 0) {
    await OBR.scene.items.addItems(toAdd);
  }
}
