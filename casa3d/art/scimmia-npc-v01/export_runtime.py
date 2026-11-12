"""Export only the approved character and the in-place game actions."""

import hashlib
import json
import struct
import sys
from pathlib import Path

import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from scimmia_motion import Pose, apply_pose, at_keys, launch_pose, walk


def in_place(pose):
    pose.hands = tuple(point - pose.base for point in pose.hands)
    pose.feet = tuple(point - pose.base for point in pose.feet)
    pose.base = Vector()
    return pose


def grip():
    # 32 cm square post, seen diagonally from its corner, centre 62 cm ahead.
    return Pose(Vector(), .43, .035, -.36, -.075,
                (Vector((.094, -.330, .99)), Vector((-.090, -.324, .82))),
                (Vector((.106, -.291, .30)), Vector((-.100, -.284, .16))),
                Vector((0, -.64, -.77)), .32)


def main():
    source = HERE / "Scimmia_NPC_v02.blend"
    bpy.ops.wm.open_mainfile(filepath=str(source))
    scene = bpy.context.scene
    rig = bpy.data.objects["Scimmia | rig"]
    mesh = bpy.data.objects["Scimmia | corpo e volto"]
    rig.animation_data_clear()
    for action in list(bpy.data.actions):
        bpy.data.actions.remove(action)
    data = rig.animation_data_create()
    ready = grip()
    loaded = grip()
    loaded.hips_z -= .11
    loaded.lean -= .055
    loaded.head_pitch -= .07
    loaded.tail_lift = .18
    takeoff = launch_pose(Vector(), .04)
    tucked = launch_pose(Vector(), .48)
    reach = launch_pose(Vector(), .83)
    reach.head_pitch = -.36
    walk_end = in_place(walk(1))
    mount = [(0, walk_end), (.18, walk_end.mix(loaded,.32)),
             (.37, takeoff), (.62, tucked), (.82, reach), (1, ready)]
    leap = [(0, ready), (.16, loaded), (.32, takeoff), (.53, tucked), (.79, reach), (1, ready)]
    animations = [
        ("Walk", 24, lambda t: in_place(walk(t/2))),
        ("Mount", 24, lambda t: at_keys(mount,t)),
        ("Leap", 24, lambda t: at_keys(leap,t)),
        ("Grip", 2, lambda t: ready),
    ]
    for name, duration, pose in animations:
        previous = {}
        for frame in range(0,duration+1,2):
            apply_pose(rig,pose(frame/duration),frame+1,previous)
        action = data.action
        action.name = name
        for curve in action.layers[0].strips[0].channelbag(data.action_slot).fcurves:
            for key in curve.keyframe_points:
                key.interpolation = "LINEAR"
        slot = data.action_slot
        data.action = None
        track = data.nla_tracks.new()
        track.name = name
        strip = track.strips.new(name, 1, action)
        strip.action_slot = slot
    bpy.ops.object.select_all(action="DESELECT")
    rig.select_set(True)
    mesh.select_set(True)
    bpy.context.view_layer.objects.active = rig
    scene.frame_set(1)
    target = HERE.parents[1] / "src/assets/models/props/scimmia-npc.glb"
    bpy.ops.export_scene.gltf(
        filepath=str(target), export_format="GLB", use_selection=True,
        export_animation_mode="NLA_TRACKS", export_nla_strips=True,
        export_frame_range=False, export_frame_step=2, export_force_sampling=True,
        export_optimize_animation_size=True, export_texcoords=False,
    )
    payload = target.read_bytes()
    length = struct.unpack_from("<I",payload,12)[0]
    gltf = json.loads(payload[20:20+length])
    assert len(gltf["meshes"]) == len(gltf["skins"]) == len(gltf["materials"]) == 1
    primitive, = gltf["meshes"][0]["primitives"]
    assert "COLOR_0" in primitive["attributes"]
    clips = {item["name"] for item in gltf["animations"]}
    assert clips == {"Walk","Mount","Leap","Grip"}, clips
    triangles = gltf["accessors"][primitive["indices"]]["count"] // 3
    manifest = {
        "sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
        "glbSha256": hashlib.sha256(payload).hexdigest(), "bytes": len(payload),
        "triangles": triangles, "primitives": 1, "materials": 1, "textures": 0,
        "bones": len(gltf["skins"][0]["joints"]), "clips": sorted(clips),
        "grip": {"squareWidthM": .32, "rootToPostAxisM": .62},
    }
    (HERE/"runtime-export.json").write_text(json.dumps(manifest,indent=2)+"\n",encoding="utf-8")
    print(manifest)


if __name__ == "__main__":
    main()
