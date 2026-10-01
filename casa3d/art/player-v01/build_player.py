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
S.name = 'Player_v01_Studio'
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

# Tailored crew-neck sweatshirt, round shoulders, ribbed hem and collar.
loft('Sweatshirt',[
    (1.015,0,0,.151,.100,{'pelvis':.5,'spine_01':.5}),
    (1.030,0,0,.160,.104,{'pelvis':.4,'spine_01':.6}),
    (1.09,0,0,.169,.113,{'spine_01':1}),
    (1.19,0,.003,.169,.113,{'spine_01':.7,'spine_02':.3}),
    (1.30,0,.004,.183,.120,{'spine_01':.2,'spine_02':.8}),
    (1.395,0,.009,.204,.118,{'spine_02':1}),
    (1.46,0,.012,.213,.099,{'spine_02':1}),
    (1.49,0,.010,.183,.081,{'spine_02':1}),
    (1.513,0,.008,.073,.059,{'spine_02':1}),
    (1.518,0,.008,.068,.054,{'spine_02':1}),
],cloth,BODY,n=32)
loft('Sweatshirt hem',[(1.01,0,0,.150,.101,{'pelvis':.5,'spine_01':.5}),(1.014,0,0,.158,.105,{'pelvis':.5,'spine_01':.5}),(1.053,0,0,.161,.107,{'spine_01':1}),(1.059,0,0,.158,.105,{'spine_01':1})],trim,BODY,n=32)
torus_ellipse('Crew neck collar',1.514,.071,.056,.006,trim,BODY,'spine_02',cy=.008)
for a in range(48):
    angle=2*pi*a/48
    x=.159*cos(angle);y=.106*sin(angle)
    seam('Hem rib',[(x,y,1.015),(x*1.018,y*1.018,1.05)],.0009,cloth,BODY,'spine_01')

loft('Pelvis trousers',[(.862,0,.012,.135,.083,{'pelvis':1}),(.89,0,.007,.162,.100,{'pelvis':1}),(.966,0,.006,.160,.104,{'pelvis':1}),(1.035,0,0,.148,.093,{'pelvis':1})],pants,BODY,n=32)

for side,sgn in [('L',1),('R',-1)]:
    ua='upper_arm.'+side;fa='forearm.'+side;h='hand.'+side
    points=[(sgn*.177,.005,1.463),(sgn*.204,0,1.456),(sgn*.242,-.038,1.39),(sgn*.28,-.091,1.30),(sgn*.29,-.13,1.238),(sgn*.289,-.177,1.249),(sgn*.282,-.24,1.284),(sgn*.275,-.327,1.331),(sgn*.275,-.347,1.339)]
    ws=[{'spine_02':.55,ua:.45},{'spine_02':.2,ua:.8},{ua:1},{ua:.9,fa:.1},{ua:.5,fa:.5},{ua:.15,fa:.85},{fa:1},{fa:1},{fa:1}]
    tube('Sleeve.'+side,points,[.070,.085,.079,.066,.060,.061,.055,.041,.039],cloth,BODY,ws,n=24)
    tube('Rib cuff.'+side,[(sgn*.275,-.322,1.328),(sgn*.275,-.33,1.332),(sgn*.275,-.357,1.346),(sgn*.275,-.363,1.348)],[.040,.041,.038,.034],trim,BODY,[fa]*4,n=24)
    tube('Wrist.'+side,[(sgn*.275,-.348,1.341),(sgn*.275,-.373,1.352),(sgn*.291,-.406,1.368),(sgn*.3,-.426,1.376)],[.031,.030,.034,.030],skin,HANDS,[{fa:.8,h:.2},{fa:.3,h:.7},{h:1},{h:1}],n=20)
    thigh='thigh.'+side;shin='shin.'+side;foot='foot.'+side
    loft('Trouser leg.'+side,[
        (.135,sgn*.122,.006,.056,.057,{shin:1}),
        (.148,sgn*.122,.007,.061,.062,{shin:1}),
        (.22,sgn*.122,.012,.064,.065,{shin:1}),
        (.34,sgn*.119,.011,.074,.076,{shin:1}),
        (.47,sgn*.115,-.005,.069,.072,{shin:.85,thigh:.15}),
        (.53,sgn*.113,-.014,.071,.075,{shin:.55,thigh:.45}),
        (.585,sgn*.112,-.011,.074,.079,{shin:.15,thigh:.85}),
        (.72,sgn*.101,.001,.087,.093,{thigh:1}),
        (.84,sgn*.094,.005,.092,.100,{thigh:.85,'pelvis':.15}),
        (.92,sgn*.089,.004,.087,.098,{thigh:.45,'pelvis':.55}),
        (.955,sgn*.082,.003,.081,.089,{'pelvis':1}),
    ],pants,BODY,n=24)
    # Outer leg seam, pocket welt, cuff: restrained geometry gives black materials depth.
    torus_ellipse('Trouser cuff.'+side,.16,.060,.061,.003,trim,BODY,shin,cx=sgn*.122,cy=.007)
    # Rounded shoes modeled as horizontal cross-sections; bottoms really touch Z=0.
    loft('Sneaker sole.'+side,[(0,sgn*.122,-.070,.061,.142,{foot:1}),(.008,sgn*.122,-.074,.069,.148,{foot:1}),(.032,sgn*.122,-.077,.070,.149,{foot:1}),(.044,sgn*.122,-.075,.065,.145,{foot:1})],rubber,BODY,n=32)
    loft('Sneaker upper.'+side,[(.010,sgn*.122,-.076,.064,.144,{foot:1}),(.032,sgn*.122,-.077,.066,.143,{foot:1}),(.087,sgn*.122,-.065,.061,.125,{foot:1}),(.13,sgn*.122,-.025,.055,.085,{foot:1}),(.162,sgn*.122,.010,.046,.056,{foot:1}),(.169,sgn*.122,.010,.041,.048,{foot:1})],cloth,BODY,n=32)
    for j in range(4):
        y=-.099+j*.018;z=.114+j*.008
        seam('Shoe lace.'+side,[(sgn*.122-.032,y,z),(sgn*.122,y-.006,z+.010),(sgn*.122+.032,y,z)],.0022,trim,BODY,foot)

# Hands are individually posed around the actual handles; three bones per finger.
for side,sgn in [('L',1),('R',-1)]:
    h='hand.'+side
    ellipsoid('Palm.'+side,(sgn*.302,-.426,1.374),(.026,.033,.053),skin,HANDS,h)
    ellipsoid('Thenar.'+side,(sgn*.281,-.423,1.402),(.022,.026,.026),skin,HANDS,h,20,12)
    for i,label in enumerate(['index','middle','ring','little']):
        z=1.413-i*.021
        if side=='L':
            pts=[(.311,-.444,z),(.300,-.478,z+.002),(.272,-.493,z-.001),(.264,-.474,z-.009)]
        else:
            pts=[(-.309,-.442,z),(-.307,-.475,z+.003),(-.280,-.484,z),(-.265,-.463,z-.01)]
        rad=[.0097,.0104,.0095,.0083][i]
        names=[]
        for k in range(3):
            bn=f'{label}_{k+1:02d}.{side}';bone(bn,pts[k],pts[k+1],h if k==0 else names[-1]);names.append(bn)
        # Curved path interpolation maintains smooth, supported finger joints.
        fine=[];weights=[];rr=[]
        for k in range(3):
            p0=Vector(pts[max(0,k-1)]);p1=Vector(pts[k]);p2=Vector(pts[k+1]);p3=Vector(pts[min(3,k+2)])
            for j in range(4):
                t=j/4
                q=.5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t*t*t)
                fine.append(q);rr.append(rad*(1-.20*(k+t)/3))
                if j==0 and k>0:weights.append({names[k-1]:.5,names[k]:.5})
                elif j==3 and k<2:weights.append({names[k]:.85,names[k+1]:.15})
                else:weights.append({names[k]:1})
        fine.append(Vector(pts[-1]));rr.append(rad*.62);weights.append({names[-1]:1})
        fine.append(Vector(pts[-1])+(Vector(pts[-1])-Vector(pts[-2])).normalized()*rad*.5);rr.append(rad*.12);weights.append({names[-1]:1})
        tube(label+'.'+side,fine,rr,skin,HANDS,weights,n=16,level=0,oval=.88)
        np=Vector(pts[-1]);np.y-=rad*.67;np.z+=rad*.25
        ellipsoid('Nail '+label+'.'+side,np,(rad*.66,.0019,rad*.78),nails,HANDS,names[-1],16,8)
    if side=='L':
        pts=[(.281,-.418,1.398),(.265,-.445,1.431),(.258,-.472,1.43),(.272,-.479,1.422)]
    else:
        pts=[(-.288,-.416,1.401),(-.271,-.431,1.439),(-.26,-.455,1.441),(-.272,-.471,1.429)]
    names=[]
    for k in range(3):
        bn=f'thumb_{k+1:02d}.{side}';bone(bn,pts[k],pts[k+1],h if k==0 else names[-1]);names.append(bn)
    fine=[];ws=[];rs=[]
    for k in range(3):
        for j in range(3):
            t=j/3;fine.append(Vector(pts[k]).lerp(Vector(pts[k+1]),t));rs.append(.014-.003*(k+t)/3)
            ws.append({names[k]:1} if j else ({names[k]:.6,names[k-1]:.4} if k else {h:.25,names[0]:.75}))
    fine += [Vector(pts[-1]),Vector(pts[-1])+(Vector(pts[-1])-Vector(pts[-2])).normalized()*.006]
    rs += [.008,.002];ws += [{names[-1]:1}]*2
    tube('Thumb.'+side,fine,rs,skin,HANDS,ws,n=16,level=0)
    np=Vector(pts[-1]);np.y-=.006;np.z+=.005
    ellipsoid('Thumbnail.'+side,np,(.007,.002,.009),nails,HANDS,names[-1],16,8)

# A neutral stylized head; separate and removable in first-person views.
loft('Neck',[(1.49,0,.008,.052,.044,{'neck':1}),(1.53,0,.008,.049,.043,{'neck':1}),(1.58,0,.012,.050,.046,{'neck':.35,'head':.65}),(1.61,0,.012,.052,.049,{'head':1})],skin,HEAD,n=24)
loft('Head',[
    (1.566,0,-.024,.032,.043,{'head':1}),
    (1.582,0,-.01,.052,.059,{'head':1}),
    (1.611,0,0,.070,.075,{'head':1}),
    (1.65,0,.006,.079,.081,{'head':1}),
    (1.695,0,.010,.081,.084,{'head':1}),
    (1.742,0,.015,.077,.079,{'head':1}),
    (1.777,0,.015,.059,.061,{'head':1}),
    (1.795,0,.015,.030,.031,{'head':1}),
    (1.800,0,.015,.002,.003,{'head':1})
],skin,HEAD,n=32,level=1)
for sgn in [-1,1]:
    ellipsoid('Ear',(sgn*.080,.007,1.665),(.012,.019,.028),skin,HEAD,'head',20,12)
    # Small inset eyes and brows, no facial-animation scope in this source pass.
    ellipsoid('Eye',(sgn*.032,-.071,1.68),(.013,.004,.004),feature,HEAD,'head',20,10)
    seam('Brow',[(sgn*.016,-.073,1.700),(sgn*.032,-.074,1.704),(sgn*.047,-.067,1.700)],.0023,feature,HEAD,'head')
ellipsoid('Nose',(0,-.082,1.653),(.013,.016,.022),skin,HEAD,'head',24,16)
seam('Mouth',[(-.020,-.070,1.615),(0,-.077,1.612),(.020,-.070,1.615)],.0015,feature,HEAD,'head')

props=build_props(PROPS,str(OUT/'references'/'logo2.png'))

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

continuous_garment(['Sweatshirt','Sleeve.L','Sleeve.R'],'Sweatshirt continuous',6500)
continuous_garment(['Pelvis trousers','Trouser leg.L','Trouser leg.R'],'Trousers continuous',5500)

# Consolidate by function while retaining named weight groups and distinct head.
def join_collection(col,name):
    obs=[o for o in col.objects if o.type=='MESH']
    bpy.ops.object.select_all(action='DESELECT')
    for o in obs:o.select_set(True)
    bpy.context.view_layer.objects.active=obs[0]
    bpy.ops.object.join();o=bpy.context.object;o.name=name
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    return o
body=join_collection(BODY,'Body_Black_Clothing')
hands=join_collection(HANDS,'Hands_Detailed_Grip')
head=join_collection(HEAD,'Head_Separate')

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
eyes.location=(0,-.050*SCALE,2);eyes.empty_display_type='PLAIN_AXES';eyes.empty_display_size=.06
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
grip=camera('Review_Hands_Closeup',(0,-2.3,2.45),(0,-.46*SCALE,1.47*SCALE),ortho=1.07)
fps=camera('First_Person_2m',(0,-.050*SCALE,2),(0,-1.050*SCALE,2))
fps.data.sensor_fit='VERTICAL';fps.data.sensor_height=24;fps.data.lens=12/math.tan(math.radians(75/2))
down=camera('First_Person_Look_Down',(0,-.050*SCALE,2),(0,-.050*SCALE-math.cos(math.radians(68)),2-math.sin(math.radians(68))))
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

note=bpy.data.texts.new('READ_ME_Player_v01')
note.write('Player v01 — Blender source only\n\nCamera reference: 2.00 m. Full-body height approx. 2.18 m to match the raised game eye height.\nFront -Y; anatomical left +X; units metres.\nBody, hands, head and props are separate. Head collection is excluded only in first-person preview renders.\nProps are bone-parented to hand.L and hand.R. 3 phalanges per finger, hand-authored skin weights.\nRest pose: carry. Idle_Hold_Review is a gentle review loop. Walk/run, final weight polish and runtime packaging remain later stages.\nLogo texture is the supplied original, packed in the blend. LAB is editable mesh geometry.\nNo player GLB export and no game integration. Only the user-requested game eye-height constant changed.\n')
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'player-v01.blend'),compress=True)

# Geometry and weight audit; measures the actual authored meshes.
report={'schema':'animal-house.player-source.v1','eye_height_m':2,'authoring_scale':SCALE,'bone_count':len(ad.bones),'deform_bone_count':sum(b.use_deform for b in ad.bones),'forward':'-Y','anatomical_left':'+X','runtime_exported':False,'meshes':{},'source_logo':'references/logo2.png','review_approval':'pending user visual review','clips':['Idle_Hold_Review']}
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
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'player-v01.blend'),compress=True)
