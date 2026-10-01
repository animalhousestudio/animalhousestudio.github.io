"""Editable hand props for the player authoring scene; no runtime exports.

Nominal coordinates are metres, Z up, character front -Y, anatomical left +X.
``build_props(collection, logo_path)`` never resets, saves, or renders the scene.
The caller owns character-scale conversion and attachment to its rig.
"""

import math
from pathlib import Path

import bpy
from mathutils import Vector


def _material(name, color, roughness=0.4, coat=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.diffuse_color = (*color, 1)
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Roughness"].default_value = roughness
    if "Coat Weight" in shader.inputs:
        shader.inputs["Coat Weight"].default_value = coat
        shader.inputs["Coat Roughness"].default_value = 0.2
    return mat


def _mesh(collection, name, vertices, faces, material, smooth=True):
    mesh = bpy.data.meshes.new(name + "_mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj.data.materials.append(material)
    for polygon in mesh.polygons:
        polygon.use_smooth = smooth
    return obj


def _lathe(collection, name, center, profile, material, segments=64):
    """Revolve a bottom-outside-top-inside profile, with single-vertex poles.

    Ordering a closed cup cross-section this way produces outward-facing outer
    walls, inward-facing cavity walls and a real, closed bottom thickness.
    """
    vertices, rings, faces = [], [], []
    cx, cy = center
    for radius, z in profile:
        ring = []
        if radius < 1e-8:
            ring.append(len(vertices))
            vertices.append((cx, cy, z))
        else:
            for j in range(segments):
                angle = 2 * math.pi * j / segments
                ring.append(len(vertices))
                vertices.append((cx + radius * math.cos(angle),
                                 cy + radius * math.sin(angle), z))
        rings.append(ring)
    for lower, upper in zip(rings[:-1], rings[1:]):
        for j in range(segments):
            n = (j + 1) % segments
            if len(lower) == 1:
                faces.append((lower[0], upper[n], upper[j]))
            elif len(upper) == 1:
                faces.append((lower[j], lower[n], upper[0]))
            else:
                faces.append((lower[j], lower[n], upper[n], upper[j]))
    return _mesh(collection, name, vertices, faces, material)


def _bezier(a, b, c, d, t):
    return (1-t)**3 * a + 3*(1-t)**2*t*b + 3*(1-t)*t*t*c + t**3*d


def _handle(collection, material):
    """Rounded ceramic D handle with both end caps buried inside the cup wall."""
    y = -.465
    sections = [
        [(-.207, 1.416), (-.227, 1.426), (-.271, 1.428), (-.278, 1.412)],
        [(-.278, 1.412), (-.282, 1.404), (-.282, 1.372), (-.274, 1.361)],
        [(-.274, 1.361), (-.264, 1.348), (-.231, 1.346), (-.207, 1.353)],
    ]
    path = []
    for index, section in enumerate(sections):
        points = [Vector((x, y, z)) for x, z in section]
        for j in range(13):
            if index and j == 0:
                continue
            path.append(_bezier(*points, j / 12))
    vertices, faces = [], []
    count, sides, radius = len(path), 12, .0055
    across = Vector((0, 1, 0))
    for i, point in enumerate(path):
        tangent = (path[min(i + 1, count - 1)] - path[max(i - 1, 0)]).normalized()
        inward = tangent.cross(across).normalized()
        for j in range(sides):
            a = 2 * math.pi * j / sides
            vertices.append(point + radius * (math.cos(a)*across + math.sin(a)*inward))
    for i in range(count - 1):
        for j in range(sides):
            n = (j + 1) % sides
            faces.append((i*sides + j, i*sides + n,
                          (i+1)*sides + n, (i+1)*sides + j))
    faces.extend([tuple(reversed(range(sides))),
                  tuple((count-1)*sides+j for j in range(sides))])
    handle = _mesh(collection, "PROP_R_Mug_Handle", vertices, faces, material)
    handle["construction"] = "Rounded ceramic handle; ends overlap the cup wall."
    return handle


def _mug_radius(z):
    # The lettering follows the taper of the actual straight upper body.
    t = max(0, min(1, (z - 1.340) / (1.438 - 1.340)))
    return .044 + t * (.054 - .044)


def _mug_label(collection, white, front=True):
    """Convert editable text to a curved mesh, readable from its own side."""
    curve = bpy.data.curves.new("LAB_type_source", "FONT")
    curve.body = "LAB"
    curve.align_x = "CENTER"
    curve.align_y = "CENTER"
    curve.size = .033
    curve.space_character = 1.12
    curve.extrude = .00012
    curve.bevel_depth = .000045
    curve.bevel_resolution = 1
    curve.resolution_u = 6
    font_path = Path("C:/Windows/Fonts/arialbd.ttf")
    if font_path.is_file():
        curve.font = bpy.data.fonts.load(str(font_path), check_existing=True)
    source = bpy.data.objects.new("LAB_type_source", curve)
    collection.objects.link(source)
    bpy.context.view_layer.update()
    depsgraph = bpy.context.evaluated_depsgraph_get()
    mesh = bpy.data.meshes.new_from_object(source.evaluated_get(depsgraph),
                                         depsgraph=depsgraph)
    name = "PROP_R_Mug_LAB_" + ("Front" if front else "Back")
    mesh.name = name + "_mesh"
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    mesh.materials.append(white)
    # Find the text's actual centre rather than relying on font baseline metrics.
    min_x = min(v.co.x for v in mesh.vertices)
    max_x = max(v.co.x for v in mesh.vertices)
    min_y = min(v.co.y for v in mesh.vertices)
    max_y = max(v.co.y for v in mesh.vertices)
    middle_x, middle_y = (min_x+max_x)/2, (min_y+max_y)/2
    for vertex in mesh.vertices:
        s = vertex.co.x - middle_x
        z = 1.387 + vertex.co.y - middle_y
        radius = _mug_radius(z) + .00030 + vertex.co.z
        angle = s / _mug_radius(z)
        direction = 1 if front else -1
        vertex.co = (-.16 + direction * radius*math.sin(angle),
                     -.465 - direction * radius*math.cos(angle), z)
    mesh.update()
    obj["label_text"] = "LAB"
    obj["label_side"] = "-Y / outward" if front else "+Y / player"
    obj["construction"] = "White lettering fitted to mug taper; original text LAB."
    bpy.data.objects.remove(source, do_unlink=True)
    bpy.data.curves.remove(curve)
    return obj


def _logo_material(logo_path):
    image = bpy.data.images.load(str(Path(logo_path)), check_existing=True)
    image.name = "AnimalHouse_Original_Logo_PACKED"
    image.pack()
    mat = _material("Prop | Original Animal House logo", (.95, .28, .04), .26, .38)
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    shader = nodes.get("Principled BSDF")
    texture = nodes.new("ShaderNodeTexImage")
    texture.name = "Original supplied logo — unchanged and packed"
    texture.image = image
    texture.extension = "CLIP"
    texture.interpolation = "Linear"
    texture.location = (-550, 50)
    mix = nodes.new("ShaderNodeMixRGB")
    mix.blend_type = "MIX"
    mix.inputs[1].default_value = (1.0, .22, .035, 1)
    mix.location = (-270, 70)
    links.new(texture.outputs["Alpha"], mix.inputs[0])
    links.new(texture.outputs["Color"], mix.inputs[2])
    links.new(mix.outputs[0], shader.inputs["Base Color"])
    return mat, image


def _lollipop_face(collection, material, image, front):
    segments, radius = 96, .0707
    cx, cy, cz = .275, -.48, 1.60
    face_y = cy + (-.00612 if front else .00612)
    vertices = [(cx, face_y, cz)]
    for j in range(segments):
        a = j * 2*math.pi/segments
        vertices.append((cx + radius*math.cos(a), face_y, cz + radius*math.sin(a)))
    # x/z CCW points toward -Y; reverse the rear's winding and its horizontal UV.
    faces = [(0, j+1, (j+1) % segments+1) for j in range(segments)]
    if not front:
        faces = [tuple(reversed(face)) for face in faces]
    name = "PROP_L_Lollipop_Logo_" + ("Front" if front else "Back")
    obj = _mesh(collection, name, vertices, faces, material, smooth=False)
    uv_layer = obj.data.uv_layers.new(name="Original_logo_upright")
    aspect = image.size[0] / max(1, image.size[1])
    for loop in obj.data.loops:
        co = obj.data.vertices[loop.vertex_index].co
        direction = 1 if front else -1
        # Preserve original pixel proportions. CLIP plus alpha supplies the thin
        # candy-coloured padding above and below the untouched rectangular PNG.
        u = .5 + direction*(co.x-cx)/(2*radius)
        v = .5 + (co.z-cz)*aspect/(2*radius)
        uv_layer.data[loop.index].uv = (u, v)
    obj["logo_source"] = Path(image.filepath).name
    obj["logo_orientation"] = "Upright and readable from " + ("-Y" if front else "+Y")
    return obj


def _empty(collection, name, point):
    obj = bpy.data.objects.new(name, None)
    collection.objects.link(obj)
    obj.location = point
    obj.empty_display_type = "PLAIN_AXES"
    obj.empty_display_size = .055
    obj.show_in_front = True
    return obj


def _parent_preserve(objects, root):
    bpy.context.view_layer.update()
    for obj in objects:
        world = obj.matrix_world.copy()
        obj.parent = root
        obj.matrix_world = world


def build_props(collection, logo_path):
    """Create a round logo lollipop (left) and a hollow black LAB mug (right).

    Returns ``left_root``, ``right_root``, mesh-only ``objects``, and ``metadata``.
    To resize the character, parent these roots to one common scaled master; do
    not independently multiply transforms on roots and their mesh children.
    """
    black = _material("Prop | Glazed black ceramic", (.009, .012, .016), .235, .42)
    ivory = _material("Prop | Ivory paper stick", (.82, .78, .64), .58)
    white = _material("Prop | White LAB enamel", (.94, .945, .91), .3, .18)
    candy = _material("Prop | Glossy candy rim", (.98, .17, .032), .2, .45)
    logo_mat, logo_image = _logo_material(logo_path)
    left_root = _empty(collection, "ATTACH_L_Lollipop_Grip", (.275, -.48, 1.39))
    right_root = _empty(collection, "ATTACH_R_Mug_Grip", (-.278, -.465, 1.39))
    left_root["anatomical_hand"] = "LEFT"
    right_root["anatomical_hand"] = "RIGHT"

    # A continuous closed cross-section, including rounded foot, rounded lip,
    # 3 mm rim/wall and 6 mm floor; no face spans the mouth of the cup.
    cup_profile = [
        (0, 1.325), (.037, 1.325), (.040, 1.326), (.042, 1.329),
        (.044, 1.340), (.054, 1.438), (.054, 1.443),
        (.0536, 1.4442), (.0525, 1.445), (.0514, 1.4442), (.051, 1.443),
        (.051, 1.438), (.041, 1.341), (.0398, 1.334),
        (.0378, 1.332), (.034, 1.331), (0, 1.331),
    ]
    cup = _lathe(collection, "PROP_R_Mug_HollowBody", (-.16, -.465),
                 cup_profile, black, 80)
    cup["construction"] = "Closed manifold cup wall and floor; open mouth, no drink surface."
    cup["nominal_wall_thickness_m"] = .003
    cup["nominal_base_thickness_m"] = .006
    right_objects = [cup, _handle(collection, black),
                     _mug_label(collection, white, True), _mug_label(collection, white, False)]

    stick_profile = [(0, 1.330), (.0020, 1.330), (.0025, 1.3306),
                     (.0025, 1.5595), (.0020, 1.560), (0, 1.560)]
    stick = _lathe(collection, "PROP_L_Lollipop_Stick", (.275, -.48),
                   stick_profile, ivory, 16)
    # Build a bevelled, round candy solid on the Z axis, then orient its axis Y.
    candy_profile = [(0, -.006), (.0705, -.006), (.0722, -.0052),
                     (.073, -.0033), (.073, .0033), (.0722, .0052),
                     (.0705, .006), (0, .006)]
    disk = _lathe(collection, "PROP_L_Lollipop_RoundCandy", (0, 0),
                  candy_profile, candy, 96)
    for v in disk.data.vertices:
        x, y, z = v.co
        v.co = (.275 + x, -.48 - z, 1.60 + y)
    disk.data.update()
    disk["construction"] = "Perfectly round 146 mm candy disk; no square wrapper."
    left_objects = [disk, stick,
                    _lollipop_face(collection, logo_mat, logo_image, True),
                    _lollipop_face(collection, logo_mat, logo_image, False)]
    _parent_preserve(left_objects, left_root)
    _parent_preserve(right_objects, right_root)
    objects = left_objects + right_objects
    for obj in objects:
        obj["authoring_role"] = "separate_hand_prop"
    metadata = {
        "units": "metres; nominal pre-scale coordinates",
        "front_axis": "-Y",
        "anatomical_left_axis": "+X",
        "left_prop": "round lollipop, original logo on both faces",
        "right_prop": "hollow black mug, white LAB on both faces",
        "left_grip": [.275, -.48, 1.39],
        "right_grip": [-.278, -.465, 1.39],
        "logo_packed": bool(logo_image.packed_file),
        "logo_source": str(Path(logo_path)),
        "lollipop_diameter_m": .146,
        "mug_height_m": .120,
        "mug_rim_thickness_m": .003,
        "mesh_objects": len(objects),
        "left_objects": [obj.name for obj in left_objects],
        "right_objects": [obj.name for obj in right_objects],
    }
    return {"left_root": left_root, "right_root": right_root,
            "objects": objects, "metadata": metadata}
