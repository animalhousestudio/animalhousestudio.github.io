"""Authoring pass for the existing Casa3D island. Run against asteroid-v03.blend."""
from pathlib import Path
import json
import math
import sys

import bmesh
import bpy
from mathutils import Vector, noise


OUT = Path(__file__).resolve().parent
PROJECT = OUT.parents[1]
scene = bpy.context.scene
top = bpy.data.objects["Asteroid_Surface"]
rock = bpy.data.objects["Asteroid_Rock"]
root = bpy.data.objects["Asteroid_Root"]
assert scene.name == "Asteroid_Review_v03"
original_top = [tuple(vertex.co) for vertex in top.data.vertices]
original_rim = [tuple(vertex.co) for vertex in rock.data.vertices[:160]]
original_triangles = sum(len(obj.data.polygons) for obj in (top, rock))


def smooth(lo, hi, value):
    t = min(1.0, max(0.0, (value-lo)/(hi-lo)))
    return t*t*(3.0-2.0*t)


# Carve into the existing shell and preserve the shared rim exactly.
rock.data = rock.data.copy()
rock.data.name = "Asteroid_Rock_v04_FaultedCliffs"
fault = rock.data.color_attributes.new(name="Fault", type="FLOAT_COLOR", domain="POINT")
for index, vertex in enumerate(rock.data.vertices):
    x, y, z = vertex.co
    depth = max(0.0, -z)
    theta = math.atan2(y/46, x/50)
    axis = -.58 - .014*depth + .12*math.sin(depth*.31)
    angular = math.atan2(math.sin(theta-axis), math.cos(theta-axis))
    fade = smooth(.4, 6.5, depth)*(1-smooth(31, 53, depth))
    core = (1-smooth(.022, .153, abs(angular)))*fade
    shoulder = (1-smooth(.018, .105, abs(abs(angular)-.17)))*fade
    branch_axis = -.19 + .008*depth
    branch = (1-smooth(.017, .083, abs(angular-branch_axis)))*smooth(8,16,depth)*(1-smooth(26,36,depth))
    variation = noise.noise(Vector((x*.24, y*.24, z*.18)))
    if index >= 160:
        outward = Vector((x,y,0)).normalized()
        cut = -5.3*core - 2.35*branch + shoulder*(1.15+variation*.65)
        vertex.co += outward*cut
        vertex.co.z -= fade*math.copysign(.9, angular)*(core+shoulder*.37)
    fault.data[index].color = (max(core, branch*.78), shoulder, .5+.5*variation, 1)
rock.data.update()


def stone_material(name):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.diffuse_color = (.17,.15,.13,1)
    nodes, links = material.node_tree.nodes, material.node_tree.links
    bsdf = nodes.get("Principled BSDF")
    coordinates = nodes.new("ShaderNodeTexCoord").outputs["Object"]

    def wire(value, socket):
        if isinstance(value, bpy.types.NodeSocket):
            links.new(value,socket)
        else:
            socket.default_value = value

    def math_node(op, a, b=0):
        node = nodes.new("ShaderNodeMath")
        node.operation = op
        wire(a,node.inputs[0])
        wire(b,node.inputs[1])
        return node.outputs[0]

    def field(scale, detail, label):
        node = nodes.new("ShaderNodeTexNoise")
        node.label = label
        wire(coordinates,node.inputs["Vector"])
        node.inputs["Scale"].default_value = scale
        node.inputs["Detail"].default_value = detail
        return node.outputs["Fac"]

    def ramp(value, entries, label):
        node = nodes.new("ShaderNodeValToRGB")
        node.label = label
        wire(value,node.inputs["Fac"])
        colors = node.color_ramp.elements
        colors.remove(colors[1])
        for index, (position,color) in enumerate(entries):
            stop = colors.new(position) if index else colors[0]
            stop.position = position
            stop.color = (color,color,color,1) if isinstance(color,(int,float)) else (*color,1)
        return node.outputs[0]

    def mix(factor, first, second, label):
        node = nodes.new("ShaderNodeMixRGB")
        node.label = label
        for value, socket in zip((factor, first, second),node.inputs):
            wire(value,socket)
        return node.outputs[0]

    xyz = nodes.new("ShaderNodeSeparateXYZ")
    wire(coordinates,xyz.inputs[0])
    x,y,z = xyz.outputs
    geology = field(.25,4,"Plaques minerales")
    grain = field(4.8,2,"Grana fine")
    stone = ramp(geology,[(.23,(.035,.034,.039)),(.51,(.103,.111,.119)),
                          (.76,(.228,.207,.175))],"Basalto grafite")
    if name.startswith("Superficie"):
        def ellipse(cx,cy,rx,ry):
            dx = math_node("DIVIDE", math_node("SUBTRACT",x,cx),rx)
            dy = math_node("DIVIDE", math_node("SUBTRACT",y,cy),ry)
            return math_node("SQRT",math_node("ADD",math_node("MULTIPLY",dx,dx),math_node("MULTIPLY",dy,dy)))

        central = ellipse(1.65,.57,21,19)
        approach = ellipse(.25,-22,12,26)
        dust_extent = math_node("ADD",math_node("MINIMUM",central,approach),
                                math_node("MULTIPLY",math_node("SUBTRACT",field(.12,3,"Margini della polvere"),.5),.68))
        dust_mask = ramp(dust_extent,[(.67,1),(.98,.62),(1.22,0)],"Spianata e arrivo")
        dust = ramp(geology,[(.18,(.135,.106,.081)),(.51,(.33,.276,.208)),
                             (.78,(.50,.422,.315))],"Polvere calda")
        color = mix(dust_mask,stone,dust,"Polvere sulla roccia")

        line = math_node("ABSOLUTE",math_node("ADD",
                         math_node("SUBTRACT",math_node("ADD",y,math_node("MULTIPLY",x,.86)),10.3),
                         math_node("MULTIPLY",math_node("SUBTRACT",field(.48,3,"Margine della vena"),.5),4.2)))
        crack_width = ramp(math_node("DIVIDE",line,4),[(0,1),(.23,.74),(.55,0)],"Vena superficiale")
        east = ramp(math_node("DIVIDE",x,50),[(.45,0),(.64,.60),(.91,1)],"Affioramento orientale")
        color = mix(math_node("MULTIPLY",crack_width,east),color,(.024,.022,.028,1),"Fessura a filo del suolo")
        relief = mix(dust_mask,geology,grain,"Grana piu fine nella polvere")
    else:
        shift = field(.061,2,"Strati deformati")
        bands = math_node("ADD",math_node("ADD",z,math_node("MULTIPLY",x,.20)),
                          math_node("ADD",math_node("MULTIPLY",y,-.14),math_node("MULTIPLY",shift,12)))
        wave = math_node("MULTIPLY_ADD",math_node("SINE",math_node("MULTIPLY",bands,1.06)),.5)
        wave.node.inputs[2].default_value = .5
        strata = ramp(wave,[(.02,(.043,.047,.054)),(.44,(.101,.103,.105)),
                             (.86,(.193,.174,.139)),(1,(.255,.224,.175))],"Strati inclinati")
        weathering = ramp(field(.18,3,"Erosione degli strati"),[(.32,.11),(.51,.28),(.70,.69)],"Continuita degli strati")
        color = mix(weathering,stone,strata,"Letti di roccia spezzati")
        attribute = nodes.new("ShaderNodeVertexColor")
        attribute.layer_name = "Fault"
        split = nodes.new("ShaderNodeSeparateColor")
        wire(attribute.outputs["Color"],split.inputs[0])
        color = mix(math_node("MULTIPLY",split.outputs[1],.77),color,(.24,.131,.073,1),"Ossido sulle spalle")
        color = mix(split.outputs[0],color,(.010,.011,.016,1),"Fondo della frattura")
        relief = mix(weathering,grain,wave,"Rilievo delle stratificazioni")
    flecks = ramp(grain,[(.26,(.53,.55,.58)),(.51,(.96,.95,.92)),
                        (.78,(1.27,1.23,1.13))],"Granuli minerali")
    modulation = nodes.new("ShaderNodeMixRGB")
    modulation.blend_type = "MULTIPLY"
    modulation.inputs[0].default_value = .53
    wire(color,modulation.inputs[1])
    wire(flecks,modulation.inputs[2])
    wire(modulation.outputs[0],bsdf.inputs["Base Color"])
    wire(ramp(grain,[(.13,.68),(.85,.96)],"Rugosita"),bsdf.inputs["Roughness"])
    bump = nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = .47
    bump.inputs["Distance"].default_value = .17
    wire(relief,bump.inputs["Height"])
    wire(bump.outputs["Normal"],bsdf.inputs["Normal"])
    columns = {}
    depths = {}

    def arrange(node, depth):
        if depths.get(node,-1) >= depth:
            return
        depths[node] = depth
        for socket in node.inputs:
            for link in socket.links:
                arrange(link.from_node,depth+1)

    arrange(nodes.get("Material Output"),0)
    for node, depth in depths.items():
        row = columns.get(depth,0)
        node.location = (-230*depth,-235*row)
        columns[depth] = row+1
    return material


for obj, material in ((top,stone_material("Superficie | basalto e polvere")),
                      (rock,stone_material("Fianco | basalto stratificato"))):
    obj.data.materials.clear()
    obj.data.materials.append(material)

assert original_top == [tuple(vertex.co) for vertex in top.data.vertices]
assert original_rim == [tuple(vertex.co) for vertex in rock.data.vertices[:160]]
vertices, faces = [], []
for obj in (top,rock):
    faces.extend(tuple(len(vertices)+i for i in face.vertices) for face in obj.data.polygons)
    vertices.extend(tuple(v.co) for v in obj.data.vertices)
check = bpy.data.meshes.new("Validation")
check.from_pydata(vertices,[],faces)
bm = bmesh.new()
bm.from_mesh(check)
bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.0001)
assert all(edge.is_manifold for edge in bm.edges)
assert all(face.calc_area()>1e-8 for face in bm.faces)
bm.free()
bpy.data.meshes.remove(check)

# The shipped mansion is context for framing only, in its game position.
reference = bpy.data.collections.new("RIFERIMENTO | Casa v10")
scene.collection.children.link(reference)
before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=str(PROJECT/"src/assets/models/mansion-v10.glb"))
imported = set(bpy.data.objects)-before
placement = bpy.data.objects.new("Posizione casa nel gioco",None)
reference.objects.link(placement)
placement.location = (1.65,.57,0)
for obj in imported:
    if obj.parent not in imported:
        obj.parent = placement
    for collection in list(obj.users_collection):
        collection.objects.unlink(obj)
    reference.objects.link(obj)
reference.hide_select = True

scene.name = "Asteroide | Basalto e polvere"
root["version"] = "v04 authoring review"
root["runtime_status"] = "Materials and cliff review. Source deck and shared rim preserved."
overview_camera = scene.camera


def set_camera(camera, location, target, width):
    camera.location = location
    camera.rotation_euler = (Vector(target)-camera.location).to_track_quat("-Z","Y").to_euler()
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = width


views = {
    "panoramica": ((105,-161,83),(0,0,-18),137),
    "superficie": ((34,-61,142),(0,-4,2),111),
    "frattura": ((105,-135,13),(21,-25,-17),56),
}
camera_collection = overview_camera.users_collection[0]
cameras = {}
for name, view in views.items():
    if name == "panoramica":
        camera = overview_camera
    else:
        camera = overview_camera.copy()
        camera.data = overview_camera.data.copy()
        camera_collection.objects.link(camera)
    camera.name = "Vista | " + name
    set_camera(camera,*view)
    cameras[name] = camera
scene.camera = overview_camera
scene.render.engine = "CYCLES"
scene.cycles.samples = 14
scene.cycles.use_denoising = True
scene.render.resolution_x = 1100
scene.render.resolution_y = 900
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
for obj in bpy.context.selected_objects:
    obj.select_set(False)
bpy.context.view_layer.objects.active = rock
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type == "VIEW_3D":
            space = area.spaces.active
            space.region_3d.view_perspective = "CAMERA"
            space.clip_end = 600
            space.overlay.show_overlays = False
            space.shading.type = "MATERIAL"

bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/"Asteroide_v04.blend"),compress=True)
stats = {"source":"asteroid-v03.blend","terrain_meshes":2,"terrain_triangles":original_triangles,
         "top_unchanged":True,"rim_unchanged":True,"welded_shell_manifold":True,
         "context_mansion":"mansion-v10.glb","runtime_export":False}
(OUT/"stats.json").write_text(json.dumps(stats,indent=2)+"\n",encoding="utf-8")

if "--render" in sys.argv:
    for name, camera in cameras.items():
        scene.camera = camera
        scene.render.filepath = str(OUT/(name+".png"))
        bpy.ops.render.render(write_still=True)
