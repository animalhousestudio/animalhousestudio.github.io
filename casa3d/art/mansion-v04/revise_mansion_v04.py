"""Shared greenery and window cats, plus a smaller upper west turret."""
import bpy, math, random, json, bmesh
from pathlib import Path
from mathutils import Vector, Matrix
OUT=Path(__file__).resolve().parent;OUT.mkdir(parents=True,exist_ok=True)
s=bpy.context.scene
assert s.name=='Mansion_Architecture_v03','Run once on the approved v03.'
if bpy.context.object and bpy.context.object.mode!='OBJECT':bpy.ops.object.mode_set(mode='OBJECT')
s.name='Mansion_Architecture_v04'
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':area.spaces.active.shading.type='SOLID'
before={o.data for o in s.objects if o.type=='MESH'}
def collection(name):
    c=bpy.data.collections.new(name);s.collection.children.link(c);return c
green=collection('M04_01_Shared_Greenery');cats=collection('M04_02_Window_Cats');west=collection('M04_03_Upper_West_Turret')
def material(name,color,metal=0,rough=.65):
    m=bpy.data.materials.new('M04_'+name);m.diffuse_color=(*color,1);m.use_nodes=True
    p=m.node_tree.nodes['Principled BSDF'];p.inputs['Base Color'].default_value=m.diffuse_color;p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough;return m
leafm=[material('Leaf_Forest',(.055,.16,.065)),material('Leaf_Sage',(.16,.31,.095)),material('Leaf_NewGrowth',(.29,.42,.12))]
stem=material('Vine_Wood',(.15,.105,.047));soil=material('Pot_Soil',(.06,.032,.018))
flower=material('Flower_Mauve',(.50,.22,.36));petal=material('Flower_Cream',(.84,.66,.35))
oak=bpy.data.materials['CURVE_AgedOak_Trim'];bronze=bpy.data.materials['CURVE_AgedBronze'];iron=bpy.data.materials['M01_Ironwork'];clay=bpy.data.materials['EXT_Organic_Planter'];slate=bpy.data.materials['CURVE_Slate_BlueGrey'];sage=bpy.data.materials['M01_Sage_Timber'];glass=bpy.data.materials['M01_Amber_Window']

class MeshKit:
    def __init__(self):self.v=[];self.f=[];self.mi=[]
    def part(self,v,f,mat=0):
        n=len(self.v);self.v.extend([tuple(p) for p in v]);self.f.extend([tuple(n+i for i in face) for face in f]);self.mi.extend([mat]*len(f))
    def box(self,c,d,mat=0):
        c=Vector(c);v=[c+Vector((x*d[0],y*d[1],z*d[2])) for x in [-.5,.5] for y in [-.5,.5] for z in [-.5,.5]]
        self.part(v,[(0,4,6,2),(1,3,7,5),(0,1,5,4),(2,6,7,3),(0,2,3,1),(4,5,7,6)],mat)
    def blob(self,c,r,mat=0,n=12,rings=8):
        v=[Vector(c)+Vector((r[0]*math.sin(j*math.pi/rings)*math.cos(i*math.tau/n),r[1]*math.sin(j*math.pi/rings)*math.sin(i*math.tau/n),r[2]*math.cos(j*math.pi/rings))) for j in range(rings+1) for i in range(n)]
        f=[(j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i) for j in range(rings) for i in range(n)];self.part(v,f,mat)
    def tube(self,pts,r,mat=0,n=6):
        pts=list(map(Vector,pts));v=[]
        for i,p in enumerate(pts):
            q=(pts[min(i+1,len(pts)-1)]-pts[max(i-1,0)]).to_track_quat('Z','Y')
            rr=r*(1-.30*i/max(1,len(pts)-1))
            v.extend(p+q@Vector((rr*math.cos(k*math.tau/n),rr*math.sin(k*math.tau/n),0)) for k in range(n))
        f=[(j*n+k,j*n+(k+1)%n,(j+1)*n+(k+1)%n,(j+1)*n+k) for j in range(len(pts)-1) for k in range(n)]
        f.extend([tuple(reversed(range(n))),tuple((len(pts)-1)*n+k for k in range(n))]);self.part(v,f,mat)
    def leaf(self,p,vec,width,mat):
        # Folded ivy leaf: lobed silhouette, central ridge, 8 triangles per leaf.
        p=Vector(p);d=Vector(vec);l=d.length;d.normalize();side=Vector((d.z,0,-d.x)).normalized()*width
        tip=p+d*l
        edge=[p,p+d*l*.18-side*.48,p+d*l*.43-side,p+d*l*.68-side*.58,tip,p+d*l*.68+side*.58,p+d*l*.43+side,p+d*l*.18+side*.48]
        center=p+d*l*.47+Vector((0,.038,0));self.part([center]+edge,[(0,i+1,(i+1)%8+1) for i in range(8)],mat)
    def mesh(self,name,mats):
        me=bpy.data.meshes.new(name);me.from_pydata(self.v,[],self.f);me.update()
        for m in mats:me.materials.append(m)
        for p,idx in zip(me.polygons,self.mi):p.material_index=idx
        bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free();return me
def instance(name,me,col,loc=(0,0,0),scale=(1,1,1),angle=0):
    ob=bpy.data.objects.new(name,me);col.objects.link(ob);ob.location=loc;ob.scale=scale;ob.rotation_euler.z=angle;return ob

# Replace the coarse merged vine system, retaining the tree and aviary.
removed=[]
for o in list(s.objects):
    if o.name.startswith(('M01_Reuse_EXT_Organic_Vine','M01_Reuse_EXT_Vegetation_Detail','M01_Reuse_EXT_Organic_PlanterLeaf','M01_Balcony_Plant','M01_WindowCat_','M01_BalconyCat_')):
        removed.append(o.name);bpy.data.objects.remove(o,do_unlink=True)

# Three reusable branch modules. Leaves are combined into each module, never separate objects.
vine_meshes=[]
for variant in range(3):
    rng=random.Random(130+variant);kit=MeshKit();height=2.7
    trunk=[(.09*math.sin(i*.72+variant),0,i*height/12) for i in range(13)];kit.tube(trunk,.022,3)
    for j in range(12):
        z=.12+j*.205;side=-1 if j%2 else 1;x=.09*math.sin(z*3+variant)
        reach=rng.uniform(.26,.60);pts=[(x,0,z),(x+side*reach*.48,.035,z+.16),(x+side*reach,.05,z+.35)]
        kit.tube(pts,.012,3)
        for k in range(5):
            t=(k+.4)/5;p=Vector((x+side*reach*t,.065+rng.uniform(0,.055),z+.35*t))
            direction=Vector((side*rng.uniform(.12,.23),rng.uniform(-.04,.05),rng.uniform(.12,.29)))
            kit.leaf(p,direction,rng.uniform(.12,.19),rng.randrange(3))
            if k%2==0:kit.leaf(p,(-direction.x*.55,.025,.22),.14,(j+k)%3)
    vine_meshes.append(kit.mesh('M04_Ivy_Module_'+str(variant),leafm+[stem]))

# Raycast exclusively to wall cladding; modules occupy piers rather than window openings.
bpy.context.view_layer.update()
wall_objects=[o for o in s.objects if o.type=='MESH' and 'Clapboard' in o.name]
from mathutils.bvhtree import BVHTree
verts=[];faces=[]
for o in wall_objects:
    off=len(verts);verts.extend(o.matrix_world@v.co for v in o.data.vertices);faces.extend(tuple(off+i for i in p.vertices) for p in o.data.polygons)
wall=BVHTree.FromPolygons(verts,faces)
patches=[]
for front,positions in [(True,[(-5.55,.5),(-5.55,3.15),(-5.55,6.0),(-5.4,9),(-5.4,12),(.9,.6),(1.0,3.3),(0,10.0),(0,12.6),(5.45,.4),(5.5,3.0),(5.5,6.0),(5.35,9.2),(5.35,12.0)]),(False,[(-4.6,.5),(-4.6,3.2),(-4.6,6),(-4.45,9.1),(-4.45,12),(3.9,.3),(4.0,3.0),(4.1,6.0),(3.7,9.0),(3.5,11.8),(-.7,.3),(-.5,4.8)])]:
    for x,z in positions:
        origin=Vector((x,-12 if front else 12,z+1.2));direction=Vector((0,1 if front else -1,0))
        p,n,idx,dist=wall.ray_cast(origin,direction,20)
        if p is None:continue
        if n.dot(-direction)<0:n=-n
        n.z=0;n.normalize();t=Vector((n.y,-n.x,0));center=Vector((p.x,p.y,z))+n*.05
        ob=instance('M04_Ivy_Pier',vine_meshes[len(patches)%3],green)
        ob.matrix_world=Matrix(((t.x,n.x,0,center.x),(t.y,n.y,0,center.y),(0,0,1,center.z),(0,0,0,1)))
        ob.scale.x=.78 if abs(x)<2 else 1.0;patches.append(ob)

# One detailed flowerbox mesh with soil, wooden slats, rim and integral metal brackets.
k=MeshKit();k.box((0,0,-.16),(1.26,.42,.08),0)
for y in [-.22,.22]:
    k.box((0,y,0),(1.30,.065,.32),0);k.box((0,y,.16),(1.36,.09,.075),0)
for x in [-.63,.63]:k.box((x,0,0),(.065,.45,.32),0)
k.box((0,0,.09),(1.18,.37,.025),1)
for x in [-.40,.40]:
    k.tube([(x,.25,.04),(x,.25,-.26),(x,-.2,-.26)],.025,2)
for x in [-.52,-.26,0,.26,.52]:k.box((x,-.257,0),(.027,.02,.28),2)
boxmesh=k.mesh('M04_WindowBox_Shared',[oak,soil,iron])

# Two mixed leafy/flowering clusters, also used to improve the main balcony planters.
pot_meshes=[]
for variant in range(2):
    rng=random.Random(903+variant);k=MeshKit()
    for j in range(19):
        x=rng.uniform(-.48,.48);y=rng.uniform(-.12,.12);h=rng.uniform(.18,.48)
        k.tube([(x,y,.08),(x+.07,y,.08+h)],.012,3)
        for side in [-1,1]:k.leaf((x,y,.11+h*.4),(side*.16,.025,h*.55),.12,j%3)
        if j%3==0:
            for a in range(5):k.blob((x+.07+.042*math.cos(a*math.tau/5),y+.04*math.sin(a*math.tau/5),h+.10),(.045,.04,.045),4+variant,n=6,rings=4)
    for side in [-1,1]:
        pts=[(side*.45,-.05,.14),(side*.58,-.22,.04),(side*.56,-.32,-.28),(side*.68,-.34,-.55)]
        k.tube(pts,.014,3)
        for j in range(6):k.leaf((side*(.48+.025*j),-.26,.02-.095*j),(side*.14,.04,-.1),.105,j%3)
    pot_meshes.append(k.mesh('M04_Flowering_WindowCluster_'+str(variant),leafm+[stem,flower,petal]))
seats=[(-4.85,-6.53,18.02,0),(3.225,-6.52,18.07,0),(-1.9,6.48,17.94,math.pi),(5.6,6.48,18.44,math.pi),(1.27,6.55,2.63,math.pi),(-1.56,6.44,10.27,math.pi)]
for i,(x,y,z,a) in enumerate(seats):
    instance('M04_WindowBox',boxmesh,green,(x,y,z),(1,.95,1),a)
    instance('M04_WindowFlowers',pot_meshes[i%2],green,(x,y,z+.05),(1,1,1),a)
for i,o in enumerate([o for o in s.objects if o.name.startswith('M01_Balcony_Planter')]):
    p=o.matrix_world.translation.copy();instance('M04_BalconyFlowers',pot_meshes[i%2],green,(p.x,p.y,p.z+.25),(1,1,1.1))

# A seated window cat, back toward the viewer, with front paws and a draped curled tail.
fur=[material('Cat_Charcoal',(.045,.047,.055)),material('Cat_Ginger',(.48,.20,.06)),material('Cat_Silver',(.30,.33,.36)),material('Cat_Cream',(.70,.59,.40))]
cream=material('Cat_WhiteMarkings',(.83,.79,.68));nose=material('Cat_Features',(.06,.045,.038));eye=material('Cat_Eyes',(.62,.52,.14))
k=MeshKit();k.blob((0,-.015,.36),(.27,.22,.36));k.blob((0,.065,.66),(.19,.16,.31));k.blob((0,.095,.89),(.235,.19,.21))
for x in [-.135,.135]:
    k.blob((x,.19,.09),(.085,.115,.09),1);k.blob((x,-.055,.13),(.145,.15,.14),0)
    k.part([(x-.095,.035,.98),(x+.095,.035,.98),(x,.04,1.23),(x,.16,.99)],[(0,1,2),(0,3,1),(0,2,3),(1,3,2)],0)
k.blob((0,.203,.51),(.12,.055,.23),1)
k.blob((-.055,.267,.84),(.075,.05,.047),1);k.blob((.055,.267,.84),(.075,.05,.047),1);k.blob((0,.304,.875),(.03,.025,.022),2,n=8,rings=6)
for x in [-.10,.10]:
    k.blob((x,.260,.935),(.043,.022,.038),3,n=8,rings=6);k.blob((x,.279,.935),(.012,.008,.025),2,n=6,rings=4)
k.tube([(.18,-.08,.16),(.31,-.19,.08),(.34,-.34,-.08),(.31,-.40,-.34),(.38,-.40,-.55),(.48,-.35,-.56),(.50,-.29,-.45)],.065,0,n=8)
catmesh=k.mesh('M04_Seated_WindowCat_SHARED',[fur[0],cream,nose,eye])
for p in catmesh.polygons:p.use_smooth=True
cat_sites=[(-3.83,-5.93,2.92,0,.90),(6.07,-6.36,17.78,0,1.02),(-1.12,6.40,18.03,math.pi,.94),(1.36,6.45,2.77,math.pi,.83),(-1.56,6.32,10.44,math.pi,.88)]
for i,(x,y,z,a,scale) in enumerate(cat_sites):
    ob=instance('M04_WindowCat_'+['Tuxedo','Ginger','Silver','Cream','Charcoal'][i],catmesh,cats,(x,y,z),(scale,scale,scale),a)
    ob.material_slots[0].link='OBJECT';ob.material_slots[0].material=fur[i%4]
    ob['shared_pose']='seated, looking into window, tail over sill'

# Linked copy of the existing tower: smaller, opposite side, on the upper gallery level.
source=list(bpy.data.collections['M01_04_East_Tower_Wing'].objects)
target=Vector((-12.5,-4.5,17.2));house=Vector((-7.5,-3,17.2));axis=(house-target).normalized();angle=math.atan2(axis.y,axis.x)
xf=Matrix.Translation(target)@Matrix.Rotation(math.pi+angle,4,'Z')@Matrix.Diagonal((.62,.62,.55,1))@Matrix.Translation((-14.85,.1,-9.784561157226562))
copied=[]
for old in source:
    ob=old.copy();ob.name='M04_WestTurret_'+old.name;ob.parent=None;ob.matrix_world=xf@old.matrix_world;west.objects.link(ob);copied.append(ob)

# Regenerate only the affected side bay with a door-height opening instead of glass.
base=(OUT.parent/'mansion-v01'/'create_mansion.py').read_text(encoding='utf-8')
ns={'bpy':bpy,'math':math,'Vector':Vector,'Matrix':Matrix,'oak':oak,'glass':glass,'bronze':bronze}
exec(base[base.index('def mesh_obj('):base.index('# The new upper storey')],ns)
for o in list(s.objects):
    if not o.name.startswith('M01_UpperFloor_Side'):continue
    p=[o.matrix_world@Vector(v) for v in o.bound_box]
    if max(v.x for v in p)<-7.3 and max(v.y for v in p)<.01:bpy.data.objects.remove(o,do_unlink=True)
start=set(west.objects)
ns['bay']('M04_WestPassage_Door',(-7.5,-3,17.2),6,5.05,(1.65,2.65),0,sage,west,-math.pi/2)
for o in list(west.objects):
    if o not in start and any(x in o.name for x in ['Glass','Mullion','Transom','LowerRail','Sill']):bpy.data.objects.remove(o,do_unlink=True)

# Single combined connector mesh: deck, balustrades, braces and a pitched roof.
end=target+axis*1.30;length=(house-end).length;mid=(house+end)/2;lat=Vector((-axis.y,axis.x,0))
k=MeshKit();k.box((0,0,-.12),(length+.25,1.8,.24),0)
for y in [-.84,.84]:
    k.box((0,y,1.08),(length+.22,.09,.10),0)
    for x in [-length/2+.08,length/2-.08]:
        k.box((x,y,1.27),(.14,.14,2.6),0)
        k.tube([(x,y,1.95),(x+(.5 if x<0 else -.5),y,2.5)],.07,0)
    for j in range(10):k.box((-length/2+length*j/9,y,.56),(.04,.04,1.0),1)
    k.tube([(-length/2,y,-.18),(length/2,y,-1.35)],.13,0)
k.part([(-length/2-.15,-1.03,2.60),(length/2+.25,-1.03,2.60),(-length/2-.15,0,3.20),(length/2+.25,0,3.20),(-length/2-.15,1.03,2.60),(length/2+.25,1.03,2.60)],[(0,1,3,2),(2,3,5,4)],2)
for x in [-length/2-.15,length/2+.25]:k.tube([(x,-1.03,2.60),(x,0,3.20),(x,1.03,2.60)],.065,0)
connmesh=k.mesh('M04_WestPassage_Assembly',[oak,iron,slate]);instance('M04_WestPassage',connmesh,west,mid,angle=angle)

# One matching cat-sized sill extension supports the upper front cat's whole body.
k=MeshKit();k.box((0,0,0),(1.0,.58,.10),0)
sill=k.mesh('M04_CatSill_Shared',[oak])
for x,y,z,a,sc in cat_sites:instance('M04_Cat_WindowSeat',sill,cats,(x,y,z-.05),(sc,sc,1),a)

# Normalize generated version names; repeated details keep shared geometry.
for o in s.objects:
    if o.name.startswith('M01_M04_'):o.name=o.name.replace('M01_M04_','M04_',1)
bpy.context.view_layer.update()
studio=bpy.data.collections['M01_90_Presentation']
def cam(name,loc,target,scale):
    data=bpy.data.cameras.new(name);data.type='ORTHO';data.ortho_scale=scale
    ob=bpy.data.objects.new(name,data);studio.objects.link(ob);ob.location=loc;ob.rotation_euler=(Vector(target)-ob.location).to_track_quat('-Z','Y').to_euler();return ob
hero=cam('M04_Camera_Front',(-48,-83,39),(0,-.5,16.4),49)
detail=cam('M04_Camera_WindowDetail',(13,-28,22),(5.6,-6.1,18.6),6.8)
s.camera=hero;s.cycles.samples=24;s.render.resolution_x=1200;s.render.resolution_y=1200;s.render.resolution_percentage=100
s.render.filepath=str(OUT/'mansion-v04-front.png')
for o in s.objects:o.select_set(False)
meshes=[o for o in s.objects if o.type=='MESH' and not any(c==studio for c in o.users_collection)]
stats={'revision':'v04','cats':len(cat_sites),'cat_unique_meshes':1,'ivy_modules':len(vine_meshes),'ivy_instances':len(patches),'flower_cluster_meshes':len(pot_meshes),'flowerbox_meshes':1,'tower_linked_objects':len(copied),'tower_base_level':17.2,'tower_xy_scale':.62,'tower_height_scale':.55,'mesh_objects':len(meshes),'unique_meshes':len({o.data for o in meshes}),'removed_old_greenery_objects':len(removed),'game_modified':False}
(OUT/'stats.json').write_text(json.dumps(stats,indent=2),encoding='utf-8')
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'mansion-v04.blend'),compress=True)
result=stats
