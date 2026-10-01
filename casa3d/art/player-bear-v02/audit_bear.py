"""Inspect the saved bear and exercise its rig in memory; never save the blend.

Run: blender -b player-bear-v02.blend -P audit_bear.py
Only audit.json is written. These small pose checks are deformation sanity,
not a visual review or validation of final locomotion.
"""
import json
import math
from pathlib import Path

import bpy
from mathutils import Matrix

OUT = Path(__file__).resolve().parent
SCENE = bpy.context.scene
REPORT = {
    "schema": "animal-house.bear-source-audit.v1",
    "source": bpy.data.filepath,
    "scope": "Saved Blender source; in-memory deformation only; no export or runtime",
    "blend_saved_by_audit": False,
    "checks": [],
    "pose_checks": [],
}


def check(label, passed, **details):
    REPORT["checks"].append({"check": label, "passed": bool(passed), **details})


def matrix_error(a, b):
    return max(abs(a[r][c] - b[r][c]) for r in range(4) for c in range(4))


def evaluate(objects):
    bpy.context.view_layer.update()
    depsgraph = bpy.context.evaluated_depsgraph_get()
    result = {}
    for obj in objects:
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        try:
            mesh.calc_loop_triangles()
            vertices = [evaluated.matrix_world @ vertex.co for vertex in mesh.vertices]
            result[obj.name] = {
                "vertices": vertices,
                "triangles": len(mesh.loop_triangles),
                "finite": all(math.isfinite(c) for v in vertices for c in v),
            }
        finally:
            evaluated.to_mesh_clear()
    return result


def bounds(evaluated):
    vertices = [v for item in evaluated.values() for v in item["vertices"]]
    lower = [min(v[i] for v in vertices) for i in range(3)]
    upper = [max(v[i] for v in vertices) for i in range(3)]
    return {"min_m": lower, "max_m": upper,
            "dimensions_m": [upper[i] - lower[i] for i in range(3)]}


rig = None
saved_action = None
saved_pose = {}
saved_frame = SCENE.frame_current
try:
    if not bpy.data.filepath or Path(bpy.data.filepath).name != "player-bear-v02.blend":
        raise ValueError("Open player-bear-v02.blend before running this audit")
    rig = SCENE.objects["Player_Rig"]
    skin_collections = ["01_Body", "02_Head_Hide_In_First_Person", "03_Hands"]
    skin = list({o for name in skin_collections
                 for o in bpy.data.collections[name].all_objects if o.type == "MESH"})
    prop_collection = bpy.data.collections["04_Hand_Props"]
    props = [o for o in prop_collection.all_objects if o.type == "MESH"]
    actor = sorted(skin + props, key=lambda o: o.name)
    roots = {"L": SCENE.objects["ATTACH_L_Lollipop_Grip"],
             "R": SCENE.objects["ATTACH_R_Mug_Grip"]}
    REPORT["actor_collections"] = skin_collections + [prop_collection.name]
    REPORT["excluded"] = "90_Review_Studio, cameras, lights, rig helpers"
    REPORT["rig_bones"] = len(rig.data.bones)
    check("metric units", SCENE.unit_settings.system == "METRIC"
          and abs(SCENE.unit_settings.scale_length - 1) < 1e-7,
          system=SCENE.unit_settings.system, scale_length=SCENE.unit_settings.scale_length)
    check("reused 52-bone rig", len(rig.data.bones) == 52)
    transform_objects = actor + [rig] + list(roots.values())
    scale_errors = {o.name: max(abs(c - 1) for c in o.scale) for o in transform_objects}
    check("actor object scales are unity", max(scale_errors.values()) < 1e-5,
          max_error=max(scale_errors.values()))

    REPORT["skin_meshes"] = {}
    for obj in sorted(skin, key=lambda o: o.name):
        armatures = [m for m in obj.modifiers if m.type == "ARMATURE"]
        binding_ok = (len(armatures) == 1 and armatures[0].object == rig
                      and armatures[0].show_viewport and armatures[0].show_render)
        groups = {g.index: g.name for g in obj.vertex_groups}
        counts, errors, invalid_groups = [], [], set()
        for vertex in obj.data.vertices:
            weights = [g for g in vertex.groups if g.weight > 1e-6]
            counts.append(len(weights))
            errors.append(abs(sum(g.weight for g in weights) - 1))
            for group in weights:
                name = groups[group.group]
                bone = rig.data.bones.get(name)
                if bone is None or not bone.use_deform:
                    invalid_groups.add(name)
        info = {"vertices": len(obj.data.vertices), "bound_to_rig": binding_ok,
                "max_influences": max(counts), "unweighted_vertices": counts.count(0),
                "max_weight_sum_error": max(errors), "invalid_weight_groups": sorted(invalid_groups)}
        REPORT["skin_meshes"][obj.name] = info
        check("skin binding and normalized weights: " + obj.name,
              binding_ok and min(counts) > 0 and max(counts) <= 4
              and max(errors) < 1e-4 and not invalid_groups)

    REPORT["prop_attachments"] = {}
    for side, root in roots.items():
        expected = "hand." + side
        attached = root.parent == rig and root.parent_type == "BONE" and root.parent_bone == expected
        REPORT["prop_attachments"][side] = {"root": root.name, "bone": root.parent_bone}
        check("prop correct hand: " + side, attached)
        descendants = [o for o in props if o.name.startswith("PROP_" + side + "_")]
        check("prop meshes attached to grip root: " + side,
              bool(descendants) and all(o.parent == root for o in descendants))

    images = [i for i in bpy.data.images if i.source == "FILE"]
    REPORT["images"] = [{"name": i.name, "packed": bool(i.packed_file), "size": list(i.size)} for i in images]
    check("file images packed", bool(images) and all(i.packed_file for i in images))
    eye = SCENE.objects.get("Eye_Reference_2m")
    check("camera reference at 2 metres", eye is not None and abs(eye.matrix_world.translation.z - 2) < 1e-5)

    # Temporarily detach the review action so a frame update cannot undo test poses.
    saved_action = rig.animation_data.action if rig.animation_data else None
    saved_pose = {p.name: (p.rotation_mode, p.matrix_basis.copy()) for p in rig.pose.bones}
    if rig.animation_data:
        rig.animation_data.action = None

    def reset_pose():
        for pose_bone in rig.pose.bones:
            pose_bone.rotation_mode = "XYZ"
            pose_bone.matrix_basis = Matrix.Identity(4)
        bpy.context.view_layer.update()

    reset_pose()
    baseline = evaluate(actor)
    body_baseline = {o.name: baseline[o.name] for o in skin}
    REPORT["actor_bounds"] = bounds(baseline)
    REPORT["body_without_props_bounds"] = bounds(body_baseline)
    REPORT["triangles_by_mesh"] = {name: info["triangles"] for name, info in baseline.items()}
    triangles = sum(info["triangles"] for info in baseline.values())
    REPORT["triangle_budget"] = {"measured_evaluated": triangles, "target_approx": 40000,
                                 "difference": triangles - 40000, "within_target": triangles <= 40000,
                                 "blocking": False}
    check("rest vertices finite", all(info["finite"] for info in baseline.values()))

    # A bone's world basis omits the parent-tail offset, which is constant and
    # therefore still cancels when checking a prop's rigid attachment transform.
    def relative_to_hand(side):
        hand_world = rig.matrix_world @ rig.pose.bones["hand." + side].matrix
        return hand_world.inverted() @ roots[side].matrix_world

    grip_offsets = {side: relative_to_hand(side).copy() for side in roots}
    root_world = {side: root.matrix_world.copy() for side, root in roots.items()}
    child_offsets = {o.name: o.parent.matrix_world.inverted() @ o.matrix_world for o in props}
    cases = [
        ("arms", {"upper_arm.L": (9, 0, 0), "forearm.R": (0, 0, -10)}, "Body_Bear_Fur"),
        ("legs", {"thigh.L": (8, 0, 0), "shin.R": (-10, 0, 0)}, "Body_Bear_Fur"),
        ("fingers", {"index_01.L": (12, 0, 0), "thumb_01.R": (0, 0, 12)}, "Hands_Bear_Paws"),
    ]
    for label, rotations, expected_mesh in cases:
        reset_pose()
        for bone_name, degrees in rotations.items():
            rig.pose.bones[bone_name].rotation_euler = tuple(math.radians(a) for a in degrees)
        evaluated = evaluate(actor)
        displacement = {}
        stable_topology = True
        for name, item in evaluated.items():
            old = baseline[name]["vertices"]
            new = item["vertices"]
            stable_topology &= len(old) == len(new)
            displacement[name] = max((a - b).length for a, b in zip(old, new))
        attachment_error = max(matrix_error(relative_to_hand(side), grip_offsets[side]) for side in roots)
        child_error = max(matrix_error(o.parent.matrix_world.inverted() @ o.matrix_world,
                                      child_offsets[o.name]) for o in props)
        roots_moved = {side: (root.matrix_world.translation - root_world[side].translation).length
                       for side, root in roots.items()}
        box = bounds(evaluated)
        finite = all(item["finite"] for item in evaluated.values())
        # Generous bounds detect exploded or invalid deformation; they make no
        # assertion about the artistic quality of bends or grip contacts.
        sane_bounds = (max(displacement.values()) < 1.0
                       and max(box["dimensions_m"]) < 4.0
                       and max(abs(c) for key in ("min_m", "max_m") for c in box[key]) < 4.0)
        passed = (stable_topology and finite and sane_bounds
                  and displacement[expected_mesh] > 1e-5
                  and attachment_error < 1e-5 and child_error < 1e-5)
        if label == "arms":
            passed &= all(distance > 1e-5 for distance in roots_moved.values())
        REPORT["pose_checks"].append({
            "pose": label, "rotations_degrees": rotations, "passed": bool(passed),
            "finite_vertices": finite, "stable_vertex_counts": stable_topology,
            "bounds": box, "max_vertex_displacement_m": displacement,
            "grip_transform_error": attachment_error, "prop_child_transform_error": child_error,
            "grip_translation_m": roots_moved,
        })
        check("small-pose deformation and rigid props: " + label, passed)
except Exception as error:
    REPORT["exception"] = repr(error)
    check("audit completed", False, error=repr(error))
finally:
    if rig is not None and saved_pose:
        for name, (mode, basis) in saved_pose.items():
            rig.pose.bones[name].rotation_mode = mode
            rig.pose.bones[name].matrix_basis = basis
        if rig.animation_data:
            rig.animation_data.action = saved_action
        SCENE.frame_set(saved_frame)
        bpy.context.view_layer.update()
    REPORT["passed"] = all(item["passed"] for item in REPORT["checks"])
    REPORT["limits"] = ["No source save, GLB export, game integration or locomotion test",
                         "No visual approval; no collision or retopology quality certification"]
    (OUT / "audit.json").write_text(json.dumps(REPORT, indent=2), encoding="utf-8")
    print("BEAR_AUDIT", json.dumps({"passed": REPORT["passed"],
                                    "failures": [c for c in REPORT["checks"] if not c["passed"]],
                                    "triangle_budget": REPORT.get("triangle_budget"),
                                    "body_bounds": REPORT.get("body_without_props_bounds")}))
    if not REPORT["passed"]:
        raise RuntimeError("Bear source audit failed; inspect audit.json")
