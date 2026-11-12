import bpy
import math
import os
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parent
COVER = ROOT / "cover-5350.jpg"
FRONT = -0.23

scene = bpy.data.scenes.new("Animale Artificiale | Monolite")
bpy.context.window.scene = scene
scene.unit_settings.system = "METRIC"
scene.view_settings.view_transform = "Standard"
scene.render.engine = "CYCLES"
scene.cycles.samples = 20
scene.cycles.use_denoising = True

def collection(name, parent):
    group = bpy.data.collections.new(name)
    parent.children.link(group)
    return group

prop = collection("ANIMALE ARTIFICIALE", scene.collection)
screen = collection("Player", prop)
studio = collection("Studio", scene.collection)

def add(name, data, group, pos=(0, 0, 0)):
    obj = bpy.data.objects.new(name, data)
    group.objects.link(obj)
    obj.location = pos
    return obj

def srgb(hex_color):
    values = [int(hex_color[i:i+2], 16) / 255 for i in (0, 2, 4)]
    return tuple(v / 12.92 if v < .04045 else ((v + .055) / 1.055) ** 2.4 for v in values) + (1,)

def material(name, color, metallic=0, roughness=.5, emissive=False):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = srgb(color)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    if emissive:
        nodes.remove(nodes.get("Principled BSDF"))
        shader = nodes.new("ShaderNodeEmission")
        shader.inputs["Color"].default_value = srgb(color)
        mat.node_tree.links.new(shader.outputs[0], nodes.get("Material Output").inputs["Surface"])
    else:
        shader = nodes.get("Principled BSDF")
        shader.inputs["Base Color"].default_value = srgb(color)
        shader.inputs["Metallic"].default_value = metallic
        shader.inputs["Roughness"].default_value = roughness
    return mat

def mesh(name, verts, faces, mat, group):
    data = bpy.data.meshes.new(name)
    data.from_pydata(verts, [], faces)
    data.update()
    obj = add(name, data, group)
    data.materials.append(mat)
    return obj

def box(name, dims, center, mat, group, bevel):
    dx, dy, dz = (d/2 for d in dims)
    verts = [(-dx,-dy,-dz),(dx,-dy,-dz),(dx,dy,-dz),(-dx,dy,-dz),
             (-dx,-dy,dz),(dx,-dy,dz),(dx,dy,dz),(-dx,dy,dz)]
    faces = [(3,2,1,0),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]
    obj = mesh(name, verts, faces, mat, group)
    obj.location = center
    if bevel:
        mod = obj.modifiers.new("Micro smusso", "BEVEL")
        mod.width, mod.segments = bevel, 3
        mod.harden_normals = True
    return obj

def shape(name, points, mat, depth=0):
    return mesh(name, [(x, FRONT-depth, z) for x,z in points],
                [tuple(range(len(points)))], mat, screen)

def rect(name, x, z, w, h, mat, depth=0):
    obj = shape(name, [(x,z),(x+w,z),(x+w,z+h),(x,z+h)], mat, depth)
    uv = obj.data.uv_layers.new()
    for loop, coord in zip(uv.uv, ((0,0),(1,0),(1,1),(0,1))):
        loop.vector = coord
    return obj

def dot(name, x, z, radius, mat, depth=.004):
    return shape(name, [(x+radius*math.cos(a*math.tau/48), z+radius*math.sin(a*math.tau/48))
                         for a in range(48)], mat, depth)

def font(name):
    return bpy.data.fonts.load(str(Path(os.environ["WINDIR"]) / "Fonts" / name), check_existing=True)

regular, bold, egyptian = font("arial.ttf"), font("arialbd.ttf"), font("seguihis.ttf")
def label(name, value, x, z, size, mat, face=regular, align="LEFT"):
    data = bpy.data.curves.new(name, "FONT")
    data.body, data.font, data.size = value, face, size
    data.align_x, data.align_y = align, "CENTER"
    data.materials.append(mat)
    obj = add(name, data, screen, (x,FRONT-.004,z))
    obj.rotation_euler.x = math.pi/2
    return obj

def tune_header(mat):
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    coordinates = nodes.new("ShaderNodeTexCoord")
    split = nodes.new("ShaderNodeSeparateXYZ")
    gradient = nodes.new("ShaderNodeValToRGB")
    low, high = gradient.color_ramp.elements
    low.color, high.color = srgb("151515"), srgb("49403B")
    links.new(coordinates.outputs["UV"], split.inputs["Vector"])
    links.new(split.outputs["Y"], gradient.inputs["Fac"])
    links.new(gradient.outputs["Color"], nodes.get("Emission").inputs["Color"])

stone = material("Nero satinato", "111215", .28, .34)
bezel = material("Bordo display", "19191D", .48, .32)
panel = material("Schermo grafite", "121212", emissive=True)
header = material("Sfondo album", "27221F", emissive=True)
tune_header(header)
stripe = material("Separatore", "303030", emissive=True)
selected = material("Traccia selezionata", "242424", emissive=True)
white = material("Testo bianco", "F4F4F4", emissive=True)
muted = material("Testo secondario", "B3B3B3", emissive=True)
green = material("Verde play", "1ED760", emissive=True)

body = box("Monolite nero", (1.12,.45,2.84), (0,0,1.419), stone, prop, .005)
body["Altezza player al centro (m)"] = 2.0
box("Cornice a filo", (.97,.009,1.49), (0,-.225,2.0), bezel, screen, .003)
rect("Display", -.465, 1.27, .93, 1.46, panel, .001)
rect("Testata album", -.465, 2.378, .93, .352, header, .002)

art = material("Fotogramma Drive | 53:50.142", "B3B3B3", emissive=True)
tex = art.node_tree.nodes.new("ShaderNodeTexImage")
tex.image = bpy.data.images.load(str(COVER), check_existing=True)
tex.image.pack()
art.node_tree.links.new(tex.outputs["Color"], art.node_tree.nodes.get("Emission").inputs["Color"])
rect("Supporto copertina quadrata", -.423, 2.414, .276, .276, panel, .003)
rect("Copertina | video massimo lago", -.423, 2.464, .276, .176, art, .004)
label("Tipo", "Album", -.116, 2.649, .035, white, bold)
title = label("Titolo album", "𓅭𓃸𓅝𓃰𓆝", -.116, 2.565, .169, white, egyptian)
title.data.space_character = 1.21
label("Artista", "ANIMALE ARTIFICIALE", -.116, 2.477, .043, white, bold)

dot("Pulsante Play", -.37, 2.313, .049, green)
shape("Triangolo Play", [(-.381,2.292),(-.381,2.334),(-.347,2.313)], panel, .005)
for x in (-.278,-.264,-.250):
    dot("Menu album", x, 2.313, .0034, muted)
label("Colonna indice", "#", -.394, 2.222, .032, muted, align="CENTER")
label("Colonna titolo", "Titolo", -.35, 2.222, .034, muted)
rect("Linea titoli", -.422, 2.196, .844, .0015, stripe, .003)

sequences = [
    "𓅭𓃸𓅝𓃰𓆝", "𓃰𓆝𓅭𓃸𓅝", "𓅝𓃰𓃸𓆝𓅭", "𓆝𓅭𓅝𓃰𓃸",
    "𓃸𓅝𓆝𓅭𓃰", "𓆝𓃸𓅭𓅝𓃰", "𓅭𓆝𓃰𓅝𓃸", "𓃰𓅭𓃸𓅝𓆝",
    "𓅝𓅭𓆝𓃸𓃰", "𓃸𓃰𓅭𓆝𓅝", "𓆝𓅝𓃰𓅭𓃸", "𓅭𓅝𓃸𓆝𓃰",
    "𓃰𓃸𓆝𓅝𓅭",
]
assert len(set(sequences)) == 13 and all(set(s) == set(title.data.body) for s in sequences)
for i, glyphs in enumerate(sequences, 1):
    z = 2.163 - (i-1)*.0615
    track_id = f"03.{i+100}"
    if i == 1:
        rect("Fondo prima traccia", -.428, z-.028, .856, .056, selected, .002)
    tint = green if i == 1 else white
    label(f"Indice {i:02}", str(i), -.394, z, .033, tint if i == 1 else muted, align="CENTER")
    label(f"Traccia {track_id}", track_id, -.35, z, .041, tint, bold)
    glyph_row = label(f"Glifi {track_id}", glyphs, -.207, z-.001, .070, tint, egyptian)
    glyph_row.data.space_character = 1.17
    for x in (.383,.394,.405):
        dot("Menu " + track_id, x, z, .0026, muted)

rect("Linea player", -.465, 1.373, .93, .0015, stripe, .003)
label("Tempo", "0:00", -.386, 1.318, .031, muted)
rect("Barra di avanzamento", -.300, 1.316, .680, .0045, stripe, .003)
dot("Inizio barra", -.300, 1.318, .006, white)

def aim(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()

def camera(name, position, target, scale):
    data = bpy.data.cameras.new(name)
    data.type, data.ortho_scale = "ORTHO", scale
    obj = add(name, data, studio, position)
    aim(obj, target)
    return obj

def light(name, pos, target, energy, size, color):
    data = bpy.data.lights.new(name, "AREA")
    data.energy, data.size, data.color = energy, size, color
    obj = add(name, data, studio, pos)
    aim(obj, target)

floor = material("Pavimento studio", "383A3C", 0, .70)
box("Pavimento di prova", (200,200,.10), (0,0,-.05), floor, studio, 0)
scene.world = bpy.data.worlds.new("Studio neutro")
scene.world.use_nodes = True
scene.world.node_tree.nodes.get("Background").inputs["Strength"].default_value = .22
light("Key morbida", (-3,-4,5), (0,0,1.5), 440, 4, (1,.89,.80))
light("Rim freddo", (2.1,1.7,4.3), (0,0,1.3), 550, 3.0, (.74,.85,1))
light("Riempimento", (3,-4,2), (0,0,1.3), 115, 3.4, (.82,.90,1))

overview = camera("01 | Monolite", (2.85,-8,2.70), (0,0,1.415), 3.47)
detail = camera("02 | Player", (0,-6,2), (0,0,2), 1.59)
scene.camera = overview
scene.render.resolution_x, scene.render.resolution_y = 930, 1170
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "JPEG"
scene.render.image_settings.quality = 92
scene.render.filepath = "//monolite.jpg"
scene["Copertina"] = "video massimo lago.MP4, 00:53:50.142, fotogramma casuale dalla preview Drive"
scene["Fonte copertina"] = "https://drive.google.com/file/d/1bjv6p4nN1apGfycyGc7oq0u2wkAH9KWd/view"
scene["Player"] = "Prototipo visivo | 13 tracce"

bpy.context.view_layer.update()
for character in title.data.body:
    probe = label("Test glifo", character, 0, 0, .1, white, egyptian)
    bpy.context.view_layer.update()
    evaluated = probe.evaluated_get(bpy.context.evaluated_depsgraph_get())
    glyph_mesh = evaluated.to_mesh()
    assert len(glyph_mesh.vertices) > 15, f"Glifo mancante: {character}"
    evaluated.to_mesh_clear()
    data = probe.data
    bpy.data.objects.remove(probe, do_unlink=True)
    bpy.data.curves.remove(data)

for font_data in (regular, bold, egyptian):
    font_data.pack()

for area in bpy.context.screen.areas if bpy.context.screen else ():
    if area.type == "VIEW_3D":
        space = area.spaces.active
        space.overlay.show_overlays = False
        space.region_3d.view_perspective = "CAMERA"
        space.region_3d.view_camera_zoom = 6
        space.shading.type = "MATERIAL"

bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / "Animale_Artificiale.blend"))
result = {"scene": scene.name, "file": bpy.data.filepath, "tracks": len(sequences),
          "panel_center": 2.0, "glyphs_checked": len(title.data.body),
          "cover_packed": bool(tex.image.packed_file), "bottom": body.location.z - 2.84/2}

