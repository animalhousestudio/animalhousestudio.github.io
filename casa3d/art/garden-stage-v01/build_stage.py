"""Rebuild the editable garden stage without changing any existing scene.

Run in Blender's Python console or with blender --background --python this_file.
The asset uses real metres, Z up, with the audience toward -Y.
"""
import bpy
import json
import math
import random
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parent
ROOT.mkdir(parents=True, exist_ok=True)
(ROOT / 'renders').mkdir(exist_ok=True)
random.seed(31)

scene = bpy.data.scenes.new('GardenStage_Review')
bpy.context.window.scene = scene
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 1.0
asset = bpy.data.collections.new('GardenStage_ASSET')
scene.collection.children.link(asset)
studio = bpy.data.collections.new('ReviewStudio_DO_NOT_EXPORT')
scene.collection.children.link(studio)
root = bpy.data.objects.new('GardenStage', None)
asset.objects.link(root)
root['asset_id'] = 'garden-stage'
root['front'] = '-Y (Blender), +Z (glTF)'
root['units'] = 'metres; integrate under WORLD_SCALE=5 with scale=0.2'
root['deck_top_m'] = 0.64
root['scope'] = 'editable asset design; world placement pending'

def material(name, color, metallic=0.0, roughness=0.5):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    bs = m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value = (*color, 1)
    bs.inputs['Metallic'].default_value = metallic
    bs.inputs['Roughness'].default_value = roughness
    return m

steel = material('Stage_SatinSilver', (0.34, 0.38, 0.39), 0.72, 0.32)
dark = material('Stage_CharcoalSteel', (0.026, 0.033, 0.039), 0.45, 0.43)
black = material('Stage_SpeakerCabinet', (0.013, 0.019, 0.023), 0.04, 0.65)
grille = material('Stage_SpeakerGrille', (0.037, 0.049, 0.055), 0.3, 0.78)
rubber = material('Stage_Rubber', (0.009, 0.012, 0.014), 0, 0.86)
warm = material('Stage_WarmLens', (0.9, 0.58, 0.23), 0.12, 0.26)
bs = warm.node_tree.nodes.get('Principled BSDF')
bs.inputs['Emission Color'].default_value = (1.0, 0.55, 0.18, 1)
bs.inputs['Emission Strength'].default_value = 1.1
woods = []
for i, tone in enumerate((0.9, 0.96, 1.0, 1.04, 1.1)):
    m = material(f'Stage_Walnut_{i+1}', (0.13*tone, 0.047*tone, 0.015*tone), 0, 0.64)
    # Restrained longitudinal grain; editable shader source, no external textures.
    nt = m.node_tree
    coord = nt.nodes.new('ShaderNodeTexCoord')
    mapping = nt.nodes.new('ShaderNodeVectorMath')
    mapping.operation = 'MULTIPLY'
    mapping.inputs[1].default_value = (1.4, 45, 10)
    nt.links.new(coord.outputs['Generated'], mapping.inputs[0])
    noise = nt.nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 3.0
    noise.inputs['Detail'].default_value = 2.0
    noise.inputs['Roughness'].default_value = 0.62
    nt.links.new(mapping.outputs['Vector'], noise.inputs['Vector'])
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = 0.20
    ramp.color_ramp.elements[0].color = (0.065*tone, 0.021*tone, 0.006*tone, 1)
    ramp.color_ramp.elements[1].position = 0.8
    ramp.color_ramp.elements[1].color = (0.17*tone, 0.068*tone, 0.021*tone, 1)
    nt.links.new(noise.outputs['Fac'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], nt.nodes.get('Principled BSDF').inputs['Base Color'])
    bump = nt.nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.11
    bump.inputs['Distance'].default_value = 0.008
    nt.links.new(noise.outputs['Fac'], bump.inputs['Height'])
    nt.links.new(bump.outputs['Normal'], nt.nodes.get('Principled BSDF').inputs['Normal'])
    woods.append(m)

def finish(obj, name, mat, coll=asset, bevel=0):
    obj.name = name
    for c in tuple(obj.users_collection):
        c.objects.unlink(obj)
    coll.objects.link(obj)
    if coll == asset:
        obj.parent = root
    if mat:
        obj.data.materials.append(mat)
    if bevel:
        mod = obj.modifiers.new('Soft manufactured edges', 'BEVEL')
        mod.width = bevel
        mod.segments = 2
        mod = obj.modifiers.new('Weighted corner normals', 'WEIGHTED_NORMAL')
        mod.keep_sharp = True
    return obj

def box(name, pos, size, mat, bevel=0.01, coll=asset):
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos)
    obj = bpy.context.object
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, name, mat, coll, bevel)

def tube(name, a, b, radius, mat=steel, segments=12):
    a, b = Vector(a), Vector(b)
    delta = b-a
    bpy.ops.mesh.primitive_cylinder_add(vertices=segments, radius=radius,
                                      depth=delta.length, location=(a+b)*0.5)
    obj = bpy.context.object
    obj.rotation_mode = 'QUATERNION'
    obj.rotation_quaternion = delta.to_track_quat('Z', 'Y')
    for poly in obj.data.polygons:
        poly.use_smooth = len(poly.vertices) == 4
    return finish(obj, name, mat)

# A solid deck with individually editable planks; narrow joints never open
# directly to the ground. The physical top will use one simple runtime slab.
box('Stage_DeckSubstrate', (0,0,0.52), (8,4,0.16), dark, 0.008)
box('Stage_Fascia_Front', (0,-1.97,0.275), (8,0.10,0.55), dark, 0.014)
box('Stage_Fascia_Rear', (0,1.97,0.275), (8,0.10,0.55), dark, 0.014)
for side in (-1,1):
    box(f'Stage_Fascia_Side_{side}', (side*3.95,0,0.275), (0.1,3.84,0.55), dark)
for row in range(20):
    y = -1.9 + row*0.2
    splits = (-4, -1.4, 1.25, 4) if row%2 == 0 else (-4, -2.5, 0.15, 2.8, 4)
    for col, (a,b) in enumerate(zip(splits, splits[1:])):
        o = box(f'Stage_Plank_{row+1:02}_{col+1}', ((a+b)/2,y,0.62),
                (b-a-0.006,0.194,0.04), woods[random.randrange(5)], 0.003)
        o['role'] = 'wood walking surface'

# Four clean uprights and an open tubular rectangular rig. Sparse knee braces
# make the support readable, without dense triangular concert trusses.
for x in (-3.74,3.74):
    for y in (-1.72,1.72):
        tag = f'{"L" if x<0 else "R"}_{"Front" if y<0 else "Rear"}'
        box(f'Stage_PostFoot_{tag}', (x,y,0.668), (0.32,0.32,0.056), steel, 0.018)
        tube(f'Stage_Post_{tag}', (x,y,0.68), (x,y,4.52), 0.075)
        tube(f'Stage_KneeX_{tag}', (x,y,3.81), (x-math.copysign(0.64,x),y,4.45), 0.037)
        tube(f'Stage_KneeY_{tag}', (x,y,3.84), (x,y-math.copysign(0.57,y),4.41), 0.033)
for y in (-1.72,1.72):
    tube(f'Stage_Header_{y}', (-3.81,y,4.48), (3.81,y,4.48), 0.075)
for x in (-3.74,3.74):
    tube(f'Stage_SideBeam_{x}', (x,-1.72,4.48), (x,1.72,4.48), 0.065)
# The low front rail carries the four lamps; five short vertical ties only.
tube('Stage_LightingRail', (-3.74,-1.72,4.19), (3.74,-1.72,4.19), 0.05)
for x in (-3.74,-1.87,0,1.87,3.74):
    tube(f'Stage_RailTie_{x}', (x,-1.72,4.19), (x,-1.72,4.48), 0.032)

fixtures = []
for n,x in enumerate((-2.7,-0.9,0.9,2.7),1):
    pivot = Vector((x,-1.72,3.86))
    direction = Vector((0,0.48,-0.88)).normalized()
    tube(f'Stage_LampHook_{n}', (x,-1.72,4.2), (x,-1.72,4.04), 0.022,dark)
    for side in (-1,1):
        box(f'Stage_LampYoke_{n}_{side}', (x+side*0.17,-1.72,3.99), (0.027,0.05,0.25),dark,0.006)
        tube(f'Stage_LampPivot_{n}_{side}', (x+side*0.132,-1.72,3.88),
             (x+side*0.185,-1.72,3.88),0.026,steel)
    box(f'Stage_LampYokeTop_{n}', (x,-1.72,4.1),(0.36,0.05,0.03),dark,0.006)
    tube(f'Stage_LampHousing_{n}', pivot-direction*0.13, pivot+direction*0.13,0.144,black,16)
    tube(f'Stage_LampRim_{n}', pivot+direction*0.115,pivot+direction*0.155,0.151,dark,16)
    tube(f'Stage_LampLens_{n}', pivot+direction*0.149,pivot+direction*0.158,0.129,warm,16)
    fixtures.append({'id': f'stage-light-{n}', 'positionMeters':list(pivot),
                     'direction':list(direction), 'color':[1,0.55,0.18],
                     'runtimePolicy':'emissive lens; no dynamic light by default'})

# Matching compact ground speakers, replacing the tall suspended line arrays.
for side in (-1,1):
    x = side*4.58
    label = 'Left' if side<0 else 'Right'
    box(f'Stage_Sub_{label}', (x,-1.40,0.44),(0.8,0.73,0.88),black,0.035)
    box(f'Stage_SubGrille_{label}', (x,-1.775,0.45),(0.67,0.025,0.70),grille,0.006)
    tube(f'Stage_SpeakerMast_{label}', (x,-1.4,0.86),(x,-1.4,1.43),0.028,dark)
    box(f'Stage_TopSpeaker_{label}', (x,-1.4,1.83),(0.59,0.49,0.84),black,0.035)
    box(f'Stage_TopGrille_{label}', (x,-1.654,1.83),(0.49,0.025,0.71),grille,0.006)

# Two short front access stairs: four equal risers including the deck lip.
for x in (-2.65,2.65):
    label = 'Left' if x<0 else 'Right'
    for i in range(3):
        y = -2.90+i*0.36
        top = 0.16*(i+1)
        box(f'Stage_StairRiser_{label}_{i+1}', (x,y,(top-0.04)/2),
            (1.3,0.35,top-0.04),dark,0.008)
        box(f'Stage_StairTread_{label}_{i+1}', (x,y,top-0.02),
            (1.34,0.36,0.04),woods[2],0.005)
    for edge in (-1,1):
        ex=x+edge*0.68
        tube(f'Stage_StairStringer_{label}_{edge}', (ex,-3.055,0.06),(ex,-1.955,0.54),0.026,dark)

# Low monitor wedges with genuinely sloped faces, and one unobtrusive mic.
for side in (-1,1):
    x=side*1.6
    verts=[(-.29,-.24,0),(.29,-.24,0),(.29,.24,0),(-.29,.24,0),
           (-.29,-.24,.32),(.29,-.24,.32),(.29,.24,.15),(-.29,.24,.15)]
    faces=[(0,3,2,1),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7),(4,5,6,7)]
    mesh=bpy.data.meshes.new(f'Stage_MonitorMesh_{side}')
    mesh.from_pydata(verts,[],faces)
    mesh.update()
    obj=bpy.data.objects.new(f'Stage_Monitor_{side}',mesh)
    asset.objects.link(obj)
    obj.parent=root
    obj.location=(x,-1.43,.64)
    mesh.materials.append(black)
    mesh.materials.append(grille)
    mesh.polygons[-1].material_index=1
    bevel=obj.modifiers.new('Soft cabinet edges','BEVEL')
    bevel.width=.016
    bevel.segments=2
    obj.modifiers.new('Cabinet normals','WEIGHTED_NORMAL')
tube('Stage_MicrophoneBase', (0,-.55,.643),(0,-.55,.677),.17,black,24)
tube('Stage_MicrophoneStand', (0,-.55,.672),(0,-.55,2.16),.012,dark)
tube('Stage_Microphone', (0,-.55,2.15),(0,-.61,2.30),.024,black,12)

# Review rig is its own collection, excluded from asset export by contract.
ground = material('Review_WarmGrey',(.34,.355,.33),0,.86)
box('Review_Ground',(0,0,-.08),(200,200,.15),ground,0,studio)
world=bpy.data.worlds.new('GardenStage_StudioWorld')
world.use_nodes=True
world.node_tree.nodes['Background'].inputs['Color'].default_value=(0.66,.73,.82,1)
world.node_tree.nodes['Background'].inputs['Strength'].default_value=.45
scene.world=world

def area(name,pos,power,size,target=(0,0,1.6)):
    data=bpy.data.lights.new(name,'AREA')
    data.energy=power
    data.shape='DISK'
    data.size=size
    obj=bpy.data.objects.new(name,data)
    studio.objects.link(obj)
    obj.location=pos
    obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
area('Review_Key',(-3,-6,10),2100,7)
area('Review_Fill',(6,-1,7),1350,6)
area('Review_Rim',(-2,6,9),2400,5)
camera_data=bpy.data.cameras.new('GardenStage_ReviewCamera')
camera=bpy.data.objects.new('GardenStage_ReviewCamera',camera_data)
studio.objects.link(camera)
camera.location=(11,-17,10)
camera.rotation_euler=(Vector((0,-.1,2))-camera.location).to_track_quat('-Z','Y').to_euler()
camera_data.type='ORTHO'
camera_data.ortho_scale=12.8
scene.camera=camera
scene.render.engine='CYCLES'
scene.cycles.samples=48
scene.cycles.use_denoising=True
scene.render.resolution_x=1600
scene.render.resolution_y=1100
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.render.filepath=str(ROOT/'renders'/'stage-three-quarter.png')
scene.view_settings.view_transform='AgX'
scene.render.film_transparent=False

# Make the asset immediately visible and editable in the connected Blender UI.
for obj in tuple(bpy.context.selected_objects):
    obj.select_set(False)
root.select_set(True)
bpy.context.view_layer.objects.active=root
for screen in bpy.data.screens:
    for area_ui in screen.areas:
        if area_ui.type=='VIEW_3D':
            space=area_ui.spaces.active
            space.region_3d.view_rotation=camera.rotation_euler.to_quaternion()
            space.region_3d.view_distance=15
            space.region_3d.view_location=(0,0,2)
            space.shading.type='MATERIAL'
            space.overlay.show_extras=False
            space.overlay.show_floor=False

bpy.context.view_layer.update()
depsgraph=bpy.context.evaluated_depsgraph_get()
triangles=0
mesh_objects=0
low=Vector((float('inf'),)*3)
high=Vector((float('-inf'),)*3)
for obj in asset.objects:
    if obj.type!='MESH':
        continue
    mesh_objects+=1
    evaluated=obj.evaluated_get(depsgraph)
    mesh=evaluated.to_mesh()
    mesh.calc_loop_triangles()
    triangles+=len(mesh.loop_triangles)
    for vert in mesh.vertices:
        p=evaluated.matrix_world@vert.co
        for axis in range(3):
            low[axis]=min(low[axis],p[axis])
            high[axis]=max(high[axis],p[axis])
    evaluated.to_mesh_clear()
report={'asset':'garden-stage','source':'garden-stage.blend',
        'meshObjects':mesh_objects,'evaluatedTriangles':triangles,
        'boundsMinMeters':list(low),'boundsMaxMeters':list(high),
        'dimensionsMeters':list(high-low),'deckMeters':[8,4,.64],
        'lampCount':len(fixtures),'humanApproval':'pending',
        'runtimeExported':False,'runtimeTested':False}
(ROOT/'geometry-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
(ROOT/'fixtures.json').write_text(json.dumps(fixtures,indent=2),encoding='utf-8')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'garden-stage-small.blend'),compress=True)
# Current approved revision enlarges the structure and keeps stage equipment
# at human scale; preserve the initial source as an independently usable asset.
resize=ROOT/'resize_stage.py'
exec(compile(resize.read_text(encoding='utf-8'),str(resize),'exec'),
     {'__file__':str(resize),'__name__':'__main__'})
result={'source':'garden-stage.blend','structureScale':3}
