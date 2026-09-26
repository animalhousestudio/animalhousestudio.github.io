"""Repair the open v05 scene; originals remain in a disabled archive collection."""
import bpy, bmesh, math, json
from pathlib import Path
from mathutils import Vector, Matrix
import numpy as np

S = bpy.context.scene
OUT = Path(__file__).parent
assert not bpy.data.collections.get('M06_Interior_Repairs'), 'Already repaired'
FIX = bpy.data.collections.new('M06_Interior_Repairs'); S.collection.children.link(FIX)
ARCHIVE = bpy.data.collections.new('M06_Originals_Disabled'); S.collection.children.link(ARCHIVE)
ARCHIVE.hide_render = True; ARCHIVE.hide_viewport = True
saved = set(); log = []
def preserve(o):
    if o.name in saved: return
    clone = o.copy(); clone.name = 'M06_Original_' + o.name
    ARCHIVE.objects.link(clone); clone.hide_render = True
    saved.add(o.name)
    if o.type == 'MESH': o.data = o.data.copy()
def retire(o, reason):
    preserve(o); o.hide_render = True; o.hide_set(True)
    o['M06_disabled_reason'] = reason
    log.append({'object': o.name, 'change': reason})
def mesh(name, verts, faces, mat, target=None):
    me = bpy.data.meshes.new(name + '_Mesh'); me.from_pydata(verts, [], faces); me.update()
    bm = bmesh.new(); bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=0.00001)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces)); bm.to_mesh(me); bm.free()
    if mat: me.materials.append(mat)
    if target:
        preserve(target); target.data = me; target.matrix_world = Matrix.Identity(4); return target
    o = bpy.data.objects.new(name, me); FIX.objects.link(o); return o
def box(name, center, dims, mat, target=None):
    c = Vector(center)
    v = [c+Vector((x*dims[0], y*dims[1], z*dims[2])) for x in [-.5,.5] for y in [-.5,.5] for z in [-.5,.5]]
    f = [(0,4,6,2),(1,3,7,5),(0,1,5,4),(2,6,7,3),(0,2,3,1),(4,5,7,6)]
    return mesh(name, v, f, mat, target)
oak = bpy.data.materials['CURVE_AgedOak_Trim']
pearl = bpy.data.materials['CURVE_PaintedTimber_Pearl']
floor_mat = bpy.data.materials['INT_Slab_Material']

def bounds(o):
    p = [o.matrix_world@Vector(v) for v in o.bound_box]
    return Vector([min(v[i] for v in p) for i in range(3)]), Vector([max(v[i] for v in p) for i in range(3)])

# Fit each original curved board away from the damaged openings. Keep its two
# unmodified outer wings, and rebuild only the central strip as closed solids.
fits = {}
for i in range(3, 36):
    o = S.objects[f'M01_Reuse_CURVE_Left_Clapboard_{i:02d}']
    low, high = bounds(o); inv = o.matrix_world.inverted(); coefs = []
    for z in [low.z+.002, high.z-.002]:
        surfaces = []
        for start, sign in [(-12,1), (0,-1)]:
            samples = []
            for y in [-4,-3.75,-3.5,-3.25,-3,-2.8,2.3,2.5,2.8,3,3.25,3.5,3.75,4]:
                hit,p,n,idx = o.ray_cast(inv@Vector((start,y,z)), (inv.to_3x3()@Vector((sign,0,0))).normalized())
                if hit: samples.append((y, (o.matrix_world@p).x))
            assert len(samples) >= 6, (o.name, z, samples)
            surfaces.append(np.polynomial.polynomial.polyfit([y*y for y,x in samples], [x for y,x in samples], 3))
        coefs.append(surfaces)
    fits[i] = (low.z, high.z, coefs)

def wallx(y,z,inner=False):
    i = min(fits, key=lambda j:abs((fits[j][0]+fits[j][1])/2-z))
    lo, hi, c = fits[i]; t = min(1,max(0,(z-lo)/(hi-lo)))
    return float((1-t)*np.polynomial.polynomial.polyval(y*y,c[0][int(inner)])+t*np.polynomial.polynomial.polyval(y*y,c[1][int(inner)]))

for i, (z0,z1,coeffs) in fits.items():
    o = S.objects[f'M01_Reuse_CURVE_Left_Clapboard_{i:02d}']
    verts=[]; faces=[]; materials=[]
    for yedge, normal in [(-2.7,(0,1,0)),(2.0,(0,-1,0))]:
        bm=bmesh.new(); bm.from_mesh(o.data); bm.transform(o.matrix_world)
        bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=1e-6,plane_co=(0,yedge,0),plane_no=normal,clear_outer=True,clear_inner=False)
        bm.verts.index_update(); offset=len(verts)
        verts.extend(tuple(v.co) for v in bm.verts); faces.extend(tuple(offset+v.index for v in f.verts) for f in bm.faces)
        bm.free()
    zs=sorted(set([z0,z1]+[z for z in [1.487,4.447,9.912,12.872] if z0<z<z1]))
    for za,zb in zip(zs,zs[1:]):
        mid=(za+zb)/2
        spans=[(-2.7,2.0)]
        if 1.487<=mid<4.447: spans=[(-2.7,-2.025),(-.375,2.0)]
        if 9.912<=mid<12.872: spans=[(-2.7,-1.125),(.525,2.0)]
        for ya,yb in spans:
            count=math.ceil((yb-ya)/.12); ys=np.linspace(ya,yb,count+1); start=len(verts)
            for y in ys:
                for z,inside in [(za,False),(zb,False),(za,True),(zb,True)]:
                    verts.append((wallx(float(y),z,inside),float(y),z))
            for j in range(count):
                a=start+4*j; b=a+4
                faces.extend([(a,b,b+1,a+1),(a+2,a+3,b+3,b+2),(a,a+2,b+2,b),(a+1,b+1,b+3,a+3)])
            end=start+4*count; faces.extend([(start,start+1,start+3,start+2),(end,end+2,end+3,end+1)])
    mesh(o.name,verts,faces,pearl,o)
log.append({'change':'Rebuilt 33 curved wall boards around two continuous doorways'})

# Retire obsolete window parts and the glass sheet previously blocking the aviary.
for suffix in ['051','052','053','057','058','059']:
    retire(S.objects['M01_Reuse_Cube.'+suffix], 'Obsolete window detail overlapping veranda doorway')
for n in ['M01_Reuse_AVIARY_Left_Connector','M01_Reuse_AVIARY_Left_ConnectorGlass']:
    retire(S.objects[n], 'Obsolete connector across aviary entrance')

# Trim annex endpoints to the existing curved exterior. No roof, post or glass
# endpoint may extend through the inner face of the house.
trimmed=[]
for o in list(S.objects):
    if o.type!='MESH' or o.hide_render: continue
    if not (o.name.startswith('M01_Conservatory_') or o.name.startswith('M01_Reuse_AVIARY_Left_')): continue
    if any(k in o.name for k in ['Plant','Planter','Cat','Toy','Perch','Hammock']): continue
    pts=[o.matrix_world@v.co for v in o.data.vertices]
    intruding=[p.x>wallx(p.y,p.z)+.055 for p in pts]
    if not any(intruding): continue
    if all(intruding): retire(o,'Annex component entirely inside the main house'); continue
    preserve(o); inv=o.matrix_world.inverted()
    for v,p,hit in zip(o.data.vertices,pts,intruding):
        if hit: p.x=wallx(p.y,p.z)+.055;v.co=inv@p
    o.data.update();trimmed.append(o.name)
log.append({'change':'Trimmed annex geometry to curved facade','objects':trimmed})

# Clean, matching jambs and a small continuous threshold at each repaired portal.
for label,y,z,xc in [('Veranda',-1.2,1.487,-8.04),('Aviary',-.3,9.912,-7.96)]:
    for suffix,loc,dims in [('L',(xc,y-.9,z+1.48),(.80,.15,2.96)),('R',(xc,y+.9,z+1.48),(.80,.15,2.96)),('Top',(xc,y,z+3.03),(.80,1.95,.14))]:
        o=S.objects['ACCESS_'+label+'_'+suffix]
        box(o.name,loc,dims,oak,o)
    box('M06_'+label+'_Threshold',(xc,y,z-.035),(1.02,1.66,.07),oak)

# Seven equal risers connect the actual conservatory floor to the living floor.
bottom=.4405; top=1.487; landing_end=-8.72
box('M06_Veranda_UpperLanding',(-8.42,-1.2,top-.10),(.62,1.64,.20),oak)
for j in range(7):
    tread=.29; height=top-(j+1)*(top-bottom)/7
    box(f'M06_Veranda_Step_{j+1:02d}',(landing_end-(j+.5)*tread,-1.2,(bottom+height)/2),(.30,1.64,max(.03,height-bottom)),oak)

# Move the obstructing planter as one assembly to the outer front corner.
for o in S.objects:
    if o.name=='M01_Reuse_AVIARY_Left_Planter_4' or o.name.startswith('M01_Reuse_AVIARY_Left_Plant_4_'):
        preserve(o);o.location+=Vector((-1.28,-.92,0))

# Prune complete leaf clusters, preserving their organic silhouettes. Branches
# that enter the glazed volumes are pruned at their branch origins as well.
def components(o):
    adj=[[] for _ in o.data.vertices]
    for e in o.data.edges:
        a,b=e.vertices;adj[a].append(b);adj[b].append(a)
    remaining=set(range(len(adj))); groups=[]
    while remaining:
        seed=remaining.pop(); stack=[seed]; group=[seed]
        while stack:
            for b in adj[stack.pop()]:
                if b in remaining:remaining.remove(b);stack.append(b);group.append(b)
        groups.append(group)
    return groups
for n in ['M01_Reuse_TREE_Left_Foliage','M01_Reuse_TREE_Left_Trunk']:
    o=S.objects[n]; groups=components(o); bad=[]
    for group in groups:
        p=[o.matrix_world@o.data.vertices[i].co for i in group]
        lo=[min(v[i] for v in p) for i in range(3)];hi=[max(v[i] for v in p) for i in range(3)]
        hit_house=any(v.x>wallx(v.y,v.z)-.18 and abs(v.y)<4.6 for v in p)
        def overlaps(a,b):return all(hi[i]>a[i] and lo[i]<b[i] for i in range(3))
        hit_annex=overlaps((-12.86,-4.5,.44),(-7.6,.88,5.85)) or overlaps((-11.9,-2.38,9.75),(-7.5,.86,14.70))
        if hit_house or hit_annex:bad.extend(group)
    preserve(o);bm=bmesh.new();bm.from_mesh(o.data);bm.verts.ensure_lookup_table()
    bmesh.ops.delete(bm,geom=[bm.verts[i] for i in bad],context='VERTS');bm.to_mesh(o.data);bm.free();o.data.update()
    log.append({'object':n,'change':'Pruned intersecting branches/leaf clusters','vertices_removed':len(bad)})

# Rebuild both accidentally empty upper slabs with a real square lift opening.
def ring_slab(name,z,outer,hole,thickness,mat,target=None):
    x,y=outer; hx,hy=hole; vertices=[];faces=[]
    # Eight corresponding outer/inner corners, two horizontal rings.
    rings=[(-x,-y),(x,-y),(x,y),(-x,y),(-hx,-hy),(hx,-hy),(hx,hy),(-hx,hy)]
    vertices=[(a,b,zz) for zz in [z-thickness,z] for a,b in rings]
    for j in range(4):
        k=(j+1)%4
        faces.extend([(j,k,4+k,4+j),(8+j,12+j,12+k,8+k),(j,8+j,8+k,k),(4+j,4+k,12+k,12+j)])
    return mesh(name,vertices,faces,mat,target)
ring_slab('M01_UpperFloor_Slab',17.2,(7.7,6.125),(1.9,1.9),.28,oak,S.objects['M01_UpperFloor_Slab'])
ring_slab('M01_UpperFloor_Ceiling',22.32,(7.7,6.125),(1.9,1.9),.20,oak,S.objects['M01_UpperFloor_Ceiling'])

# Landing edges are flush with floors and bridge the gap to the smaller cabin.
stops=list(S.objects['M05_Elevator_Controller']['stop_floor_z'])
for o in list(S.objects):
    if o.name.startswith('M05_Elevator_Landing_'):
        preserve(o);o.location.z-=.16
for i,z in enumerate(stops):
    box(f'M06_Lift_BoardingBridge_{i:02d}',(0,-1.57,z-.055),(1.86,.98,.11),bpy.data.materials['M05_Elevator_Landing'])

# South glazing has actual door openings at every landing; cabin glazing opens
# on the same side. Keep all other glazing and animation/controller properties.
shaft=S.objects['M05_Elevator_Shaft_Glass_South'];preserve(shaft)
glass=shaft.data.materials[0]; retire(shaft,'Replaced with glazing around aligned landing openings')
bottom=stops[0]-.16; shafttop=stops[-1]+2.65
for label,x in [('L',-1.38),('R',1.38)]:
    box('M06_Lift_SouthGlass_'+label,(x,-1.8,(bottom+shafttop)/2),(.84,.07,shafttop-bottom),glass)
last=bottom
for i,z in enumerate(stops):
    if z>last:box(f'M06_Lift_SouthGlass_Spandrel_{i:02d}',(0,-1.8,(last+z)/2),(1.92,.07,z-last),glass)
    last=z+2.30
if shafttop>last:box('M06_Lift_SouthGlass_Top',(0,-1.8,(last+shafttop)/2),(1.92,.07,shafttop-last),glass)
retire(S.objects['M05_Elevator_Cabin_Glass_South'],'Cabin entrance aligned with south landings')
for n in ['West','East','North']:
    o=S.objects['M05_Elevator_Shaft_Glass_'+n];preserve(o);lo,hi=bounds(o)
    for v in o.data.vertices:
        p=o.matrix_world@v.co
        if abs(p.z-hi.z)<.01:p.z=shafttop;v.co=o.matrix_world.inverted()@p
    o.data.update()
for o in S.objects:
    if o.name.startswith('M05_Elevator_Shaft_Post_'):
        preserve(o);lo,hi=bounds(o)
        for v in o.data.vertices:
            p=o.matrix_world@v.co
            if abs(p.z-hi.z)<.01:p.z=shafttop;v.co=o.matrix_world.inverted()@p
        o.data.update()

S['M06_cleanup']='Curved portals, annex clipping, tree clearance, restored slabs and flush lift landings'
bpy.context.view_layer.update()
(OUT/'changes.json').write_text(json.dumps(log,indent=2),encoding='utf-8')
result={'preserved_originals':len(saved),'changes':log,'stops':stops}
bpy.app.driver_namespace['cleanup_ns']=globals()
