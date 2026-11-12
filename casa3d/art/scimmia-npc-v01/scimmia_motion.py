"""Authoring poses and baked actions for the Blender review course."""

from dataclasses import dataclass
from math import cos, pi, sin, sqrt, tau

import bpy
from mathutils import Euler, Vector


V = Vector
POST_TOPS = (V((0, 0, 1.48)), V((0, -2.14, 1.82)))
ROOF = V((0, -4.79, 2.20))
TAIL_POINTS = ((0,.127,.613), (0,.381,.671), (.018,.624,.781),
               (.046,.813,.941), (.086,.876,1.124))


def skeleton():
    joints = {
        "root": ((0, 0, 0), (0, 0, .24), None),
        "hips": ((0, .04, .585), (0, .032, .69), "root"),
        "spine": ((0, .032, .69), (0, .012, .880), "hips"),
        "chest": ((0, .012, .880), (0, -.048, 1.139), "spine"),
        "head": ((0, -.048, 1.139), (0, -.111, 1.433), "chest"),
    }
    for i, (head, tip) in enumerate(zip(TAIL_POINTS,TAIL_POINTS[1:])):
        joints[f"tail_{i}"] = (head,tip,"hips" if i == 0 else f"tail_{i-1}")
    for sign, side in ((1, "L"), (-1, "R")):
        def point(x, y, z):
            return (sign*x, y, z)

        shoulder, elbow, wrist = point(.245, -.004, 1.023), point(.333, .073, .604), point(.354, -.039, .194)
        hip, knee, ankle = point(.112, .040, .568), point(.151, -.055, .337), point(.160, .008, .087)
        joints.update({
            f"upper_arm.{side}": (shoulder, elbow, "chest"),
            f"forearm.{side}": (elbow, wrist, f"upper_arm.{side}"),
            f"hand.{side}": (wrist, point(.354, -.039, .042), f"forearm.{side}"),
            f"thigh.{side}": (hip, knee, "hips"),
            f"shin.{side}": (knee, ankle, f"thigh.{side}"),
            f"foot.{side}": (ankle, point(.160, -.132, .067), f"shin.{side}"),
        })
    return joints


def create_rig(collection, joints):
    armature = bpy.data.armatures.new("Scimmia | scheletro")
    rig = bpy.data.objects.new("Scimmia | rig", armature)
    collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    for name, (head, tail, parent) in joints.items():
        bone = armature.edit_bones.new(name)
        bone.head, bone.tail = head, tail
        if parent:
            bone.parent = armature.edit_bones[parent]
        bone.use_deform = name != "root"
    bpy.ops.object.mode_set(mode="OBJECT")
    rig.show_in_front = True
    rig.display_type = "WIRE"
    return rig


@dataclass
class Pose:
    base: Vector
    hips_z: float
    lean: float
    head_pitch: float
    roll: float
    hands: tuple
    feet: tuple
    hand_direction: Vector
    head_yaw: float = 0
    tail_sway: float = 0
    tail_lift: float = 0

    def mix(self, other, t):
        lerp = lambda a, b: a + (b - a) * t
        return Pose(self.base.lerp(other.base, t), lerp(self.hips_z, other.hips_z),
                    lerp(self.lean, other.lean), lerp(self.head_pitch, other.head_pitch),
                    lerp(self.roll, other.roll),
                    tuple(a.lerp(b, t) for a, b in zip(self.hands, other.hands)),
                    tuple(a.lerp(b, t) for a, b in zip(self.feet, other.feet)),
                    self.hand_direction.lerp(other.hand_direction, t),
                    lerp(self.head_yaw,other.head_yaw),
                    lerp(self.tail_sway,other.tail_sway),
                    lerp(self.tail_lift,other.tail_lift))


def smooth(t):
    t = min(1, max(0, t))
    return t*t*(3-2*t)


def walk(t):
    base = V((0, 2.28 - 1.59*t, 0))
    phase = 2*t
    hands, feet = [], []
    for sign, offset in ((1,0), (-1,.5)):
        for is_hand, targets in ((True,hands), (False,feet)):
            p = (phase + offset + (.20 if is_hand else 0)) % 1
            stance = .65
            travel = 1.59 / 2
            ahead = travel*stance/2
            if p < stance:
                shift, lift = -ahead + travel*p, 0
            else:
                u = (p-stance)/(1-stance)
                shift = ahead*(1-2*smooth(u)) + travel*(1-stance)*sin(tau*u)/tau
                lift = (.095 if is_hand else .120) * sin(pi*u)**2
            targets.append(base + V((sign*(.267 if is_hand else .151),
                                      (-.272 if is_hand else .127) + shift,
                                      (.150 if is_hand else .086)+lift)))
    return Pose(base, .502+.015*cos(2*tau*phase), .54, -.24,
                .055*sin(tau*phase), tuple(hands), tuple(feet), V((0, -.06, -1)),
                tail_sway=.30*sin(tau*phase),tail_lift=.06*cos(tau*phase))


def perch(base, pole=True, compression=0):
    hand_x = .092 if pole else .24
    foot_x = .087 if pole else .19
    return Pose(base, .485-compression, .43+compression, -.18, 0,
                tuple(base+V((s*hand_x, -.101 if pole else -.32, .145)) for s in (1,-1)),
                tuple(base+V((s*foot_x, .085 if pole else .10, .087)) for s in (1,-1)),
                V((0, -.06, -1)))


def climb():
    def pose(y, z, hands, feet, lean=-.03, pitch=-.37):
        return Pose(V((0,y,z)), .46, lean, pitch, 0,
                    tuple(V((s*.102, h_y, h_z)) for s,(h_y,h_z) in zip((1,-1),hands)),
                    tuple(V((s*.112, f_y, f_z)) for s,(f_y,f_z) in zip((1,-1),feet)),
                    V((0, -.58, -.82)))

    return [
        (0, walk(1)),
        (.12, pose(.57,.02, ((.225,.94),(.225,.73)), ((.60,.086),(.80,.086)), .22)),
        (.25, pose(.47,.20, ((.225,.94),(.225,1.27)), ((.30,.40),(.63,.12)))),
        (.39, pose(.49,.42, ((.225,1.40),(.225,1.27)), ((.30,.40),(.30,.63)))),
        (.54, pose(.47,.64, ((.225,1.40),(.113,1.62)), ((.30,.87),(.30,.63)))),
        (.68, pose(.40,.85, ((.122,1.62),(.113,1.62)), ((.30,.87),(.30,1.08)), .21)),
        (.79, pose(.30,1.07, ((.122,1.62),(.113,1.62)), ((.32,1.40),(.30,1.08)), .42, -.20)),
        (.90, pose(.135,1.32, ((.044,1.62),(.066,1.62)), ((.140,1.58),(.32,1.42)), .48, -.19)),
        (1, perch(POST_TOPS[0])),
    ]


def launch_pose(base, t):
    tuck = sin(pi*t)
    hands = tuple(base+V((s*(.16+.19*tuck),-.34-.29*t,.32+.34*tuck)) for s in (1,-1))
    feet = tuple(base+V((s*.14,.17+.19*tuck,.13+.25*tuck)) for s in (1,-1))
    return Pose(base,.52+.12*tuck,.58,-.21,.045*tuck,hands,feet,V((0,-.75,-.66)),
                tail_sway=.14*tuck,tail_lift=-.36*tuck+.11*t)


def jump(start, end, t, roof=False):
    if t < .23:
        q = t/.23
        if q < .65:
            return perch(start, compression=.105*smooth(q/.65))
        return perch(start, compression=.105).mix(launch_pose(start,0),smooth((q-.65)/.35))
    if t <= .76:
        q = (t-.23)/.53
        base = start.lerp(end, q) + V((0, 0, (.68 if roof else .61)*4*q*(1-q)))
        pose = launch_pose(base,q)
        if q > .77:
            pose = pose.mix(perch(base, not roof, .10), smooth((q-.77)/.23))
        return pose
    return perch(end, not roof, .10*(1-smooth((t-.76)/.24)))


def at_keys(keys, t):
    for (a, before), (b, after) in zip(keys, keys[1:]):
        if t <= b:
            return before.mix(after, smooth((t-a)/(b-a)))
    return keys[-1][1]


def roof_settle(t):
    pose = perch(ROOF,False,.016*sin(tau*t)**2)
    pose.head_yaw = .64*smooth(t)
    pose.head_pitch += .12*smooth(t)
    return pose


def solve_limb(shoulder, goal, hint, upper_length, lower_length):
    ray = goal - shoulder
    distance = min(ray.length, upper_length+lower_length-.0001)
    direction = ray.normalized()
    normal = (hint - direction*direction.dot(hint)).normalized()
    along = (distance**2 + upper_length**2 - lower_length**2) / (2*distance)
    bend = sqrt(max(0, upper_length**2-along**2))
    return shoulder + direction*along + normal*bend, shoulder + direction*distance


def apply_pose(rig, pose, frame, previous):
    desired = {}

    def set_bone(name, point, rotation):
        pb = rig.pose.bones[name]
        rest = pb.bone.matrix_local
        transform = (rotation.to_matrix().to_4x4() @ rest).copy()
        transform.translation = point
        if pb.parent:
            basis = pb.bone.convert_local_to_pose(
                transform, rest, parent_matrix=desired[pb.parent.name],
                parent_matrix_local=pb.parent.bone.matrix_local, invert=True)
        else:
            basis = rest.inverted() @ transform
        desired[name] = transform
        pb.rotation_mode = "QUATERNION"
        if name in ("root", "hips"):
            pb.location = basis.to_translation()
            pb.keyframe_insert(data_path="location", frame=frame, group=name)
        quat = basis.to_quaternion()
        if name in previous and quat.dot(previous[name]) < 0:
            quat.negate()
        previous[name] = quat
        pb.rotation_quaternion = quat
        pb.keyframe_insert(data_path="rotation_quaternion", frame=frame, group=name)

    def start(name):
        bone = rig.pose.bones[name]
        return desired[bone.parent.name] @ bone.parent.bone.matrix_local.inverted() @ bone.bone.head_local

    def euler(pitch, roll=0, yaw=0):
        return Euler((pitch,roll,yaw), "XYZ").to_quaternion()

    def aim(name, a, b):
        bone = rig.pose.bones[name].bone
        rotation = (bone.tail_local-bone.head_local).rotation_difference(b-a)
        set_bone(name, a, rotation)

    set_bone("root",pose.base,euler(0))
    set_bone("hips",pose.base+V((0,.04,pose.hips_z)),euler(pose.lean*.29,pose.roll))
    set_bone("spine",start("spine"),euler(pose.lean*.88,pose.roll))
    set_bone("chest",start("chest"),euler(pose.lean,pose.roll*.55))
    set_bone("head",start("head"),euler(pose.head_pitch,pose.roll*.36,pose.head_yaw))
    for i in range(len(TAIL_POINTS)-1):
        name = f"tail_{i}"
        parent = rig.pose.bones[name].parent
        inherited = (desired[parent.name] @ parent.bone.matrix_local.inverted()).to_quaternion()
        swing = euler((pose.tail_lift + pose.lean*.22) * (.58 if i == 0 else .19),
                      0, pose.tail_sway * (.54 if i == 0 else .24))
        set_bone(name,start(name),inherited @ swing)
    for i, (sign, side) in enumerate(((1,"L"),(-1,"R"))):
        for parts, targets, hint, tip in (
            (("upper_arm","forearm","hand"),pose.hands,(sign*.65,1,-.12),pose.hand_direction),
            (("thigh","shin","foot"),pose.feet,(sign*.55,-1,.10),V((0,-1,-.143))),
        ):
            upper, lower, extremity = [f"{part}.{side}" for part in parts]
            shoulder = start(upper)
            elbow, goal = solve_limb(shoulder, targets[i], V(hint),
                                     rig.pose.bones[upper].bone.length, rig.pose.bones[lower].bone.length)
            aim(upper, shoulder, elbow)
            aim(lower, elbow, goal)
            aim(extremity, goal, goal + tip)


def author_actions(rig, scene):
    climbing = climb()
    sequence = [
        ("01 | Camminata sulle nocche", 1, 97, walk),
        ("02 | Arrampicata sul palo", 97, 193, lambda t: at_keys(climbing,t)),
        ("03 | Salto tra i pali", 193, 245, lambda t: jump(*POST_TOPS,t)),
        ("04 | Salto verso il tetto", 245, 301, lambda t: jump(POST_TOPS[1],ROOF,t,roof=True)),
        ("05 | Assestamento sul tetto", 301, 337, roof_settle),
    ]
    data = rig.animation_data_create()
    camera_positions = {}
    actions = []
    for name, first, last, sample in sequence:
        data.action = None
        previous = {}
        for frame in range(first,last+1,2):
            pose = sample((frame-first)/(last-first))
            apply_pose(rig,pose,frame-first+1,previous)
            camera_positions[frame] = pose.base.copy()
        action = data.action
        action.name = name
        action.use_fake_user = True
        for channel in action.layers[0].strips[0].channelbag(data.action_slot).fcurves:
            for key in channel.keyframe_points:
                key.interpolation = "LINEAR"
        actions.append((first,last,action))
        scene.timeline_markers.new(name,frame=first)
    data.action = None
    track = data.nla_tracks.new()
    track.name = "Tour | terra, pali, tetto"
    for first,last,action in actions:
        strip = track.strips.new(action.name,first,action)
        strip.action_slot = action.slots[0]
        strip.extrapolation = "NOTHING"
        strip.blend_type = "REPLACE"
        strip.frame_end = last
    return camera_positions
