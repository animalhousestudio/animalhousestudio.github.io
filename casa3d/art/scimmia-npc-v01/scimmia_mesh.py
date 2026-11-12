"""Geometry in metres, with the face looking toward -Y."""

from math import cos, pi, sin, sqrt, tau

import bmesh
import bpy
from mathutils import Vector


PALETTE = {
    "coal": "23242C", "silver": "4B4C55", "dark": "101018", "ivory": "EDE9DF",
    "shadow": "AEA7AA", "chalk": "F9F5E9", "rose": "B67F87", "lip": "6B4755",
    "void": "100810", "lid": "303038", "copper": "BA5317", "amber": "FFA51D",
    "honey": "FFE278", "black": "100D14", "shine": "FFF8E8", "nose": "26252F",
}


def linear_color(hex_value):
    rgb = [int(hex_value[index:index + 2], 16) / 255 for index in (0, 2, 4)]
    return tuple(c / 12.92 if c < 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in rgb) + (1,)


class Skin:
    def __init__(self):
        self.points = []
        self.faces = []
        self.weights = []
        self.colors = []

    def vert(self, position, weight, color):
        self.points.append(position)
        if callable(weight):
            weight = weight(position)
        self.weights.append({weight: 1.0} if isinstance(weight, str) else weight)
        pigment = color(position) if callable(color) else color
        self.colors.append(linear_color(PALETTE[pigment]))
        return len(self.points) - 1

    def connect(self, rings):
        for a, b in zip(rings, rings[1:]):
            for i in range(len(a)):
                j = (i + 1) % len(a)
                self.faces.append((a[i], a[j], b[j], b[i]))

    def ellipsoid(self, center, radii, bone, color, n=16, bands=10, axis=None):
        center = Vector(center)
        axis = Vector(axis or (0, 0, 1)).normalized()
        across = Vector((1, 0, 0))
        if abs(axis.dot(across)) > .92:
            across = Vector((0, 1, 0))
        across = (across - axis * across.dot(axis)).normalized()
        depth = axis.cross(across)
        top = self.vert(center + axis * radii[2], bone, color)
        bottom = self.vert(center - axis * radii[2], bone, color)
        rings = []
        for band in range(1, bands):
            phi = pi * band / bands
            rings.append([
                self.vert(center + axis * (radii[2] * cos(phi))
                          + (across * (radii[0] * cos(tau * i / n))
                             + depth * (radii[1] * sin(tau * i / n))) * sin(phi),
                          bone, color)
                for i in range(n)
            ])
        self.connect(rings)
        for i in range(n):
            j = (i + 1) % n
            self.faces.extend(((top, rings[0][i], rings[0][j]),
                               (bottom, rings[-1][j], rings[-1][i])))

    def tube(self, sections, count=10):
        rings = []
        for i, (center, width, depth, weight, color) in enumerate(sections):
            before = Vector(sections[max(0, i - 1)][0])
            after = Vector(sections[min(len(sections) - 1, i + 1)][0])
            direction = (after - before).normalized()
            across = direction.cross(Vector((0, 1, 0))).normalized()
            forward = direction.cross(across)
            rings.append([
                self.vert(Vector(center) + across * (width * cos(tau * j / count))
                          + forward * (depth * sin(tau * j / count)), weight, color)
                for j in range(count)
            ])
        self.connect(rings)
        self.faces.extend((tuple(reversed(rings[0])), tuple(rings[-1])))

    def patch(self, outline, center, surface, weight, color, bulge=0, samples=3, back=None):
        """A curved opaque patch. Coordinates describe the front silhouette."""
        outline = [Vector(point) for point in outline]
        contour = []
        for i, p1 in enumerate(outline):
            p0, p2, p3 = (outline[j % len(outline)] for j in (i - 1, i + 1, i + 2))
            for k in range(samples):
                t = k / samples
                contour.append(.5 * ((2 * p1) + (-p0 + p2) * t
                                    + (2*p0 - 5*p1 + 4*p2 - p3) * t*t
                                    + (-p0 + 3*p1 - 3*p2 + p3) * t*t*t))
        center = Vector(center)
        rings = []
        for factor in ((.52, 1) if samples == 2 else (.34, .68, 1)):
            ring = []
            for point in contour:
                x, z = center.lerp(point, factor)
                y, world_z = surface(x, z)
                ring.append(self.vert((x, y - bulge * (1 - factor**2), world_z), weight, color))
            rings.append(ring)
        self.connect(rings)
        if back:
            backing = []
            for x, z in contour:
                y, world_z = back(x,z)
                backing.append(self.vert((x,y,world_z),weight,color))
            self.connect([rings[-1], backing])
        y, z = surface(*center)
        middle = self.vert((center.x, y - bulge, z), weight, color)
        for i in range(len(contour)):
            self.faces.append((middle, rings[0][i], rings[0][(i + 1) % len(contour)]))

    def create(self, rig, collection):
        mesh = bpy.data.meshes.new("Scimmia | pelle")
        mesh.from_pydata(self.points, [], self.faces)
        bm = bmesh.new()
        bm.from_mesh(mesh)
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
        bm.to_mesh(mesh)
        bm.free()
        mesh.update()
        color = mesh.color_attributes.new(name="Pigmento", type="BYTE_COLOR", domain="POINT")
        color.data.foreach_set("color", [value for rgba in self.colors for value in rgba])
        for polygon in mesh.polygons:
            polygon.use_smooth = True
        material = bpy.data.materials.new("Scimmia | pigmento dei vertici")
        material.use_nodes = True
        nodes = material.node_tree.nodes
        pigment = nodes.new("ShaderNodeVertexColor")
        pigment.layer_name = color.name
        shader = nodes.get("Principled BSDF")
        shader.inputs["Roughness"].default_value = .67
        material.node_tree.links.new(pigment.outputs["Color"], shader.inputs["Base Color"])
        mesh.materials.append(material)
        obj = bpy.data.objects.new("Scimmia | corpo e volto", mesh)
        collection.objects.link(obj)
        groups = {}
        for index, weights in enumerate(self.weights):
            for bone, influence in weights.items():
                if bone not in groups:
                    groups[bone] = obj.vertex_groups.new(name=bone)
                groups[bone].add([index], influence, "REPLACE")
        modifier = obj.modifiers.new("Deformazione scheletrica", "ARMATURE")
        modifier.object = rig
        obj.parent = rig
        return obj


HEAD_Z = 1.34


def face_surface(offset):
    def surface(x, z):
        radial = max(.045, 1 - (x / .302)**2 - (z / .311)**2)
        return -.111 - .255 * sqrt(radial) - offset, HEAD_Z + z
    return surface


def fur_lock(skin, x, z, dx, dz, width):
    surface = face_surface(0)
    base_y, base_z = surface(x,z)
    middle_y, middle_z = surface(x+dx*.45,z+dz*.45)
    tip_y, tip_z = surface(x+dx*.87,z+dz*.87)
    skin.tube([
        ((x,base_y+.017,base_z),width*.80,.012,"head","ivory"),
        ((x+dx*.45,middle_y-.009,middle_z),width,.016,"head","ivory"),
        ((x+dx*.80,tip_y-.014,tip_z-dz*.07),width*.45,.009,"head","chalk"),
        ((x+dx,tip_y+.008,HEAD_Z+z+dz),.001,.001,"head","chalk"),
    ], 7)


def face(skin):
    bone = "head"
    skin.ellipsoid((0, -.111, HEAD_Z), (.302, .255, .311), bone, "ivory", 28, 19)
    for side in (-1, 1):
        def mirror(points):
            return [(side * x, z) for x, z in points]

        skin.ellipsoid((side*.254, -.044, 1.502), (.122, .100, .141),
                       bone, "coal", 16, 11, (side*.38, 0, 1))
        skin.ellipsoid((side*.277, -.123, 1.501), (.078, .032, .095),
                       bone, "dark", 12, 8, (side*.35, 0, 1))
        for x,z,dx,dz,width in (
            (.206,.187,.079,-.013,.027),(.244,.138,.070,-.028,.027),
            (.255,.078,.076,-.042,.031),(.251,.022,.081,-.050,.034),
            (.246,-.031,.067,-.080,.032),(.233,-.092,.061,-.082,.034),
            (.205,-.148,.048,-.105,.031),(.164,-.196,.033,-.099,.030),
            (.116,-.231,.009,-.106,.032),(.064,-.257,-.004,-.107,.030),
        ):
            fur_lock(skin,side*x,z,side*dx,dz,width)

        socket = [(.044,.036),(.052,.100),(.084,.157),(.137,.175),(.183,.158),
                  (.219,.118),(.240,.050),(.226,-.014),(.185,-.055),(.129,-.066),
                  (.082,-.049),(.054,-.013)]
        skin.patch(mirror(socket), (side*.14,.056), face_surface(.010), bone, "dark", .013)
        x = side*.137
        skin.ellipsoid((x,-.352,HEAD_Z+.039),(.075,.035,.072),bone,"lid",18,11)
        skin.ellipsoid((x,-.371,HEAD_Z+.041),(.063,.024,.060),bone,"black",18,11)
        skin.ellipsoid((x-side*.008,-.386,HEAD_Z+.043),(.053,.014,.051),bone,"copper",18,10)
        skin.ellipsoid((x-side*.009,-.395,HEAD_Z+.046),(.044,.010,.044),bone,"amber",18,10)
        skin.ellipsoid((x-side*.014,-.403,HEAD_Z+.048),(.024,.008,.027),bone,"black",16,8)
        skin.ellipsoid((x-side*.022,-.411,HEAD_Z+.065),(.010,.004,.010),bone,"shine",10,6)
        brow = [(.042,.044),(.045,.100),(.075,.148),(.124,.171),(.174,.148),
                (.218,.100),(.210,.068),(.175,.084),(.147,.088),(.115,.069),(.074,.032)]
        skin.patch(mirror(brow), (side*.129,.106), face_surface(.060),
                   bone, "dark", .016, back=face_surface(-.003))

    mouth = [(-.225,-.114),(-.174,-.131),(-.102,-.143),(0,-.160),(.105,-.143),
             (.174,-.125),(.221,-.110),(.192,-.180),(.119,-.236),(0,-.260),
             (-.118,-.233),(-.184,-.182)]
    skin.patch([(x*1.09,z*1.045) for x,z in mouth], (0,-.183),
               face_surface(.020), bone, "rose", .010)
    skin.patch(mouth, (0,-.180), face_surface(.030), bone, "lip", .010)
    skin.patch([(x*.96, -.171+(z+.171)*.89) for x,z in mouth], (0,-.176),
               face_surface(.040), bone, "void", .006)
    for i in range(-4, 5):
        x = i * .041
        width = .019 if abs(i) < 4 else .014
        top = -.154 + .029 * (abs(i) / 4)**1.7
        length = .079 - .009 * abs(i) + (.007 if abs(i) in (1,3) else 0)
        lean = -.010*i/4
        tooth = [(x-width,top), (x+width,top+.003), (x+width*.59,top-length*.61),
                 (x+lean,top-length), (x-width*.56,top-length*.66)]
        skin.patch(tooth, (x+lean*.3,top-length*.43), face_surface(.052),
                   bone,"copper", .014, 2)
        skin.patch([(x+(px-x)*.78, top+(z-top)*.84-.003) for px,z in tooth],
                   (x+lean*.3,top-length*.4),face_surface(.060),bone,"amber",.014,2)
        skin.patch([(x-width*.30,top-.010),(x+width*.27,top-.014),
                    (x+lean*.7,top-length*.80)],
                   (x,top-length*.32),face_surface(.074),bone,"honey",.007,2)

    for side in (-1, 1):
        cheek = [(0,-.105),(.043,-.061),(.084,-.063),(.117,-.084),(.159,-.074),
                 (.194,-.079),(.217,-.116),(.186,-.136),(.123,-.154),(.058,-.160),(.008,-.140)]
        skin.patch([(side*x,z) for x,z in cheek],(side*.105,-.113),
                   face_surface(.065),bone,"chalk", .023)
        crease = [(side*.163,-.088),(side*.184,-.084),(side*.207,-.111),
                  (side*.180,-.104),(side*.163,-.112),(side*.170,-.100)]
        skin.patch(crease,(side*.180,-.099),face_surface(.082),bone,"rose", .009)

    skin.ellipsoid((0,-.407,HEAD_Z-.057),(.069,.039,.050),bone,"nose",18,11)
    skin.ellipsoid((0,-.433,HEAD_Z-.033),(.035,.009,.009),bone,"lid",12,6)
    for side in (-1, 1):
        skin.ellipsoid((side*.034,-.435,HEAD_Z-.073),(.019,.008,.011),bone,"void",12,7,
                       (side*.84,0,.55))
    skin.ellipsoid((0,-.402,HEAD_Z-.113),(.006,.023,.031),bone,"lip",12,8)
    for x,z,dx,dz,width in (
        (-.160,.225,-.048,.041,.029),(-.111,.254,-.035,.059,.027),
        (-.065,.269,-.036,.056,.025),(-.013,.274,.018,.085,.033),
        (.040,.262,.040,.067,.031),(.093,.247,.051,.058,.031),
        (.138,.222,.058,.047,.033),(.011,-.277,-.014,-.097,.029),
    ):
        fur_lock(skin,x,z,dx,dz,width)


def body(skin, joints):
    def bib(half_width, center_y):
        return lambda point: "ivory" if point.y < center_y and abs(point.x) < half_width else "coal"

    skin.tube([
        ((0,.049,.485),.101,.101,"hips","coal"),
        ((0,.057,.555),.164,.147,"hips","coal"),
        ((0,.049,.675),.155,.127,{"hips":.68,"spine":.32},"coal"),
        ((0,.028,.815),.185,.137,"spine","coal"),
        ((0,.019,.861),.213,.149,{"spine":.84,"chest":.16},bib(.046,.019)),
        ((0,.006,.917),.246,.170,{"spine":.55,"chest":.45},bib(.094,.006)),
        ((0,-.002,.961),.278,.178,{"spine":.26,"chest":.74},bib(.138,-.002)),
        ((0,-.010,1.025),.272,.171,"chest",bib(.162,-.010)),
        ((0,-.017,1.083),.246,.157,"chest",bib(.144,-.017)),
        ((0,-.025,1.122),.192,.132,"chest",bib(.109,-.025)),
        ((0,-.042,1.166),.130,.110,{"chest":.72,"head":.28},"coal"),
    ], 28)
    for sign, side in ((1,"L"),(-1,"R")):
        def bone(name):
            return f"{name}.{side}"

        shoulder, elbow, wrist = [Vector(joints[bone(part)][0])
                                  for part in ("upper_arm","forearm","hand")]
        hip, knee, ankle = [Vector(joints[bone(part)][0])
                            for part in ("thigh","shin","foot")]
        skin.tube([(shoulder+Vector((-sign*.049,0,.066)),.055,.065,
                    {bone("upper_arm"):.55,"chest":.45},"coal"),
                   (shoulder,.109,.102,{bone("upper_arm"):.86,"chest":.14},"coal"),
                   (shoulder.lerp(elbow,.42),.096,.093,bone("upper_arm"),"coal"),
                   (shoulder.lerp(elbow,.82),.072,.077,bone("upper_arm"),"coal"),
                   (elbow,.068,.074,{bone("upper_arm"):.5,bone("forearm"):.5},"silver"),
                   (elbow.lerp(wrist,.22),.084,.080,bone("forearm"),"coal"),
                   (elbow.lerp(wrist,.62),.069,.067,bone("forearm"),"coal"),
                   (wrist,.050,.056,{bone("forearm"):.28,bone("hand"):.72},"dark")], 14)
        skin.ellipsoid(wrist+Vector((sign*.012,0,-.055)),(.068,.060,.094),
                       bone("hand"),"dark",12,8)
        for index in range(4):
            x = sign*(index-1.35)*.027
            skin.ellipsoid(wrist+Vector((x,-.023,-.111+abs(index-1)*.009)),
                           (.018,.034,.039),bone("hand"),"silver",8,5)
        skin.ellipsoid(wrist+Vector((-sign*.048,-.031,-.044)),(.027,.036,.054),
                       bone("hand"),"coal",10,6,(sign*.6,0,1))
        skin.tube([(hip+Vector((0,0,.030)),.111,.113,bone("thigh"),"coal"),
                   (hip.lerp(knee,.38),.118,.105,bone("thigh"),"coal"),
                   (knee,.080,.076,{bone("thigh"):.52,bone("shin"):.48},"silver"),
                   (knee.lerp(ankle,.40),.074,.078,bone("shin"),"coal"),
                   (knee.lerp(ankle,.74),.061,.061,bone("shin"),"coal"),
                   (ankle,.045,.047,{bone("shin"):.30,bone("foot"):.70},"dark")], 14)
        skin.ellipsoid(ankle+Vector((0,-.053,-.028)),(.073,.116,.058),
                       bone("foot"),"dark",12,8)
        for index in range(4):
            x = sign*(index-1.5)*.026
            skin.ellipsoid(ankle+Vector((x,-.142+abs(index-1)*.010,-.040)),
                           (.019,.041,.026),bone("foot"),"silver",8,5)

    tail = [Vector(joints[f"tail_{i}"][0]) for i in range(4)]
    tail.append(Vector(joints["tail_3"][1]))
    sections = [(tail[0],.078,.066,{"hips":.65,"tail_0":.35},"coal")]
    radii = (.071,.058,.043,.028,.007)
    for i,(start,end) in enumerate(zip(tail,tail[1:])):
        name = f"tail_{i}"
        radius = (radii[i]+radii[i+1])/2
        sections.append((start.lerp(end,.49),radius,radius*.92,name,"coal"))
        weights = {name:.52,f"tail_{i+1}":.48} if i < 3 else name
        sections.append((end,radii[i+1],radii[i+1]*.91,weights,"dark" if i == 3 else "coal"))
    skin.tube(sections,12)
