import OBR from "@owlbear-rodeo/sdk";
import type { Layer } from "@owlbear-rodeo/sdk";
import { getPluginId } from "./pluginId";
import { getLanguage, resolveLanguage } from "./settings";
import { t } from "./i18n";
import type { Language } from "./i18n";

const icon = "/icon.svg";

const ALL_LAYERS: Layer[] = [
  "MAP",
  "GRID",
  "DRAWING",
  "PROP",
  "MOUNT",
  "CHARACTER",
  "ATTACHMENT",
  "NOTE",
  "TEXT",
  "RULER",
  "FOG",
  "POINTER",
  "POST_PROCESS",
  "CONTROL",
  "POPOVER",
];
const ALLOWED_LAYERS: Layer[] = ["CHARACTER", "MOUNT", "PROP"];
const DISALLOWED_LAYERS = ALL_LAYERS.filter(
  (layer) => !ALLOWED_LAYERS.includes(layer)
);

/**
 * Runs when the extension loads. Registers the context menu entry that
 * opens the altitude marker picker for the selected token(s).
 *
 * A single "layer == X" check would require every selected item to share
 * the exact same layer, so a mixed Character+Prop selection would never
 * match. Instead we check "layer != <every disallowed layer>", which each
 * selected item can satisfy independently regardless of which allowed
 * layer it's actually on.
 */
let registeredLanguage: Language | null = null;

function registerMenu(language: Language) {
  if (language === registeredLanguage) {
    return;
  }
  registeredLanguage = language;

  OBR.contextMenu.create({
    id: getPluginId("menu"),
    icons: [
      {
        icon,
        label: t(language, "menuLabel"),
        filter: {
          every: [
            { key: "type", value: "IMAGE" },
            ...DISALLOWED_LAYERS.map((layer) => ({
              key: "layer",
              value: layer,
              operator: "!=" as const,
            })),
          ],
          permissions: ["UPDATE"],
        },
      },
    ],
    embed: {
      url: "/",
      height: 210,
    },
  });
}

OBR.onReady(async () => {
  registerMenu(await getLanguage());
  // Re-register with an updated label if the player changes language
  // without reloading the room.
  OBR.player.onChange((player) => {
    registerMenu(resolveLanguage(player.metadata));
  });
});
