"""Author v10 from preserved v09. Save editable source and game asset; no build/QA."""
import bpy, bmesh, json, math
from pathlib import Path
from mathutils import Vector, Matrix

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[1]
S = bpy.context.scene
SOURCE = bpy.data.filepath
assert S.name == 'Mansion_Architecture_v09_Trees', 'Start from the preserved v09'
if bpy.context.mode != 'OBJECT':
    bpy.ops.object.mode_set(mode='OBJECT')
STOPS = [-6.6, 1.487, 9.912, 17.2, 25.72]
RADIUS, HOLE, CABIN, SEGMENTS = .22, .23, .16, 24
HEIGHT, DOOR_HALF = .46, .10
ANGLE = math.asin(DOOR_HALF / RADIUS)
LOG = []
COL = bpy.data.collections.new('M10_01_Compact_Circular_Elevator')
S.collection.children.link(COL)
glass = bpy.data.materials['M05_Elevator_Glass']
frame = bpy.data.materials['M05_Elevator_Frame']
landing = bpy.data.materials['M05_Elevator_Landing']

def mesh(name, vertices, faces, material=None):
    data = bpy.data.meshes.new(name + '_Mesh')
    data.from_pydata(vertices, [], faces)
    data.update()
    bm = bmesh.new(); bm.from_mesh(data)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(data); bm.free()
    if material: data.materials.append(material)
    obj = bpy.data.objects.new(name, data); COL.objects.link(obj)
    return obj

def box(name, low, high, material=None):
    vertices = [(x,y,z) for x in [low[0],high[0]] for y in [low[1],high[1]] for z in [low[2],high[2]]]
    return mesh(name,vertices,[(0,4,6,2),(1,3,7,5),(0,1,5,4),(2,6,7,3),(0,2,3,1),(4,5,7,6)],material)

def tube(name, inner, outer, bottom, top, start=0, sweep=2*math.pi, segments=SEGMENTS, material=frame):
    full = abs(sweep-2*math.pi)<1e-8
    n = segments if full else segments+1
    angles = [start+sweep*i/segments for i in range(n)]
    v = [(r*math.sin(a),-r*math.cos(a),z) for z in [bottom,top] for r in [inner,outer] for a in angles]
    f = []
    for i in range(segments):
        j=(i+1)%n
        f.extend([(i,j,n+j,n+i),(2*n+i,3*n+i,3*n+j,2*n+j),
                  (i,2*n+i,2*n+j,j),(n+i,n+j,3*n+j,3*n+i)])
    if not full:
        f += [(0,n,3*n,2*n),(n-1,3*n-1,4*n-1,2*n-1)]
    obj=mesh(name,v,f,material)
    # Cylindrical walls smooth around their circumference; horizontal caps flat.
    for p in obj.data.polygons:
        p.use_smooth=abs(p.normal.z)<.1
    return obj

def glazing(name, bottom, top, start, sweep, segments):
    angles=[start+sweep*i/segments for i in range(segments+1)]
    v=[(RADIUS*math.sin(a),-RADIUS*math.cos(a),z) for z in [bottom,top] for a in angles]
    n=segments+1
    obj=mesh(name,v,[(i,i+1,n+i+1,n+i) for i in range(segments)],glass)
    for p in obj.data.polygons:p.use_smooth=True
    return obj

def apply_boolean(obj, cutter, operation, label):
    bpy.context.view_layer.update()
    mod=obj.modifiers.new(label,'BOOLEAN');mod.operation=operation;mod.solver='EXACT';mod.object=cutter
    bpy.context.view_layer.objects.active=obj
    bpy.ops.object.modifier_apply(modifier=mod.name)

def bounds(obj):
    points=[obj.matrix_world@Vector(v) for v in obj.bound_box]
    return [min(p[i] for p in points) for i in range(3)], [max(p[i] for p in points) for i in range(3)]

def cylinder(name,radius,bottom,top):
    bpy.ops.mesh.primitive_cylinder_add(vertices=SEGMENTS,radius=radius,depth=top-bottom,
                                      end_fill_type='NGON',location=(0,0,(bottom+top)/2))
    obj=bpy.context.object;obj.name=name
    return obj

# Replace the old square shaft, oversized thresholds and static cabin in this
# revision only. The preceding blend remains the complete recoverable source.
removed=[]
for obj in list(S.objects):
    if obj.name.startswith(('M05_Elevator_', 'M06_Lift_')) and obj.name!='M06_Lift_RoofClearance_Cutter':
        removed.append(obj.name);bpy.data.objects.remove(obj,do_unlink=True)

# Recover the whole old square hole, then cut one shared circular clearance.
# Union keeps the original curved exterior perimeter and floor material intact.
floor_specs=[('M01_Reuse_INT_Slab_Living',2.1),('M01_Reuse_INT_Slab_Kitchen',2.1),
             ('M01_UpperFloor_Slab',1.9),('M01_UpperFloor_Ceiling',1.9),
             ('M06_Observatory_InteriorFloor',1.9),('M01_Reuse_CURVE_Roof_Soffit',1.8)]
for name,old_half in floor_specs:
    obj=S.objects[name]
    # Bake only the soffit's existing thickness before restoring its hole.
    for mod in list(obj.modifiers):
        bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=mod.name)
    obj.data=obj.data.copy()
    bpy.context.view_layer.update();low,high=bounds(obj)
    patch=box('M10_Temporary_FloorRestore',(-old_half-.01,-old_half-.01,low[2]),
              (old_half+.01,old_half+.01,high[2]),obj.data.materials[0])
    apply_boolean(obj,patch,'UNION','M10_Restore_Usable_Floor')
    bpy.data.objects.remove(patch,do_unlink=True)
    cutter=cylinder('M10_Temporary_CircularAperture',HOLE,low[2]-1,high[2]+1)
    apply_boolean(obj,cutter,'DIFFERENCE','M10_Circular_Lift_Opening')
    bpy.data.objects.remove(cutter,do_unlink=True)
    obj['lift_opening_radius']=HOLE
    LOG.append(dict(object=name,change='Recovered square opening; cut 24-sided circular shaft clearance'))

# Reduce the live roof Boolean too, restoring the roof around the tiny shaft.
old=S.objects.get('M06_Lift_RoofClearance_Cutter')
if old:
    replacement=cylinder('M10_Lift_RoofClearance_Cutter',HOLE,21.7,28.7)
    replacement.display_type='WIRE';replacement.hide_render=True;replacement.hide_set(True)
    for obj in S.objects:
        for mod in obj.modifiers:
            if mod.type=='BOOLEAN' and mod.object==old:mod.object=replacement
    bpy.data.objects.remove(old,do_unlink=True)

bottom,top=STOPS[0],STOPS[-1]+HEIGHT+.06
glazing('M10_Elevator_Shaft_Glass',bottom,top,ANGLE,2*math.pi-2*ANGLE,20)
last=bottom
for i,z in enumerate(STOPS):
    if z>last:
        glazing(f'M10_Elevator_Shaft_Glass_Front_{i:02d}',last,z,-ANGLE,2*ANGLE,4)
    last=z+HEIGHT
if top>last:glazing('M10_Elevator_Shaft_Glass_Front_Top',last,top,-ANGLE,2*ANGLE,4)

# Four slender rails and five restrained circular bands echo the reference.
for i,a in enumerate([ANGLE,-ANGLE,math.pi*.72,math.pi*1.28]):
    x,y=RADIUS*math.sin(a),-RADIUS*math.cos(a)
    # Posts sit outside the clear 1 m entrance rather than narrowing it.
    if i<2:x += .006 if x>0 else -.006
    box(f'M10_Elevator_Shaft_Post_{i}',(x-.006,y-.006,bottom),(x+.006,y+.006,top),frame)
for i,z in enumerate(STOPS):
    tube(f'M10_Elevator_Landing_Band_{i:02d}',RADIUS-.004,RADIUS+.006,z-.016,z)
    tube(f'M10_Elevator_DoorHeader_{i:02d}',RADIUS-.004,RADIUS+.006,z+HEIGHT,z+HEIGHT+.012,
         -ANGLE,2*ANGLE,4)
    a=math.asin(DOOR_HALF/CABIN)
    tube(f'M10_Lift_BoardingBridge_{i:02d}',CABIN+.006,HOLE+.005,z-.024,z,-a,2*a,6,landing)
tube('M10_Elevator_TopRing',RADIUS-.004,RADIUS+.006,top-.016,top)
controller=bpy.data.objects.new('M10_Elevator_Controller',None);COL.objects.link(controller)
controller['stop_floor_z']=STOPS;controller['cabin_radius']=CABIN;controller['runtime_cabin']='src/rooms/elevator.mjs'

# One conservative topology pass: dissolve near-coplanar redundant divisions,
# preserving seams, UVs, material breaks and sharp shading. No collapse decimate
# on silhouettes, cats, foliage, collision openings or the new elevator.
optimized=[];seen=set()
for obj in list(S.objects):
    if obj.type!='MESH' or obj.hide_render or obj.modifiers or obj.name.startswith('M10_'):continue
    if any(k in obj.name for k in ['Cat','TREE','Tree','Flower','Ivy','Plant','Leaf','Leaves','Foliage','JETPACK']):continue
    data=obj.data
    if data in seen or len(data.polygons)<80:continue
    seen.add(data)
    data.calc_loop_triangles();before=len(data.loop_triangles)
    bm=bmesh.new();bm.from_mesh(data)
    bmesh.ops.dissolve_limit(bm,angle_limit=math.radians(.5),verts=list(bm.verts),edges=list(bm.edges),
                            delimit={'NORMAL','MATERIAL','SEAM','UV'})
    bm.to_mesh(data);bm.free();data.update();data.calc_loop_triangles()
    after=len(data.loop_triangles)
    if before!=after:optimized.append(dict(mesh=data.name,before=before,after=after,instances=data.users))

S.name='Mansion_Architecture_v10_CircularLift'
S['source_revision']=SOURCE
S['revision_notes']='Single-person circular glass lift; restored floors; conservative topology pass; stopped before build and QA at user request.'
bpy.context.view_layer.update()

# Source metrics are recorded while writing the artifact, not a validation run.
objects=[o for o in S.objects if o.type in {'MESH','EMPTY'} and not o.hide_render
         and not any('Presentation' in c.name or 'Review_Views' in c.name for c in o.users_collection)]
dg=bpy.context.evaluated_depsgraph_get();triangles=0;polygons=0
for obj in objects:
    if obj.type=='MESH':
        ev=obj.evaluated_get(dg);data=ev.to_mesh();data.calc_loop_triangles()
        triangles+=len(data.loop_triangles);polygons+=len(data.polygons);ev.to_mesh_clear()
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'mansion-v10-circular-lift.blend'),compress=True)

# Export prepared asset into source assets only; never run Vite/deploy here.
bpy.ops.object.select_all(action='DESELECT')
temporary=[]
try:
    for obj in objects:
        if obj.type=='MESH' and obj.modifiers:
            data=bpy.data.meshes.new_from_object(obj.evaluated_get(dg),preserve_all_data_layers=True,depsgraph=dg)
            temporary.append((obj,obj.data,data,[(m,m.show_viewport,m.show_render) for m in obj.modifiers]))
            obj.data=data
            for mod in obj.modifiers:mod.show_viewport=False;mod.show_render=False
        obj.hide_set(False);obj.select_set(True)
    bpy.context.view_layer.update()
    bpy.ops.export_scene.gltf(filepath=str(ROOT/'src/assets/models/mansion-v10.glb'),export_format='GLB',
        use_selection=True,export_apply=False,export_extras=False,export_cameras=False,export_lights=False)
finally:
    for obj,source,data,mods in temporary:
        obj.data=source
        for mod,viewport,render in mods:mod.show_viewport=viewport;mod.show_render=render
        bpy.data.meshes.remove(data)
report=dict(source=SOURCE,blend=str(OUT/'mansion-v10-circular-lift.blend'),
            asset=str(ROOT/'src/assets/models/mansion-v10.glb'),triangles=triangles,polygons=polygons,
            optimized=optimized,removed_square_lift_objects=len(removed),floor_changes=LOG,
            dimensions_game_m=dict(cabin_diameter=1.6,cabin_height=2.3,shaft_diameter=2.2,door_width=1.0),
            status='Prepared source and GLB. No build, tests, review renders or runtime checks requested/performed.')
(OUT/'change-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps({'saved':report['blend'],'triangles':triangles,'optimized_meshes':len(optimized),
                  'triangles_removed_by_dissolve':sum((r['before']-r['after'])*r['instances'] for r in optimized)}))
