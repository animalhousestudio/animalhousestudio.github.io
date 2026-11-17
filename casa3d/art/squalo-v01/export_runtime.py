"""Export only the skinned shark and its in-place swimming action."""

import hashlib
import json
from pathlib import Path
import struct

import bpy


here = Path(__file__).resolve().parent
source = here / "Squalo_Animato.blend"
bpy.ops.wm.open_mainfile(filepath=str(source))
scene = bpy.data.scenes["02 | Ciclo di nuoto sul posto"]
bpy.context.window.scene = scene
for other in list(bpy.data.scenes):
    if other != scene:
        bpy.data.scenes.remove(other)
rig = scene.objects["Squalo | rig"]
mesh = scene.objects["Squalo | mesh"]
# Raise the exposed portion of the dorsal tip so it reads through pond waves.
for vertex in mesh.data.vertices:
    if vertex.co.z > .660001:
        vertex.co.z += .5 * (vertex.co.z - .66)
rig.animation_data.action.name = "Swim"
scene.frame_start = 0
scene.frame_end = 33
scene.frame_set(1)
for obj in scene.objects:
    obj.select_set(obj in (rig, mesh))
bpy.context.view_layer.objects.active = rig

target = here.parents[1] / "src/assets/models/props/squalo.glb"
bpy.ops.export_scene.gltf(
    filepath=str(target), export_format="GLB", use_selection=True,
    export_animation_mode="ACTIONS", export_frame_range=True, export_anim_slide_to_zero=True,
    export_frame_step=1, export_force_sampling=True, export_texcoords=False,
)
payload = target.read_bytes()
length = struct.unpack_from("<I", payload, 12)[0]
gltf = json.loads(payload[20:20 + length])
primitive, = gltf["meshes"][0]["primitives"]
clip, = gltf["animations"]
skin, = gltf["skins"]
assert "COLOR_0" in primitive["attributes"] and len(gltf["materials"]) == 1
assert not gltf.get("textures") and len(gltf["meshes"]) == 1
assert clip["name"] == "Swim" and len(skin["joints"]) == 8, clip["name"]
for sampler in clip["samplers"]:
    times = gltf["accessors"][sampler["input"]]
    assert times["min"] == [0.0] and abs(times["max"][0] - 32 / 24) < 1e-5
manifest = {
    "sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
    "glbSha256": hashlib.sha256(payload).hexdigest(),
    "bytes": len(payload),
    "triangles": gltf["accessors"][primitive["indices"]]["count"] // 3,
    "materials": 1,
    "textures": 0,
    "bones": len(skin["joints"]),
    "clip": clip["name"],
}
(here / "runtime-export.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
