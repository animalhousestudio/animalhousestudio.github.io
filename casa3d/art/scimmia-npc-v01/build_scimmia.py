"""Blender 5.x: --background --factory-startup --python build_scimmia.py."""

import hashlib
import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from scimmia_mesh import Skin, body, face, linear_color
from scimmia_motion import POST_TOPS, ROOF, author_actions, create_rig, skeleton, walk


def collection(name, scene):
    group = bpy.data.collections.new(name)
    scene.collection.children.link(group)
    return group


def move_to(obj, group):
    for old in list(obj.users_collection):
        old.objects.unlink(obj)
    group.objects.link(obj)
    return obj


def material(name, value, roughness=.8, metallic=0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = linear_color(value)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = mat.diffuse_color
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    return mat


def finish_prop(group, name, mat, bevel):
    obj = move_to(bpy.context.object, group)
    obj.name = name
    obj.data.materials.append(mat)
    if bevel:
        mod = obj.modifiers.new("Bordi", "BEVEL")
        mod.width, mod.segments = bevel, 2
    return obj


def cylinder(group, name, radius, depth, center, mat):
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=radius, depth=depth, location=center)
    return finish_prop(group, name, mat, .008)


def box(group, name, dimensions, center, mat, bevel):
    bpy.ops.mesh.primitive_cube_add(size=1, location=center)
    bpy.context.object.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish_prop(group, name, mat, bevel)


def make_stage(scene):
    group = collection("02 | Appoggi della prova", scene)
    floor = material("Suolo | ardesia", "35464E")
    post = material("Pali | metallo ossidato", "355258", .64, .31)
    edge = material("Pali | anelli di appoggio", "7A9695", .66, .26)
    roof = material("Tetto | lamiera", "40545F", .65, .15)
    box(group, "Pavimento di studio", (200,200,.12), (0,0,-.06), floor, 0)
    for i, top in enumerate(POST_TOPS, 1):
        h = top.z
        cylinder(group, f"Palo {i} | fusto", .18,h-.032,(0,top.y,(h-.032)/2),post)
        cylinder(group, f"Palo {i} | testa", .213,.065,(0,top.y,h-.0325),edge)
        cylinder(group, f"Palo {i} | basamento", .254,.09,(0,top.y,.045),edge)
        for step in (.37,.60,.84,1.05,1.37):
            cylinder(group, f"Palo {i} | collarino {step:.2f}", .205,.025,(0,top.y,step),edge)
    box(group, "Casa | volume di prova", (3.08,2.22,2.14),(0,-5.27,1.07),post,.024)
    box(group, "Casa | sommità", (3.28,2.43,.10),(0,-5.27,2.15),roof,.022)
    for x in (-1.39,-.95,-.51,.51,.95,1.39):
        box(group,"Casa | nervatura",(.022,2.35,.024),(x,-5.27,2.207),edge,.005)


def camera(group, name, lens):
    data = bpy.data.cameras.new(name)
    data.lens = lens
    data.clip_end = 400
    obj = bpy.data.objects.new(name, data)
    group.objects.link(obj)
    return obj


def place(obj, position, target):
    obj.location = position
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def make_studio(scene, camera_positions):
    group = collection("03 | Camere e luci di studio", scene)

    def area(name, position, target, watts, size, color):
        data = bpy.data.lights.new(name, "AREA")
        data.energy, data.shape, data.size = watts, "DISK", size
        data.color = color
        light = bpy.data.objects.new(name, data)
        group.objects.link(light)
        place(light, position, target)

    area("Principale", (2.1,-3.6,6.2), (0,-1,1), 1050, 5, (1,.86,.76))
    area("Riempimento", (-3.8,-4.5,3.8), (0,-1.5,1.2), 640, 4, (.69,.87,1))
    area("Controluce", (1,4.8,5), (0,-.5,1.3), 1700, 4.2, (.64,.86,1))
    area("Tetto", (-1,-8.1,5.1), (0,-3.6,1.8), 650, 3, (.80,.94,1))

    portrait = camera(group, "Ritratto", 71)
    course = camera(group, "Tour | camera mobile", 42)
    base = camera_positions[1]
    place(portrait, (.12,base.y-2.14,1.82),(0,base.y-.20,1.21))
    for frame, position in camera_positions.items():
        intro = min(1, (frame-1)/64)
        swing = min(1, max(0, (frame-92)/74))
        side = 1.56 + 3.38*swing + .29*intro
        lead = -2.94 + 1.45*swing
        rise = 1.65 + 1.13*swing
        place(course,(side,position.y+lead,position.z+rise),
              (0,position.y-.25-.30*swing,position.z+.75))
        course.keyframe_insert("location",frame=frame)
        course.keyframe_insert("rotation_euler",frame=frame)
    scene.camera = course
    return portrait, course


def measured_rig(scene, rig, obj):
    obj.data.calc_loop_triangles()
    assert len(obj.data.materials) == 1
    assert all(0 < len(v.groups) <= 2 and abs(sum(g.weight for g in v.groups)-1) < 1e-6
               for v in obj.data.vertices)
    assert len(obj.data.loop_triangles) < 14000, len(obj.data.loop_triangles)
    assert len(rig.animation_data.nla_tracks[0].strips) == 5
    minimum = [float("inf")]*3
    maximum = [-float("inf")]*3
    support_error = 0
    contact_error = 0
    joints = ("hand.L", "hand.R", "foot.L", "foot.R")
    for frame in range(1,338):
        scene.frame_set(frame)
        if frame <= 97:
            reference = walk((frame-1)/96)
            for joint, point in zip(joints, reference.hands+reference.feet):
                contact_error = max(contact_error, (rig.pose.bones[joint].head-point).length)
        if frame in (193,245,301,337):
            top = {193:POST_TOPS[0],245:POST_TOPS[1],301:ROOF,337:ROOF}[frame]
            for joint in joints[2:]:
                support_error = max(support_error, abs(rig.pose.bones[joint].head.z-top.z-.087))
        evaluated = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
        for point in evaluated.bound_box:
            for axis, value in enumerate(point):
                minimum[axis] = min(minimum[axis],value)
                maximum[axis] = max(maximum[axis],value)
    assert support_error < .01, support_error
    assert contact_error < .06, contact_error
    scene.frame_set(1)
    return {
        "vertices": len(obj.data.vertices), "triangles": len(obj.data.loop_triangles),
        "bones": len(rig.data.bones), "deformBones": sum(b.use_deform for b in rig.data.bones),
        "materials": len(obj.data.materials), "textures": 0, "maxWeightsPerVertex": 2,
        "restHeightM": round(max(v.co.z for v in obj.data.vertices), 3),
        "sampledTourBoundsM": {"min": [round(v,4) for v in minimum], "max": [round(v,4) for v in maximum]},
        "maxLandingAnkleTargetErrorM": round(support_error,5),
        "maxWalkLimbTargetErrorM": round(contact_error,5),
        "fps": 24, "frames": [1,337],
        "clips": [{"name": s.name, "frames": [int(s.frame_start),int(s.frame_end)]}
                  for s in rig.animation_data.nla_tracks[0].strips],
    }


def render(scene, path, cam, frame, width, height):
    scene.frame_set(frame)
    scene.camera = cam
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.name = "Scimmia | tour di prova"
    scene.unit_settings.system = "METRIC"
    scene.render.fps = 24
    scene.frame_end = 337
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 20
    scene.cycles.use_denoising = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.resolution_x, scene.render.resolution_y = 960, 640
    scene.world = bpy.data.worlds.new("Ambiente di studio")
    scene.world.use_nodes = True
    scene.world.node_tree.nodes["Background"].inputs[0].default_value = (.20,.24,.29,1)
    scene.world.node_tree.nodes["Background"].inputs[1].default_value = .40
    scene.view_settings.view_transform = "AgX"
    npc = collection("01 | NPC Scimmia", scene)
    joints = skeleton()
    rig = create_rig(npc,joints)
    skin = Skin()
    body(skin,joints)
    face(skin)
    obj = skin.create(rig,npc)
    make_stage(scene)
    camera_positions = author_actions(rig,scene)
    portrait, course = make_studio(scene,camera_positions)
    metrics = measured_rig(scene,rig,obj)

    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = obj
    scene.camera = course
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == "VIEW_3D":
                area.spaces.active.region_3d.view_perspective = "CAMERA"
                area.spaces.active.overlay.show_overlays = False
                area.spaces.active.shading.color_type = "VERTEX"
    scene.render.filepath = "//renders/tour-"
    bpy.context.preferences.filepaths.save_version = 0
    path = HERE / "Scimmia_NPC_v02.blend"
    bpy.ops.wm.save_as_mainfile(filepath=str(path))
    metrics["sourceSha256"] = hashlib.sha256(path.read_bytes()).hexdigest()
    metrics["blenderVersion"] = bpy.app.version_string
    (HERE/"verification-v02.json").write_text(json.dumps(metrics,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
    print(json.dumps(metrics,ensure_ascii=False))

    if "--" in sys.argv and "--stills" in sys.argv[sys.argv.index("--")+1:]:
        renders = HERE/"renders"/"v02"
        renders.mkdir(parents=True,exist_ok=True)
        render(scene,renders/"Scimmia_Ritratto.png",portrait,1,900,900)
        for name, frame in (("camminata",21),("arrampicata",169),("salto",220),("tetto",333)):
            render(scene,renders/f"{name}.png",course,frame,960,640)


if __name__ == "__main__":
    main()
