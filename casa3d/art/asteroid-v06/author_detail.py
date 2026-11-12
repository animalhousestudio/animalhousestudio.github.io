"""Create the editable Blender surface-detail pass and its optional game assets."""
from array import array
import hashlib
import json
import math
from pathlib import Path
import random
import subprocess

import bpy
from mathutils import Vector, noise
from mathutils.bvhtree import BVHTree


OUT = Path(__file__).resolve().parent
GAME = OUT.parents[1]/"src/assets/terrain-detail"
GAME.mkdir(parents=True,exist_ok=True)
scene = bpy.context.scene
root = bpy.data.objects["Asteroid_Root"]
assert root["version"] == "v05 authoring review"
top = bpy.data.objects["Asteroid_Surface"]
bvh = BVHTree.FromPolygons([v.co for v in top.data.vertices],
                           [p.vertices[:] for p in top.data.polygons],all_triangles=True)
rng = random.Random(38126)
CELL = 20
map_size = 512


def smooth(t):
    return t*t*(3-2*t)


def field(x,y,period,salt):
    # Cross-fade shifted samples at both edges to make the tile periodic.
    u,v = smooth(x),smooth(y)
    value = 0
    for a,b,w in [(0,0,(1-u)*(1-v)),(1,0,u*(1-v)),(0,1,(1-u)*v),(1,1,u*v)]:
        value += w*noise.noise(Vector(((x-a)*period+salt,(y-b)*period+salt*.61,3.27)))
    return value


pixels = array("f")
for row in range(map_size):
    y = row/map_size
    for col in range(map_size):
        x = col/map_size
        vein = field(x,y,8,11)
        erosion = field(x,y,21,32)
        grit = field(x,y,56,5)
        dust = field(x,y,142,74)
        crack = math.exp(-abs(vein+.29*erosion)*39)*max(0,.55+erosion)
        chips = max(0,grit+.26*dust-.12)**.8
        height = .49+.24*vein+.21*erosion+.39*chips+.095*dust-.38*crack
        tone = .50+.20*vein+.22*erosion+.32*chips+.09*dust-.51*crack
        rough = .57+.24*erosion-.36*chips
        pixels.extend([min(1,max(0,v)) for v in (height,tone,rough)]+[1])
image = bpy.data.images.new("Roccia | altezza, tono e rugosita",map_size,map_size,alpha=False)
image.colorspace_settings.name = "Non-Color"
image.pixels.foreach_set(pixels)
image.filepath_raw = str(GAME/"rock-micro.png")
image.file_format = "PNG"
image.save()
image.pack()

material = top.data.materials[0]
nodes,links = material.node_tree.nodes,material.node_tree.links
shader = nodes.get("Principled BSDF")
old_color = shader.inputs["Base Color"].links[0].from_socket
old_normal = shader.inputs["Normal"].links[0].from_socket
coordinates = next(node for node in nodes if node.type=="TEX_COORD")
scale = nodes.new("ShaderNodeVectorMath")
scale.operation = "SCALE"
scale.inputs["Scale"].default_value = 1/2.7
links.new(coordinates.outputs["Object"],scale.inputs[0])
texture = nodes.new("ShaderNodeTexImage")
texture.image = image
links.new(scale.outputs["Vector"],texture.inputs["Vector"])
channel = nodes.new("ShaderNodeSeparateColor")
links.new(texture.outputs["Color"],channel.inputs[0])
bump = nodes.new("ShaderNodeBump")
bump.inputs["Strength"].default_value = .68
bump.inputs["Distance"].default_value = .038
links.new(channel.outputs["Red"],bump.inputs["Height"])
links.new(old_normal,bump.inputs["Normal"])
links.new(bump.outputs["Normal"],shader.inputs["Normal"])
tone = nodes.new("ShaderNodeMath")
tone.operation = "ADD"
tone.inputs[1].default_value = .55
links.new(channel.outputs["Green"],tone.inputs[0])
mix = nodes.new("ShaderNodeMixRGB")
mix.blend_type = "MULTIPLY"
mix.inputs[0].default_value = .8
links.new(old_color,mix.inputs[1])
links.new(tone.outputs[0],mix.inputs[2])
links.new(mix.outputs[0],shader.inputs["Base Color"])
for i,node in enumerate((scale,texture,channel,bump,tone,mix)):
    node.location = (-900+i*155,830+(i%2)*210)

old_detail = bpy.data.collections.get("DETTAGLIO LOCALE | Detriti e affioramenti")
if old_detail:
    old_detail.hide_viewport = old_detail.hide_render = True
collection = bpy.data.collections.new("TERRENO | Dettaglio per settori")
scene.collection.children.link(collection)
stone = bpy.data.materials.new("Breccia e pietrisco")
stone.diffuse_color = (.14,.077,.039,1)
stone.use_nodes = True
nodes = stone.node_tree.nodes
vertex_color = nodes.new("ShaderNodeVertexColor")
vertex_color.layer_name = "Colore"
stone.node_tree.links.new(vertex_color.outputs["Color"],nodes.get("Principled BSDF").inputs["Base Color"])
nodes.get("Principled BSDF").inputs["Roughness"].default_value = .91

sites = []
for row in range(5):
    for col in range(5):
        x0,z0 = -50+col*CELL,-50+row*CELL
        patches = [(x0+rng.uniform(2,18),z0+rng.uniform(2,18)) for _ in range(9)]
        for px,pz in patches:
            for i in range(11):
                x,z = rng.gauss(px,1.65),rng.gauss(pz,1.5)
                if not (x0+.15<x<x0+CELL-.15 and z0+.15<z<z0+CELL-.15):
                    continue
                size = rng.uniform(.023,.115) if i else rng.uniform(.15,.33)
                sites.append((x,z,size,col,row))
for i in range(190):
    angle = rng.uniform(0,math.tau)
    distance = rng.uniform(5.3,9.3)
    x,z = -29+math.cos(angle)*distance,-15+math.sin(angle)*distance
    size = rng.uniform(.033,.15) if i%12 else rng.uniform(.22,.37)
    sites.append((x,z,size,int((x+50)//CELL),int((z+50)//CELL)))

request = subprocess.run(["node",str(OUT/"sample_sites.mjs")],check=True,text=True,encoding="utf-8",
    capture_output=True,input=json.dumps([(x,z,r*1.6) for x,z,r,_,_ in sites]))
heights = json.loads(request.stdout)
assert len(heights)==len(sites)
sectors = {}
for (x,z,size,col,row),height in zip(sites,heights):
    if height is None or bvh.ray_cast((x,-z,5),(0,0,-1),20)[0] is None:
        continue
    vertices,faces,colors = sectors.setdefault((col,row),([],[],[]))
    y = -z
    offset = len(vertices)
    theta = rng.uniform(0,math.tau)
    length,width = rng.uniform(.85,1.65)*size,rng.uniform(.6,1.1)*size
    crest = size*rng.uniform(.30,.90)
    vertices.append((x+.16*size,y-.15*size,height+crest))
    for j in range(6):
        angle = theta+j*math.tau/6
        vertices.append((x+math.cos(angle)*length*rng.uniform(.66,1.14),
                         y+math.sin(angle)*width*rng.uniform(.66,1.14),
                         height+size*rng.uniform(-.16,.1)))
    vertices.append((x,y,height-size*.36))
    for j in range(6):
        a,b = offset+1+j,offset+1+(j+1)%6
        faces.extend([(offset,a,b),(offset+7,b,a)])
    shade = rng.uniform(.72,1.23)
    base = (.26,.17,.094) if math.hypot(x/13,(z-17)/26)<1 else (.123,.068,.035)
    for j in range(8):
        colors.append(tuple(value*shade*rng.uniform(.83,1.17) for value in base)+(1,))

records = []
for (col,row),(vertices,faces,colors) in sorted(sectors.items()):
    cell_id = f"ground-{col}-{row}"
    mesh = bpy.data.meshes.new(cell_id)
    mesh.from_pydata(vertices,[],faces)
    mesh.update()
    mesh.materials.append(stone)
    color_attribute = mesh.color_attributes.new(name="Colore",type="BYTE_COLOR",domain="POINT")
    for entry,color in zip(color_attribute.data,colors):
        entry.color = color
    obj = bpy.data.objects.new(cell_id,mesh)
    collection.objects.link(obj)
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    file = GAME/(cell_id+".glb")
    bpy.ops.export_scene.gltf(filepath=str(file),export_format="GLB",use_selection=True,
                             export_animations=False,export_lights=False,export_cameras=False)
    records.append({"id":cell_id,"minX":-50+col*CELL,"minZ":-50+row*CELL,"size":CELL,
        "triangles":len(faces),"bytes":file.stat().st_size,"sha256":hashlib.sha256(file.read_bytes()).hexdigest()})

(GAME/"sectors.json").write_text(json.dumps(records,indent=2)+"\n",encoding="utf-8")
root["version"] = "v06 ground detail"
scene.name = "Asteroide | Breccia e micro rilievo"
bpy.ops.object.select_all(action="DESELECT")
bpy.context.view_layer.objects.active = top
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/"Asteroide_v06.blend"),compress=True)

scene.camera = bpy.data.objects["Vista | cratere"]
scene.render.resolution_percentage = 80
scene.cycles.samples = 12
scene.render.filepath = str(OUT/"cratere-blender.png")
bpy.ops.render.render(write_still=True)
