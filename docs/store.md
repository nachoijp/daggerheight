---
title: Daggerheight
description: Mark customizable distance/range bands — icons or numbers — directly on any token
author: Ignacio Pedraza
image: https://raw.githubusercontent.com/nachoijp/daggerheight/main/docs/header.png
icon: https://raw.githubusercontent.com/nachoijp/daggerheight/main/public/logo.svg
tags:
  - tool
  - combat
manifest: https://daggerheight.ijpedraza.com/manifest.json
learn-more: https://github.com/nachoijp/daggerheight#readme
---

# Daggerheight

A distance/altitude marker built for the **Daggerheart** tabletop RPG's range
bands, but fully customizable for any system. Adds an item to any token's
context menu to mark a distance and direction, shown as colored icons or a
numeric label right on the token.

![Range picker](https://raw.githubusercontent.com/nachoijp/daggerheight/main/docs/header.png)

## How to use

1. Select a token (character, mount, or prop) and open its context menu.
2. Click **Altitude**.
3. Pick a distance and a direction (Up or Down). Clicking the same marker
   again removes it.

![Markers on several tokens](https://raw.githubusercontent.com/nachoijp/daggerheight/main/docs/screenshot-ranges.png)

Each token can have its own marker, and markers move together with their
token (scaling with it too, unless you turn that off in settings).

## Distance levels

The **✏️** button opens the level editor (shared by the room, set by the GM):
start from the Daggerheart preset (Very Close/Close/Far/Very Far) or the
Dragons preset (5/15/30/60/120 ft), or build your own — add, remove, reorder,
and rename levels, and render each one as stacked icons or a numeric label.
A one-click color theme (including colorblind-friendly palettes matching the
[Ranges](https://extensions.owlbear.rodeo/ranges) extension) recolors every
level by position; individual colors can still be fine-tuned afterward. Save
as many custom presets as you like and switch between them anytime.

![Level editor](https://raw.githubusercontent.com/nachoijp/daggerheight/main/docs/screenshot-levels.png)
![Numeric distances on the panel](https://raw.githubusercontent.com/nachoijp/daggerheight/main/docs/screenshot-distances-text.png)

## Icon shapes

For icon-mode levels: triangles that point up or down, or shapes that
grow/shrink in size to show direction instead — bars, circles, diamonds,
squares, stars, a stepped triangle, or a themed feather/shovel pair.

![Bar-shaped markers](https://raw.githubusercontent.com/nachoijp/daggerheight/main/docs/screenshot-shapes-bars.png)
![Feather and shovel markers](https://raw.githubusercontent.com/nachoijp/daggerheight/main/docs/screenshot-shapes-feather.png)

## Settings

The **⚙** button opens a separate settings panel (shared by the room, set by
the GM) for icon size and spacing from the token, where markers sit relative
to the token, whether they scale with it, whether the "Down" direction and
column labels are shown, and the interface language. Changes in either panel
preview live as you make them.

![Settings panel](https://raw.githubusercontent.com/nachoijp/daggerheight/main/docs/screenshot-settings.png)

The interface is available in English and Spanish (per-player preference).

## Support

If you run into a bug or have a feature request, please open an issue at
<https://github.com/nachoijp/daggerheight/issues>.
