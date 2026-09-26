"""Repair measured openings and connections; retain v07 as the source revision."""
import bpy, bmesh, math, json, re
import numpy as np
from pathlib import Path
from mathutils import Vector, Matrix

OUT=Path(__file__).resolve().parent
S=bpy.context.scene
assert 'v07' in bpy.data.filepath, 'Run on the preserved v07 source'
if bpy.context.mode!='OBJECT': bpy.ops.object.mode_set(mode='OBJECT')
bpy.context.view_layer.update()
LOG=[]
col=bpy.data.collections.new('M08_01_Fitted_Openings');S.collection.children.link(col)
oak=bpy.data.materials['CURVE_AgedOak_Trim']
bronze=bpy.data.materials['CURVE_AgedBronze']
glass=bpy.data.materials['M01_Amber_Window']
walnut=bpy.data.materials.get('M03_Portal_Walnut') or oak

def bounds(o):
    p=[o.matrix_world@Vector(v) for v in o.bound_box]
    return np.min(p,axis=0),np.max(p,axis=0)
def mesh(name,v,f,mat,collection=col):
    me=bpy.data.meshes.new(name);me.from_pydata(v,[],f);me.update()
    if mat:me.materials.append(mat)
    bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free()
    ob=bpy.data.objects.new(name,me);collection.objects.link(ob);return ob
cube_cache={}
def box(name,c,d,mat=oak):
    key=mat.name if mat else 'cutter'
    if key not in cube_cache:
        v=[(x,y,z) for x in [-.5,.5] for y in [-.5,.5] for z in [-.5,.5]]
        o=mesh(name,v,[(0,4,6,2),(1,3,7,5),(0,1,5,4),(2,6,7,3),(0,2,3,1),(4,5,7,6)],mat)
        cube_cache[key]=o.data
    else:o=bpy.data.objects.new(name,cube_cache[key]);col.objects.link(o)
    o.location=c;o.scale=d;return o
def remove(predicate):
    names=[]
    for o in list(S.objects):
        if predicate(o.name):names.append(o.name);bpy.data.objects.remove(o,do_unlink=True)
    return names
def cut(cutter,predicate,label):
    bpy.context.view_layer.update();cl,ch=bounds(cutter);changed=[]
    for o in list(S.objects):
        if o.type!='MESH' or o==cutter or not predicate(o.name):continue
        lo,hi=bounds(o)
        if np.any(hi<cl) or np.any(lo>ch):continue
        o.data=o.data.copy()
        mod=o.modifiers.new(label,'BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=cutter
        bpy.context.view_layer.objects.active=o
        bpy.ops.object.modifier_apply(modifier=mod.name);changed.append(o.name)
    bpy.data.objects.remove(cutter,do_unlink=True)
    LOG.append({'change':label,'objects':changed})

# Sample the intact front surfaces on each board, interpolating across the old
# mismatched apertures. The resulting strip has no residual internal end caps.
profiles=[]
for o in sorted([o for o in S.objects if o.name.startswith('M01_Reuse_CURVE_Front_Clapboard_')],key=lambda o:o.name):
    lo,hi=bounds(o);inv=o.matrix_world.inverted();polys=[]
    for z in (lo[2]+.00005,hi[2]-.00005):
        for inner in (False,True):
            xs=[];ys=[]
            for x in np.linspace(lo[0]+.14,hi[0]-.14,181):
                origin=Vector((float(x),0 if inner else -20,float(z)))
                direction=inv.to_3x3()@Vector((0,-1 if inner else 1,0));direction.normalize()
                hit,p,n,_=o.ray_cast(inv@origin,direction)
                if hit and abs(n.y)>.4:xs.append(x);ys.append((o.matrix_world@p).y)
            assert len(xs)>35, (o.name,len(xs))
            polys.append(np.polynomial.Polynomial.fit(xs,ys,10))
    v=[];f=[];segments=56
    for x in np.linspace(lo[0],hi[0],segments+1):
        v.extend([(x,float(polys[0](x)),lo[2]),(x,float(polys[2](x)),hi[2]),
                  (x,float(polys[1](x)),lo[2]),(x,float(polys[3](x)),hi[2])])
    for i in range(segments):
        a=4*i;b=a+4
        f.extend([(a,b,b+1,a+1),(a+2,a+3,b+3,b+2),(a,a+2,b+2,b),(a+1,b+1,b+3,a+3)])
    f.extend([(0,1,3,2),(4*segments,4*segments+2,4*segments+3,4*segments+1)])
    temp=mesh(o.name+'_Continuous',v,f,o.data.materials[0]);old=o.data;o.data=temp.data;o.matrix_world=Matrix.Identity(4)
    bpy.data.objects.remove(temp,do_unlink=True)
    profiles.append((float(lo[2]),float(hi[2]),polys))
LOG.append({'change':'Rebuilt continuous front cladding before cutting fitted apertures','boards':len(profiles)})

def front_y(x,z,inner=False):
    low,high,polys=min(profiles,key=lambda row:abs((row[0]+row[1])/2-z))
    t=max(0,min(1,(z-low)/(high-low)));idx=1 if inner else 0
    return float(polys[idx](x)*(1-t)+polys[idx+2](x)*t)

# Delete the superimposed old window generations and disconnected planter boxes.
old_cubes={f'M01_Reuse_Cube.{i:03d}' for i in [5,6,7,8,9,10,11,12,13,17,18,19]}
removed=remove(lambda n:n in old_cubes or n.startswith(('M01_Reuse_DET_', 'M01_Reuse_SHUTTER_',
    'M01_Reuse_EXT_FrontWindow_', 'M01_Reuse_WALLDETAIL_EXT_FrontWindow_',
    'M01_Reuse_CURVE_UpperSash_', 'M01_Reuse_EXT_WindowSet_RightLower_',
    'M01_Reuse_EXT_WindowSet_RightUpper_', 'M01_Reuse_EXT_Planter_',
    'M01_Reuse_EXT_Plant_', 'M01_Reuse_EXT_Organic_Planter_', 'M03_Front_Shutter_')))
LOG.append({'change':'Removed obsolete duplicate window parts and primitive planters','objects':removed})

def profile(cx,z,w,h,arch=0,margin=0):
    left=cx-w/2-margin;right=cx+w/2+margin;bottom=z-margin;spring=z+h-arch
    if not arch:return [(left,bottom),(right,bottom),(right,z+h+margin),(left,z+h+margin)]
    p=[(left,bottom),(right,bottom),(right,spring)]
    p.extend((cx+(w/2+margin)*math.cos(a),spring+(arch+margin)*math.sin(a)) for a in np.linspace(0,math.pi,21)[1:])
    return p
def opening_cutter(name,p,axis='front'):
    # Uniform-depth extrusion gives one unambiguous through-hole.
    v=[]
    for depth in ([-9,-3] if axis=='front' else [6,10]):
        v.extend((u,depth,z) if axis=='front' else (depth,u,z) for u,z in p)
    n=len(p);f=[tuple(reversed(range(n))),tuple(range(n,2*n))]
    f.extend((i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n))
    return mesh(name,v,f,None)
def window(name,cx,z,w,h,arch,axis='front',side_x=None):
    p=profile(cx,z,w,h,arch);outside=profile(cx,z,w,h,arch,.10)
    cut(opening_cutter('M08_Temporary_Window',profile(cx,z,w,h,arch,.018),axis),
        lambda n:n.startswith('M01_Reuse_CURVE_'+('Front' if axis=='front' else 'Right')+'_Clapboard_'),name+' through opening')
    def point(u,height,depth):
        if axis=='front':return (u,front_y(u,height)+depth,height)
        return (side_x(u,height)-depth,u,height)
    # One continuous deep reveal, with a deliberate clearance hidden in the wood.
    n=len(p);v=[point(u,height,depth) for depth in [-.12,.34] for loop in [outside,p] for u,height in loop];f=[]
    for i in range(n):
        j=(i+1)%n
        f.extend([(i,j,n+j,n+i),(2*n+i,3*n+i,3*n+j,2*n+j),
                  (i,2*n+i,2*n+j,j),(n+i,n+j,3*n+j,3*n+i)])
    mesh('M08_Window_'+name+'_Reveal',v,f,oak)
    # A single glass sheet avoids coplanar front/back transparent surfaces.
    mesh('M08_Window_'+name+'_Glass',[point(u,height,.04) for u,height in p],[tuple(range(n))],glass)
    def bar(label,u,height,width,height_size,depth=.07):
        if axis=='front':
            o=box('M08_Window_'+name+'_'+label,point(u,height,-.018),(width,depth,height_size),bronze)
            slope=(front_y(u+.01,height)-front_y(u-.01,height))/.02;o.rotation_euler.z=math.atan(slope)
        else:
            o=box('M08_Window_'+name+'_'+label,point(u,height,-.018),(depth,width,height_size),bronze)
            slope=(side_x(u+.01,height)-side_x(u-.01,height))/.02;o.rotation_euler.z=-math.atan(slope)
        return o
    bar('Mullion',cx,z+(h-arch)/2,.043,h-arch)
    for fraction in ([.42,.75] if h>4 else [.50]):bar('Transom',cx,z+(h-arch)*fraction,w,.045)
    if arch:bar('SpringRail',cx,z+h-arch,w,.055)
    if axis=='front':box('M08_Window_'+name+'_Sill',point(cx,z-.10,.04),(w+.37,.67,.15),oak)
    else:box('M08_Window_'+name+'_Sill',point(cx,z-.10,.04),(.72,w+.32,.15),oak)

window('FrontLeft',-3.83,2.78,.74,3.48,0)
window('FrontRight',3.72,2.76,1.10,4.35,1.04)
window('UpperLeft',-3.09,10.66,1.84,4.50,.91)
window('UpperRight',2.84,10.66,1.84,4.50,.91)

# Right-side windows follow the measured local tangent. Replace the opaque
# recess and the lower unglazed frame with clear, fully connected openings.
window('EastLower',1.77,2.98,.65,2.94,0,'right',lambda u,z:8.13-.37*(u-1.77)-.015*(z-4.46))
window('EastUpper',2.67,10.79,.63,2.91,0,'right',lambda u,z:7.58-.61*(u-2.67)-.002*(z-12.245))

# The door leaf pivots are unchanged. Remove all wall caps from the reveal,
# then cover the curved masonry with a continuous inside casing.
cut(box('M08_Temporary_Entry',(-.98,-6,4.515),(1.978,4,6.10),None),
    lambda n:n.startswith('M01_Reuse_CURVE_Front_Clapboard_'),'Clean front door opening')
for x in [-2.055,.095]:box('M08_Entry_InnerJamb',(x,-6.15,4.52),(.23,.63,6.08),oak)
box('M08_Entry_InnerLintel',(-.98,-6.15,7.65),(2.38,.63,.24),oak)
for x in [-2.15,.19]:box('M08_Entry_InnerCasing',(x,-5.78,4.56),(.15,.10,6.22),oak)
box('M08_Entry_InnerCasingTop',(-.98,-5.78,7.72),(2.48,.10,.15),oak)
# Give both interior leaves raised joinery instead of an unfinished flat board.
for side in [-1,1]:
    hinge=-.98+side*.96
    transform=Matrix.Translation((hinge,-6.38,0))@Matrix.Rotation(math.radians(-side*100),4,'Z')@Matrix.Translation((-hinge,6.38,0))
    x=-.98+side*.49
    for z,h in [(2.60,1.55),(4.60,1.85),(6.60,1.30)]:
        ob=box('M03_Portal_PanelField_Inside',(x,-6.235,z),(.69,.07,h),oak)
        bpy.context.view_layer.update();ob.matrix_world=transform@ob.matrix_world
        for dx in [-.355,.355]:
            ob=box('M03_Portal_RecessedPanel_InsideStile',(x+dx,-6.205,z),(.047,.055,h+.06),bronze)
            bpy.context.view_layer.update();ob.matrix_world=transform@ob.matrix_world
        for dz in [-h/2,h/2]:
            ob=box('M03_Portal_RecessedPanel_InsideRail',(x,-6.205,z+dz),(.75,.055,.045),bronze)
            bpy.context.view_layer.update();ob.matrix_world=transform@ob.matrix_world

# Wall end faces were exactly coplanar with the side-door jambs. The clearance
# is smaller than the wooden frame thickness, so the wall remains closed.
for label,y,z0,z1 in [('Veranda',-1.2,1.487,4.447),('Aviary',-.3,9.912,12.872)]:
    cut(box('M08_Temporary_Access',(-8,y,(z0+z1)/2),(3,1.686,z1-z0+.036),None),
        lambda n:n.startswith('M01_Reuse_CURVE_Left_Clapboard_'),label+' jamb clearance')
cut(box('M08_Temporary_East',(8,-.1,11.475),(3,1.72,3.29),None),
    lambda n:n.startswith('M01_Reuse_CURVE_Right_Clapboard_'),'East bridge jamb clearance')

# Cut only the buried portions of front canopies at the inner wall surface.
v=[];f=[];xs=np.linspace(-6.5,6.5,65)
for x in xs:
    y=front_y(x,6.4,True)-.065
    v.extend([(x,y,0),(x,y,18),(x,2,0),(x,2,18)])
for i in range(len(xs)-1):
    a=4*i;b=a+4;f.extend([(a,b,b+1,a+1),(a+2,a+3,b+3,b+2),(a,a+2,b+2,b),(a+1,b+1,b+3,a+3)])
f.extend([(0,1,3,2),(256,258,259,257)])
cut(mesh('M08_Temporary_Interior_Clearance',v,f,None),
    lambda n:n.startswith(('M01_Reuse_EXT_Canopy_Front','M03_Portal_Hood')),'Canopy interior clearance')

# Extend the authored lift shaft and basement landing to the actual game floor.
for o in list(S.objects):
    if o.name.startswith('M05_Elevator_Landing_00_') or o.name in ['M06_Lift_BoardingBridge_00','M06_Lift_FloorCollar_00']:
        o.location.z-=5.28
    elif o.type=='MESH' and o.name.startswith(('M05_Elevator_Shaft_Glass_', 'M05_Elevator_Shaft_Post_', 'M06_Lift_SouthGlass_')):
        o.data=o.data.copy();inv=o.matrix_world.inverted()
        for vertex in o.data.vertices:
            p=o.matrix_world@vertex.co
            if abs(p.z+1.32)<.005:p.z=-6.6
            elif abs(p.z+1.48)<.005:p.z=-6.76
            elif 'Spandrel_00' in o.name and p.z<0:p.z-=5.28
            elif 'Spandrel_01' in o.name and abs(p.z-.98)<.005:p.z=-4.30
            vertex.co=inv@p
        o.data.update()
controller=S.objects.get('M05_Elevator_Controller')
if controller and 'stop_floor_z' in controller:
    levels=list(controller['stop_floor_z']);levels[0]=-6.6;controller['stop_floor_z']=levels

# Flush the tower threshold instead of hiding a half-metre-high obstruction.
o=S.objects['M03_Tower_ClosedBase'];o.data=o.data.copy();inv=o.matrix_world.inverted()
for vertex in o.data.vertices:
    p=o.matrix_world@vertex.co
    if p.z>9.84456:p.z=9.84456
    vertex.co=inv@p
cut(box('M08_Temporary_TowerThreshold',(12.5,-.1,10.14),(1.5,1.8,.59),None),
    lambda n:n=='M01_Tower_StringCourse','Flush tower entrance')

S.name='Mansion_Architecture_v08_Repaired'
S['source_revision']=str(OUT.parent/'mansion-v07'/'mansion-v07-refined.blend')
S['revision_notes']='Fitted through-windows, clear door reveals, extended cellar lift shaft, shared cat poses; runtime capsule collisions.'
bpy.context.view_layer.update()
OUT.mkdir(parents=True,exist_ok=True)
(OUT/'architecture-report.json').write_text(json.dumps(LOG,indent=2),encoding='utf-8')
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'mansion-v08-refined.blend'),compress=True)
result={'file':bpy.data.filepath,'changes':len(LOG),'removed_obsolete':len(removed),'front_boards':len(profiles)}
