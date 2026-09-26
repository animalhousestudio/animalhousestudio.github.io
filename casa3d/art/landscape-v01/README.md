# Asteroid landscape v01

Game landscape authored in reusable, deterministic modules. House stays on mansion v09 with the requested tree number 5. No house re-export is necessary for these exterior changes.

- `src/rooms/landscapeLayout.mjs`: shared layout, routes and reserved-ground masks. Units are garden-local, multiplied by WORLD_SCALE (5) at runtime.
- Garden: ellipse centred (-23, 3), radii (10.5, 11.5), about 20% larger than the main house footprint. Gate on the southeast border joins the front approach.
- Future pond: central bare-earth ellipse (-24, 3), radii (2.1, 1.55); no water, excavation or gameplay barrier yet.
- Main walk: from landing (0, 43) to first stair (.67, 10.35), width 1.4 game metres. One short branch reaches the garden. Low, irregular, bevelled oval stones share three 112-triangle meshes and one material. Border stones follow the terrain slope and leave a gate opening.
- `roundStoneLandscape.mjs`: all stones instanced, with per-instance muted grey/beige colours. Included in the collision world; reserved pond earth is only a surface marker.
- `fluffyGrass.mjs` / `grassPlacement.mjs`: replaces old blade and alien-grass loads with FluffyGrass cards and mask. Green and violet/turquoise patches share one material. GPU wind preserves roots; reduced motion freezes wind without removing grass.
- 26,000 maximum tufts (9,500 on low-core/mobile devices), spatial cells of 8 units, 32-triangle close tuft and 16-triangle far tuft, distance density down to 8%. No per-frame matrix rebuilds. Ground shading follows the same dense/sparse lawn mask.
- `treePlacement.mjs`: 6 sparse outer trees plus 6 garden trees, sharing the existing three natural tree variants. Leaves remain non-collidable; trunks are solid. Existing house tree remains unchanged.
- Rocks formerly inside the garden are moved to its outer edge. Path, pond, house, field and existing props are protected by shared footprint checks.

## Attribution

Tuft meshes and alpha texture from [FluffyGrass](https://github.com/thebenezer/FluffyGrass), Copyright (c) 2023 Ebenezer, MIT. Original downloaded files and complete license are in `src/assets/fluffy-grass/`. The license is included in the game bundle. Wind and root-to-tip colour approach adapted to this project's standard lighting rather than replacing its renderer/shadow system.

## Validation

`node --test test/landscape.test.mjs test/trees.test.mjs test/naturalRocks.test.mjs test/collision.test.mjs test/arrival.test.mjs`

Build with `./deploy.ps1` from `casa3d` (no push). Local play-testing is left to the user after the final server readiness check.
