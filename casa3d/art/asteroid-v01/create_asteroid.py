"""Run in Blender. Standalone review asset; does not alter the game or other scenes."""
import bpy
import bmesh
import math
import json
import random
from pathlib import Path
from mathutils import Vector, noise

OUT = Path(__file__).resolve().parent
OUT.mkdir(parents=True, exist_ok=True)
SCENE_NAME = 'Asteroid_Review_v01'
if SCENE_NAME in bpy.data.scenes:
    raise RuntimeError('Review scene already exists; revise it explicitly instead of duplicating it.')
scene = bpy.data.scenes.new(SCENE_NAME)
bpy.context.window.scene = scene
scene.unit_settings.system = 'METRIC'
asset = bpy.data.collections.new('ASSET_Asteroid')
studio = bpy.data.collections.new('PREVIEW_Lights_Cameras')
scene.collection.children.link(asset)
scene.collection.children.link(studio)
root = bpy.data.objects.new('Asteroid_Root', None)
asset.objects.link(root)
root['surface_height_blender'] = 0.0
root['surface_height_gltf'] = 0.0
root['purpose'] = 'Review only. Grass remains instanced in the game. No collision mesh included.'
root['version'] = 'v01'

def material(name, color):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Roughness'].default_value = .94
    vertex = mat.node_tree.nodes.new('ShaderNodeVertexColor')
    vertex.layer_name = 'Color'
    mat.node_tree.links.new(vertex.outputs['Color'], bsdf.inputs['Base Color'])
    return mat

rock_mat = material('Rock_Shared', (.22, .20, .18))
soil_mat = material('Soil_Shared', (.19, .22, .10))
N = 160
TAU = math.tau
rng = random.Random(7091)
angles = [TAU * (i + rng.uniform(-.24,.24)) / N for i in range(N)]

def outline(t):
    return 1 + .061*math.sin(3*t+.7) + .038*math.sin(7*t+1.8) + .021*math.sin(13*t-.4) + .011*math.sin(31*t)

def edge(t):
    r = outline(t)
    return (50*r*math.cos(t), 46*r*math.sin(t))

def coherent(x,y,z, scale):
    return noise.noise_vector(Vector((x*scale+3.7,y*scale+9.1,z*scale+1.3)))[0]

def make_mesh(name, vertices, faces, mat, is_soil=False):
    mesh = bpy.data.meshes.new(name + '_Geometry')
    mesh.from_pydata(vertices, [], faces)
    mesh.validate(verbose=False)
    mesh.update()
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name,mesh)
    asset.objects.link(obj)
    obj.parent = root
    mesh.materials.append(mat)
    colors = mesh.color_attributes.new(name='Color', type='BYTE_COLOR', domain='POINT')
    for v,c in zip(mesh.vertices, colors.data):
        x,y,z = v.co
        broad = coherent(x,y,z,.095)
        fine = coherent(x,y,z,.51)
        if is_soil:
            variation = .88 + .30*broad + .07*fine
            rgb = (.185*variation,.205*variation,.092*variation)
        else:
            variation = .96 + .26*broad + .11*fine
            # A restrained warm soil band over cooler exposed bedrock.
            soil = max(0, min(1, (z+5)/5))
            rgb = tuple(((.20,.225,.235)[i]*(1-soil)+(.24,.178,.108)[i]*soil)*variation for i in range(3))
        c.color = (*rgb,1)
    return obj

# Flat disk. Its open perimeter intentionally meets the shell's identical rim.
verts = [(0,0,0)]
for radius in [.20,.40,.60,.79,.93,1.0]:
    for t in angles:
        x,y = edge(t)
        verts.append((x*radius,y*radius,0))
faces = [(0,1+i,1+(i+1)%N) for i in range(N)]
for j in range(5):
    for i in range(N):
        a=1+j*N+i; b=1+j*N+(i+1)%N; c=a+N; d=b+N
        faces.extend([(a,c,d),(a,d,b)])
top = make_mesh('Asteroid_Surface',verts,faces,soil_mat,True)
top['note'] = 'Exactly planar at z=0; separate to allow future house/stair opening and lawn material.'

# One continuous shell, with longitudinal fractures and asymmetrical hanging spurs.
# Detail is actual silhouette geometry; there are no overlapping rock objects.
profiles = [(1,0),(1.008,-.65),(.992,-1.8),(.981,-3.8),(.961,-6.5)] + [(r,-9) for r in [.92,.87,.82,.77,.72,.67,.62,.57,.52,.47,.42,.37,.32,.27,.22,.17,.12,.065]]
verts=[]
for j,(radius,depth) in enumerate(profiles):
    for i,t in enumerate(angles):
        x,y=edge(t)
        strength=math.sin(math.pi*min(1,j/19))
        groove=(.028*math.sin(23*t+.2)+.018*math.sin(41*t+1.4))
        radial=radius + groove*strength
        if j>1:
            radial += .010*coherent(x,y,depth,.24)
        u,v=radius*math.cos(t),radius*math.sin(t)
        z=depth
        if j>=5:
            z=-9-6*(1-radius)
            # Spatially separated peaks leave visible recesses between hanging rocks.
            peaks=[(.03,.02,43,.25),(-.48,-.25,30,.18),(.40,-.44,26,.17),(.39,.37,28,.19),(-.30,.48,24,.16),(-.68,.16,16,.12)]
            depths=[h*max(0,1-math.hypot(u-px,v-py)/w)**.72 for px,py,h,w in peaks]
            z-=max(depths)
            z-=2.3*(.5+.5*math.sin(17*t+.4))**5*math.sin(math.pi*radius)
        if j>1:
            z += (1.4*math.sin(4*t+j*.27)+.65*math.sin(17*t+j*.5))*min(1,j/4)
            z += .65*coherent(x,y,depth,.4)
        shift=max(0,1-radius)**1.5
        verts.append((x*radial+8*shift,y*radial+3*shift,z))
faces=[]
for j in range(len(profiles)-1):
    for i in range(N):
        a=j*N+i; b=j*N+(i+1)%N; c=a+N; d=b+N
        if (i+j)%2:
            faces.extend([(a,c,b),(b,c,d)])
        else:
            faces.extend([(a,c,d),(a,d,b)])
tip=len(verts)
verts.append((8,3,-55))
start=(len(profiles)-1)*N
faces.extend([(start+i,tip,start+(i+1)%N) for i in range(N)])
shell=make_mesh('Asteroid_Rock',verts,faces,rock_mat)
shell['note']='Single connected shell, open only at the surface seam. No duplicated or internal faces.'

world=bpy.data.worlds.new('Preview_Space')
world.use_nodes=True
world.node_tree.nodes['Background'].inputs[0].default_value=(.025,.034,.060,1)
world.node_tree.nodes['Background'].inputs[1].default_value=.45
scene.world=world

def aim(obj,point):
    obj.rotation_euler=(Vector(point)-obj.location).to_track_quat('-Z','Y').to_euler()

def area(name,location,power,color,size):
    data=bpy.data.lights.new(name,'AREA')
    data.energy=power
    data.color=color
    data.shape='DISK'
    data.size=size
    obj=bpy.data.objects.new(name,data)
    studio.objects.link(obj)
    obj.location=location
    aim(obj,(0,0,-18))

area('Key_Warm',(30,-80,100),180000,(1,.88,.73),75)
area('Fill_Soft',(-85,-45,20),120000,(.56,.76,1),65)
area('Rim_Cool',(10,75,20),220000,(.38,.70,1),55)
area('Lower_Fill',(25,-90,-60),45000,(.66,.75,1),55)
camera_data=bpy.data.cameras.new('Review_Camera')
camera=bpy.data.objects.new('Review_Camera',camera_data)
studio.objects.link(camera)
camera.location=(110,-180,40)
aim(camera,(0,0,-18))
camera_data.type='ORTHO'
camera_data.ortho_scale=130
scene.camera=camera
scene.render.engine='CYCLES'
scene.cycles.samples=32
scene.cycles.use_denoising=True
scene.render.resolution_x=1400
scene.render.resolution_y=1200
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.render.filepath=str(OUT/'asteroid-v01-preview.png')
scene.view_settings.view_transform='AgX'
for obj in bpy.context.view_layer.objects:
    obj.select_set(False)
top.select_set(True)
shell.select_set(True)
root.select_set(True)
bpy.context.view_layer.objects.active=shell
bpy.context.view_layer.update()
for screen in bpy.data.screens:
    for area_ui in screen.areas:
        if area_ui.type=='VIEW_3D':
            space=area_ui.spaces.active
            space.region_3d.view_distance=150
            space.region_3d.view_location=(0,0,-20)
            space.region_3d.view_rotation=camera.rotation_euler.to_quaternion()
            space.shading.type='MATERIAL'

# glTF exports only the selected asset. Preview cameras/lights never ship.
bpy.ops.export_scene.gltf(filepath=str(OUT/'asteroid-v01.glb'),export_format='GLB',use_selection=True,use_active_scene=True,export_yup=True,export_animations=False,export_cameras=False,export_lights=False)
# Write only the new scene and its dependencies, preserving the pre-existing scene.
bpy.data.libraries.write(str(OUT/'asteroid-v01.blend'),{scene},fake_user=True,compress=True)
stats={'version':'v01','meshes':2,'materials':2,'triangles':sum(len(o.data.polygons) for o in (top,shell)),'vertices':sum(len(o.data.vertices) for o in (top,shell)), 'glb_bytes':(OUT/'asteroid-v01.glb').stat().st_size,'grass_included':False,'game_modified':False,'bounds_blender':{'min':[min(v.co[i] for o in (top,shell) for v in o.data.vertices) for i in range(3)],'max':[max(v.co[i] for o in (top,shell) for v in o.data.vertices) for i in range(3)]}}
(OUT/'stats.json').write_text(json.dumps(stats,indent=2),encoding='utf-8')
result=stats
