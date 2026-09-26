"""Refine the five existing window cats without moving their sites or sills.

Integration: exec this file in a private namespace, then call refine_cats().
No scene switches, file saves, exports, or object removals are performed.
Three shared pose meshes use seven shared material slots and object palettes.
"""
import math
import bpy
import bmesh
from mathutils import Matrix, Vector


def _material(name, color, roughness=.83):
    name = 'M08_Cat_' + name
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.diffuse_color = (*color, 1)
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = mat.diffuse_color
    shader.inputs['Metallic'].default_value = 0
    shader.inputs['Roughness'].default_value = roughness
    return mat


class _CatMesh:
    def __init__(self):
        self.vertices, self.faces, self.materials, self.smooth = [], [], [], []

    def part(self, vertices, faces, material=0, smooth=True, transform=None):
        vertices = [Vector(v) for v in vertices]
        if transform is not None:
            vertices = [transform @ v for v in vertices]
        first = len(self.vertices)
        self.vertices.extend(tuple(v) for v in vertices)
        for face in faces:
            self.faces.append(tuple(first + i for i in face))
            center = sum((vertices[i] for i in face), Vector()) / len(face)
            self.materials.append(material(center) if callable(material) else material)
            self.smooth.append(smooth)

    def ellipsoid(self, center, radius, material=0, segments=16, rings=8, transform=None):
        c = Vector(center)
        vertices = [c + Vector((0, 0, radius[2]))]
        for ring in range(1, rings):
            theta = math.pi * ring / rings
            for j in range(segments):
                angle = math.tau * j / segments
                vertices.append(c + Vector((radius[0] * math.sin(theta) * math.cos(angle),
                                             radius[1] * math.sin(theta) * math.sin(angle),
                                             radius[2] * math.cos(theta))))
        bottom = len(vertices)
        vertices.append(c - Vector((0, 0, radius[2])))
        faces = [(0, 1 + j, 1 + (j + 1) % segments) for j in range(segments)]
        for ring in range(rings - 2):
            a, b = 1 + ring * segments, 1 + (ring + 1) * segments
            for j in range(segments):
                k = (j + 1) % segments
                faces.append((a + j, b + j, b + k, a + k))
        a = 1 + (rings - 2) * segments
        faces.extend((a + j, bottom, a + (j + 1) % segments) for j in range(segments))
        self.part(vertices, faces, material, transform=transform)

    def profile(self, rings, material=0, segments=20, transform=None):
        # Each ring supplies z, half-width, half-depth and fore/aft centre.
        vertices = [(rx * math.cos(j * math.tau / segments),
                     cy + ry * math.sin(j * math.tau / segments), z)
                    for z, rx, ry, cy in rings for j in range(segments)]
        faces = []
        for ring in range(len(rings) - 1):
            for j in range(segments):
                a, b = ring * segments, (ring + 1) * segments
                k = (j + 1) % segments
                faces.append((a + j, a + k, b + k, b + j))
        faces += [tuple(reversed(range(segments))),
                  tuple((len(rings) - 1) * segments + j for j in range(segments))]
        self.part(vertices, faces, material, transform=transform)

    def tube(self, controls, radius, material=0, sides=8, steps=2, transform=None):
        controls = list(map(Vector, controls))
        points = []
        # Catmull-Rom gives a soft tail curve without subdivision modifiers.
        for i in range(len(controls) - 1):
            a, b = controls[max(0, i - 1)], controls[i]
            c, d = controls[i + 1], controls[min(len(controls) - 1, i + 2)]
            for j in range(steps):
                t = j / steps
                points.append(.5 * ((2 * b) + (-a + c) * t
                                     + (2 * a - 5 * b + 4 * c - d) * t * t
                                     + (-a + 3 * b - 3 * c + d) * t * t * t))
        points.append(controls[-1])
        vertices = []
        for i, point in enumerate(points):
            tangent = points[min(i + 1, len(points) - 1)] - points[max(0, i - 1)]
            q = tangent.to_track_quat('Z', 'Y')
            t = i / (len(points) - 1)
            r = radius(t) if callable(radius) else radius
            for j in range(sides):
                angle = j * math.tau / sides
                vertices.append(point + q @ Vector((r * math.cos(angle), r * math.sin(angle), 0)))
        faces = [(i * sides + j, i * sides + (j + 1) % sides,
                  (i + 1) * sides + (j + 1) % sides, (i + 1) * sides + j)
                 for i in range(len(points) - 1) for j in range(sides)]
        faces += [tuple(reversed(range(sides))),
                  tuple((len(points) - 1) * sides + j for j in range(sides))]
        self.part(vertices, faces, material, transform=transform)

    def ear(self, x, z, transform):
        side = -1 if x < 0 else 1
        # Closed ears with real thickness and inset coloured front faces.
        front = [Vector((x - .070, .030, z)), Vector((x + .065, .030, z)),
                 Vector((x + side * .030, .035, z + .205))]
        rear = [v + Vector((0, -.075, -.012)) for v in front]
        middle = sum(front, Vector()) / 3
        inset = [middle + (v - middle) * .64 + Vector((0, .002, 0)) for v in front]
        vertices = front + rear + inset
        self.part(vertices, [(0, 3, 4, 1), (1, 4, 5, 2), (2, 5, 3, 0),
                             (3, 5, 4), (0, 1, 7, 6), (1, 2, 8, 7), (2, 0, 6, 8), (6, 7, 8)],
                  0, smooth=False, transform=transform)
        self.materials[-1] = 3

    def head(self, center, yaw=0, roll=0, asleep=False):
        transform = (Matrix.Translation(Vector(center)) @ Matrix.Rotation(yaw, 4, 'Z')
                     @ Matrix.Rotation(roll, 4, 'Y'))
        # Broad feline cheeks, a short jaw and a flatter crown; no spherical head.
        self.profile([(-.140, .068, .062, .042), (-.115, .112, .092, .018),
                      (-.060, .175, .120, .000), (.015, .184, .126, -.004),
                      (.085, .155, .109, -.010), (.135, .105, .071, -.017),
                      (.155, .040, .030, -.021)], 0, segments=20, transform=transform)
        for side in [-1, 1]:
            self.ear(side * .113, .090, transform)
            self.ellipsoid((side * .050, .127, -.068), (.063, .043, .045), 1,
                           segments=12, rings=6, transform=transform)
            if asleep:
                self.tube([(side * .120, .125, .020), (side * .088, .141, .009),
                           (side * .055, .143, .021)], .005, 5, sides=5, steps=2,
                          transform=transform)
            else:
                self.ellipsoid((side * .085, .122, .023), (.047, .024, .031), 4,
                               segments=12, rings=6, transform=transform)
                self.ellipsoid((side * .085, .143, .025), (.009, .005, .025), 5,
                               segments=8, rings=4, transform=transform)
                self.ellipsoid((side * .075, .148, .034), (.007, .003, .007), 6,
                               segments=6, rings=4, transform=transform)
                self.tube([(side * .129, .124, .033), (side * .088, .144, .049),
                           (side * .049, .133, .036)], .005, 2, sides=5, steps=2,
                          transform=transform)
            for j in range(2):
                self.tube([(side * .072, .162, -.062 - j * .015),
                           (side * .153, .184, -.040 - j * .023),
                           (side * .221, .173, -.032 - j * .027)],
                          lambda t: .0027 * (1 - .65 * t), 6, sides=4, steps=1,
                          transform=transform)
        self.part([(-.025, .159, -.036), (.025, .159, -.036), (0, .182, -.061),
                   (0, .153, -.041)], [(0, 1, 2), (0, 3, 1), (0, 2, 3), (1, 3, 2)],
                  3, smooth=False, transform=transform)
        self.tube([(0, .169, -.063), (0, .172, -.088), (-.023, .164, -.097)],
                  .0035, 5, sides=5, steps=1, transform=transform)
        self.tube([(0, .172, -.088), (.023, .164, -.097)],
                  .0035, 5, sides=5, steps=1, transform=transform)

    def paw(self, x, y, z=.064, scale=1):
        self.ellipsoid((x, y, z), (.073 * scale, .103 * scale, .064 * scale),
                       1, segments=12, rings=6)
        for dx in [-.026, .018]:
            self.tube([(x + dx * scale, y + .069 * scale, z + .041 * scale),
                       (x + dx * scale, y + .095 * scale, z + .024 * scale)],
                      .0024 * scale, 2, sides=4, steps=1)

    def mesh(self, name, palette):
        mesh = bpy.data.meshes.get(name) or bpy.data.meshes.new(name)
        mesh.clear_geometry()
        mesh.from_pydata(self.vertices, [], self.faces)
        mesh.materials.clear()
        for mat in palette:
            mesh.materials.append(mat)
        for polygon, material, smooth in zip(mesh.polygons, self.materials, self.smooth):
            polygon.material_index = material
            polygon.use_smooth = smooth
        bm = bmesh.new()
        bm.from_mesh(mesh)
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
        bm.to_mesh(mesh)
        bm.free()
        mesh.update()
        mesh.calc_loop_triangles()
        assert len(mesh.loop_triangles) <= 5000, (name, len(mesh.loop_triangles))
        mesh['pose_library'] = 'Three closed, reusable cat silhouettes; no modifiers'
        return mesh


def _sitting():
    k = _CatMesh()
    def coat(point):
        if point.y > .11 and .30 < point.z < .72:
            return 1
        return 2 if point.y < -.145 and .28 < point.z < .52 else 0
    k.profile([(.035, .150, .143, -.035), (.120, .206, .172, -.049),
               (.280, .209, .180, -.051), (.430, .178, .159, -.025),
               (.600, .143, .117, .015), (.730, .114, .096, .035),
               (.790, .086, .077, .042)], coat, segments=24)
    for side in [-1, 1]:
        k.ellipsoid((side * .161, -.064, .158), (.109, .140, .159), 0, segments=14, rings=7)
        k.tube([(side * .101, .073, .596), (side * .105, .125, .360),
                (side * .108, .150, .089)], lambda t: .050 - .016 * t, 0, sides=10, steps=2)
        k.paw(side * .105, .163)
    k.head((0, .044, .824), yaw=-.12, roll=.055)
    k.tube([(.155, -.139, .152), (.263, -.172, .084), (.300, -.231, .017),
            (.278, -.294, -.167), (.257, -.301, -.331), (.327, -.297, -.414),
            (.412, -.263, -.367)], lambda t: .052 * (1 - .78 * t), 0, sides=10, steps=3)
    return k


def _loaf():
    k = _CatMesh()
    def coat(point):
        # Repeated flank stripes use material indices, without overlay surfaces.
        return 2 if point.z > .20 and point.y < .015 and int((point.x + .5) * 21) % 4 == 0 else 0
    k.ellipsoid((-.064, -.025, .238), (.328, .192, .232), coat, segments=24, rings=10)
    k.ellipsoid((-.285, -.017, .157), (.105, .148, .145), 0, segments=14, rings=7)
    k.ellipsoid((.182, .004, .340), (.115, .108, .183), 0, segments=14, rings=7)
    k.paw(.108, .139, .054, .82)
    k.paw(.258, .139, .054, .82)
    k.head((.213, .026, .525), yaw=.24, roll=-.07)
    k.tube([(-.314, -.120, .195), (-.398, -.159, .104), (-.363, -.235, .068),
            (-.183, -.253, .067), (.048, -.237, .067), (.191, -.169, .070)],
           lambda t: .047 * (1 - .73 * t), 2, sides=10, steps=3)
    return k


def _sleeping():
    k = _CatMesh()
    def coat(point):
        return 2 if point.x < -.11 and point.z > .25 else 0
    k.ellipsoid((-.052, -.037, .215), (.313, .212, .204), coat, segments=24, rings=10)
    k.ellipsoid((-.229, .016, .159), (.145, .161, .145), 0, segments=14, rings=7)
    k.paw(.215, .171, .056, .75)
    k.paw(.076, .179, .056, .72)
    k.head((.185, .058, .253), yaw=-.30, roll=.13, asleep=True)
    k.tube([(-.283, -.131, .164), (-.380, -.121, .103), (-.400, .020, .073),
            (-.314, .174, .069), (-.139, .227, .071), (.015, .239, .078),
            (.117, .193, .087)], lambda t: .064 * (1 - .78 * t), 0, sides=10, steps=3)
    return k


def refine_cats():
    scene = bpy.context.scene
    names = ['Tuxedo', 'Ginger', 'Silver', 'Cream', 'Charcoal']
    objects = [scene.objects.get('M04_WindowCat_' + name) for name in names]
    assert all(obj is not None and obj.type == 'MESH' for obj in objects), 'Expected the five v04 window cats'
    pink = _material('Ear_Nose_Rose', (.43, .20, .19))
    iris = _material('Amber_Iris', (.48, .42, .105), .34)
    dark = _material('Pupils_Mouth', (.012, .015, .016), .55)
    highlight = _material('Whiskers_Highlights', (.79, .76, .66), .55)
    colors = [
        ((.035, .043, .050), (.73, .73, .66), (.020, .025, .031)),
        ((.48, .205, .062), (.70, .49, .25), (.25, .080, .028)),
        ((.34, .37, .39), (.65, .66, .62), (.15, .18, .20)),
        ((.70, .56, .37), (.79, .72, .59), (.39, .25, .14)),
        ((.090, .107, .125), (.20, .23, .25), (.035, .046, .061)),
    ]
    palettes = [[_material(name + '_Coat', colors[i][0]),
                 _material(name + '_Bib_Paws', colors[i][1]),
                 _material(name + '_Markings', colors[i][2]), pink, iris, dark, highlight]
                for i, name in enumerate(names)]
    builders = {'Sitting': _sitting, 'Loaf': _loaf, 'Sleeping': _sleeping}
    meshes = {pose: builder().mesh('M08_Cat_' + pose + '_SHARED', palettes[0])
              for pose, builder in builders.items()}
    assignments = ['Sitting', 'Loaf', 'Sitting', 'Sleeping', 'Loaf']
    report = []
    for obj, pose, palette in zip(objects, assignments, palettes):
        obj.data = meshes[pose]
        for slot, mat in zip(obj.material_slots, palette):
            slot.link = 'OBJECT'
            slot.material = mat
        obj['shared_pose'] = pose.lower()
        obj['revision'] = 'v08: anatomical silhouette, inset ears, face, paws and tapered tail'
        report.append({'object': obj.name, 'pose': pose, 'triangles': len(obj.data.loop_triangles)})
    bpy.context.view_layer.update()
    return {'cats': report, 'unique_pose_meshes': len(meshes),
            'unique_pose_triangles': sum(len(mesh.loop_triangles) for mesh in meshes.values()),
            'transforms_preserved': True, 'sills_preserved': True}
