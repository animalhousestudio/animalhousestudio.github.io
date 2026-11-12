"""Run in Blender against Asteroide_v04.blend to build the relief and UFO study."""
import hashlib
import json
import math
from pathlib import Path
import random
import subprocess
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector, geometry, noise
from mathutils.bvhtree import BVHTree


OUT = Path(__file__).resolve().parent
PROJECT = OUT.parents[1]
scene = bpy.context.scene
top = bpy.data.objects["Asteroid_Surface"]
rock = bpy.data.objects["Asteroid_Rock"]
root = bpy.data.objects["Asteroid_Root"]
assert root["version"] == "v04 authoring review"


def smooth(lo, hi, value):
    t = min(1.0, max(0.0, (value-lo)/(hi-lo)))
    return t*t*(3.0-2.0*t)


def read_layout(points):
    sampled = subprocess.run(
        ["node", str(OUT/"sample_game_terrain.mjs")], input=json.dumps(points),
        text=True, encoding="utf-8", capture_output=True, check=True,
    )
    return json.loads(sampled.stdout)


def disk(x, y, cx, cy, rx, ry):
    return math.hypot((x-cx)/rx, (y-cy)/ry)


layout = read_layout([])
impact = layout["crater"]
cx, cy, radius = impact["x"], -impact["z"], impact["radius"]
rim = [tuple(vertex.co) for vertex in rock.data.vertices[:160]]
assert all(z == 0 for _, _, z in rim)
edges = [(i, (i+1)%len(rim)) for i in range(len(rim))]


def inside(x, y):
    return sum((ay > y) != (by > y) and x < (bx-ax)*(y-ay)/(by-ay)+ax
               for (ax, ay, _), (bx, by, _) in ((rim[a], rim[b]) for a, b in edges)) % 2


def protected(x, y):
    hx, hz = layout["house"]
    lx, lz = layout["landing"]
    pitch = layout["pitch"]
    stage = layout["stage"]
    distance = min(
        disk(x,y,hx,-hz,11,11),
        disk(x,y,lx,-lz,7.5,5.4),
        disk(x,y,.2,-25,5.3,19),
        *(disk(x,y,p["x"],-p["z"],p["rx"]+1.4,p["rz"]+1.4) for p in layout["ponds"]),
    )
    dx = max(pitch["minX"]-x, x-pitch["maxX"], 0)
    dz = max(pitch["minZ"]+y, -y-pitch["maxZ"], 0)
    pitch_mask = smooth(.7, 4.0, math.hypot(dx,dz))
    ahead = (math.sin(stage["yaw"]), -math.cos(stage["yaw"]))
    # Keep the stage, stairs and the facing audience apron level.
    sx, sy = stage["x"]+3.3*ahead[0], -stage["z"]+3.3*ahead[1]
    stage_mask = smooth(1, 1.55, disk(x,y,sx,sy,6.2,6.5))
    return smooth(1, 1.52, distance)*pitch_mask*stage_mask


sites = [Vector((x,y)) for x,y,_ in rim]
rng = random.Random(2106)
for step, span, impact_only in [(1.32,53,False),(.53,10,True)]:
    center_x, center_y = (cx,cy) if impact_only else (0,0)
    cells = math.ceil(span/step)
    for row in range(-cells,cells+1):
        for col in range(-cells,cells+1):
            x = center_x+(col+rng.uniform(-.31,.31))*step
            y = center_y+(row+rng.uniform(-.31,.31))*step
            near_impact = math.hypot(x-cx,y-cy)<9.1
            if near_impact == impact_only and inside(x,y):
                sites.append(Vector((x,y)))

points, _, faces, _, _, _ = geometry.delaunay_2d_cdt(sites,edges,[list(range(len(rim)))],1,1e-6)
baseline = read_layout([(p.x,-p.y) for p in points])["heights"]
assert len(baseline) == len(points)
rim_lookup = {(round(p[0],5),round(p[1],5)) for p in rim}


def profile(d):
    if d < 1:
        bowl = -(1-d*d)**2
    else:
        bowl = 0
    lip = .25*math.sin(math.pi*(d-.7)/.65)**2 if .7 < d < 1.35 else 0
    return bowl, lip


def sample(p, height):
    x,y = p
    if (round(x,5),round(y,5)) in rim_lookup:
        return (x,y,0), 0.0, 0.0
    dx,dy = x-cx,y-cy
    radial = math.hypot(dx,dy)
    circular = radial/radius
    angle = math.atan2(dy,dx)-.62
    edge = 1.0+.11*math.cos(angle)+.075*math.sin(3*angle+.4)+.045*math.cos(5*angle)
    distance = math.hypot(math.cos(angle)*radial/1.18,math.sin(angle)*radial/.85)/(radius*edge)
    old_bowl,old_lip = profile(circular)
    bowl,lip = profile(distance)
    ejecta = .80+.32*math.cos(angle-.9)+.15*math.sin(angle*4.0)
    impact_gate = (1-smooth(1.09,1.63,circular))*protected(x,y)
    impact_height = impact["depth"]*(bowl+lip*ejecta-old_bowl-old_lip)*impact_gate
    broad = noise.noise(Vector((x*.116+14,y*.116+7,2.8)))
    broken = noise.noise(Vector((x*.34,y*.34,8.3)))
    edge_gate = 1-smooth(.87,1.035,math.hypot(x/48,y/44))
    relief = (.56*broad+.19*broken)*edge_gate*protected(x,y)
    relief *= smooth(.1,1.0,circular)
    dust = (1-smooth(.64,1.40,distance))*(.67+.18*broken)
    return (x,y,height+relief+impact_height), dust, relief+impact_height


samples = [sample(point,height) for point,height in zip(points,baseline)]
vertices = [item[0] for item in samples]
mesh = bpy.data.meshes.new("Asteroid_Surface_v05_Rilievo")
mesh.from_pydata(vertices,[],faces)
bm = bmesh.new()
bm.from_mesh(mesh)
for face in bm.faces:
    if face.normal.z < 0:
        face.normal_flip()
bm.to_mesh(mesh)
bm.free()
mesh.update()
for face in mesh.polygons:
    face.use_smooth = True
impact_colors = mesh.color_attributes.new(name="Impact",type="FLOAT_COLOR",domain="POINT")
for color, (_, mask, _) in zip(impact_colors.data,samples):
    color.color = (mask,mask,mask,1)
mesh.materials.append(top.data.materials[0])
top.data = mesh

combined = bpy.data.meshes.new("Volume check")
vertices = [tuple(v.co) for v in top.data.vertices]
combined.from_pydata(vertices+[tuple(v.co) for v in rock.data.vertices],[],
    [tuple(p.vertices) for p in top.data.polygons]
    +[tuple(len(vertices)+i for i in p.vertices) for p in rock.data.polygons])
bm = bmesh.new()
bm.from_mesh(combined)
bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.0001)
assert all(edge.is_manifold for edge in bm.edges), "Broken seam between the deck and cliff"
assert all(face.calc_area()>1e-8 for face in bm.faces)
bm.free()
bpy.data.meshes.remove(combined)


def recolor(material, label, palette):
    ramp = next(node.color_ramp for node in material.node_tree.nodes if node.label == label)
    assert len(ramp.elements) == len(palette)
    for stop, color in zip(ramp.elements,palette):
        stop.color = (*color,1)


ground = top.data.materials[0]
cliff = rock.data.materials[0]
for material in (ground,cliff):
    material.diffuse_color = (.105,.058,.032,1)
    recolor(material,"Basalto grafite",[(.021,.010,.006),(.062,.032,.016),(.139,.081,.040)])
recolor(ground,"Polvere calda",[(.121,.068,.038),(.265,.181,.108),(.406,.294,.182)])
recolor(cliff,"Strati inclinati",[(.018,.011,.008),(.048,.026,.015),(.126,.075,.038),(.197,.111,.053)])
nodes, links = ground.node_tree.nodes, ground.node_tree.links
base_socket = nodes.get("Principled BSDF").inputs["Base Color"]
old_color = base_socket.links[0].from_socket
mask = nodes.new("ShaderNodeVertexColor")
mask.layer_name = "Impact"
mask.label = "Polvere da impatto"
mask.location = (-870,480)
mix = nodes.new("ShaderNodeMixRGB")
mix.label = "Sedimento del cratere"
mix.location = (-625,260)
mix.inputs[2].default_value = (.202,.108,.052,1)
links.new(mask.outputs["Color"],mix.inputs[0])
links.new(old_color,mix.inputs[1])
links.new(mix.outputs[0],base_socket)
shader = nodes.get("Principled BSDF")
old_normal = shader.inputs["Normal"].links[0].from_socket
coordinates = next(node for node in nodes if node.type=="TEX_COORD")
aggregate = nodes.new("ShaderNodeTexVoronoi")
aggregate.label = "Grana e breccia"
aggregate.feature = "DISTANCE_TO_EDGE"
aggregate.inputs["Scale"].default_value = 9.5
aggregate.location = (-870,770)
fine = nodes.new("ShaderNodeBump")
fine.label = "Rilievo minuto della roccia"
fine.inputs["Strength"].default_value = .64
fine.inputs["Distance"].default_value = .085
fine.location = (-420,400)
links.new(coordinates.outputs["Object"],aggregate.inputs["Vector"])
links.new(aggregate.outputs["Distance"],fine.inputs["Height"])
links.new(old_normal,fine.inputs["Normal"])
links.new(fine.outputs["Normal"],shader.inputs["Normal"])
for light in (obj for obj in scene.objects if obj.type == "LIGHT" and "Cool" in obj.name):
    light.data.color = (.87,.91,1.0)

# Fragments on the impact rim and a few exposed outcrops. Kept separate from
# the surface so they can become optional near detail if this pass is approved.
scatter = []
for _ in range(104):
    angle = rng.uniform(0,math.tau)
    distance = radius*rng.uniform(.87,1.41)
    weight = .52+.42*math.cos(angle-.75)
    if rng.random()>weight:
        continue
    x,y = cx+distance*math.cos(angle),cy+distance*math.sin(angle)
    if protected(x,y)>.85 and inside(x,y):
        scatter.append((x,y,rng.uniform(.068,.29)*(.8+.5*weight)))
for bx,by in [(32,-10),(38,5),(-19,24)]:
    for _ in range(24):
        x,y = rng.gauss(bx,2.3),rng.gauss(by,2.7)
        if protected(x,y)>.85 and inside(x,y):
            scatter.append((x,y,rng.uniform(.064,.24)))
surface_bvh = BVHTree.FromPolygons([tuple(v.co) for v in mesh.vertices],
                                   [tuple(face.vertices) for face in mesh.polygons],all_triangles=True)
chips, triangles = [], []
for x,y,size in scatter:
    contact, _, _, _ = surface_bvh.ray_cast((x,y,5),(0,0,-1),20)
    assert contact is not None
    z = contact.z
    offset = len(chips)
    rotation = rng.uniform(0,math.tau)
    long = rng.uniform(.90,1.6)*size
    wide = rng.uniform(.53,.95)*size
    chips.append((x+.24*size,y-.14*size,z+size*rng.uniform(.30,.82)))
    for i in range(6):
        theta = rotation+i*math.tau/6
        chips.append((x+long*math.cos(theta)*rng.uniform(.7,1.12),
                      y+wide*math.sin(theta)*rng.uniform(.7,1.12),z+size*rng.uniform(-.14,.13)))
    chips.append((x,y,z-.46*size))
    for i in range(6):
        a,b = offset+1+i,offset+1+(i+1)%6
        triangles.extend([(offset,a,b),(offset+7,b,a)])
chips_mesh = bpy.data.meshes.new("Detrito | frammenti irregolari")
chips_mesh.from_pydata(chips,[],triangles)
chips_mesh.update()
for name,color in [("Detrito | roccia bruna",(.094,.052,.024)),
                   ("Detrito | roccia ossidata",(.154,.077,.034)),
                   ("Detrito | roccia scura",(.052,.033,.019))]:
    material = bpy.data.materials.new(name)
    material.diffuse_color = (*color,1)
    material.roughness = .92
    material.use_nodes = True
    fragment_shader = material.node_tree.nodes.get("Principled BSDF")
    fragment_shader.inputs["Base Color"].default_value = (*color,1)
    fragment_shader.inputs["Roughness"].default_value = .92
    chips_mesh.materials.append(material)
for face in chips_mesh.polygons:
    face.material_index = (face.index//12*7)%3
detail = bpy.data.collections.new("DETTAGLIO LOCALE | Detriti e affioramenti")
scene.collection.children.link(detail)
detail.objects.link(bpy.data.objects.new("Frammenti semisepolti",chips_mesh))

# Match the normalization, staging cleanup, tilt and burial used by the game.
before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=str(PROJECT/"src/assets/models/props/ufo.glb"))
new = set(bpy.data.objects)-before
for obj in list(new):
    plain = obj.name.replace("_"," ").lower()
    if (plain.startswith("neutral") and plain.endswith("floor")) or obj.name == "Cube":
        new.remove(obj)
        bpy.data.objects.remove(obj,do_unlink=True)
    elif obj.type in {"LIGHT","CAMERA"}:
        new.remove(obj)
        bpy.data.objects.remove(obj,do_unlink=True)
bpy.context.view_layer.update()
corners = [obj.matrix_world@Vector(corner) for obj in new if obj.type=="MESH" for corner in obj.bound_box]
minimum = Vector([min(p[i] for p in corners) for i in range(3)])
maximum = Vector([max(p[i] for p in corners) for i in range(3)])
center = (minimum+maximum)*.5
ufo = layout["ufo"]
size = maximum-minimum
scale = ufo["size"]/max(size.x,size.y)
context = bpy.data.collections.new("RIFERIMENTO | UFO nel cratere")
scene.collection.children.link(context)
pivot = bpy.data.objects.new("UFO | posa di gioco",None)
context.objects.link(pivot)
pivot.matrix_world = (
    Matrix.Translation((ufo["x"],-ufo["z"],ufo["height"]-ufo["buried"]))
    @ Matrix.Rotation(ufo["tilt"],4,"X") @ Matrix.Rotation(ufo["yaw"],4,"Z")
    @ Matrix.Scale(scale,4)
)
offset = Matrix.Translation((-center.x,-center.y,-minimum.z))
for obj in new:
    if obj.parent not in new:
        original_transform = obj.matrix_world.copy()
        obj.parent = pivot
        obj.matrix_basis = offset@original_transform
    for collection in list(obj.users_collection):
        collection.objects.unlink(obj)
    context.objects.link(obj)

camera_collection = scene.camera.users_collection[0]
overview = bpy.data.objects["Vista | panoramica"]
cameras = {"panoramica":overview,"superficie":bpy.data.objects["Vista | superficie"]}
for name, location, target, width in (
    ("cratere", (cx-11,cy+16,11), (cx,cy,-.75), 23),
    ("terreno", (20,-24,8), (31,-7,.15), 33),
):
    camera = overview.copy()
    camera.data = overview.data.copy()
    camera_collection.objects.link(camera)
    camera.name = "Vista | "+name
    camera.location = location
    camera.rotation_euler = (Vector(target)-camera.location).to_track_quat("-Z","Y").to_euler()
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = width
    cameras[name] = camera

scene.name = "Asteroide | Roccia bruna e impatto"
root["version"] = "v05 authoring review"
root["runtime_status"] = "Relief and UFO composition for approval; runtime remains on v03."
scene.camera = overview
for obj in bpy.context.selected_objects:
    obj.select_set(False)
bpy.context.view_layer.objects.active = top
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/"Asteroide_v05.blend"),compress=True)

stats = {
    "source_sha256": hashlib.sha256((OUT.parent/"asteroid-v04/Asteroide_v04.blend").read_bytes()).hexdigest(),
    "terrain_triangles": len(mesh.polygons)+len(rock.data.polygons),
    "top_triangles": len(mesh.polygons),
    "optional_detail_triangles": len(triangles),
    "optional_detail_fragments": len(scatter),
    "rim_vertices_preserved": len(rim),
    "welded_shell_manifold": True,
    "ufo_game_anchor": ufo,
    "runtime_export": False,
}
(OUT/"stats.json").write_text(json.dumps(stats,indent=2)+"\n",encoding="utf-8")

if "--render" in sys.argv:
    for name in ("cratere","panoramica","superficie","terreno"):
        camera = cameras[name]
        scene.camera = camera
        scene.render.filepath = str(OUT/(name+".png"))
        bpy.ops.render.render(write_still=True)
