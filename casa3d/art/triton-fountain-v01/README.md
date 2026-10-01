# Triton chocolate fountain

The editable Blender source is `triton-chocolate-fountain.blend`, copied from the first visible fountain concept. `export_game.py` prepares a separate game version at `../../src/assets/models/props/triton-chocolate-fountain.glb`; the studio floor, camera and lights stay out of the export. Geometry is reduced for the game without changing the Blender source.

`src/rooms/chocolateFountain.mjs` places the fountain to the right of the arrival path, 27.5 metres forward from the landing point and closer to the house than the beehive. The basin has a simple collision hull so players can walk around it.

The stone sculpture and chocolate streams come from Blender. At runtime, a subtle travelling highlight moves across the chocolate material, drops descend from four shell outlets, and concentric ripples expand in the basin. This is a lightweight loop rather than a simulated fluid volume.
