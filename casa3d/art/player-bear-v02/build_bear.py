"""Standalone Blender character source. No game export or runtime writes.

Run: blender --background --factory-startup --python build_player.py
Nominal sculpt coordinates: Z up, front -Y, anatomical left +X.
Authoring scale follows the requested 2.00 m camera eye height.
"""
import bpy, bmesh, math, json, sys
from pathlib import Path
from mathutils import Vector, Matrix
from mathutils.kdtree import KDTree
from math import sin, cos, pi

OUT = Path(__file__).resolve().parent
sys.path.insert(0, str(OUT))
from props import build_props
SCALE = 2.00 / 1.65
S = bpy.context.scene
S.name = 'Player_Bear_v02_Studio'
# This builder runs in its own factory-startup process, never a user scene.
for ob in list(S.objects):
    bpy.data.objects.remove(ob, do_unlink=True)
S.unit_settings.system = 'METRIC'
S.unit_settings.scale_length = 1
S.render.engine = 'CYCLES'
S.cycles.samples = 48
S.cycles.use_denoising = True
S.render.resolution_x = 1400
S.render.resolution_y = 1400
S.render.resolution_percentage = 100
S.render.image_settings.file_format = 'PNG'
S.view_settings.view_transform = 'AgX'
S.render.film_transparent = False
S.world.use_nodes = True
S.world.node_tree.nodes['Background'].inputs[0].default_value = (.18,.21,.24,1)
S.world.node_tree.nodes['Background'].inputs[1].default_value = .35

def collection(name):
    c = bpy.data.collections.new(name)
    S.collection.children.link(c)
    return c

BODY = collection('01_Body')
HEAD = collection('02_Head_Hide_In_First_Person')
HANDS = collection('03_Hands')
PROPS = collection('04_Hand_Props')
RIG = collection('05_Rig_And_Sockets')
STUDIO = collection('90_Review_Studio')

def material(name, color, roughness=.7, metallic=0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color,1)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*color,1)
    p.inputs['Roughness'].default_value = roughness
    p.inputs['Metallic'].default_value = metallic
    return m

cloth = material('Black | cotton sweatshirt',(.008,.009,.011),.84)
pants = material('Black | twill trousers',(.006,.007,.009),.76)
trim = material('Black | ribbing and seams',(.027,.029,.033),.88)
rubber = material('Black | sneaker rubber',(.008,.010,.013),.58)
skin = material('Skin | warm neutral',(.48,.285,.185),.62)
skin.node_tree.nodes['Principled BSDF'].inputs['Subsurface Weight'].default_value = .035
nails = material('Skin | nails',(.59,.378,.282),.47)
feature = material('Face | muted features',(.066,.038,.026),.88)

# Bone definitions are authored alongside the geometry that they deform.
bones = []
def bone(name, head, tail, parent=None, deform=True):
    bones.append((name,Vector(head),Vector(tail),parent,deform))
    return name

bone('root',(0,0,0),(0,0,.15),deform=False)
bone('pelvis',(0,0,.91),(0,0,1.055),'root')
bone('spine_01',(0,0,1.055),(0,0,1.24),'pelvis')
bone('spine_02',(0,0,1.24),(0,0,1.46),'spine_01')
bone('neck',(0,0,1.46),(0,0,1.575),'spine_02')
bone('head',(0,0,1.575),(0,0,1.79),'neck')
for side,sgn in [('L',1),('R',-1)]:
    bone('clavicle.'+side,(0,0,1.45),(sgn*.205,0,1.465),'spine_02')
    bone('upper_arm.'+side,(sgn*.205,0,1.465),(sgn*.29,-.13,1.23),'clavicle.'+side)
    bone('forearm.'+side,(sgn*.29,-.13,1.23),(sgn*.275,-.37,1.35),'upper_arm.'+side)
    bone('hand.'+side,(sgn*.275,-.37,1.35),(sgn*.294,-.454,1.386),'forearm.'+side)
    bone('thigh.'+side,(sgn*.091,0,.935),(sgn*.113,-.019,.55),'pelvis')
    bone('shin.'+side,(sgn*.113,-.019,.55),(sgn*.122,.009,.13),'thigh.'+side)
    bone('foot.'+side,(sgn*.122,.009,.13),(sgn*.122,-.144,.055),'shin.'+side)
    bone('toe.'+side,(sgn*.122,-.144,.055),(sgn*.122,-.219,.05),'foot.'+side)

def move_collection(o,c):
    for old in list(o.users_collection): old.objects.unlink(o)
    c.objects.link(o)

def weight_object(o, weights):
    if isinstance(weights,str): weights={weights:1.0}
    for name,value in weights.items():
        g=o.vertex_groups.get(name) or o.vertex_groups.new(name=name)
        g.add(list(range(len(o.data.vertices))),value,'REPLACE')

def mesh_obj(name, verts, faces, mat, col, weights=None):
    me=bpy.data.meshes.new(name+'_Mesh')
    me.from_pydata(verts,[],faces)
    me.update()
    bm=bmesh.new();bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    bm.to_mesh(me);bm.free()
    o=bpy.data.objects.new(name,me);col.objects.link(o)
    o.data.materials.append(mat)
    for p in me.polygons:p.use_smooth=True
    if weights:weight_object(o,weights)
    return o

def apply(o,mod):
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True);bpy.context.view_layer.objects.active=o
    bpy.ops.object.modifier_apply(modifier=mod.name)

def subdiv(o,level=1):
    m=o.modifiers.new('Soft authored surface','SUBSURF');m.levels=level
    apply(o,m)
    return o

def ellipsoid(name, pos, sizes, mat, col, group, segments=24,rings=16, rotation=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,location=pos)
    o=bpy.context.object;o.name=name;o.scale=sizes
    if rotation:o.rotation_euler=rotation
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    move_collection(o,col);o.data.materials.append(mat)
    for p in o.data.polygons:p.use_smooth=True
    if group:weight_object(o,group)
    return o

def lerp_weights(a,b,t):
    return {k:a.get(k,0)*(1-t)+b.get(k,0)*t for k in a.keys()|b.keys() if a.get(k,0)*(1-t)+b.get(k,0)*t>1e-6}

def loft(name,rows,mat,col,n=24,level=1):
    """Horizontal ellipses: (z,cx,cy,rx,ry,weights), smooth authored edge loops."""
    verts=[];faces=[]
    for z,x,y,rx,ry,w in rows:
        for j in range(n):
            a=2*pi*j/n
            verts.append((x+rx*cos(a),y+ry*sin(a),z))
    for k in range(len(rows)-1):
        for j in range(n):faces.append((k*n+j,k*n+(j+1)%n,(k+1)*n+(j+1)%n,(k+1)*n+j))
    faces += [tuple(reversed(range(n))),tuple((len(rows)-1)*n+j for j in range(n))]
    o=mesh_obj(name,verts,faces,mat,col)
    for k,row in enumerate(rows):
        for g,w in row[-1].items():
            vg=o.vertex_groups.get(g) or o.vertex_groups.new(name=g)
            vg.add(list(range(k*n,(k+1)*n)),w,'REPLACE')
    if level:subdiv(o,level)
    return o

def tube(name,pts,radii,mat,col,weights,n=16,level=1,oval=1):
    pts=[Vector(p) for p in pts];vs=[];fs=[]
    for k,p in enumerate(pts):
        tangent=(pts[min(k+1,len(pts)-1)]-pts[max(0,k-1)]).normalized()
        helper=Vector((1,0,0))
        if abs(tangent.dot(helper))>.92:helper=Vector((0,1,0))
        u=(helper-tangent*helper.dot(tangent)).normalized()
        v=tangent.cross(u).normalized()
        for j in range(n):
            a=2*pi*j/n
            vs.append(p+radii[k]*(u*cos(a)+v*sin(a)*oval))
    for k in range(len(pts)-1):
        for j in range(n):fs.append((k*n+j,k*n+(j+1)%n,(k+1)*n+(j+1)%n,(k+1)*n+j))
    fs += [tuple(reversed(range(n))),tuple((len(pts)-1)*n+j for j in range(n))]
    o=mesh_obj(name,vs,fs,mat,col)
    for k,w in enumerate(weights):
        if isinstance(w,str):w={w:1}
        for g,val in w.items():
            vg=o.vertex_groups.get(g) or o.vertex_groups.new(name=g)
            vg.add(list(range(k*n,(k+1)*n)),val,'REPLACE')
    if level:subdiv(o,level)
    return o

def seam(name,pts,radius,mat,col,group):
    return tube(name,pts,[radius]*len(pts),mat,col,[group]*len(pts),n=8,level=0)

def torus_ellipse(name,z,rx,ry,thickness,mat,col,group,cy=0,cx=0):
    vs=[];fs=[];nu=48;nv=8
    for i in range(nu):
        a=2*pi*i/nu
        for j in range(nv):
            b=2*pi*j/nv
            vs.append((cx+(rx+thickness*cos(b))*cos(a),cy+(ry+thickness*cos(b))*sin(a),z+thickness*sin(b)))
    for i in range(nu):
        for j in range(nv):fs.append((i*nv+j,((i+1)%nu)*nv+j,((i+1)%nu)*nv+(j+1)%nv,i*nv+(j+1)%nv))
    return mesh_obj(name,vs,fs,mat,col,group)

exec(compile((OUT/'bear_geometry.py').read_text(encoding='utf-8'), str(OUT/'bear_geometry.py'), 'exec'), globals())

props=build_props(PROPS,str(OUT/'references'/'logo2.png'))
props['left_root'].location += Vector((.035,-.145,0))
props['right_root'].location += Vector((-.04,-.145,0))
bpy.context.view_layer.update()

def continuous_garment(names,name,target_faces,voxel=.004):
    """Union the sewn panels; preserve skin weights from authored control shapes.

    Deliberately local to clothing. Fingers, rigid props and head stay untouched.
    The resulting draft is a skinned sculpt mesh, not final animation retopology.
    """
    obs=[bpy.data.objects[n] for n in names]
    bpy.ops.object.select_all(action='DESELECT')
    for o in obs:o.select_set(True)
    bpy.context.view_layer.objects.active=obs[0]
    bpy.ops.object.join();o=bpy.context.object;o.name=name
    positions=[v.co.copy() for v in o.data.vertices]
    group_names={g.index:g.name for g in o.vertex_groups}
    source_weights=[{group_names[g.group]:g.weight for g in v.groups} for v in o.data.vertices]
    kd=KDTree(len(positions))
    for i,p in enumerate(positions):kd.insert(p,i)
    kd.balance()
    m=o.modifiers.new('Continuous sewn garment','REMESH');m.mode='VOXEL';m.voxel_size=voxel;m.use_smooth_shade=True
    apply(o,m)
    m=o.modifiers.new('Relax cloth surface','SMOOTH');m.factor=.8;m.iterations=5;apply(o,m)
    o.data.calc_loop_triangles()
    m=o.modifiers.new('Source mesh budget','DECIMATE');m.ratio=min(1,target_faces/max(1,len(o.data.loop_triangles)));apply(o,m)
    o.vertex_groups.clear()
    for name_ in set(group_names.values()):o.vertex_groups.new(name=name_)
    for v in o.data.vertices:
        influences={}
        near=kd.find_n(v.co,3)
        total=sum(1/max(d,.0001)**2 for p,i,d in near)
        for p,i,d in near:
            coeff=(1/max(d,.0001)**2)/total
            for gn,w in source_weights[i].items():influences[gn]=influences.get(gn,0)+w*coeff
        influences=dict(sorted(influences.items(),key=lambda x:-x[1])[:4])
        total=sum(influences.values())
        for gn,w in influences.items():o.vertex_groups[gn].add([v.index],w/total,'REPLACE')
    for p in o.data.polygons:p.use_smooth=True
    return o

continuous_garment(body_panels,'Bear continuous body',10000,voxel=.0045)
continuous_garment(paw_parts,'Bear continuous forepaws',7000,voxel=.0028)
continuous_garment([o.name for o in HEAD.objects if o.type=='MESH' and o.data.materials[0]==fur],'Bear continuous head',3800,voxel=.003)

# Consolidate by function while retaining named weight groups and distinct head.
def join_collection(col,name):
    obs=[o for o in col.objects if o.type=='MESH']
    bpy.ops.object.select_all(action='DESELECT')
    for o in obs:o.select_set(True)
    bpy.context.view_layer.objects.active=obs[0]
    bpy.ops.object.join();o=bpy.context.object;o.name=name
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    return o
body=join_collection(BODY,'Body_Bear_Fur')
hands=join_collection(HANDS,'Hands_Bear_Paws')
head=join_collection(HEAD,'Head_Bear_Separate')

# Bake authoring size into mesh and armature data; object transforms stay unity.
for col in [BODY,HANDS,HEAD,PROPS]:
    for o in col.objects:
        if o.type=='MESH':
            o.data.transform(Matrix.Scale(SCALE,4))
        o.location *= SCALE

ad=bpy.data.armatures.new('Player_Skeleton')
rig=bpy.data.objects.new('Player_Rig',ad);RIG.objects.link(rig)
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.object.mode_set(mode='EDIT')
for name,p,q,parent,deform in bones:
    b=ad.edit_bones.new(name);b.head=p*SCALE;b.tail=q*SCALE;b.use_deform=deform
    if parent:b.parent=ad.edit_bones[parent]
    b.align_roll(Vector((0,-1,0)))
bpy.ops.object.mode_set(mode='OBJECT')
rig.show_in_front=True;ad.display_type='STICK'
for o in [body,hands,head]:
    o.parent=rig
    mod=o.modifiers.new('Player skin','ARMATURE');mod.object=rig
    mod.use_deform_preserve_volume=False

def bone_parent(o,bn):
    bpy.context.view_layer.update()
    world=o.matrix_world.copy();o.parent=rig;o.parent_type='BONE';o.parent_bone=bn
    bpy.context.view_layer.update();o.matrix_world=world
    bpy.context.view_layer.update()
bone_parent(props['left_root'],'hand.L')
bone_parent(props['right_root'],'hand.R')
rig['eye_height_m']=2.0
rig['authoring_scale']=SCALE
rig['forward_axis']='-Y'
rig['anatomical_left_axis']='+X'
rig['scope']='Blender source only. Grip rest pose. No runtime export or integration.'
rig['rest_pose']='Carrying; hands naturally hold separate rigid props.'

eyes=bpy.data.objects.new('Eye_Reference_2m',None);RIG.objects.link(eyes)
eyes.location=(0,-.240*SCALE,2);eyes.empty_display_type='PLAIN_AXES';eyes.empty_display_size=.06
eyes['purpose']='Independent camera reference, not parented to animated head'

# Short breathing review clip. Locomotion comes after silhouette and grip review.
S.render.fps=30;S.frame_start=1;S.frame_end=91
rig.animation_data_create()
for f,val in [(1,0),(23,1),(46,0),(68,-1),(91,0)]:
    for bn,amt in [('spine_01',.0025),('spine_02',.004)]:
        p=rig.pose.bones[bn];p.rotation_mode='XYZ';p.rotation_euler=(amt*val,0,0)
        p.keyframe_insert(data_path='rotation_euler',frame=f,group=bn)
rig.animation_data.action.name='Idle_Hold_Review'
S.frame_set(1)

# Studio set and review cameras.
ground=material('Studio | blue grey',(.16,.193,.207),.82)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.003))
floor=bpy.context.object;floor.name='Review floor';move_collection(floor,STUDIO);floor.data.materials.append(ground)
def camera(name,loc,target,ortho=None,lens=50):
    d=bpy.data.cameras.new(name);o=bpy.data.objects.new(name,d);STUDIO.objects.link(o)
    o.location=loc;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
    if ortho:d.type='ORTHO';d.ortho_scale=ortho
    d.lens=lens;d.clip_start=.1;d.clip_end=200
    return o
hero=camera('Review_Full_Body',(3.2,-6,3.1),(0,-.04,1.08),ortho=2.72)
front=camera('Review_Front',(0,-6,1.1),(0,0,1.1),ortho=2.62)
back=camera('Review_Back',(3,6,2.8),(0,0,1.1),ortho=2.7)
grip=camera('Review_Hands_Closeup',(0,-2.3,2.45),(0,-.60*SCALE,1.47*SCALE),ortho=1.15)
fps=camera('First_Person_2m',(0,-.240*SCALE,2),(0,-1.240*SCALE,2))
fps.data.sensor_fit='VERTICAL';fps.data.sensor_height=24;fps.data.lens=12/math.tan(math.radians(75/2))
down=camera('First_Person_Look_Down',(0,-.240*SCALE,2),(0,-.240*SCALE-math.cos(math.radians(75)),2-math.sin(math.radians(75))))
down.data.sensor_fit='VERTICAL';down.data.sensor_height=24;down.data.lens=fps.data.lens
def light(name,loc,power,size,color):
    d=bpy.data.lights.new(name,'AREA');o=bpy.data.objects.new(name,d);STUDIO.objects.link(o)
    o.location=loc;o.rotation_euler=(Vector((0,0,1.1))-o.location).to_track_quat('-Z','Y').to_euler()
    d.energy=power;d.shape='DISK';d.size=size;d.color=color
light('Key softbox',(-3,-4,5),650,4,(1,.87,.73))
light('Fill softbox',(3,-2,3),430,3,(.73,.85,1))
light('Rim softbox',(1,3,4),800,3,(.77,.9,1))

S.camera=hero
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            area.spaces.active.region_3d.view_perspective='CAMERA'
            area.spaces.active.overlay.show_overlays=False
            area.spaces.active.shading.type='MATERIAL'
rig.hide_set(True)
eyes.hide_set(True)
bpy.ops.object.select_all(action='DESELECT')
body.select_set(True);bpy.context.view_layer.objects.active=body

note=bpy.data.texts.new('READ_ME_Player_Bear_v02')
note.write('Player Bear v02 — Blender source only\n\nCamera reference: 2.00 m. Full-body height approx. 2.22 m to match the raised game eye height.\nFront -Y; anatomical left +X; units metres.\nBody, hands, head and props are separate. Head collection is excluded only in first-person preview renders.\nProps are bone-parented to hand.L and hand.R. 3 phalanges per finger, hand-authored skin weights.\nRest pose: carry. Idle_Hold_Review is a gentle review loop. Walk/run, final weight polish and runtime packaging remain later stages.\nLogo texture is the supplied original, packed in the blend. LAB is editable mesh geometry.\nNo player GLB export and no game integration. Only the user-requested game eye-height constant changed.\n')
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'player-bear-v02.blend'),compress=True)

# Geometry and weight audit; measures the actual authored meshes.
report={'schema':'animal-house.player-source.v1','species':'stylized near-black bear','eye_height_m':2,'authoring_scale':SCALE,'bone_count':len(ad.bones),'deform_bone_count':sum(b.use_deform for b in ad.bones),'forward':'-Y','anatomical_left':'+X','runtime_exported':False,'meshes':{},'source_logo':'references/logo2.png','review_approval':'pending user visual review','clips':['Idle_Hold_Review']}
for o in [body,hands,head]:
    o.data.calc_loop_triangles()
    counts=[len([g for g in v.groups if g.weight>1e-5]) for v in o.data.vertices]
    sums=[sum(g.weight for g in v.groups) for v in o.data.vertices]
    report['meshes'][o.name]={'vertices':len(o.data.vertices),'triangles':len(o.data.loop_triangles),'max_influences':max(counts),'unweighted_vertices':sum(n==0 for n in counts),'max_weight_sum_error':max(abs(w-1) for w in sums),'materials':len(o.data.materials)}
    assert min(counts)>0 and max(counts)<=4 and max(abs(w-1) for w in sums)<1e-4
report['total_character_triangles']=0
for col in [BODY,HANDS,HEAD,PROPS]:
    for o in col.objects:
        if o.type=='MESH':
            o.data.calc_loop_triangles();report['total_character_triangles']+=len(o.data.loop_triangles)
report['packed_images']=[{'name':i.name,'size':list(i.size),'packed':bool(i.packed_file)} for i in bpy.data.images if i.source=='FILE']
assert all(i['packed'] for i in report['packed_images'])
report['prop_hand_assignment']={'left':props['left_root'].parent_bone,'right':props['right_root'].parent_bone}
(OUT/'verification.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print('PLAYER_SOURCE_READY',json.dumps(report))

if '--no-render' not in sys.argv:
    for cam,filename,size in [(hero,'01-full-body.png',(1400,1400)),(front,'02-front.png',(1000,1300)),(back,'03-back.png',(1000,1300)),(grip,'04-hands.png',(1500,1000)),(fps,'05-first-person.png',(1600,1000)),(down,'06-look-down.png',(1600,1000))]:
        S.camera=cam;S.render.resolution_x,S.render.resolution_y=size
        head.hide_render=cam in (fps,down)
        S.render.filepath=str(OUT/'renders'/filename)
        bpy.ops.render.render(write_still=True)
    head.hide_render=False;S.camera=hero;S.render.resolution_x=S.render.resolution_y=1400
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'player-bear-v02.blend'),compress=True)

