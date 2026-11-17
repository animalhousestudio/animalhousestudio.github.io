"""Build the Casa3D shark source with Blender 5.2."""

import hashlib
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


PACKAGE = Path(__file__).resolve().parent
SIDES = 36
BODY_STEPS = 52
WATERLINE = 0.70
ORIGIN_FROM_NOSE = 1.35
PROFILE = [
    # Distance aft of the snout, half-width, vertical radius, center height.
    (0.00, 0.000, 0.000, 0.010),
    (0.06, 0.115, 0.052, 0.005),
    (0.15, 0.183, 0.104, -0.010),
    (0.30, 0.245, 0.183, -0.018),
    (0.48, 0.288, 0.251, -0.009),
    (0.66, 0.320, 0.296, 0.008),
    (0.90, 0.354, 0.340, 0.013),
    (1.14, 0.372, 0.365, 0.012),
    (1.40, 0.359, 0.349, 0.004),
    (1.63, 0.326, 0.307, -0.008),
    (1.88, 0.268, 0.244, -0.018),
    (2.10, 0.194, 0.182, -0.024),
    (2.31, 0.130, 0.124, -0.027),
    (2.49, 0.089, 0.078, -0.024),
    (2.66, 0.062, 0.052, -0.013),
    (2.83, 0.057, 0.061, -0.008),
    (2.95, 0.000, 0.000, 0.000),
]
SLATE = (0.075, 0.115, 0.145)
FLANK = (0.215, 0.278, 0.304)
IVORY = (0.68, 0.72, 0.70)
GILL = (0.029, 0.046, 0.052)


def mix(a, b, t):
    return tuple(x + (y - x) * t for x, y in zip(a, b))


def smoothstep(low, high, value):
    t = min(1, max(0, (value - low) / (high - low)))
    return t * t * (3 - 2 * t)


def interpolate(rows, position):
    for i, (a, b) in enumerate(zip(rows, rows[1:])):
        if position <= b[0]:
            break
    before = rows[max(0, i - 1)]
    after = rows[min(len(rows) - 1, i + 2)]
    span = b[0] - a[0]
    t = (position - a[0]) / span
    return [
        (2*t**3 - 3*t*t + 1) * start + (-2*t**3 + 3*t*t) * end
        + (t**3 - 2*t*t + t) * span * (end - prev) / (b[0] - before[0])
        + (t**3 - t*t) * span * (nxt - start) / (after[0] - a[0])
        for prev, start, end, nxt in zip(before[1:], a[1:], b[1:], after[1:])
    ]


def body_point(s, angle, offset=0):
    width, radius, z = interpolate(PROFILE, s)
    return ((width + offset) * math.sin(angle), s - ORIGIN_FROM_NOSE,
            z + (radius + offset) * math.cos(angle))


def skin(s, angle):
    height = math.cos(angle)
    transition = -0.27 + 0.065 * math.sin(s * 3.8)
    grey = mix(FLANK, SLATE, smoothstep(-0.26, 0.87, height))
    color = mix(grey, IVORY, 1 - smoothstep(transition - 0.12, transition + 0.10, height))
    mottling = 1 + 0.045 * math.sin(s * 22 + angle * 4) * math.sin(s * 35 - angle * 9)
    return tuple(channel * mottling for channel in color)


class Surface:
    def __init__(self):
        self.vertices = []
        self.faces = []
        self.colors = []
        self.parts = {}

    def add(self, name, points, faces, colors, closed=True):
        if closed:
            vectors = [Vector(point) for point in points]
            volume = sum(vectors[a].dot(vectors[b].cross(vectors[c]))
                         for a, *rim in faces for b, c in zip(rim, rim[1:]))
            if volume < 0:
                faces = [tuple(reversed(face)) for face in faces]
        first = len(self.vertices)
        self.vertices.extend(points)
        self.faces.extend(tuple(first + index for index in face) for face in faces)
        self.colors.extend(colors)
        self.parts[name] = list(range(first, len(self.vertices)))


def loft(surface, name, start, end, rings):
    sides = len(rings[0])
    points = [start] + [p for ring in rings for p in ring] + [end]
    faces = []
    for k in range(sides):
        next_k = (k + 1) % sides
        faces.append((0, 1 + k, 1 + next_k))
        for r in range(len(rings) - 1):
            a = 1 + r * sides
            b = a + sides
            faces.append((a + k, b + k, b + next_k, a + next_k))
        tail = len(points) - 1
        faces.append((tail, tail - sides + next_k, tail - sides + k))
    surface.add(name, [p for p, _ in points], faces, [color for _, color in points])


def make_body(surface):
    rings = []
    for index in range(1, BODY_STEPS):
        s = PROFILE[-1][0] * index / BODY_STEPS
        rings.append([(body_point(s, a), skin(s, a))
                      for a in (math.tau * k / SIDES for k in range(SIDES))])
    loft(surface, "Corpo", (body_point(0, 0), skin(0, 1.6)),
         (body_point(PROFILE[-1][0], 0), SLATE), rings)


def make_fin(surface, name, rows, horizontal=False, side=1, steps=17):
    def section(span, angle):
        values = interpolate(rows, span)
        center, leading, trailing, width = values if horizontal else (0, *values)
        s = leading + (trailing - leading) * (1 - math.cos(angle)) / 2
        thickness = width * math.sin(angle) * (0.82 + 0.18 * math.cos(angle))
        if horizontal:
            point = (span * side, s - ORIGIN_FROM_NOSE, center + thickness)
            color = mix((0.43, 0.48, 0.49), SLATE, smoothstep(-0.1, 0.78, math.sin(angle)))
        else:
            point = (center + thickness, s - ORIGIN_FROM_NOSE, span)
            color = mix(FLANK, SLATE, smoothstep(-0.14, 0.50, span))
        edge = smoothstep(0.66, 1, -math.cos(angle))
        color = mix(color, (0.048, 0.076, 0.096), edge * 0.47)
        return point, color

    low, high = rows[0][0], rows[-1][0]
    rings = [[section(low + (high - low) * i / steps, k * math.tau / 16)
              for k in range(16)] for i in range(1, steps)]
    def cap(span):
        front, color = section(span, 0)
        back, _ = section(span, math.pi)
        return mix(front, back, 0.5), color

    loft(surface, name, cap(low), cap(high), rings)


def make_marks(surface):
    def ribbon(name, samples, half_width, color, right):
        points, colors, faces = [], [], []
        for i, (s, angle) in enumerate(samples):
            tip = math.sin(math.pi * i / (len(samples) - 1)) ** 0.65
            width = half_width * (0.12 + 0.88 * tip)
            for shift in (-1, 0, 1):
                points.append(body_point(s + shift * width, angle, 0.0025))
                colors.append(color if shift == 0 else skin(s, angle))
        for i in range(len(samples) - 1):
            for j in range(2):
                a = i * 3 + j
                face = (a, a + 1, a + 4, a + 3)
                faces.append(face if right else tuple(reversed(face)))
        surface.add(name, points, faces, colors, closed=False)

    for side in (-1, 1):
        # Recessed-looking eyelid colored into the flank, with a convex black eye.
        for name, depth, length, height, inset, color in [
            ("Contorno occhio", 0.015, 0.061, 0.050, 0.004, (0.055, 0.089, 0.103)),
            ("Occhio", 0.021, 0.042, 0.032, 0.001, (0.003, 0.007, 0.010)),
        ]:
            _, _, base_z = body_point(0.44, side * 1.28)

            def eye_point(latitude, angle):
                shell = math.sin(latitude)
                y = 0.44 - ORIGIN_FROM_NOSE + length * shell * math.cos(angle)
                z = base_z + height * shell * math.sin(angle)
                width, radius, center_z = interpolate(PROFILE, y + ORIGIN_FROM_NOSE)
                flank = width * math.sqrt(1 - ((z - center_z) / radius) ** 2)
                x = side * (flank - inset + depth * math.cos(latitude))
                tone = mix(color, (0.025, 0.044, 0.058),
                           max(0, math.sin(angle) * shell) ** 6 * 0.22)
                return (x, y, z), tone

            rings = [[eye_point(math.pi * j / 8, math.tau * k / 16)
                      for k in range(16)] for j in range(1, 8)]
            loft(surface, name + str(side), eye_point(0, 0), eye_point(math.pi, 0), rings)

        for gill in range(5):
            samples = []
            for i in range(15):
                t = i / 14
                angle = side * (1.15 + 1.23 * t + 0.041 * gill)
                s = 0.743 + 0.052 * gill + 0.050 * math.sin(math.pi * t) - 0.036 * t
                samples.append((s, angle))
            ribbon(f"Branchia {side} {gill + 1}", samples, 0.014 - 0.0009 * gill, GILL, side < 0)
        samples = [(0.315 + 0.365 * (i / 32)**1.62, side * (math.pi - 1.14 * i / 32))
                   for i in range(33)]
        ribbon(f"Bocca {side}", samples, 0.020, (0.065, 0.047, 0.050), side > 0)


def make_shark(collection):
    surface = Surface()
    make_body(surface)
    make_fin(surface, "Dorsale", [
        (0.15, 1.01, 1.88, 0.102), (0.36, 1.075, 1.85, 0.088),
        (0.46, 1.15, 1.73, 0.066), (0.57, 1.22, 1.68, 0.053),
        (0.70, 1.32, 1.65, 0.036), (0.82, 1.44, 1.66, 0.026),
        (0.92, 1.54, 1.68, 0.016), (0.98, 1.64, 1.69, 0.006),
        (0.992, 1.69, 1.69, 0.0),
    ])
    make_fin(surface, "Seconda dorsale", [
        (0.022, 2.28, 2.67, 0.039), (0.15, 2.34, 2.62, 0.033),
        (0.20, 2.41, 2.57, 0.021), (0.25, 2.50, 2.56, 0.009),
        (0.268, 2.55, 2.55, 0.0),
    ], steps=12)
    make_fin(surface, "Caudale", [
        (-0.55, 3.24, 3.24, 0.0), (-0.53, 3.17, 3.25, 0.009),
        (-0.44, 3.06, 3.22, 0.023), (-0.30, 2.94, 3.16, 0.038),
        (-0.16, 2.83, 3.09, 0.049), (0.00, 2.72, 3.07, 0.055),
        (0.14, 2.79, 3.13, 0.045), (0.34, 2.93, 3.23, 0.036),
        (0.52, 3.07, 3.36, 0.025), (0.62, 3.24, 3.43, 0.013),
        (0.655, 3.38, 3.43, 0.004), (0.66, 3.43, 3.43, 0.0),
    ], steps=28)
    make_fin(surface, "Anale", [
        (-0.26, 2.44, 2.44, 0.0), (-0.23, 2.37, 2.47, 0.013),
        (-0.16, 2.27, 2.54, 0.028), (-0.075, 2.20, 2.57, 0.046),
    ], steps=10)
    for side in (-1, 1):
        make_fin(surface, f"Pettorale {side}", [
            (0.19, -0.19, 0.87, 1.58, 0.085), (0.32, -0.19, 0.94, 1.65, 0.067),
            (0.48, -0.25, 1.08, 1.65, 0.052), (0.65, -0.31, 1.23, 1.65, 0.039),
            (0.81, -0.38, 1.39, 1.71, 0.025), (0.98, -0.445, 1.59, 1.79, 0.011),
            (1.08, -0.49, 1.78, 1.78, 0.0),
        ], horizontal=True, side=side)
        make_fin(surface, f"Pelvica {side}", [
            (0.10, -0.18, 1.89, 2.36, 0.044), (0.19, -0.20, 1.96, 2.38, 0.035),
            (0.29, -0.24, 2.09, 2.40, 0.022), (0.38, -0.30, 2.37, 2.37, 0.0),
        ], horizontal=True, side=side, steps=12)
    make_marks(surface)
    mesh = bpy.data.meshes.new("Squalo | superficie")
    mesh.from_pydata(surface.vertices, [], surface.faces)
    mesh.update()
    if mesh.validate():
        raise ValueError("Invalid shark mesh")
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    colors = mesh.color_attributes.new(name="Livrea", type='FLOAT_COLOR', domain='POINT')
    colors.data.foreach_set("color", [value for rgb in surface.colors for value in (*rgb, 1)])
    shark = bpy.data.objects.new("Squalo | mesh", mesh)
    collection.objects.link(shark)
    for name, indices in surface.parts.items():
        shark.vertex_groups.new(name=name).add(indices, 1, 'REPLACE')
    material = bpy.data.materials.new("Squalo | livrea")
    material.use_nodes = True
    nodes = material.node_tree.nodes
    pigment = nodes.new("ShaderNodeVertexColor")
    pigment.layer_name = colors.name
    bsdf = nodes.get("Principled BSDF")
    bsdf.inputs["Roughness"].default_value = 0.39
    material.node_tree.links.new(pigment.outputs["Color"], bsdf.inputs["Base Color"])
    mesh.materials.append(material)
    return shark, surface.parts


def new_camera(collection, name, location, target, lens):
    data = bpy.data.cameras.new(name)
    data.lens = lens
    camera = bpy.data.objects.new(name, data)
    collection.objects.link(camera)
    camera.location = location
    camera.rotation_euler = (Vector(target) - camera.location).to_track_quat('-Z', 'Y').to_euler()
    return camera


def studio_light(collection, name, location, energy, size, color):
    data = bpy.data.lights.new(name, 'AREA')
    data.energy, data.shape, data.size, data.color = energy, 'DISK', size, color
    light = bpy.data.objects.new(name, data)
    collection.objects.link(light)
    light.location = location
    light.rotation_euler = (-light.location).to_track_quat('-Z', 'Y').to_euler()


def add_surface_preview(collection):
    mesh = bpy.data.meshes.new("Piano acqua | studio")
    mesh.from_pydata([(-100, -100, WATERLINE), (100, -100, WATERLINE),
                      (100, 100, WATERLINE), (-100, 100, WATERLINE)], [], [(0, 1, 2, 3)])
    water = bpy.data.objects.new("Piano acqua | studio", mesh)
    collection.objects.link(water)
    material = bpy.data.materials.new("Acqua scura | studio")
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    bsdf = nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (0.017, 0.115, 0.137, 1)
    bsdf.inputs["Roughness"].default_value = 0.28
    coords = nodes.new("ShaderNodeTexCoord")
    noise = nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 5
    noise.inputs["Detail"].default_value = 2
    links.new(coords.outputs["Object"], noise.inputs["Vector"])
    bump = nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.28
    bump.inputs["Distance"].default_value = 0.039
    links.new(noise.outputs["Fac"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    mesh.materials.append(material)
    return water


def build():
    scene = bpy.context.scene
    scene.name = "Squalo | Casa3D"
    scene.unit_settings.system = 'METRIC'
    scene.unit_settings.length_unit = 'METERS'
    asset = bpy.data.collections.new("Squalo | asset")
    studio = bpy.data.collections.new("Studio | anteprima")
    scene.collection.children.link(asset)
    scene.collection.children.link(studio)
    shark, parts = make_shark(asset)
    shark["forward"] = "-Y"
    shark["waterline_z"] = WATERLINE
    scene.camera = new_camera(studio, "Camera | squalo intero",
                              (5.0, -2.85, 2.00), (0, 0.26, 0.15), 51)
    fin_camera = new_camera(studio, "Camera | pinna in superficie",
                            (2.8, -1.35, 1.60), (0, 0.25, 0.79), 65)
    studio_light(studio, "Luce | superficie", (0, -1, 4), 620, 4, (0.80, 0.90, 1))
    studio_light(studio, "Luce | muso", (4, -4, 1), 265, 3.5, (1, 0.93, 0.80))
    studio_light(studio, "Luce | controluce", (-3, 4, 2), 500, 3, (0.51, 0.75, 1))
    water = add_surface_preview(studio)
    water.hide_set(True)
    water.hide_render = True
    scene.world = bpy.data.worlds.new("Studio | blu profondo")
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.042, 0.076, 0.105, 1)
    background.inputs["Strength"].default_value = 0.48
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 20
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 1000
    scene.render.resolution_y = 620
    scene.render.resolution_percentage = 100
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type != 'VIEW_3D':
                continue
            space = area.spaces.active
            space.overlay.show_overlays = False
            space.shading.color_type = 'VERTEX'
            space.shading.studiolight_rotate_z = 0
            space.region_3d.view_location = (0, 0.26, 0.12)
            space.region_3d.view_distance = 4.1
            space.region_3d.view_perspective = 'ORTHO'
            space.region_3d.view_rotation = Vector((5.0, -2.85, 1.55)).to_track_quat('Z', 'Y')
    bpy.context.view_layer.objects.active = shark
    shark.select_set(True)
    bpy.context.view_layer.update()
    mesh = shark.data
    mesh.calc_loop_triangles()
    part_z = {name: max(mesh.vertices[i].co.z for i in ids) for name, ids in parts.items()}
    assert {name for name, z in part_z.items() if z > WATERLINE} == {"Dorsale"}
    assert min(triangle.area for triangle in mesh.loop_triangles) > 0
    report = {
        "mesh": shark.name,
        "triangles": len(mesh.loop_triangles),
        "vertices": len(mesh.vertices),
        "materials": len(mesh.materials),
        "textures": 0,
        "dimensions_m": [round(value, 4) for value in shark.dimensions],
        "waterline_z_m": WATERLINE,
        "dorsal_above_water_m": round(part_z["Dorsale"] - WATERLINE, 4),
        "next_highest_part_z_m": round(max(z for name, z in part_z.items() if name != "Dorsale"), 4),
    }
    return scene, fin_camera, water, report


if __name__ == "__main__":
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene, fin_camera, water, report = build()
    path = PACKAGE / "Squalo.blend"
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(path), compress=True)
    report["sha256"] = hashlib.sha256(path.read_bytes()).hexdigest()
    (PACKAGE / "verification.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    if "--stills" in sys.argv:
        scene.render.filepath = str(PACKAGE / "squalo.png")
        bpy.ops.render.render(write_still=True)
        scene.camera = fin_camera
        water.hide_render = False
        scene.render.filepath = str(PACKAGE / "pinna.png")
        bpy.ops.render.render(write_still=True)
