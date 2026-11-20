"""Blender 5.2 --background --factory-startup --python build.py [-- --stills]."""

import hashlib
import json
import struct
import sys
from math import cos, pi, sin, tau
from pathlib import Path

import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
sys.dont_write_bytecode = True
sys.path[:0] = [str(HERE), str(HERE.parent / "scimmia-npc-v01")]
from build_scimmia import box, camera, collection, make_studio, material, place, render
from export_runtime import grip, in_place
from model import PaintedSkin, coat, ears_and_ruff, sculpt_face
from scimmia_motion import apply_pose, at_keys, create_rig, launch_pose, skeleton, walk


def gait(t):
    pose = in_place(walk(t/2))
    # Hips swing towards the planted foot. The face counterbalances the transfer.
    swing = sin(tau*t)
    pose.roll = .111*swing
    pose.hips_z += .018*cos(2*tau*t)-.011
    pose.lean += .067*cos(2*tau*t-.45)
    pose.head_pitch -= .048*cos(2*tau*t-.76)
    pose.head_yaw = -.12*swing
    pose.tail_sway = .47*sin(tau*t-.65)
    pose.tail_lift = .14*cos(2*tau*t-.82)
    return pose


def hold(t):
    pose = grip()
    breath = sin(pi*t)**2
    pose.hips_z -= .019*breath
    pose.head_pitch += .067*breath
    pose.head_yaw += .25*breath
    pose.tail_sway = .25*sin(tau*t)*breath
    pose.tail_lift = .13*breath
    return pose


def clips():
    ready, loaded = grip(), grip()
    loaded.hips_z -= .112
    loaded.lean -= .071
    loaded.head_pitch -= .08
    loaded.tail_lift = .24
    push, tuck, reach = [launch_pose(Vector(), t) for t in (.055,.50,.81)]
    # One hand finds the next post first, the trailing leg extends through takeoff.
    push.feet[1].y += .085
    push.feet[1].z -= .047
    tuck.hands[0].z += .17
    tuck.hands[1].y += .13
    tuck.feet[0].z += .105
    tuck.roll = -.14
    tuck.head_yaw = .13
    tuck.tail_lift = -.48
    reach.hands[0].z += .14
    reach.hands[1].y += .084
    reach.lean -= .12
    reach.head_pitch = -.34
    reach.tail_lift = -.22
    catch = ready.mix(reach,.14)
    catch.hips_z -= .039
    catch.tail_lift = -.09
    mount = [(0,gait(0)),(.18,gait(0).mix(loaded,.45)),(.36,push),(.58,tuck),
             (.78,reach),(.93,catch),(1,ready)]
    leap = [(0,ready),(.15,loaded),(.31,push),(.52,tuck),(.74,reach),(.93,catch),(1,ready)]
    return [("Walk",24,gait),("Mount",30,lambda t: at_keys(mount,t)),
            ("Leap",32,lambda t: at_keys(leap,t)),("Grip",48,hold)]


def animate(rig, scene):
    data = rig.animation_data_create()
    first = 1
    for name, duration, sample in clips():
        previous = {}
        for frame in range(0,duration+1,2):
            apply_pose(rig,sample(frame/duration),frame+1,previous)
        action, slot = data.action, data.action_slot
        action.name = name
        for curve in action.layers[0].strips[0].channelbag(slot).fcurves:
            for key in curve.keyframe_points:
                key.interpolation = "LINEAR"
        data.action = None
        track = data.nla_tracks.new()
        track.name = name
        strip = track.strips.new(name,first,action)
        strip.action_slot = slot
        strip.extrapolation = "NOTHING"
        scene.timeline_markers.new(name,frame=first)
        first += duration+1
    scene.frame_end = first-1


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 12
    scene.cycles.use_denoising = True
    scene.render.fps = 24
    scene.unit_settings.system = "METRIC"
    scene.world = bpy.data.worlds.new("Ambiente")
    scene.world.use_nodes = True
    scene.world.node_tree.nodes["Background"].inputs[0].default_value = (.106,.142,.157,1)
    scene.view_settings.view_transform = "AgX"
    group = collection("Scimmia", scene)
    joints = skeleton()
    # Sweep the tip forward into a hook. The same four links follow through in flight.
    tail = [(0,.127,.613),(.013,.410,.641),(.031,.736,.767),
            (.038,.778,1.019),(.038,.598,1.110)]
    for i in range(4):
        joints[f"tail_{i}"] = (tail[i],tail[i+1],"hips" if i==0 else f"tail_{i-1}")
    rig = create_rig(group,joints)
    skin = PaintedSkin()
    coat(skin,joints)
    sculpt_face(skin)
    ears_and_ruff(skin)
    mesh = skin.create(rig,group)
    animate(rig,scene)
    portrait,_ = make_studio(scene,{1:Vector()})
    box(collection("Studio",scene),"Pavimento", (200,200,.06),(0,0,-.048),
        material("Ardesia","2C373B"),0)
    place(portrait,(.38,-2.67,1.47),(0,-.22,1.18))
    full = camera(group,"Figura intera",58)
    place(full,(2.78,-2.78,1.17),(0,.05,.78))
    scene.camera = full
    scene.frame_set(8)
    bpy.ops.object.select_all(action="DESELECT")
    mesh.select_set(True)
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.context.preferences.filepaths.save_version = 0
    source = HERE / "Scimmia_NPC_v03.blend"
    bpy.ops.wm.save_as_mainfile(filepath=str(source))
    if "--stills" in sys.argv:
        render(scene,HERE/"ritratto.png",portrait,7,720,580)
        render(scene,HERE/"passo.png",full,9,680,640)
        render(scene,HERE/"slancio.png",full,74,680,640)
    tracks = rig.animation_data.nla_tracks
    actions = [track.strips[0].action for track in tracks]
    for track in list(tracks):
        tracks.remove(track)
    for action in actions:
        track = tracks.new()
        track.name = action.name
        track.strips.new(action.name,1,action)
    scene.frame_set(1)
    target = HERE.parents[1]/"src/assets/models/props/scimmia-npc.glb"
    bpy.ops.export_scene.gltf(filepath=str(target), use_selection=True, export_format="GLB",
        export_animation_mode="NLA_TRACKS", export_frame_range=False, export_frame_step=2,
        export_force_sampling=True, export_anim_slide_to_zero=True, export_optimize_animation_size=True,
        export_vertex_color="ACTIVE", export_image_format="AUTO")
    payload = target.read_bytes()
    doc = json.loads(payload[20:20+struct.unpack_from("<I",payload,12)[0]])
    primitive, = doc["meshes"][0]["primitives"]
    assert {"TEXCOORD_0","COLOR_0","JOINTS_0","WEIGHTS_0"} <= primitive["attributes"].keys()
    assert len(doc["meshes"]) == len(doc["skins"]) == len(doc["materials"]) == len(doc["textures"]) == 1
    assert "baseColorTexture" in doc["materials"][0]["pbrMetallicRoughness"]
    manifest = {"sourceSha256":sha(source), "referenceSha256":sha(HERE/"riferimento.jpg"),
                "glbSha256":sha(target), "bytes":len(payload), "primitives":1,
                "triangles":doc["accessors"][primitive["indices"]]["count"]//3,
                "materials":1,"bones":len(doc["skins"][0]["joints"]),"textures":1,
                "textureSize":[768,1024],"clips":sorted(c["name"] for c in doc["animations"])}
    assert manifest["clips"] == ["Grip","Leap","Mount","Walk"] and manifest["triangles"] < 14000
    (HERE/"runtime-export.json").write_text(json.dumps(manifest,indent=2)+"\n")
    print(manifest)


if __name__ == "__main__":
    main()
