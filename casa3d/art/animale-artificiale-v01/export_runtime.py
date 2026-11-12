"""Export the approved Blender body and bake its screen in metres."""
import hashlib
import json
import struct
from pathlib import Path

import bpy

art = Path(__file__).resolve().parent
casa = art.parent.parent
model = casa / "src/assets/models/props/music-monolith.glb"
texture = casa / "src/assets/models/props/music-monolith-screen.jpg"
scene = bpy.context.scene
body = scene.objects["Monolite nero"]
bezel = scene.objects["Cornice a filo"]

for obj in scene.objects:
    obj.select_set(obj in (body, bezel))
bpy.context.view_layer.objects.active = body
bpy.ops.export_scene.gltf(filepath=str(model), export_format="GLB", use_selection=True,
                          use_active_scene=True, export_apply=True)

# The front camera fills the raster with the physical .93 × 1.46 m screen.
# Leave every Blender object and material intact in the source .blend.
screen = bpy.data.collections["Player"]
runtime_controls = {"Pulsante Play", "Triangolo Play", "Tempo", "Barra di avanzamento",
                    "Inizio barra", "Linea player", "Fondo prima traccia"}
for obj in scene.objects:
    obj.hide_render = (obj not in screen.objects.values() or obj.name in runtime_controls
                       or obj.name.startswith("Menu "))
for name in ("Traccia 03.101", "Glifi 03.101"):
    scene.objects[name].data.materials[0] = bpy.data.materials["Testo bianco"]
scene.objects["Indice 01"].data.materials[0] = bpy.data.materials["Testo secondario"]
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
bpy.ops.render.render(write_still=True)

def record(path):
    data = path.read_bytes()
    return {"path": path.relative_to(casa).as_posix(), "bytes": len(data),
            "sha256": hashlib.sha256(data).hexdigest()}

raw = model.read_bytes()
length = struct.unpack_from("<I", raw, 12)[0]
gltf = json.loads(raw[20:20+length])
assert len(gltf["meshes"]) == 2 and len(gltf["scenes"]) == 1
triangles = sum(gltf["accessors"][p["indices"]]["count"] // 3
                for m in gltf["meshes"] for p in m["primitives"])
manifest = {
    "source": record(art / "Animale_Artificiale.blend"),
    "model": {**record(model), "triangles": triangles},
    "screen": {**record(texture), "width": 744, "height": 1168},
}
(art / "runtime-export.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

