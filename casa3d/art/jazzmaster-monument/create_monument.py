"""Editable Jazzmaster monument. Run in Blender; preserves existing scenes."""
import bpy, math, random
from mathutils import Vector
from pathlib import Path

OUT = Path(__file__).resolve().parent
random.seed(386)
scene = bpy.data.scenes.new('Jazzmaster | Carrara monument')
bpy.context.window.scene = scene
scene.unit_settings.system = 'METRIC'
scene.world = bpy.data.worlds.new('Monument | charcoal studio')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.10,.13,.17,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value = .35

def mat(name, color, metal=0, rough=.4):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Metallic'].default_value=metal; p.inputs['Roughness'].default_value=rough
    return m

def noise_color(m, scale, stops, detail=4):
    n=m.node_tree.nodes; l=m.node_tree.links; p=n.get('Principled BSDF')
    tex=n.new('ShaderNodeTexNoise'); tex.inputs['Scale'].default_value=scale; tex.inputs['Detail'].default_value=detail
    ramp=n.new('ShaderNodeValToRGB')
    for e in list(ramp.color_ramp.elements)[2:]: ramp.color_ramp.elements.remove(e)
    for i,(pos,col) in enumerate(stops):
        e=ramp.color_ramp.elements[i] if i<2 else ramp.color_ramp.elements.new(pos)
        e.position=pos; e.color=(*col,1)
    l.new(tex.outputs['Fac'],ramp.inputs[0]); l.new(ramp.outputs[0],p.inputs['Base Color'])
    return tex

marble=mat('Carrara | fine cool-grey veins',(.86,.88,.86),rough=.28)
n=marble.node_tree.nodes; l=marble.node_tree.links
tex=n.new('ShaderNodeTexNoise'); tex.inputs['Scale'].default_value=2.8; tex.inputs['Detail'].default_value=5; tex.inputs['Roughness'].default_value=.7
wave=n.new('ShaderNodeTexWave'); wave.wave_type='BANDS'; wave.bands_direction='DIAGONAL'; wave.inputs['Scale'].default_value=3.2; wave.inputs['Distortion'].default_value=8; wave.inputs['Detail Scale'].default_value=1.8
l.new(tex.outputs['Color'],wave.inputs['Vector'])
r=n.new('ShaderNodeValToRGB'); r.color_ramp.elements[0].position=.94; r.color_ramp.elements[0].color=(.90,.92,.91,1); r.color_ramp.elements[1].position=.995; r.color_ramp.elements[1].color=(.64,.68,.70,1)
l.new(wave.outputs['Color'],r.inputs[0]); l.new(r.outputs[0],n.get('Principled BSDF').inputs['Base Color'])
wood=mat('Relic | aged amber ash',(.37,.18,.045),rough=.48)
noise_color(wood,5,[(.22,(.11,.052,.018)),(.48,(.40,.23,.078)),(.7,(.63,.43,.19))])
tort=mat('Pickguard | mottled oxblood tortoiseshell',(.20,.035,.017),rough=.28)
noise_color(tort,24,[(.25,(.022,.005,.003)),(.45,(.12,.021,.009)),(.59,(.32,.075,.026)),(.74,(.50,.24,.095))])
black=mat('Black lacquer | worn charcoal',(.017,.020,.018),rough=.38)
rubber=mat('Jack cables | black rubber',(.009,.013,.015),rough=.65)
red=mat('Jack cable | oxblood woven',(.12,.018,.015),rough=.7)
ivory=mat('Pickup covers | aged ivory',(.79,.77,.63),rough=.38)
chrome=mat('Hardware | nickel chrome',(.56,.63,.68),metal=1,rough=.2)
gold=mat('Jack contacts | brass',(.58,.34,.09),metal=.85,rough=.24)
rose=mat('Fretboard | dark rosewood',(.035,.017,.011),rough=.45)
noise_color(rose,8,[(.2,(.013,.009,.007)),(.8,(.065,.032,.016))])
maple=mat('Neck | amber maple',(.58,.35,.14),rough=.38)
floor=mat('Studio | graphite',(.034,.046,.052),rough=.65)

def finish(o,name,m,parent=None):
    o.name=name
    if m:o.data.materials.append(m)
    if parent:o.parent=parent
    if o.type=='MESH':
        for p in o.data.polygons:p.use_smooth=True
    return o

def bevel(o,w=.04):
    b=o.modifiers.new('Soft machined edges','BEVEL'); b.width=w; b.segments=3
    return o

def cube(name,loc,scale,m,parent=None,b=.035):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc); o=bpy.context.object; o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    finish(o,name,m,parent); bevel(o,b)
    return o

def cyl(name,loc,r,depth,m,parent=None,front=False):
    bpy.ops.mesh.primitive_cylinder_add(vertices=48,radius=r,depth=depth,location=loc)
    o=bpy.context.object
    if front:o.rotation_euler[0]=math.pi/2
    finish(o,name,m,parent); bevel(o,min(.015,r*.15))
    return o

def tube(name,pts,r,m,parent=None,cyclic=False):
    c=bpy.data.curves.new(name,'CURVE'); c.dimensions='3D'; c.resolution_u=16; c.bevel_depth=r; c.bevel_resolution=3
    s=c.splines.new('BEZIER'); s.bezier_points.add(len(pts)-1)
    for p,co in zip(s.bezier_points,pts):p.co=co; p.handle_left_type='AUTO'; p.handle_right_type='AUTO'
    s.use_cyclic_u=cyclic
    o=bpy.data.objects.new(name,c); scene.collection.objects.link(o); finish(o,name,m,parent)
    return o

def outline(name,pts,depth,y,m,parent=None):
    # 2D profile in local XY, rotated into the guitar's XZ face.
    c=bpy.data.curves.new(name,'CURVE'); c.dimensions='2D'; c.resolution_u=16; c.fill_mode='BOTH'; c.extrude=depth/2; c.bevel_depth=.025; c.bevel_resolution=3
    s=c.splines.new('BEZIER'); s.bezier_points.add(len(pts)-1); s.use_cyclic_u=True
    for p,co in zip(s.bezier_points,pts):p.co=(co[0],co[1],0); p.handle_left_type='AUTO'; p.handle_right_type='AUTO'
    if name.startswith('Fingerboard'):
        for p in s.bezier_points:p.handle_left_type='VECTOR'; p.handle_right_type='VECTOR'
    o=bpy.data.objects.new(name,c); scene.collection.objects.link(o); o.location.y=y; o.rotation_euler[0]=math.pi/2; finish(o,name,m,parent)
    return o

# Short shaft and Corinthian capital, deliberately squat enough to read as a plinth.
cube('Carrara | foundation',(0,0,.14),(3.9,3.35,.28),marble,b=.09)
cube('Carrara | upper step',(0,0,.39),(3.45,2.95,.24),marble,b=.045)
cyl('Carrara | torus base',(0,0,.60),1.30,.22,marble)
cyl('Carrara | short column shaft',(0,0,1.02),1.04,.72,marble)
for i in range(28):
    a=i*math.tau/28
    cyl('Carrara | fluted shaft rib %02d'%i,(1.025*math.cos(a),1.025*math.sin(a),1.04),.065,.68,marble)
cyl('Carrara | astragal',(0,0,1.43),1.16,.14,marble)
bpy.ops.mesh.primitive_cone_add(vertices=96,radius1=1.08,radius2=1.46,depth=1.23,location=(0,0,2.1)); finish(bpy.context.object,'Carrara | bell of capital',marble)

def leaf(a,z,h,radius,width,idx):
    vs=[]; fs=[]; rows=22; cols=12
    def point(t,u):
        w=width*(math.sin(math.pi*t)**.65)*(.84+.16*math.cos(t*math.pi*12))
        rad=radius+.20*t+.36*t**4+.065*(1-u*u)*math.sin(math.pi*t)
        # Serrated, folded lobes and outward-curling tip.
        zz=z+h*t-.20*t**7 + .028*math.cos(u*math.pi*5)*math.sin(math.pi*t)
        return ((rad*math.cos(a)-u*w*math.sin(a)),(rad*math.sin(a)+u*w*math.cos(a)),zz)
    for i in range(rows+1):
        for j in range(cols+1):vs.append(point(i/rows,2*j/cols-1))
    for i in range(rows):
        for j in range(cols):
            k=i*(cols+1)+j; fs.append((k,k+1,k+cols+2,k+cols+1))
    me=bpy.data.meshes.new('Carved acanthus'); me.from_pydata(vs,[],fs); me.update(); o=bpy.data.objects.new('Acanthus | leaf %02d'%idx,me); scene.collection.objects.link(o); finish(o,o.name,marble)
    so=o.modifiers.new('Carved thickness','SOLIDIFY'); so.thickness=.035
    tube('Acanthus | central rib',[point(t,0) for t in [.01,.15,.3,.45,.6,.75,.9,.99]],.023,marble)
    for t in [.24,.38,.52,.66,.78]:
        for side in [-1,1]:tube('Acanthus | vein',[point(t-.12,0),point(t-.04,side*.5),point(t,side*.92)],.013,marble)
for row in range(2):
    for i in range(12):leaf(i*math.tau/12+row*math.pi/12,1.43+row*.35,.95,1.10+row*.13,.32,i+row*12)
# Paired scrolls on all four faces.
for side in range(4):
    a=side*math.pi/2
    for sign in [-1,1]:
        pts=[]
        for i in range(70):
            t=i/69; angle=-math.pi/2+sign*t*math.tau*1.45; rad=.36*(1-t)+.032
            x=sign*.98+rad*math.cos(angle); y=-1.30; z=2.60+rad*math.sin(angle)
            pts.append((x*math.cos(a)-y*math.sin(a),x*math.sin(a)+y*math.cos(a),z))
        tube('Corinthian | rolled corner volute',pts,.073,marble)
    tube('Corinthian | cauliculus',[(0,-1.28,2.05),(.38,-1.4,2.30),(.66,-1.35,2.56)],.05,marble).rotation_euler.z=a
cube('Carrara | abacus lower',(0,0,2.90),(3.28,3.05,.18),marble,b=.05)
cube('Carrara | abacus crown',(0,0,3.05),(3.55,3.3,.16),marble,b=.055)

# Guitar coordinates: front is -Y, bottom Z=0; parent handles monument pose.
g=bpy.data.objects.new('JAZZMASTER | monumental assembly',None); scene.collection.objects.link(g); g.location=(.10,0,3.19); g.rotation_euler=(math.radians(-5),math.radians(-9),math.radians(-5))
body=[(-.05,.05),(-.86,.03),(-1.40,.28),(-1.53,.75),(-1.32,1.26),(-1.03,1.77),(-1.07,2.26),(-1.24,2.93),(-1.16,3.38),(-.91,3.43),(-.68,3.05),(-.32,2.88),(.03,3.00),(.24,3.03),(.47,2.75),(.87,2.62),(1.15,2.70),(1.30,2.54),(1.19,2.04),(1.06,1.49),(1.22,.98),(1.30,.44),(.91,.10)]
outline('Jazzmaster | offset ash body',body,.32,0,wood,g)
rim=[(x*.977,z*.977+.045) for x,z in body]
tube('Jazzmaster | dark relic perimeter',[(x,-.18,z) for x,z in rim],.026,black,g,True)
# Irregular lacquer islands following the perimeter, exposing amber wood.
for i in range(145):
    k=random.randrange(len(body)); x,z=body[k]; x=x*.96+random.uniform(-.075,.075); z=z*.98+random.uniform(-.07,.07)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=8,ring_count=4,radius=1,location=(x,-.20,z)); o=bpy.context.object; o.scale=(random.uniform(.015,.065),.009,random.uniform(.025,.095)); finish(o,'Relic | chipped lacquer',wood if i%3 else black,g)
guard=[(-.62,.94),(-.68,1.37),(-.68,1.88),(-.97,2.57),(-1.04,2.95),(-.84,3.01),(-.36,2.78),(.15,2.79),(.53,2.53),(1.02,2.51),(.93,2.00),(.88,1.54),(1.07,.99),(.81,.72),(.54,.94)]
outline('Pickguard | ivory laminated edge',guard,.024,-.19,ivory,g)
outline('Pickguard | tortoiseshell',[(x*.987,z*.992+.012) for x,z in guard],.03,-.212,tort,g)
cube('Neck | maple',(0,.015,4.44),(.43,.25,3.36),maple,g,b=.07)
outline('Fingerboard | tapered rosewood',[(-.25,2.7),(-.20,6.14),(.19,6.14),(.26,2.7)],.06,-.155,rose,g)
head=[(-.20,6.10),(-.25,6.40),(-.42,6.73),(-.45,7.31),(-.32,7.64),(-.09,7.72),(.16,7.51),(.12,7.14),(.35,6.65),(.27,6.39),(.18,6.13)]
outline('Headstock | six-inline maple',head,.19,0,maple,g)
cube('Nut | bone',(0,-.20,6.13),(.42,.07,.055),ivory,g,b=.01)
for i in range(22):
    z=6.11-4.67*(1-2**(-(i+1)/12)); w=.20+(6.11-z)*.017
    tube('Fret | %02d'%(i+1),[(-w,-.202,z),(w,-.202,z)],.009,chrome,g)
    if i+1 in [3,5,7,9,12,15,17,19,21]:
        prev=6.11-4.67*(1-2**(-i/12)); zz=(z+prev)/2
        for xx in ([-.08,.08] if i+1==12 else [0]):cyl('Fretboard | pearl dot',(xx,-.198,zz),.025,.008,ivory,g,True)
for z in [1.43,2.30]:
    cube('Pickup | wide Jazzmaster cover',(0,-.275,z),(.88,.13,.36),ivory,g,b=.055)
    for i in range(6):cyl('Pickup | pole piece',((i-2.5)*.117,-.347,z),.018,.009,chrome,g,True)
cube('Bridge | chrome plate',(0,-.25,1.02),(.94,.075,.17),chrome,g,b=.035)
for i in range(6):cube('Bridge | individual saddle',((i-2.5)*.13,-.31,1.05),(.09,.09,.11),chrome,g,b=.01)
outline('Tremolo | floating chrome plate',[(-.42,.32),(-.40,.63),(-.21,.79),(.19,.79),(.39,.62),(.39,.30)],.035,-.21,chrome,g)
cube('Tremolo | string anchor',(0,-.28,.38),(.64,.10,.07),chrome,g,b=.025)
tube('Tremolo | sweeping arm',[(.20,-.31,.64),(.43,-.40,.43),(.91,-.49,.25),(1.37,-.55,.20)],.022,chrome,g)
tube('Tremolo | ivory tip',[(1.29,-.55,.22),(1.53,-.57,.19)],.038,ivory,g)
for x,z in [(.77,1.02),(.87,1.36)]:
    cyl('Control | skirt',(x,-.26,z),.115,.045,chrome,g,True); cyl('Control | black knob',(x,-.31,z),.085,.075,black,g,True)
    for i in range(10):
        a=i*math.tau/10; cyl('Control | dial dot',(x+.092*math.cos(a),-.29,z+.092*math.sin(a)),.006,.009,ivory,g,True)
cyl('Selector | washer',(.86,-.258,2.32),.065,.025,chrome,g,True)
tube('Selector | switch',[(.86,-.28,2.32),(.88,-.40,2.39)],.025,ivory,g)
for x,z in [(-.88,2.73),(-.69,2.55)]:cube('Rhythm circuit | black slider',(x,-.26,z),(.08,.03,.15),black,g,b=.008)
for x,z in guard[::2]:
    cyl('Pickguard | screw',(x*.94,-.255,z),.020,.008,chrome,g,True)
    tube('Pickguard | screw slot',[(x*.94-.011,-.261,z),(x*.94+.011,-.261,z)],.003,black,g)
for i in range(6):
    z=6.46+i*.20; x=-.29 if i<3 else -.34
    cyl('Tuner | post',(x,-.14,z),.036,.10,chrome,g,True)
    tube('Tuner | shaft',[(x,.02,z),(x-.19,.02,z)],.025,chrome,g)
    cube('Tuner | oval button',(x-.24,.02,z),(.12,.075,.10),chrome,g,b=.04)
    sx=(i-2.5)*.061
    tube('String | %d'%(i+1),[((i-2.5)*.125,-.345,.39),((i-2.5)*.125,-.373,1.05),(sx,-.244,6.13),(x,-.205,z)],.0035+i*.00065,chrome,g)
patch=cube('Relic | black tape',(-.92,-.204,.57),(.63,.014,.47),black,g,b=.005); patch.rotation_euler.y=.30
jack=cyl('Output | jack socket',(.99,-.25,.65),.065,.025,chrome,g,True)

# Black instrument leads: restrained loops preserve the carved capital's silhouette.
def plug(name,base,direction):
    v=Vector(direction).normalized(); p=Vector(base)
    for label,offset,r,depth,m in [('strain relief',.08,.045,.16,rubber),('barrel',.25,.070,.24,chrome),('collar',.39,.078,.055,chrome),('tip',.51,.032,.20,gold)]:
        o=cyl(name+' | '+label,p+v*offset,r,depth,m); o.rotation_euler=v.to_track_quat('Z','Y').to_euler()
    for offset in [.45,.53]:
        o=cyl(name+' | insulator',p+v*offset,.034,.018,black); o.rotation_euler=v.to_track_quat('Z','Y').to_euler()
bpy.context.view_layer.update()
socket=g.matrix_world@Vector((.99,-.35,.65))
pts=[tuple(socket),tuple(socket+Vector((.45,-.2,-.18))),(1.92,-.20,2.95)]
for i in range(50):
    t=i/49; a=-.1+t*math.tau*1.5; r=1.82+.07*math.sin(t*11)
    pts.append((r*math.cos(a),r*math.sin(a),2.80-2.0*t))
pts.extend([(-1.9,-1.5,.31),(-2.7,-2.05,.09),(-2.65,-2.8,.075),(-1.8,-2.95,.08)])
tube('Cable 01 | plugged into guitar',pts,.038,rubber); plug('Jack 01',pts[-1],(1,.1,0))
for j in range(2):
    pts=[]
    for i in range(55):
        t=i/54; a=t*math.tau*1.45+j*2.3; r=1.88+j*.09
        pts.append((r*math.cos(a),r*math.sin(a),2.30-j*.28-1.8*t+.13*math.sin(t*8)))
    pts.extend([(2.3+j*.4,-1.2,.09),(2.75+j*.3,-2.2,.08),(1.9+j*.45,-2.7,.08)])
    tube('Cable %02d | loose winding'%(j+2),pts,.034,red if j else rubber)
    plug('Jack %02d A'%j,pts[0],(.2,-1,.3)); plug('Jack %02d B'%j,pts[-1],(-1,-.1,0))
# Ground coil, ending in a visible oversized 1/4-inch jack.
pts=[(-2.6+.83*math.cos(i*.15),.20+.65*math.sin(i*.15),.065+.002*i) for i in range(85)]
pts.extend([(-3.4,-.9,.08),(-3.15,-1.75,.08)])
tube('Cable 04 | ground coil',pts,.034,rubber); plug('Jack 04',pts[-1],(.3,-1,0))

cube('Stage | endless graphite floor',(0,0,-.10),(200,200,.15),floor,b=.01)
def light(name,loc,power,size,color):
    d=bpy.data.lights.new(name,'AREA'); d.energy=power; d.shape='DISK'; d.size=size; d.color=color
    o=bpy.data.objects.new(name,d); scene.collection.objects.link(o); o.location=loc; o.rotation_euler=(Vector((0,0,5))-o.location).to_track_quat('-Z','Y').to_euler()
light('Studio | warm key',(-6,-8,12),2300,7,(1,.86,.70))
light('Studio | cool fill',(6,-3,8),1800,6,(.68,.82,1))
light('Studio | crown rim',(2,5,12),2600,5,(1,.92,.80))
d=bpy.data.cameras.new('Monument | portrait camera'); cam=bpy.data.objects.new(d.name,d); scene.collection.objects.link(cam); cam.location=(10,-24,12)
cam.rotation_euler=(Vector((-.25,0,5.15))-cam.location).to_track_quat('-Z','Y').to_euler(); d.type='ORTHO'; d.ortho_scale=13.4; scene.camera=cam
scene.render.engine='CYCLES'; scene.cycles.samples=32; scene.cycles.use_denoising=True
scene.render.resolution_x=1100; scene.render.resolution_y=1400; scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'; scene.render.filepath=str(OUT/'jazzmaster-monument.png')
scene.view_settings.view_transform='AgX'
scene['design']='11m Jazzmaster relic monument on Carrara Corinthian capital, four instrument cables; reference supplied by user.'
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':
        area.spaces.active.region_3d.view_perspective='CAMERA'
        area.spaces.active.shading.color_type='MATERIAL'
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'jazzmaster-monument.blend'))
