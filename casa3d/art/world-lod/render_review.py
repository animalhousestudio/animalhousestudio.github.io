"""Studio geometry evidence, not a substitute for the production-camera review.

blender --background --factory-startup --python-exit-code 1 --python render_review.py
"""
import json
from pathlib import Path

import bpy
from mathutils import Vector

ART = Path(__file__).resolve().parent
REPO = ART.parents[2]
RENDERS = ART / "renders"
MANIFEST = json.loads((ART / "manifest.json").read_text(encoding="utf8"))


def aim(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def area(name, location, target, size, energy):
    data = bpy.data.lights.new(name, "AREA")
    data.energy = energy
    data.shape = "DISK"
    data.size = size
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = location
    aim(obj, target)


def render_asset(key, asset):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = scene.render.resolution_y = 384
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.view_settings.view_transform = "Standard"
    scene.world = bpy.data.worlds.new("Review studio")
    scene.world.use_nodes = True
    scene.world.node_tree.nodes["Background"].inputs[0].default_value = (.48, .51, .55, 1)
    scene.world.node_tree.nodes["Background"].inputs[1].default_value = .65
    tiers = {"near": asset["source"], **asset["tiers"]}
    objects = {}
    for tier, item in tiers.items():
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=str(REPO / item["path"]), merge_vertices=True)
        objects[tier] = list(set(bpy.data.objects) - before)
        if key == "fountain":
            # Match the game's deliberate stone/chocolate colour overrides.
            palette = {"Travertino": "d9c9a6", "Pietra dei rilievi": "b39b74",
                       "Cioccolato fondente": "582410", "Riflessi cioccolata": "a45b30"}
            for obj in objects[tier]:
                if obj.type != "MESH":
                    continue
                for material in obj.data.materials:
                    for text, color in palette.items():
                        if text in material.name:
                            rgb = [int(color[i:i + 2], 16) / 255 for i in (0, 2, 4)]
                            linear = [c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4 for c in rgb]
                            material.node_tree.nodes.get("Principled BSDF").inputs["Base Color"].default_value = (*linear, 1)

    bounds = asset["source"]["bounds"]
    lo, hi = Vector(bounds["min"]), Vector(bounds["max"])
    center_gltf = (lo + hi) / 2
    target = Vector((center_gltf.x, -center_gltf.z, center_gltf.y))
    span = max(hi - lo)
    camera_data = bpy.data.cameras.new("Identical review camera")
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = span * 1.35
    camera = bpy.data.objects.new("Identical review camera", camera_data)
    scene.collection.objects.link(camera)
    scene.camera = camera
    area("Key", target + Vector((-1, -1.7, 2)) * span, target, span * 1.5, span * span * 150)
    area("Fill", target + Vector((1.5, .6, 1.2)) * span, target, span * 2, span * span * 75)
    for view, direction in {"front": (.75, -1.7, .65), "reverse": (-.9, 1.7, .65)}.items():
        camera.location = target + Vector(direction).normalized() * span * 3
        aim(camera, target)
        for tier in tiers:
            for name, members in objects.items():
                for obj in members:
                    obj.hide_render = name != tier
            scene.render.filepath = str(RENDERS / f"{key}-{view}-{tier}.png")
            bpy.ops.render.render(write_still=True)


RENDERS.mkdir(exist_ok=True)
for key, asset in MANIFEST["assets"].items():
    render_asset(key, asset)
