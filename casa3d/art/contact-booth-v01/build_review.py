"""Blender concept geometry only. No runtime export before Form approval.
Run in Blender with PACKAGE set to this directory.
"""
import bpy, math, json
from pathlib import Path
from mathutils import Vector

out = Path(PACKAGE)
scene = bpy.data.scenes.new('ContactBooth_DesignReview')
bpy.context.window.scene = scene
scene.unit_settings.system = 'METRIC'
scene.render.engine = 'CYCLES'
scene.cycles.samples = 16
scene.render.resolution_x = 720
scene.render.resolution_y = 900
scene.render.resolution_percentage = 100
scene.world = bpy.data.worlds.new('ContactBooth_ReviewWorld')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.28,.32,.38,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value = .6

def material(name, color, metallic=0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color,1)
    mat.use_nodes = True
    p = mat.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*color,1)
    p.inputs['Metallic'].default_value = metallic
    p.inputs['Roughness'].default_value = .32
    return mat

red = material('Review_EnamelRed', (.56,.018,.025), .25)
ivory = material('Review_Ivory', (.86,.8,.62))
brass = material('Review_Brass', (.5,.29,.07), .75)
dark = material('Review_Dark', (.035,.055,.06))
glass = material('Review_GlassPlaceholder', (.14,.25,.28), .25)

def box(name, loc, dims, mat):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    ob = bpy.context.object
    ob.name = name
    ob.dimensions = dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    ob.data.materials.append(mat)
    return ob

# Front = negative Y, Blender Z is up. 1.60 x 1.60 x 3.15 metres.
box('Review_Base', (0,0,.08), (1.64,1.64,.16), red)
for x in [-.72,.72]:
    for y in [-.72,.72]:
        box('Review_Corner', (x,y,1.42), (.16,.16,2.6), red)
for side in [-1,1]:
    box('Review_SidePlinth', (side*.72,0,.36), (.12,1.35,.4),red)
    box('Review_SideGlass', (side*.72,0,1.53), (.035,1.25,1.9),glass)
    for y in [-.23,.23]:
        box('Review_SideMullion', (side*.75,y,1.54),(.08,.055,1.98),red)
    for z in [.58,.92,1.26,1.6,1.94,2.28,2.5]:
        box('Review_SideRail', (side*.75,0,z),(.08,1.35,.055),red)
box('Review_BackPanel',(0,.72,1.38),(1.36,.12,2.45),red)
box('Review_FrontLintel',(0,-.72,2.68),(1.6,.18,.3),red)
box('Review_Sign',(0,-.82,2.69),(1.27,.025,.2),ivory)
bpy.ops.object.text_add(location=(0,-.84,2.64),rotation=(math.pi/2,0,0))
text = bpy.context.object
text.name = 'Review_TELEGRAMMI'
text.data.body = 'TELEGRAMMI'
text.data.align_x = 'CENTER'
text.data.size = .14
text.data.extrude = .001
text.data.materials.append(dark)
# Rounded roof cross section, deliberately simple concept mesh.
verts=[]
for y in [-.83,.83]:
    for i in range(17):
        x=-.83+1.66*i/16
        verts.append((x,y,2.84+.31*math.sqrt(max(0,1-(x/.83)**2))))
faces=[tuple(range(16,-1,-1)),tuple(range(17,34))]
faces += [(i,i+1,i+18,i+17) for i in range(16)]
faces.append((0,17,33,16))
mesh=bpy.data.meshes.new('ReviewRoofMesh'); mesh.from_pydata(verts,[],faces); mesh.update()
roof=bpy.data.objects.new('Review_Roof',mesh); scene.collection.objects.link(roof); roof.data.materials.append(red)
# Door open outwards; no runtime collision/interaction implied by this draft.
pivot=bpy.data.objects.new('Review_DoorHinge',None); scene.collection.objects.link(pivot)
pivot.location=(-.64,-.73,.16)
for name,loc,dims,mat in [
 ('DoorBottom',(.64,0,.2),(1.28,.1,.4),red),
 ('DoorGlass',(.64,0,1.38),(1.16,.025,1.9),glass),
 ('DoorLeft',(.035,0,1.2),(.07,.1,2.4),red),
 ('DoorRight',(1.245,0,1.2),(.07,.1,2.4),red),
 ('DoorTop',(.64,0,2.37),(1.28,.1,.06),red),
 ('DoorHandle',(1.12,-.09,1.18),(.035,.065,.3),brass)]:
    ob=box('Review_'+name,loc,dims,mat); ob.parent=pivot
for z in [.45,.78,1.11,1.44,1.77,2.10]:
    ob=box('Review_DoorRail',(.64,0,z),(1.2,.08,.045),red); ob.parent=pivot
for x in [.44,.84]:
    ob=box('Review_DoorMullion',(x,0,1.38),(.04,.08,1.95),red); ob.parent=pivot
pivot.rotation_euler.z=math.radians(-100)

camdata=bpy.data.cameras.new('ReviewCamera'); cam=bpy.data.objects.new('ReviewCamera',camdata); scene.collection.objects.link(cam)
scene.camera=cam
cam.location=(4,-6,3.7)
cam.rotation_euler=(Vector((0,0,1.5))-cam.location).to_track_quat('-Z','Y').to_euler()
camdata.type='ORTHO'; camdata.ortho_scale=4.7
ld=bpy.data.lights.new('ReviewSoftbox','AREA'); lo=bpy.data.objects.new('ReviewSoftbox',ld); scene.collection.objects.link(lo)
lo.location=(1,-3,6); ld.energy=700; ld.shape='DISK'; ld.size=5
scene.render.filepath=str(out/'renders'/'exterior-concept.png')
bpy.ops.render.render(write_still=True)
# Lower plan from actual mesh bounds: open door, structural sections, sill.
items=[]
for ob in scene.objects:
    if ob.type!='MESH' or ob.name=='Review_Roof': continue
    pts=[ob.matrix_world@Vector(v) for v in ob.bound_box]
    if min(p.z for p in pts) <= 1.2 <= max(p.z for p in pts):
        items.append([(p.x,p.y) for p in pts])
def hull(points):
    pts=sorted(set(points))
    def cross(o,a,b): return (a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0])
    lower=[]; upper=[]
    for p in pts:
        while len(lower)>1 and cross(lower[-2],lower[-1],p)<=0: lower.pop()
        lower.append(p)
    for p in reversed(pts):
        while len(upper)>1 and cross(upper[-2],upper[-1],p)<=0: upper.pop()
        upper.append(p)
    return lower[:-1]+upper[:-1]
polys=''.join('<polygon points="'+ ' '.join(f'{300+x*135:.1f},{230+y*135:.1f}' for x,y in hull(p))+'" fill="white" stroke="black" stroke-width="2"/>' for p in items)
(out/'plans'/'lower-room.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="640" viewBox="0 0 600 640"><rect width="600" height="640" fill="white"/>'+polys+'</svg>',encoding='utf-8')
bpy.ops.wm.save_as_mainfile(filepath=str(out/'contact-booth-review.blend'),copy=True)
result={'draft':True,'scene':scene.name,'render':scene.render.filepath,'runtimeExported':False}
