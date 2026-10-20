"""Create the welcome basket from native geometry and the existing Animal House logo.

Run Blender --background --factory-startup --python build_basket.py.
No external service, asset download, or modification of the interactive scene.
"""
import bpy, math, json, hashlib, random, sys, struct
from mathutils import Vector, Matrix, Euler
from pathlib import Path
ART=Path(__file__).resolve().parent
CASA=ART.parent.parent
sys.path.insert(0,str(CASA/'art/player-bear-v02'))
import props
OUT=CASA/'src/assets/models/props/lollipop-basket.glb'
LOGO=CASA/'src/assets/textures/animal-house-logo.png'
ART.mkdir(exist_ok=True)
(ART/'renders').mkdir(exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene;scene.name='Animal House • cesto di benvenuto'
scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
col=bpy.data.collections.new('Basket • editable geometry');scene.collection.children.link(col)
studio=bpy.data.collections.new('Studio • review only');scene.collection.children.link(studio)
rng=random.Random(20261020)
woods=[props._material('Basket | honey rattan',(.36,.19,.073),.57),props._material('Basket | light rattan',(.48,.29,.12),.56),props._material('Basket | toasted rattan',(.25,.115,.042),.60)]
ivory=props._material('Prop | Ivory paper stick',(.82,.78,.64),.58)
candy=props._material('Prop | Glossy candy rim',(.98,.17,.032),.2,.45)
logo=props._material('Prop | Original Animal House logo',(.95,.28,.04),.26,.38)
img=bpy.data.images.load(str(LOGO));img.name='AnimalHouse_Original_Logo';img.pack()
ns=logo.node_tree.nodes;links=logo.node_tree.links;shader=ns.get('Principled BSDF')
tex=ns.new('ShaderNodeTexImage');tex.image=img;tex.extension='EXTEND';tex.interpolation='Linear'
links.new(tex.outputs['Color'],shader.inputs['Base Color']);links.new(tex.outputs['Alpha'],shader.inputs['Alpha'])
logo.surface_render_method='DITHERED'

def mesh(name,vs,fs,mat,smooth=True):return props._mesh(col,name,vs,fs,mat,smooth)
def ribbon(name,centers,width_vectors,depth_vectors,mat):
    vs=[];fs=[];n=len(centers)
    for p,w,d in zip(centers,width_vectors,depth_vectors):
        for sw,sd in ((-1,-1),(1,-1),(1,1),(-1,1)):vs.append(p+sw*w+sd*d)
    for i in range(n-1):
        for j in range(4):fs.append((i*4+j,i*4+(j+1)%4,(i+1)*4+(j+1)%4,(i+1)*4+j))
    fs.extend([(3,2,1,0),tuple((n-1)*4+j for j in range(4))])
    return mesh(name,vs,fs,mat)
def tube(name,pts,radius,mat,sides=8):
    vs=[];fs=[]
    for i,p in enumerate(pts):
        tangent=(pts[min(i+1,len(pts)-1)]-pts[max(i-1,0)]).normalized()
        normal=tangent.cross(Vector((0,0,1)))
        if normal.length<.001:normal=tangent.cross(Vector((0,1,0)))
        normal.normalize();bitangent=tangent.cross(normal).normalized()
        for j in range(sides):
            a=j*2*math.pi/sides;vs.append(p+radius*(math.cos(a)*normal+math.sin(a)*bitangent))
    for i in range(len(pts)-1):
        for j in range(sides):fs.append((i*sides+j,i*sides+(j+1)%sides,(i+1)*sides+(j+1)%sides,(i+1)*sides+j))
    fs.extend([tuple(reversed(range(sides))),tuple((len(pts)-1)*sides+j for j in range(sides))])
    return mesh(name,vs,fs,mat)
def radius(z):return .365+.165*max(0,(z-.045)/.565)**.75

# Closed recessed base, with the visibly open basket weave above it.
props._lathe(col,'Basket • solid woven base',(0,0),[(0,0),(.33,0),(.365,.025),(.37,.053),(.345,.066),(0,.066)],woods[0],64)
for i in range(32):
    a=i*2*math.pi/32;n=Vector((math.cos(a),math.sin(a),0));t=Vector((-math.sin(a),math.cos(a),0))
    centers=[];widths=[];depths=[]
    for j in range(27):
        z=.044+.571*j/26
        r=radius(z)+.009*math.cos(j*math.pi)
        centers.append(n*r+Vector((0,0,z)));widths.append(t*.012);depths.append(n*.006)
    ribbon('Basket • vertical stake %02d'%i,centers,widths,depths,woods[i%3])
for row in range(13):
    z=.065+row*.0435;centers=[];widths=[];depths=[]
    for j in range(129):
        a=j*2*math.pi/128;n=Vector((math.cos(a),math.sin(a),0))
        r=radius(z)+.012*math.cos(32*a+row*math.pi)
        centers.append(n*r+Vector((0,0,z)));widths.append(Vector((0,0,.017)));depths.append(n*.0055)
    ribbon('Basket • woven band %02d'%row,centers,widths,depths,woods[(row+1)%3])
for z,r,thickness in ((.055,.372,.013),(.605,.531,.017),(.637,.536,.018)):
    tube('Basket • rolled rim', [Vector((r*math.cos(j*2*math.pi/96),r*math.sin(j*2*math.pi/96),z)) for j in range(97)],thickness,woods[1])
# Rim binding stitches follow the same radial construction as the weave.
for i in range(48):
    a=i*2*math.pi/48;n=Vector((math.cos(a),math.sin(a),0))
    pts=[n*(.535+.025*math.cos(j*math.pi/8))+Vector((0,0,.622+.034*math.sin(j*math.pi/8))) for j in range(17)]
    tube('Basket • rim binding',pts,.0038,woods[2],4)
for side in (-1,1):
    pts=[Vector((side*(.528+.073*math.sin(t*math.pi)),.17*math.cos(t*math.pi),.59+.21*math.sin(t*math.pi))) for t in [j/24 for j in range(25)]]
    tube('Basket • low handle '+str(side),pts,.022,woods[1],10)
    for y in (-.17,.17):
        pts=[Vector((side*(.532+.023*math.sin(j*2*math.pi/12)),y+.027*math.cos(j*2*math.pi/12),.596)) for j in range(13)]
        tube('Basket • handle binding',pts,.008,woods[2],6)

# Nominal geometry and UV construction deliberately reuse the player's prop.
template=[]
template.append(props._lathe(col,'Candy template • stick',(.275,-.48),[(0,1.100),(.0020,1.100),(.0025,1.1006),(.0025,1.5595),(.0020,1.560),(0,1.560)],ivory,8))
disk=props._lathe(col,'Candy template • round sweet',(0,0),[(0,-.006),(.0705,-.006),(.0722,-.0052),(.073,-.0033),(.073,.0033),(.0722,.0052),(.0705,.006),(0,.006)],candy,24)
for v in disk.data.vertices:
    x,y,z=v.co;v.co=(.275+x,-.48-z,1.60+y)
template.append(disk)
template.extend([props._lollipop_face(col,logo,img,True),props._lollipop_face(col,logo,img,False)])
for ob in template:
    for v in ob.data.vertices:v.co-=Vector((.275,-.48,1.60))
    ob.data.update()
layout=[]
for ring,count,r,base_z in ((0,14,.385,.845),(1,8,.215,.925),(2,2,.07,1.035)):
    for i in range(count):
        a=2*math.pi*(i/count+.027*ring)
        center=Vector((r*math.cos(a),r*math.sin(a),base_z+rng.uniform(-.035,.045)))
        yaw=rng.uniform(-.65,.65)+(.40*math.sin(a))
        axis=Vector((center.x*.65+rng.uniform(-.035,.035),center.y*.65+rng.uniform(-.035,.035),1)).normalized()
        rotation=Vector((0,0,1)).rotation_difference(axis).to_matrix().to_4x4()@Matrix.Rotation(yaw,4,'Z')
        matrix=Matrix.Translation(center)@rotation
        index=len(layout)
        for source in template:
            ob=source.copy();col.objects.link(ob);ob.name='Lollipop %02d • '%index+source.name
            ob.matrix_world=matrix
            ob['role']='welcome_lollipop';ob['collection_index']=index
        bottom=matrix@Vector((0,0,-.50))
        assert .06 < bottom.z < .61 and math.hypot(bottom.x,bottom.y)<radius(bottom.z)-.025
        layout.append({'id':index,'centerBlender':list(center),'stickBottomBlender':list(bottom),'rotationXYZ':list(rotation.to_euler()),'diameterMeters':.146})
for ob in template:bpy.data.objects.remove(ob,do_unlink=True)

def camera(name,loc,target,lens=50):
    data=bpy.data.cameras.new(name);ob=bpy.data.objects.new(name,data);studio.objects.link(ob)
    ob.location=loc;ob.rotation_euler=(Vector(target)-ob.location).to_track_quat('-Z','Y').to_euler();data.lens=lens;return ob
def light(name,loc,power,size,color):
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size;data.color=color
    ob=bpy.data.objects.new(name,data);studio.objects.link(ob);ob.location=loc;ob.rotation_euler=(Vector((0,0,.5))-ob.location).to_track_quat('-Z','Y').to_euler()
front=camera('Review • front',(0,-3.4,1.75),(0,0,.55),60)
oblique=camera('Review • oblique',(2.4,-3.2,2.1),(0,0,.55),55)
light('Key',(2,-3,4),320,3,(1,.88,.73));light('Fill',(-2,-1,2),170,2,(.70,.83,1));light('Rim',(0,2,3),250,2,(1,.80,.59))
world=bpy.data.worlds.new('Review • muted studio');world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.13,.16,.20,1);world.node_tree.nodes['Background'].inputs[1].default_value=.55;scene.world=world
floor=props._material('Studio | blue-grey',(.045,.06,.075),.72)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.007));plane=bpy.context.object;plane.name='Studio • floor'
for c in list(plane.users_collection):c.objects.unlink(plane)
studio.objects.link(plane);plane.data.materials.append(floor)
scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True
scene.render.threads_mode='FIXED';scene.render.threads=8
scene.render.resolution_x=1000;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.camera=oblique
scene['source']='User-requested welcome basket; existing Animal House logo and player lollipop proportions.'
bpy.ops.wm.save_as_mainfile(filepath=str(ART/'lollipop-basket.blend'))
for name,cam in [('front',front),('oblique',oblique)]:
    scene.camera=cam;scene.render.filepath=str(ART/'renders'/(name+'.png'));bpy.ops.render.render(write_still=True)

# Export static meshes only, joined to avoid dozens of draw calls in the runtime.
bpy.ops.object.select_all(action='DESELECT')
for ob in col.objects:ob.select_set(True)
bpy.context.view_layer.objects.active=next(iter(col.objects));bpy.ops.object.join()
asset=bpy.context.object;asset.name='LollipopBasket';asset.data.transform(asset.matrix_world);asset.matrix_world=Matrix.Identity(4)
source_triangles=sum(len(p.vertices)-2 for p in asset.data.polygons)
mod=asset.modifiers.new('Runtime mesh simplification','DECIMATE');mod.ratio=.70;mod.use_collapse_triangulate=True
bpy.ops.object.modifier_apply(modifier=mod.name);asset.data.validate(clean_customdata=False)
bpy.ops.export_scene.gltf(filepath=str(OUT),export_format='GLB',use_selection=True,use_active_scene=True,export_yup=True,export_apply=True,export_animations=False,export_cameras=False,export_lights=False,export_extras=False,export_materials='EXPORT')
data=OUT.read_bytes();length=struct.unpack_from('<I',data,12)[0];gltf=json.loads(data[20:20+length])
binary_start=20+length+8
embedded_images=[]
for image in gltf.get('images',[]):
    view=gltf['bufferViews'][image['bufferView']];offset=binary_start+view.get('byteOffset',0)
    embedded_images.append({'mimeType':image['mimeType'],'sha256':hashlib.sha256(data[offset:offset+view['byteLength']]).hexdigest(),'bytes':view['byteLength']})
triangles=0;lo=[1e9]*3;hi=[-1e9]*3
for me in gltf['meshes']:
    for p in me['primitives']:
        a=gltf['accessors'][p['attributes']['POSITION']]
        lo=[min(lo[i],a['min'][i]) for i in range(3)];hi=[max(hi[i],a['max'][i]) for i in range(3)]
        triangles+=gltf['accessors'][p['indices']]['count']//3
asset.hide_render=True
bpy.ops.import_scene.gltf(filepath=str(OUT))
scene.camera=oblique;scene.render.filepath=str(ART/'renders/export-oblique.png');bpy.ops.render.render(write_still=True)
manifest={'schema':'casa3d.lollipop-basket.v1','asset':'lollipop-basket','authorization':'User requested creating a basket in Blender, replacing the landing beehive with it, moving the beehive behind it, and collecting a lollipop on desktop/mobile. This authoring export implements the explicitly selected basket form; runtime integration is separate.','coordinateSystem':'metres, glTF +Y up, +Z front, origin ground centre','source':{'path':'art/lollipop-basket-v01/lollipop-basket.blend','sha256':hashlib.sha256((ART/'lollipop-basket.blend').read_bytes()).hexdigest(),'triangles':source_triangles},'builder':{'path':'art/lollipop-basket-v01/build_basket.py','reuse':'art/player-bear-v02/props.py: _lathe, _mesh, _lollipop_face; original candy diameter and UV mapping retained, sticks extended to 460 mm to reach inside the deep basket'},'logo':{'path':'src/assets/textures/animal-house-logo.png','sha256':hashlib.sha256(LOGO.read_bytes()).hexdigest(),'unaltered':True,'embeddedImages':embedded_images},'output':{'path':'src/assets/models/props/lollipop-basket.glb','sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data),'triangles':triangles,'bounds':{'min':lo,'max':hi},'materials':[m['name'] for m in gltf['materials']],'images':len(gltf.get('images',[]))},'lollipopCount':len(layout),'lollipops':layout,'construction':{'weave':'32 vertical stakes, 13 alternating woven ribbons; solid recessed bottom; double rolled lip; 2 low handles','materials':'Native glTF PBR rattan colors and unmodified packed source logo, no unsupported procedural textures','collisionSuggestion':{'radiusMeters':.56,'heightMeters':.66},'stickSupport':'All stick bottoms asserted within the basket volume below rim, with inward lean; arranged as 14+8+2 naturally tilted candies'},'renders':['renders/front.png','renders/oblique.png','renders/export-oblique.png']}
(ART/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('BASKET_COMPLETE',json.dumps(manifest['output']),flush=True)
