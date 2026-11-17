"""Rig the Casa3D shark and build a separate Blender swim preview."""

import hashlib
import json
import math
from pathlib import Path
import sys

import bpy
from mathutils import Vector


PACKAGE = Path(__file__).resolve().parent
WATERLINE = 0.70
FPS = 24
CYCLE = 32
DURATION = 288
SURFACE_FIRST, SURFACE_LAST = 97, 205
SPINE = (
    ("Torso", -0.36, 0.13),
    ("Dorso", 0.13, 0.51),
    ("Retro", 0.51, 0.85),
    ("Peduncolo", 0.85, 1.22),
    ("Caudale", 1.22, 1.89),
)


def smoothstep(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def blend(a, b, t):
    return a + (b - a) * t


def add_bone(edit_bones, name, head, tail, parent=None):
    bone = edit_bones.new(name)
    bone.head, bone.tail = head, tail
    bone.parent = parent
    bone.align_roll(Vector((0, 0, 1)))
    return bone


def make_rig(shark, collection):
    rig = bpy.data.objects.new("Squalo | rig", bpy.data.armatures.new("Squalo | scheletro"))
    collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    shark.select_set(False)
    bpy.ops.object.mode_set(mode='EDIT')
    parent = None
    for name, start, end in SPINE:
        parent = add_bone(rig.data.edit_bones, name, (0, start, 0), (0, end, 0), parent)
    torso = rig.data.edit_bones["Torso"]
    add_bone(rig.data.edit_bones, "Testa", (0, -0.36, 0), (0, -1.18, 0), torso)
    for side in (-1, 1):
        add_bone(rig.data.edit_bones, f"Pinna {side}", (side * 0.22, -0.22, -0.18),
                 (side * 0.90, 0.30, -0.41), torso)
    bpy.ops.object.mode_set(mode='OBJECT')

    # Authoring groups identify the original surface parts. Deformation groups
    # are separate, including where a fin name also identifies a joint.
    parts = {group.index: group.name for group in shark.vertex_groups}
    membership = {v.index: parts[v.groups[0].group] for v in shark.data.vertices}
    for group in shark.vertex_groups:
        group.name = "Superficie | " + group.name
    groups = {bone.name: shark.vertex_groups.new(name=bone.name) for bone in rig.data.bones}
    samples = [(-0.77, "Testa"), (-0.23, "Torso"), (0.27, "Dorso"),
               (0.66, "Retro"), (1.03, "Peduncolo"), (1.48, "Caudale")]
    for vertex in shark.data.vertices:
        x, y, _ = vertex.co
        part = membership[vertex.index]
        if part == "Dorsale":
            # The whole main fin follows the chest while the rear body bends.
            y = 0.02
        elif part == "Caudale":
            # Each lobe follows the caudal joint, including the swept tips.
            y = 1.48
        if part.startswith("Pettorale "):
            weight = smoothstep((abs(x) - 0.24) / 0.43)
            weights = [("Torso", 1 - weight), ("Pinna " + part.split()[-1], weight)]
        else:
            y = max(samples[0][0], min(samples[-1][0], y))
            for (start, a), (end, b) in zip(samples, samples[1:]):
                if y <= end:
                    weight = smoothstep((y - start) / (end - start))
                    weights = [(a, 1 - weight), (b, weight)]
                    break
        for bone, weight in weights:
            if weight > 0:
                groups[bone].add([vertex.index], weight, 'REPLACE')

    shark.parent = rig
    modifier = shark.modifiers.new("Nuoto | armatura", 'ARMATURE')
    modifier.object = rig
    return rig, membership


def make_swim_action(rig):
    animation = rig.animation_data_create()
    action = bpy.data.actions.new("Squalo | nuoto continuo")
    action.use_fake_user = True
    animation.action = action
    # Local yaw propagates aft. The slight counter-yaw on the head keeps the
    # snout steady while the caudal fin provides most of the propulsion.
    wave = {
        "Testa": (-1.6, 0.35), "Dorso": (2.9, 0.00), "Retro": (5.3, 0.58),
        "Peduncolo": (9.5, 1.15), "Caudale": (16.0, 1.78),
    }
    for step in range(CYCLE + 1):
        phase = math.tau * (step % CYCLE) / CYCLE
        for name, (amplitude, lag) in wave.items():
            bone = rig.pose.bones[name]
            bone.rotation_mode = 'XYZ'
            bone.rotation_euler.z = math.radians(amplitude) * math.sin(phase - lag)
            bone.keyframe_insert("rotation_euler", index=2, frame=step + 1, group=name)
        for side in (-1, 1):
            bone = rig.pose.bones[f"Pinna {side}"]
            bone.rotation_mode = 'XYZ'
            bone.rotation_euler.y = math.radians(3) * side * math.sin(phase - side * 0.7)
            bone.keyframe_insert("rotation_euler", index=1, frame=step + 1, group=bone.name)
    channelbag = action.layers[0].strips[0].channelbag(animation.action_slot)
    for curve in channelbag.fcurves:
        for key in curve.keyframe_points:
            key.interpolation = 'LINEAR'
        curve.modifiers.new('CYCLES')
    return action


def aim(obj, target):
    orientation = (Vector(target) - obj.location).to_track_quat('-Z', 'Y')
    obj.rotation_euler = orientation.to_euler('XYZ', obj.rotation_euler)


def configure_water(water):
    water.hide_set(False)
    water.hide_render = False
    material = water.data.materials[0]
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    output = nodes.get("Material Output")
    backface = nodes.new("ShaderNodeNewGeometry").outputs["Backfacing"]
    mix = nodes.new("ShaderNodeMixShader")
    links.new(backface, mix.inputs[0])
    links.new(nodes.get("Principled BSDF").outputs[0], mix.inputs[1])
    links.new(nodes.new("ShaderNodeBsdfTransparent").outputs[0], mix.inputs[2])
    links.new(mix.outputs[0], output.inputs["Surface"])
    colors = water.data.color_attributes.new(name="Colore acqua", type='FLOAT_COLOR', domain='POINT')
    for color in colors.data:
        color.color = (0.045, 0.20, 0.24, 1)


def move_preview(scene, root, underwater, surface, lights):
    for frame in range(1, DURATION + 2):
        t = (frame - 1) / FPS
        phase = math.tau * t / (DURATION / FPS)
        shoal = smoothstep((frame - 65) / 32) * smoothstep((237 - frame) / 32)
        position = Vector((5.5 * math.cos(phase), 4.2 * math.sin(phase),
                           blend(-1.19, -0.08, shoal) + 0.015 * math.sin(2 * phase)))
        forward = Vector((-5.5 * math.sin(phase), 4.2 * math.cos(phase), 0)).normalized()
        right = Vector((-forward.y, forward.x, 0))
        root.location = position
        root.rotation_euler = (
            math.radians(1.4) * math.sin(4 * phase) * (1 - shoal),
            math.radians(7.5) - math.radians(3.3) * shoal + math.radians(1.5) * math.sin(phase),
            math.atan2(forward.x, -forward.y),
        )
        root.keyframe_insert("location", frame=frame)
        root.keyframe_insert("rotation_euler", frame=frame)

        underwater.location = position + right * 4.9 + forward * 2.15
        underwater.location.z = min(WATERLINE - 0.09, position.z + 0.58)
        aim(underwater, position + Vector((0, 0, 0.11)) - forward * 0.23)
        surface.location = position + right * 3.8 + forward * 1.30
        surface.location.z = 1.64
        aim(surface, position - 0.18 * forward + Vector((0, 0, WATERLINE + 0.055 - position.z)))
        for light, (across, ahead, height) in zip(lights, ((0, 1, 3.2), (4, 3, 1.3), (-3, -4, 1.5))):
            light.location = position + right * across + forward * ahead + Vector((0, 0, height))
            aim(light, position)
        for obj in (underwater, surface, *lights):
            obj.keyframe_insert("location", frame=frame)
            obj.keyframe_insert("rotation_euler", frame=frame)

    for frame, label, camera in (
        (1, "Nuoto sott'acqua", underwater),
        (82, "Dorsale in superficie", surface),
        (223, "Ritorno in profondita", underwater),
    ):
        marker = scene.timeline_markers.new(label, frame=frame)
        marker.camera = camera


def build_preview(scene, shark, rig):
    studio = bpy.data.collections["Studio | anteprima"]
    preview = bpy.data.collections.new("Squalo | dimostrazione")
    scene.collection.children.link(preview)
    root = bpy.data.objects.new("Percorso | dimostrazione", None)
    preview.objects.link(root)
    preview_rig = rig.copy()
    preview_rig.name = "Squalo | rig dimostrazione"
    preview.objects.link(preview_rig)
    preview_rig.parent = root
    preview_shark = shark.copy()
    preview_shark.name = "Squalo | mesh dimostrazione"
    preview.objects.link(preview_shark)
    preview_shark.parent = preview_rig
    preview_shark.modifiers[0].object = preview_rig
    scene.collection.children.unlink(bpy.data.collections["Squalo | asset"])
    scene.name = "01 | Dimostrazione nuoto"
    scene.frame_start, scene.frame_end = 1, DURATION
    scene.render.fps = FPS
    underwater = scene.camera
    underwater.name = "Camera | sott'acqua"
    surface = bpy.data.objects["Camera | pinna in superficie"]
    configure_water(bpy.data.objects["Piano acqua | studio"])
    lights = [bpy.data.objects[f"Luce | {name}"] for name in ("superficie", "muso", "controluce")]
    move_preview(scene, root, underwater, surface, lights)
    scene.cycles.samples = 24
    scene.frame_set(1)
    bpy.context.view_layer.objects.active = preview_shark
    preview_shark.select_set(True)
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == 'VIEW_3D':
                space = area.spaces.active
                space.overlay.show_overlays = False
                space.shading.color_type = 'VERTEX'
                space.shading.show_backface_culling = True
                space.region_3d.view_perspective = 'CAMERA'
                space.region_3d.view_camera_zoom = 5
    return preview_shark


def check_preview(scene, shark, membership):
    surface_clearance = math.inf
    fin_height = [math.inf, -math.inf]
    deepest_clearance = math.inf
    tail_tip = max(shark.data.vertices, key=lambda vertex: vertex.co.y).index
    tail_positions = []
    hidden_frames = {1, 82, 222, DURATION}
    for sample in range(0, DURATION * 2):
        scene.frame_set(1 + sample // 2, subframe=(sample % 2) / 2)
        obj = shark.evaluated_get(bpy.context.evaluated_depsgraph_get())
        if sample <= CYCLE * 2:
            tail_positions.append(obj.data.vertices[tail_tip].co.copy())
        matrix = obj.matrix_world
        height_x, height_y, height_z, offset_z = matrix[2]
        dorsal = other = -math.inf
        for vertex in obj.data.vertices:
            x, y, z = vertex.co
            z = height_x * x + height_y * y + height_z * z + offset_z
            if membership[vertex.index] == "Dorsale":
                dorsal = max(dorsal, z)
            else:
                other = max(other, z)
        deepest_clearance = min(deepest_clearance, WATERLINE - other)
        if scene.frame_current in hidden_frames:
            assert dorsal < WATERLINE, (scene.frame_current, dorsal)
        if SURFACE_FIRST <= scene.frame_current <= SURFACE_LAST:
            surface_clearance = min(surface_clearance, WATERLINE - other)
            fin_height[0] = min(fin_height[0], dorsal - WATERLINE)
            fin_height[1] = max(fin_height[1], dorsal - WATERLINE)
    assert deepest_clearance >= 0.04, deepest_clearance
    assert fin_height[0] >= 0.15, fin_height
    assert (tail_positions[0] - tail_positions[-1]).length < 1e-6
    tail_excursion = max(p.x for p in tail_positions) - min(p.x for p in tail_positions)
    assert tail_excursion > 0.4
    scene.frame_set(1)
    return {
        "samples": DURATION * 2,
        "min_submersion_other_parts_m": round(deepest_clearance, 4),
        "min_submersion_other_parts_during_surface_view_m": round(surface_clearance, 4),
        "dorsal_above_water_during_surface_view_m": [round(x, 4) for x in fin_height],
        "tail_tip_side_to_side_m": round(tail_excursion, 4),
    }


def main():
    bpy.ops.wm.open_mainfile(filepath=str(PACKAGE / "Squalo.blend"))
    scene = bpy.context.scene
    asset = bpy.data.collections["Squalo | asset"]
    shark = bpy.data.objects["Squalo | mesh"]
    rig, membership = make_rig(shark, asset)
    action = make_swim_action(rig)
    cycle_scene = bpy.data.scenes.new("02 | Ciclo di nuoto sul posto")
    cycle_scene.collection.children.link(asset)
    cycle_scene.unit_settings.system = 'METRIC'
    cycle_scene.render.fps = FPS
    cycle_scene.frame_start, cycle_scene.frame_end = 1, CYCLE
    cycle_scene.view_layers[0].objects.active = shark
    preview_shark = build_preview(scene, shark, rig)
    report = check_preview(scene, preview_shark, membership)

    assert rig.location.length == 0 and not rig.parent
    path = PACKAGE / "Squalo_Animato.blend"
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(path), compress=True)
    report.update({
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "base_sha256": hashlib.sha256((PACKAGE / "Squalo.blend").read_bytes()).hexdigest(),
        "animation": action.name,
        "fps": FPS,
        "cycle_frames": CYCLE,
        "preview_frames": DURATION,
        "bones": len(rig.data.bones),
        "cycle_closure": True,
    })
    (PACKAGE / "animation-verification.json").write_text(
        json.dumps(report, indent=2) + "\n", encoding="utf-8")
    if "--stills" in sys.argv:
        scene.render.resolution_percentage = 80
        for frame, name in ((18, "nuoto"), (147, "emersione"), (236, "discesa")):
            scene.frame_set(frame)
            scene.render.filepath = str(PACKAGE / f"{name}.png")
            bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    main()
