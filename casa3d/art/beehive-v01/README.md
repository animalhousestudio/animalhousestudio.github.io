# Dreamy beehive

Source: `beehive-dreamy.blend`, copied from the first Blender concept approved for game integration on 2026-10-01. It preserves the timber chalet hive, wax frames, cabinet doors, and matching bee reliefs on both side walls.

`export_game.py` prepares independent evaluated copies, embeds six compact wood textures, groups static geometry into 14 material meshes, and exports `../../src/assets/models/props/beehive-dreamy.glb`. The studio, lights, camera and unrelated original scene are excluded. The original authoring geometry remains editable.

The game loads the prop through `src/rooms/beehive.mjs`. Height is 2.7 metres after the environment scale. Its centre is 4 metres left and 9 metres forward of the landing point; a slight turn exposes both the front and a side bee badge. The base rests on the existing terrain and stays clear of the approach path.

Twelve bees from `src/rooms/beeSwarm.mjs` orbit above and around the hive with wing animation in four instanced draws. They are excluded from collision and static batching. The cabinet and sloping roof use small collision hulls; decorative detail does not inflate the collision world.

No new Blender review renders were produced. Game integration and the local build are the scope of this revision.
