"""Bake the new album artwork from the authored monolith and the 34:51 cover."""
import hashlib
import json
import sys
from pathlib import Path

import bpy

data, = sys.argv[sys.argv.index("--") + 1:]
album = json.loads(Path(data).read_text(encoding="utf-8"))
art = Path(__file__).resolve().parent
casa = art.parent.parent
cover = art / "cover-01.jpg"
texture = casa / "src/assets/models/props/music-monolith-screen-01.jpg"
scene = bpy.context.scene

screen = bpy.data.collections["Player"]
runtime_controls = {"Pulsante Play", "Triangolo Play", "Tempo", "Barra di avanzamento",
                    "Inizio barra", "Linea player", "Fondo prima traccia"}
for obj in scene.objects:
    obj.hide_render = (obj not in screen.objects.values() or obj.name in runtime_controls
                       or obj.name.startswith("Menu "))
scene.objects["Titolo album"].data.body = album["title"]
for index in range(1, 14):
    old_code = f"03.{100 + index}"
    label = scene.objects[f"Traccia {old_code}"]
    glyphs = scene.objects[f"Glifi {old_code}"]
    number = scene.objects[f"Indice {index:02}"]
    if index > len(album["tracks"]):
        for obj in (label, glyphs, number):
            obj.hide_render = True
        continue
    track = album["tracks"][index - 1]
    label.data.body = track["code"]
    glyphs.data.body = track["title"]
    label.data.materials[0] = glyphs.data.materials[0] = bpy.data.materials["Testo bianco"]
    number.data.materials[0] = bpy.data.materials["Testo secondario"]
cover_obj = scene.objects["Copertina | video massimo lago"]
next(node for node in cover_obj.active_material.node_tree.nodes if node.type == "TEX_IMAGE").image = \
    bpy.data.images.load(str(cover))
camera = scene.objects["02 | Player"]
camera.hide_render = False
camera.data.ortho_scale = 1.46
scene.camera = camera
scene.cycles.samples = 8
scene.render.resolution_x = 744
scene.render.resolution_y = 1168
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "JPEG"
scene.render.image_settings.quality = 94
scene.render.filepath = str(texture)
bpy.ops.render.render(write_still=True, scene=scene.name)

def record(path):
    return {"path": path.relative_to(casa).as_posix(), "bytes": path.stat().st_size,
            "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}

manifest = {"album": album["id"],
            "cover_source": {"movie": "video massimo lago.MP4", "timestamp": "00:34:51",
                             "kind": "screenshot crop", "crop_xywh": [71, 0, 329, 329]},
            "cover": record(cover), "screen": record(texture),
            "tracks": [record(casa / "audio" / album["id"] / track["file"])
                       for track in album["tracks"]]}
(art / "album-01-export.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
