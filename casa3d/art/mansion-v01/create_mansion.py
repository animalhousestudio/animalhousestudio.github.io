"""Architectural study from the open house scene. Original scene/data stay intact."""
import bpy, math, json, random
from pathlib import Path
from mathutils import Vector, Matrix

OUT=Path(__file__).resolve().parent
SOURCE=bpy.data.scenes['Scene']
NAME='Mansion_Architecture_v01'
if NAME in bpy.data.scenes:
    raise RuntimeError('Review scene already exists. Do not duplicate it.')
scene=bpy.data.scenes.new(NAME)
bpy.context.window.scene=scene
scene.unit_settings.system='METRIC'
collections={}
for label in ['01_Retained_House','02_New_Upper_Floor','03_Balconies','04_East_Tower_Wing','05_Conservatory','06_Observatory','07_Plants_Cats','90_Presentation']:
    c=bpy.data.collections.new('M01_'+label);scene.collection.children.link(c);collections[label]=c
retained=collections['01_Retained_House']
newfloor=collections['02_New_Upper_Floor']
balcony=collections['03_Balconies']
tower=collections['04_East_Tower_Wing']
conservatory=collections['05_Conservatory']
observatory=collections['06_Observatory']
life=collections['07_Plants_Cats']
studio=collections['90_Presentation']

def bounds(o):
    p=[o.matrix_world@Vector(v) for v in o.bound_box]
    return [min(v[i] for v in p) for i in range(3)],[max(v[i] for v in p) for i in range(3)]

# Copies share existing mesh/material datablocks. Only their transforms change.
stretch=Matrix.Diagonal((1.30,1.10,1,1))
roof_terms=('Gable','Roof_StandingSeam','Roof_Soffit','Observatory_Cylindrical','Dome_','Drum_')
copied=[]
source_layer=SOURCE.view_layers[0]
for old in list(SOURCE.objects):
    if old.type not in {'MESH','CURVE','FONT'}: continue
    if not old.visible_get(view_layer=source_layer) or old.hide_render: continue
    if any(c.name=='ARCHIVE_PreCurve_Shell' for c in old.users_collection): continue
    lo,hi=bounds(old)
    if hi[2]<=0 or old.name.startswith(('INT_Foundation','INT_Slab_Basement')): continue
    if 'Cat' in old.name or old.name.startswith('JETPACK'): continue
    obj=old.copy();obj.name='M01_Reuse_'+old.name
    obj.parent=None
    obj.animation_data_clear()
    obj.matrix_world=stretch@old.matrix_world
    isroof=old.name=='ObsDome_Curved' or (old.name.startswith('CURVE_') and any(s in old.name for s in roof_terms))
    if isroof: obj.location.z+=5.4
    dest=observatory if ('Dome' in old.name or 'Drum_' in old.name or 'Observatory_Cylindrical' in old.name) else retained
    if old.name.startswith(('TREE','AVIARY')) or 'Vegetation' in old.name: dest=life
    dest.objects.link(obj)
    obj['source_object']=old.name
    copied.append(obj)

def mat(name,color,metal=0,rough=.65,emission=0):
    m=bpy.data.materials.new('M01_'+name);m.diffuse_color=(*color,1);m.use_nodes=True
    b=m.node_tree.nodes.get('Principled BSDF');b.inputs['Base Color'].default_value=(*color,1)
    b.inputs['Metallic'].default_value=metal;b.inputs['Roughness'].default_value=rough
    if emission:
        b.inputs['Emission Color'].default_value=(*color,1);b.inputs['Emission Strength'].default_value=emission
    return m

cream=bpy.data.materials['CURVE_PaintedTimber_Warm']
oak=bpy.data.materials['CURVE_AgedOak_Trim']
slate=bpy.data.materials['CURVE_Slate_BlueGrey']
bronze=bpy.data.materials['CURVE_AgedBronze']
sage=mat('Sage_Timber',(.30,.43,.35))
plaster=mat('Rose_Limestone',(.66,.47,.36))
stone=mat('Foundation_Stone',(.27,.31,.30))
dark=mat('Ironwork',(.045,.085,.085),.55,.35)
glass=mat('Amber_Window',(.055,.125,.145),.18,.22)
blueglass=mat('Conservatory_Glass',(.13,.30,.31),.25,.20)
gold=mat('Brass_Accents',(.60,.36,.12),.7,.27)
leaf=bpy.data.materials['TREE_Leaf_B']
clay=bpy.data.materials['EXT_Organic_Planter']
catmat=mat('Cat_Terracotta',(.29,.13,.067))
catcream=mat('Cat_Cream',(.82,.69,.48))

def mesh_obj(name,verts,faces,material,col,cache=None):
    me=bpy.data.meshes.new('M01_'+name+'_Mesh');me.from_pydata(verts,[],faces);me.update()
    me.materials.append(material)
    ob=bpy.data.objects.new('M01_'+name,me);col.objects.link(ob)
    return ob

# One unit cube mesh per material; all repeated trim pieces reuse it.
cube_cache={}
def box(name,loc,size,material,col,rotation=0):
    key=material.name
    if key not in cube_cache:
        verts=[(x,y,z) for x in [-.5,.5] for y in [-.5,.5] for z in [-.5,.5]]
        faces=[(0,4,6,2),(1,3,7,5),(0,1,5,4),(2,6,7,3),(0,2,3,1),(4,5,7,6)]
        ob=mesh_obj(name,verts,faces,material,col);cube_cache[key]=ob.data
    else:
        ob=bpy.data.objects.new('M01_'+name,cube_cache[key]);col.objects.link(ob)
    ob.location=loc;ob.scale=size;ob.rotation_euler.z=rotation
    return ob

def line(name,points,radius,material,col,cyclic=False):
    # Mesh tubes avoid live curve overhead in the review export.
    verts=[];faces=[];sides=6
    for i,p in enumerate(points):
        direction=Vector(points[min(len(points)-1,i+1)])-Vector(points[max(0,i-1)])
        if direction.length<1e-6: direction=Vector((0,0,1))
        q=direction.to_track_quat('Z','Y')
        for k in range(sides):
            v=q@Vector((radius*math.cos(k*math.tau/sides),radius*math.sin(k*math.tau/sides),0))+Vector(p)
            verts.append(v)
    for i in range(len(points)-1):
        for k in range(sides): faces.append((i*sides+k,i*sides+(k+1)%sides,(i+1)*sides+(k+1)%sides,(i+1)*sides+k))
    faces.extend([tuple(reversed(range(sides))),tuple((len(points)-1)*sides+k for k in range(sides))])
    return mesh_obj(name,verts,faces,material,col)

def ring(name,cx,cy,z,radius,material,col,tube=.065,segments=48):
    return line(name,[(cx+radius*math.cos(i*math.tau/segments),cy+radius*math.sin(i*math.tau/segments),z) for i in range(segments+1)],tube,material,col)

def lathe(name,cx,cy,profile,material,col,segments=48):
    phase=math.pi/8 if segments==8 else 0
    verts=[(cx+r*math.cos(i*math.tau/segments+phase),cy+r*math.sin(i*math.tau/segments+phase),z) for r,z in profile for i in range(segments)]
    faces=[]
    for j in range(len(profile)-1):
        for i in range(segments): faces.append((j*segments+i,j*segments+(i+1)%segments,(j+1)*segments+(i+1)%segments,(j+1)*segments+i))
    return mesh_obj(name,verts,faces,material,col)

def transform_local(ob,center,theta):
    local=Matrix.LocRotScale(ob.location,ob.rotation_euler.to_quaternion(),ob.scale)
    ob.matrix_world=Matrix.Translation(Vector(center))@Matrix.Rotation(theta,4,'Z')@local
    return ob

bay_cache={}
def bay(name,center,width,height,opening,bottom,material,col,theta=0):
    """A wall module with a true arched opening and recessed glazing."""
    ow,oh=opening;key=(width,height,ow,oh,bottom,material.name)
    if key in bay_cache:
        for source in bay_cache[key]:
            obj=source.copy();obj.name='M01_'+name+'_'+source.name.split('_')[-1];col.objects.link(obj)
            transform_local(obj,center,theta)
        return
    objects=[]
    def part(n,loc,size,ma):
        ob=box(name+'_'+n,loc,size,ma,col);objects.append(ob);return ob
    side=(width-ow)/2
    part('Pier_L',(-ow/2-side/2,0,height/2),(side,.32,height),material)
    part('Pier_R',(ow/2+side/2,0,height/2),(side,.32,height),material)
    if bottom>0: part('Apron',(0,0,bottom/2),(ow,.32,bottom),material)
    spring=bottom+oh-ow/2
    arc=[(-ow/2*math.cos(i*math.pi/20),spring+ow/2*math.sin(i*math.pi/20)) for i in range(21)]
    # Infill above the arch, with front/back and reveal thickness.
    verts=[];faces=[]
    for x,z in arc: verts.extend([(x,-.16,z),(x,-.16,height),(x,.16,z),(x,.16,height)])
    for i in range(20):
        a=i*4;b=a+4
        faces.extend([(a,b,b+1,a+1),(a+2,a+3,b+3,b+2),(a,a+2,b+2,b),(a+1,b+1,b+3,a+3)])
    infill=mesh_obj(name+'_ArchWall',verts,faces,material,col);objects.append(infill)
    outline=[(-ow/2,bottom),(-ow/2,spring)]+arc[1:]+[(ow/2,bottom)]
    pane=mesh_obj(name+'_Glass',[(x,.055,z) for x,z in outline],[tuple(range(len(outline)))],glass,col);objects.append(pane)
    frame=line(name+'_OakFrame',[(x,-.21,z) for x,z in outline],.085,oak,col);objects.append(frame)
    part('Sill',(0,-.28,bottom-.06),(ow+.35,.65,.15),oak)
    part('Mullion',(0,-.22,bottom+oh/2),(.055,.08,oh),bronze)
    part('Transom',(0,-.22,spring-.10),(ow,.08,.065),bronze)
    part('LowerRail',(0,-.22,bottom+oh*.37),(ow,.08,.06),bronze)
    # Cache local, immutable objects as templates; copies share mesh data.
    templates=[]
    for ob in objects:
        template=ob.copy();template.matrix_world=Matrix.LocRotScale(ob.location,ob.rotation_euler.to_quaternion(),ob.scale);templates.append(template)
        transform_local(ob,center,theta)
    bay_cache[key]=templates

# The new upper storey fills the gap below the lifted bell-shaped roof.
box('UpperFloor_Slab',(0,0,17.06),(15.4,12.25,.28),oak,newfloor)
box('UpperFloor_Ceiling',(0,0,22.22),(15.4,12.25,.20),oak,newfloor)
for x in [-5,0,5]:
    bay('UpperFloor_Front', (x,-5.95,17.2),5,5.05,(2.6,4.6),.10,sage,newfloor)
    bay('UpperFloor_Rear',(-x,5.95,17.2),5,5.05,(2.2,3.5),.8,sage,newfloor,math.pi)
for side in [-1,1]:
    for y in [-3,3]:
        bay('UpperFloor_Side',(side*7.5,y,17.2),6,5.05,(2.3,3.5),.8,sage,newfloor,side*math.pi/2)
    box('UpperFloor_Corner',(side*7.48,-5.96,19.7),(.22,.22,5.2),oak,newfloor)
for z in [17.2,22.22]:
    box('UpperFloor_FrontCornice',(0,-6.12,z),(15.8,.32,.24),oak,newfloor)
    box('UpperFloor_BackCornice',(0,6.12,z),(15.8,.32,.24),oak,newfloor)

# Broad planted balcony with open balustrade and visible brackets.
box('GrandBalcony_Deck',(0,-7.55,17.12),(16.1,3.6,.30),oak,balcony)
box('GrandBalcony_StoneLip',(0,-9.33,17.12),(16.35,.18,.40),cream,balcony)
for x in [-7.6,7.6]:
    box('Balcony_Support',(x,-7.3,12.7),(.34,.38,8.7),oak,balcony)
    line('Balcony_Brace',[(x,-6.1,14.9),(x,-8.7,16.93)],.13,oak,balcony)
for x in [-7.5,-5,-2.5,0,2.5,5,7.5]:
    line('Balcony_Corbel',[(x,-6.0,15.8),(x,-8.7,16.95)],.09,oak,balcony)

def railing(name,a,b,z,col,spacing=.43):
    ax,ay=a;bx,by=b;length=math.hypot(bx-ax,by-ay);num=math.ceil(length/spacing)
    line(name+'_Top',[(ax,ay,z+1.22),(bx,by,z+1.22)],.08,oak,col)
    line(name+'_Foot',[(ax,ay,z+.16),(bx,by,z+.16)],.045,dark,col)
    for i in range(num+1):
        t=i/num;x=ax+(bx-ax)*t;y=ay+(by-ay)*t
        box(name+'_Baluster',(x,y,z+.67),(.055,.055,1.04),dark,col)
        if i%4==0: box(name+'_Post',(x,y,z+.65),(.13,.13,1.30),oak,col)

railing('GrandBalcony',(-7.9,-9.15),(7.9,-9.15),17.3,balcony)
railing('GrandBalcony_Left',(-7.9,-9.15),(-7.9,-5.9),17.3,balcony)
railing('GrandBalcony_Right',(7.9,-9.15),(7.9,-5.9),17.3,balcony)

# A lower east wing makes the house a mansion, with an offset octagonal tower.
for x in [8.5,12.5]:
    for z in [0,7.1]: bay('EastWing_Back',(x,5.2,z),4,7.1,(2,4.1),1.4,cream,tower,math.pi)
for y in [1.6,4]:
    for z in [0,7.1]: bay('EastWing_Side',(14.5,y,z),2.4,7.1,(1.35,3.9),1.5,cream,tower,math.pi/2)
for z in [.15,7.1,14.3]: box('EastWing_Floor',(10.5,1.5,z),(8.3,7.7,.30),oak,tower)
roof=mesh_obj('EastWing_Roof',[(6,-2.7,14.4),(15,-2.7,14.4),(15,5.7,14.4),(6,5.7,14.4),(10.5,-2.7,18.7),(10.5,5.7,18.7)],[(0,1,4),(3,5,2),(0,4,5,3),(1,2,5,4)],slate,tower)
line('EastWing_Ridge',[(10.5,-2.8,18.7),(10.5,5.8,18.7)],.12,bronze,tower)

cx,cy,apothem=12,-3.1,3.05
facewidth=2*apothem*math.tan(math.pi/8)
for j in range(8):
    theta=j*math.tau/8
    for base in [0,7.1,14.2]:
        bay('Tower_ArchedBay',(cx+apothem*math.sin(theta),cy-apothem*math.cos(theta),base),facewidth,7.1,(1.4,4.0),1.35,plaster,tower,theta)
    px=cx+(apothem/math.cos(math.pi/8))*math.sin(theta+math.pi/8)
    py=cy-(apothem/math.cos(math.pi/8))*math.cos(theta+math.pi/8)
    box('Tower_CornerPier',(px,py,10.65),(.18,.18,21.3),cream,tower,theta)
for z in [.2,7.1,14.2,21.3]:
    lathe('Tower_StringCourse',cx,cy,[(3.48,z-.12),(3.48,z+.12)],oak,tower,8)
lathe('Tower_WitchHat',cx,cy,[(3.65,21.3),(3.75,21.65),(3.2,22.0),(2.3,23.8),(1.45,26.0),(.68,28.1),(.04,29.5)],slate,tower,32)
for j in range(8):
    t=j*math.tau/8
    line('Tower_RoofSeam',[(cx+r*math.cos(t),cy+r*math.sin(t),z) for r,z in [(3.75,21.65),(3.2,22),(2.3,23.8),(1.45,26),(.68,28.1),(.04,29.5)]],.045,bronze,tower)
line('Tower_Finial',[(cx,cy,29.4),(cx,cy,30.7)],.065,gold,tower)
ring('Tower_FinialOrb',cx,cy,30.2,.25,gold,tower,.045,16)

# Roof terrace joins the tower to the main house.
box('EastTerrace_Deck',(9.15,3.35,17.2),(3.1,4.1,.25),oak,tower)
railing('EastTerrace_Back',(7.7,5.3),(10.6,5.3),17.34,tower)

# Retain the existing tree and aviary, add a garden-room below them.
box('Conservatory_Plinth',(-11,-1.1,.35),(7.2,7.6,.65),stone,conservatory)
for x in [-13.4,-11,-8.6]:
    bay('Conservatory_Front',(x,-4.85,.67),2.4,6.1,(2.02,5.25),.45,sage,conservatory)
for y in [-3.6,-1.2,1.2]:
    bay('Conservatory_End',(-14.6,y,.67),2.4,6.1,(2.02,5.25),.45,sage,conservatory,-math.pi/2)
box('Conservatory_Back',(-11,2.55,3.7),(7.3,.24,6.1),sage,conservatory)
for x in [-14.8,-13.6,-12.4,-11.2,-10,-8.8,-7.6]:
    line('Conservatory_RoofRafter',[(x,-5.1,6.8),(x,-1.1,8.9),(x,2.8,6.8)],.08,bronze,conservatory)
mesh_obj('Conservatory_RoofGlass',[(-14.8,-5.1,6.8),(-7.4,-5.1,6.8),(-7.4,-1.1,8.9),(-14.8,-1.1,8.9),(-14.8,2.8,6.8),(-7.4,2.8,6.8)],[(0,1,2,3),(3,2,5,4)],blueglass,conservatory)
line('Conservatory_Ridge',[(-14.9,-1.1,8.96),(-7.3,-1.1,8.96)],.11,oak,conservatory)

# Observatory: keep the original dome, add a brass viewing gallery and star finial.
ocx,ocy=-.8*1.3,.95*1.1
for z,r in [(25.73,5.18),(26.94,5.18)]: ring('Observatory_GalleryRail',ocx,ocy,z,r,bronze,observatory,.075)
lathe('Observatory_GalleryDeck',ocx,ocy,[(5.4,25.52),(5.4,25.72),(4.3,25.72)],oak,observatory,64)
for j in range(48):
    t=j*math.tau/48;x=ocx+5.18*math.cos(t);y=ocy+5.18*math.sin(t)
    box('Observatory_GalleryBaluster',(x,y,26.32),(.05,.05,1.15),dark,observatory)
line('Observatory_Spire',[(ocx,ocy,33.4),(ocx,ocy,35.0)],.07,gold,observatory)
ring('Observatory_Armillary',ocx,ocy,34.55,.48,gold,observatory,.045,24)
for j in range(8):
    t=j*math.tau/8
    x=ocx+5.3*math.cos(t);y=ocy+5.3*math.sin(t)
    line('Observatory_GalleryBracket',[(ocx+4.6*math.cos(t),ocy+4.6*math.sin(t),24.8),(x,y,25.6)],.08,oak,observatory)

# Sparse planters articulate the balconies; repeated plants use a shared mesh.
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1)
prototype=bpy.context.object
prototype.name='M01_Plant_Prototype'
plantmesh=prototype.data
plantmesh.materials.append(leaf)
bpy.data.objects.remove(prototype,do_unlink=True)
rng=random.Random(517)
for i,x in enumerate([-6.2,-3.2,3.2,6.2]):
    box('Balcony_Planter',(x,-8.75,17.64),(1.45,.65,.65),clay,life)
    for j in range(5):
        ob=bpy.data.objects.new('M01_Balcony_Plant',plantmesh);life.objects.link(ob)
        ob.location=(x+rng.uniform(-.5,.5),-8.75+rng.uniform(-.2,.2),18.04+rng.uniform(0,.4));ob.scale=(.36,.30,.55)

# One improved, resting cat mesh assembled once, then shared by two window seats.
catparts=[]
def catblob(name,loc,scale,material):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=8,radius=1,location=loc)
    o=bpy.context.object;o.name='M01_Cat_'+name;o.scale=scale;o.data.materials.append(material)
    for c in list(o.users_collection): c.objects.unlink(o)
    life.objects.link(o);catparts.append(o)
catblob('RestingBody',(0,0,.23),(.55,.26,.26),catmat)
catblob('Head',(-.36,-.025,.46),(.25,.23,.24),catmat)
for x in [-.52,-.20]:
    bpy.ops.mesh.primitive_cone_add(vertices=4,radius1=.12,radius2=0,depth=.27,location=(x,-.025,.69))
    ob=bpy.context.object;ob.data.materials.append(catmat)
    for c in list(ob.users_collection): c.objects.unlink(ob)
    life.objects.link(ob);catparts.append(ob)
for x in [-.50,-.24]: catblob('Paw',(x,-.23,.10),(.12,.13,.095),catcream)
catparts.append(line('Cat_CurledTail',[(.35,.12,.25),(.64,.10,.17),(.67,-.20,.1),(.38,-.33,.12),(.12,-.30,.16)],.08,catmat,life))
for x in [-.46,-.28]: catparts.append(line('Cat_SleepingEye',[(x-.04,-.234,.48),(x,-.245,.465),(x+.04,-.234,.48)],.012,dark,life))
for o in bpy.context.view_layer.objects: o.select_set(False)
for o in catparts: o.select_set(True)
bpy.context.view_layer.objects.active=catparts[0]
bpy.ops.object.join()
cat=catparts[0];cat.name='M01_WindowCat_Resting';cat.location+=Vector((-3.6,-6.08,3.07));cat.scale*=1.25
cat2=cat.copy();cat2.name='M01_BalconyCat_Resting';life.objects.link(cat2);cat2.location=Vector((5.0,-6.35,17.43));cat2.rotation_euler.z=.35

exec(compile((OUT/'architecture_details.py').read_text(encoding='utf-8'),str(OUT/'architecture_details.py'),'exec'))

# Presentation only: a neutral ground, soft daylight and a second camera.
groundmat=mat('Preview_Ground',(.105,.135,.145))
box('Presentation_Ground',(0,0,-.45),(2000,2000,.4),groundmat,studio)
world=bpy.data.worlds.new('M01_StudioWorld');world.use_nodes=True
world.node_tree.nodes['Background'].inputs[0].default_value=(.21,.28,.34,1)
world.node_tree.nodes['Background'].inputs[1].default_value=.5
scene.world=world
def aim(o,target): o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
def area(name,loc,power,color,size):
    d=bpy.data.lights.new('M01_'+name,'AREA');d.energy=power;d.shape='DISK';d.size=size;d.color=color
    o=bpy.data.objects.new('M01_'+name,d);studio.objects.link(o);o.location=loc;aim(o,(0,0,14))
area('Key',(-25,-35,52),52000,(1,.84,.65),25)
area('Fill',(30,-15,28),27000,(.64,.80,1),24)
area('Rim',(0,25,42),65000,(1,.89,.70),20)
def camera(name,location,scale):
    d=bpy.data.cameras.new('M01_'+name);d.type='ORTHO';d.ortho_scale=scale
    o=bpy.data.objects.new('M01_'+name,d);studio.objects.link(o);o.location=location;aim(o,(0,0,16));return o
scene.camera=camera('Camera_Hero',(45,-76,42),48)
camera('Camera_TreeAviary',(-48,-72,35),48)
scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True
scene.render.resolution_x=1450;scene.render.resolution_y=1500;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.filepath=str(OUT/'mansion-v01-hero.png')
scene.view_settings.view_transform='AgX'
scene.frame_set(1)
for ob in scene.objects: ob.select_set(False)
for screen in bpy.data.screens:
    for a in screen.areas:
        if a.type=='VIEW_3D':
            sp=a.spaces.active;sp.region_3d.view_location=(0,0,16);sp.region_3d.view_distance=55
            sp.region_3d.view_rotation=scene.camera.rotation_euler.to_quaternion();sp.shading.type='MATERIAL'
bpy.context.view_layer.update()
bpy.data.libraries.write(str(OUT/'mansion-v01.blend'),{scene},fake_user=True,compress=True)
meshes=[o for o in scene.objects if o.type=='MESH' and o not in studio.objects.values()]
unique={o.data for o in meshes}
stats={'source_file':bpy.data.filepath,'retained_objects':len(copied),'mesh_objects':len(meshes),'unique_meshes':len(unique),'shared_mesh_objects':sum(o.data.users>1 for o in meshes),'new_storey':[17.2,22.25],'balcony_depth':3.6,'architecture_only':True,'game_modified':False}
(OUT/'stats.json').write_text(json.dumps(stats,indent=2),encoding='utf-8')
result=stats
