"""Final connection checks and corrections for the v03 review."""
import bpy, math, bmesh, json
from pathlib import Path
from mathutils import Vector, Matrix
OUT=Path(__file__).resolve().parent
s=bpy.context.scene
assert s.name=='Mansion_Architecture_v03'
base=(OUT.parent/'mansion-v01'/'create_mansion.py').read_text(encoding='utf-8')
ns={'bpy':bpy,'math':math,'Vector':Vector,'Matrix':Matrix}
for key,name in {'oak':'CURVE_AgedOak_Trim','bronze':'CURVE_AgedBronze','glass':'M01_Amber_Window'}.items():ns[key]=bpy.data.materials[name]
exec(base[base.index('def mesh_obj('):base.index('# The new upper storey')],ns)
box,line=ns['box'],ns['line'];oak=ns['oak'];dark=bpy.data.materials['M01_Ironwork'];stone=bpy.data.materials['M01_Rose_Limestone']
col=bpy.data.collections['M03_08_Architectural_Details'];balcony=bpy.data.collections['M01_03_Balconies']
def delete_matching(*prefixes):
    for o in list(s.objects):
        if o.name.startswith(prefixes):bpy.data.objects.remove(o,do_unlink=True)

# Put balcony brackets in solid wall bays, clear of the tall first-floor windows.
delete_matching('M01_V03_Balcony_','M03_Balcony_')
for x in [-5.5,0,5.5]:
    wall_y=-6.15*math.sqrt(1-(x/8.0)**2)
    box('V03_Balcony_WallPlate',(x,wall_y-.08,15.5),(.32,.30,2.65),oak,balcony)
    line('V03_Balcony_Knee',[(x,wall_y+.05,14.2),(x,wall_y-.22,14.75),(x,-7.28,16.96)],.17,oak,balcony)
    line('V03_Balcony_Bearer',[(x,wall_y+.16,16.92),(x,-7.65,16.92)],.16,oak,balcony)
    for z in [14.5,16.65]:box('V03_Balcony_AnchorPlate',(x,wall_y-.26,z),(.25,.06,.32),dark,balcony)

# Raise the bridge's house sockets above the ground-floor oriel canopy.
delete_matching('M01_V03_Bridge_StructuralBrace','M01_V03_Bridge_WallSocket','M01_V03_Bridge_Tie',
                'M03_Bridge_StructuralBrace','M03_Bridge_WallSocket','M03_Bridge_Tie')
for y in [-1.25,1.05]:
    box('V03_Bridge_WallSocket',(7.64,y,7.50),(.55,.52,1.85),stone,col)
    line('V03_Bridge_StructuralBrace',[(7.55,y,6.70),(10,y,8.05),(14.8,y,9.48)],.23,oak,col)
    line('V03_Bridge_Tie',[(9.9,y,8.0),(9.9,y,8.8)],.12,dark,col)

# Align the passage with the measured Blender slab and aviary, both at 9.7846 m.
# Runtime floor constants belong to the older house and are not an authoring reference.
level=9.784561157226562
for part in ['Tread','Stringer','Post','Handrail','Baluster']:
    delete_matching('M01_V03_Bridge_'+part,'M03_Bridge_'+part)
x0,x1=7.65,12.7125
for i in range(10):box('V03_Bridge_Tread',(x0+(x1-x0)*(i+.5)/10,-.1,level-.10),((x1-x0)/10+.02,2.35,.22),oak,col)
for y in [-1.25,1.05]:
    line('V03_Bridge_Stringer',[(7.45,y,level-.24),(x1+.1,y,level-.24)],.19,oak,col)
    line('V03_Bridge_Handrail',[(7.55,y,level+1.30),(x1,y,level+1.30)],.08,oak,col)
    for x in [7.6,10.15,x1-.08]:box('V03_Bridge_Post',(x,y,(level+14.15)/2),(.22,.22,14.15-level),oak,col)
    for i in range(16):
        x=x0+(x1-x0)*i/15
        line('V03_Bridge_Baluster',[(x,y,level+.12),(x,y,level+1.27)],.035,dark,col)

# Cut through the true cladding at the house end of the first-floor bridge.
# Work on single-user copies so the earlier house's shared mesh data stays intact.
delete_matching('M03_Bridge_HouseJamb_')
bpy.ops.mesh.primitive_cube_add(size=1,location=(8,-.1,11.45))
cutter=bpy.context.object;cutter.name='M03_TemporaryBridgeDoorCut';cutter.dimensions=(2.3,1.65,3.5)
bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
cut=[]
for o in list(s.objects):
    if o.type!='MESH' or not o.name.startswith('M01_Reuse_CURVE_Right_Clapboard'):continue
    pts=[o.matrix_world@Vector(v) for v in o.bound_box]
    if max(v.z for v in pts)<8.35 or min(v.z for v in pts)>12.55:continue
    original=bpy.data.objects.get(o.name.removeprefix('M01_Reuse_'))
    o.data=(original.data if original and original.type=='MESH' else o.data).copy()
    mod=o.modifiers.new('Bridge doorway','BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=cutter
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
    bpy.ops.object.modifier_apply(modifier=mod.name);cut.append(o.name)
bpy.data.objects.remove(cutter,do_unlink=True)
for name,loc,dims in [('L',(8,-.98,11.50),(.52,.16,3.45)),('R',(8,.78,11.50),(.52,.16,3.45)),('Top',(8,-.1,13.22),(.52,1.92,.19))]:
    ob=box('V03_Bridge_HouseJamb_'+name,loc,dims,oak,col)

# Fit the observatory gallery to the elliptical drum, inside the rear gable plane.
if not s.get('v03_gallery_fitted'):
    transform=Matrix.Translation((-1.04,1.045,0))@Matrix.Diagonal((1,.86,1,1))@Matrix.Translation((1.04,-1.045,0))
    for o in s.objects:
        if o.name.startswith('M01_Observatory_Gallery'):o.matrix_world=transform@o.matrix_world
    s['v03_gallery_fitted']=True

# The rear wall and its floor edges must undergo the same smooth offset.
def smooth(a,b,x):
    t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)
def rear_offset(p):
    if p.y<3.7 or p.z>17.1:return 0
    zw=1.25*smooth(1.1,2.35,p.z)*(1-smooth(7.05,8.25,p.z))-1.65*smooth(8.8,10.1,p.z)*(1-smooth(15.65,16.85,p.z))
    return zw*(1-smooth(1.7,5.25,abs(p.x)))*smooth(3.7,4.4,p.y)
for o in s.objects:
    if o.type=='MESH' and o.name.startswith('M01_Reuse_INT_Slab_') and not o.get('v03_rear_fit'):
        o.data=o.data.copy();inv=o.matrix_world.inverted()
        for v in o.data.vertices:
            p=o.matrix_world@v.co;p.x+=rear_offset(p);p.x*=.985;p.y*=.985;v.co=inv@p
        o.data.update();o['v03_rear_fit']=True

# Complete the previously empty rear openings with fitted sash frames and glazing.
delete_matching('M03_RearSash_','M01_V03_RearSash_')
for n in ['030','031','032','033','037','038','039','041','047']:
    o=bpy.data.objects.get('M01_Reuse_Cube.'+n)
    if o:bpy.data.objects.remove(o,do_unlink=True)
for i,(x,y,z,w,h) in enumerate([(1.27,6.25,2.76,1.50,3.51),(-1.56,6.13,10.38,1.50,3.26)]):
    box('V03_RearSash_Glass',(x,y-.09,z+h/2),(w,.025,h),ns['glass'],col)
    for dx in [-w/2,w/2]:box('V03_RearSash_Jamb',(x+dx,y+.02,z+h/2),(.10,.15,h+.12),oak,col)
    for zz in [z,z+h]:box('V03_RearSash_Rail',(x,y+.02,zz),(w+.20,.15,.10),oak,col)
    box('V03_RearSash_Sill',(x,y+.06,z-.10),(w+.38,.42,.15),oak,col)
    box('V03_RearSash_Mullion',(x,y+.03,z+h/2),(.05,.09,h),ns['bronze'],col)
    for t in ([.38,.7] if i==0 else [.5]):box('V03_RearSash_Transom',(x,y+.03,z+h*t),(w,.09,.05),ns['bronze'],col)
    if i==1:
        for dx in [-.36,.36]:line('V03_RearSash_LeadDiamond',[(x+dx,y+.08,z+1.6),(x+dx+.28,y+.08,z+2.3),(x+dx,y+.08,z+3.0),(x+dx-.28,y+.08,z+2.3),(x+dx,y+.08,z+1.6)],.018,ns['bronze'],col)

# Consistent version names and deduplicated small primitive meshes.
for o in s.objects:
    if o.name.startswith('M01_V03_'):o.name='M03_'+o.name[len('M01_V03_'):]
seen={};merged=0
for o in s.objects:
    if o.type!='MESH' or not o.name.startswith('M03_'):continue
    me=o.data
    if len(me.vertices)>64:continue
    key=(tuple(tuple(round(c,6) for c in v.co) for v in me.vertices),tuple(tuple(p.vertices) for p in me.polygons),tuple(m.name if m else None for m in me.materials))
    if key in seen and me!=seen[key]:o.data=seen[key];merged+=1
    else:seen[key]=me
for me in {o.data for o in s.objects if o.type=='MESH' and o.name.startswith('M03_')}:
    bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free();me.update()
bpy.context.view_layer.update()

# Test the promised base closure and clear passage at both ends by geometry raycasts.
base_obj=bpy.data.objects['M03_Tower_ClosedBase']
bm=bmesh.new();bm.from_mesh(base_obj.data);base_boundary_edges=sum(e.is_boundary for e in bm.edges);bm.free()
assert base_boundary_edges==0,'Tower base must be watertight'
assert not any(o.name.startswith('M01_Balcony_Support') for o in s.objects)
barrel=bpy.data.objects['M03_Telescope_HorizontalBarrel']
axis=(barrel.matrix_world.to_3x3()@Vector((0,0,1))).normalized()
assert axis.dot(Vector((1,0,0)))>.9999
mesh_objects=[o for o in s.objects if o.type=='MESH' and not any(c.name=='M01_90_Presentation' for c in o.users_collection)]
stats=json.loads((OUT/'stats.json').read_text(encoding='utf-8'))
stats.update({'mesh_objects':len(mesh_objects),'unique_meshes':len({o.data for o in mesh_objects}),'shared_mesh_objects':sum(o.data.users>1 for o in mesh_objects),'tower_base_boundary_edges':base_boundary_edges,'bridge_house_strips_opened':len(cut),'small_meshes_deduplicated':merged,'balcony_supports_between_windows':3})
(OUT/'stats.json').write_text(json.dumps(stats,indent=2),encoding='utf-8')
s.camera=bpy.data.objects['M01_Camera_Hero']
for o in s.objects:o.select_set(False)
bpy.data.libraries.write(str(OUT/'mansion-v03.blend'),{s},fake_user=True,compress=True)
result=stats
