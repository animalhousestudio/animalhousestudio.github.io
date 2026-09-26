"""Finish clearance, observatory flooring and visual QA corrections."""
import bpy, math, bmesh, json
from mathutils import Vector, Matrix
ns=bpy.app.driver_namespace['cleanup_ns']
preserve,retire,box,mesh,wallx,bounds=[ns[k] for k in ['preserve','retire','box','mesh','wallx','bounds']]
S=bpy.context.scene;oak=ns['oak'];FIX=ns['FIX']

# Remaining original canopy fragments are obsolete after making a doorway.
for o in list(S.objects):
    if o.name.startswith('M01_Reuse_EXT_Canopy_Left'):
        retire(o,'Old window canopy conflicts with conservatory roof junction')

# East bridge ends follow the curved wall, just as the two west annexes do.
east=[]
for o in list(S.objects):
    if o.type!='MESH' or not o.name.startswith('M03_Bridge_') or 'HouseJamb' in o.name:continue
    pts=[o.matrix_world@v.co for v in o.data.vertices]
    inside=[p.x < -wallx(p.y,p.z)-.055 for p in pts]
    if not any(inside):continue
    if all(inside):retire(o,'Bridge end buried inside facade');continue
    preserve(o);inv=o.matrix_world.inverted()
    for v,p,hit in zip(o.data.vertices,pts,inside):
        if hit:p.x=-wallx(p.y,p.z)-.055;v.co=inv@p
    o.data.update();east.append(o.name)

# Clip the upper west bridge at its flat wall connection, including its roof.
o=S.objects['M04_WestPassage'];preserve(o)
bm=bmesh.new();bm.from_mesh(o.data);bm.transform(o.matrix_world)
r=bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=1e-6,plane_co=(-7.53,0,0),plane_no=(1,0,0),clear_outer=True)
cut_edges=[e for e in r['geom_cut'] if isinstance(e,bmesh.types.BMEdge) and e.is_boundary]
if cut_edges:bmesh.ops.holes_fill(bm,edges=cut_edges,sides=0)
bm.transform(o.matrix_world.inverted());bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free()

# Avoid coplanar surfaces at door thresholds; the lift thresholds stay flush.
for n in ['M06_Veranda_Threshold','M06_Aviary_Threshold']:
    S.objects[n].location.z+=.018
for o in S.objects:
    if o.name=='M01_Reuse_AVIARY_Left_Floor' or o.name.startswith(('M01_Reuse_AVIARY_Left_Planter_','M01_Reuse_AVIARY_Left_Plant_')):
        preserve(o);o.location.z-=.05

# A 12 cm level difference on the east bridge gets a shallow sloping threshold.
v=[(7.55,-.90,9.912),(7.55,.70,9.912),(8.75,-.90,9.795),(8.75,.70,9.795),
   (7.55,-.90,9.72),(7.55,.70,9.72),(8.75,-.90,9.70),(8.75,.70,9.70)]
mesh('M06_EastBridge_Threshold',v,[(0,2,3,1),(4,5,7,6),(0,4,6,2),(1,3,7,5),(0,1,5,4),(2,6,7,3)],oak)

# The observatory ring deck had no interior. Fit a solid elliptical floor around
# the lift, using ray/ellipse intersections so the square shaft stays square.
verts=[];faces=[];N=96;cx=-1.04;cy=1.045;rx=4.78;ry=4.02;h=1.9
for z in [25.56,25.72]:
    for inner in [False,True]:
        for i in range(N):
            a=math.tau*i/N;dx=math.cos(a);dy=math.sin(a)
            A=dx*dx/rx**2+dy*dy/ry**2;B=-2*(dx*cx/rx**2+dy*cy/ry**2);C=cx*cx/rx**2+cy*cy/ry**2-1
            r=h/max(abs(dx),abs(dy)) if inner else (-B+math.sqrt(B*B-4*A*C))/(2*A)
            verts.append((r*dx,r*dy,z))
for i in range(N):
    j=(i+1)%N
    faces.extend([(i,j,N+j,N+i),(2*N+i,3*N+i,3*N+j,2*N+j),(i,2*N+i,2*N+j,j),(N+i,N+j,3*N+j,3*N+i)])
mesh('M06_Observatory_InteriorFloor',verts,faces,oak)

# Human-scale telescope in the free northern bay, clear of the lift enclosure.
# The barrel points up through the clear dome while the tripod rests on the deck.
origin=Vector((-1.04,1.045,25.835));dest=Vector((-3.2,2.65,25.72))
xf=Matrix.Translation(dest)@Matrix.Diagonal((.5,.5,.5,1))@Matrix.Translation(-origin)
pivot=xf@Vector((-1.04,1.045,30.02))
pitch=Matrix.Translation(pivot)@Matrix.Rotation(math.radians(-25),4,'Y')@Matrix.Translation(-pivot)
for o in list(S.objects):
    if not o.name.startswith('M03_Telescope_'):continue
    preserve(o);o.matrix_world=xf@o.matrix_world
    if 'Tripod' not in o.name and 'AzimuthMount' not in o.name:o.matrix_world=pitch@o.matrix_world

# Floor geometry was offset twice above the cabin's stop reference. Correct the
# local geometry while leaving the controller and animation channels intact.
cabin=S.objects['M05_Elevator_Cabin'];target_stop=float(S.objects['M05_Elevator_Controller']['stop_floor_z'][0])
floor=S.objects['M05_Elevator_Cabin_Floor'];lo,hi=bounds(floor)
delta=hi.z-target_stop
for o in list(cabin.children):
    if o.type=='MESH':preserve(o);o.location.z-=delta

# Small timber handrails make the conservatory level change readable.
bronze=bpy.data.materials['CURVE_AgedBronze']
def beam(name,a,b,r):
    a=Vector(a);b=Vector(b);axis=b-a
    bpy.ops.mesh.primitive_cylinder_add(vertices=12,radius=r,depth=axis.length,location=(a+b)/2)
    o=bpy.context.object;o.name=name;o.rotation_euler=axis.to_track_quat('Z','Y').to_euler();o.data.materials.append(bronze)
    for c in list(o.users_collection):c.objects.unlink(o)
    FIX.objects.link(o);return o
for side,y in [('L',-2.06),('R',-.34)]:
    beam('M06_Veranda_Handrail_'+side,(-8.70,y,2.45),(-10.61,y,1.51),.033)
    for x,z in [(-8.70,1.487),(-10.61,.44)]:beam('M06_Veranda_RailPost_'+side,(x,y,z),(x,y,z+1.02),.026)

# Remove standing-seam remnants that the earlier roof boolean left crossing
# the observatory. Each narrow seam is cut at the two drum intersections.
seams=[]
for o in list(S.objects):
    if not o.name.startswith('M01_Reuse_CURVE_Roof_StandingSeam_'):continue
    lo,hi=bounds(o);x=(lo.x+hi.x)/2
    if hi.z<25.55 or abs(x+1.04)>=4.85:continue
    half=4.10*math.sqrt(1-((x+1.04)/4.85)**2)
    ys=[1.045-half,1.045+half];verts=[];faces=[]
    for y,normal in [(ys[0],(0,1,0)),(ys[1],(0,-1,0))]:
        bm=bmesh.new();bm.from_mesh(o.data);bm.transform(o.matrix_world)
        cut=bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=1e-6,plane_co=(0,y,0),plane_no=normal,clear_outer=True)
        edges=[e for e in cut['geom_cut'] if isinstance(e,bmesh.types.BMEdge) and e.is_boundary]
        if edges:bmesh.ops.holes_fill(bm,edges=edges,sides=0)
        bm.verts.index_update();offset=len(verts)
        verts.extend(tuple(v.co) for v in bm.verts);faces.extend(tuple(offset+v.index for v in f.verts) for f in bm.faces);bm.free()
    mesh(o.name,verts,faces,o.data.materials[0],o);seams.append(o.name)
for o in list(S.objects):
    if o.name.startswith(('M03_Chimney','M03_WindVane')) and o.location.x<0:
        preserve(o);o.location.x-=.9
ns['log'].append({'change':'Removed roof ribs crossing observatory and moved west chimney clear of drum','seams':seams})

bpy.context.view_layer.update()
ns['log'].append({'change':'Restored observatory floor, relocated telescope clear of elevator, trimmed both bridges, aligned cabin floor','bridge_parts':east,'cabin_floor_correction':delta})
(ns['OUT']/'changes.json').write_text(json.dumps(ns['log'],indent=2),encoding='utf-8')
result={'east_bridge_trimmed':len(east),'telescope_scale':.5,'cabin_floor_correction':delta}
