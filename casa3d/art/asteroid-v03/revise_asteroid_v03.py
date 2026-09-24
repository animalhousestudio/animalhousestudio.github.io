"""A broad continuous shoulder, offset pointed keel, and irregular lateral fractures."""
import bpy,bmesh,math,json,random
from pathlib import Path
from mathutils import Vector,noise
OUT=Path(__file__).resolve().parent;OUT.mkdir(parents=True,exist_ok=True)
s=bpy.context.scene
assert s.name in {'Asteroid_Review_v02','Asteroid_Review_v03'}
top=bpy.data.objects['Asteroid_Surface'];rock=bpy.data.objects['Asteroid_Rock'];root=bpy.data.objects['Asteroid_Root']
original_top=[tuple(v.co) for v in top.data.vertices];N=160;rim=original_top[-N:]
angles=[math.atan2(y/46,x/50) for x,y,z in rim]
# A gradual shoulder replaces the narrow neck and cylindrical central column.
profiles=[(1,0),(1.004,-.7),(.990,-2.3),(.974,-4.8),(.95,-7.8),(.922,-10.3),(.891,-12.6),(.858,-14.5),(.82,-16.3),(.78,-18.4),(.738,-20.6),(.695,-22.8),(.65,-23.7),(.605,-25.1),(.56,-26.5),(.515,-28),(.472,-30),(.43,-33),(.405,-37),(.38,-42),(.355,-47),(.327,-51),(.29,-55),(.25,-58),(.202,-60.8),(.148,-63.4),(.087,-65.5),(.035,-67.4)]
# Different positions, widths and lengths, with no rotational repetition.
spurs=[(-2.76,.80,13,.12,.18),(-2.18,.73,23,.20,.25),(-1.91,.87,7,.075,.12),(-1.24,.69,9,.15,.21),(-.62,.80,18,.115,.22),(-.30,.9,5,.06,.09),(.24,.67,11,.24,.24),(.79,.83,9,.11,.15),(1.48,.75,19,.17,.23),(2.19,.87,6,.08,.12),(2.61,.62,8,.23,.25)]
def field(t,z,scale=1):return noise.noise_vector(Vector((math.cos(t)*3.8*scale+1.7,math.sin(t)*3.8*scale-2.1,z*.065*scale))).x
verts=[]
for j,(r,depth) in enumerate(profiles):
    for i,(x,y,_) in enumerate(rim):
        t=angles[i]
        if j==0:verts.append((x,y,0));continue
        ramp=min(1,j/4)
        radial=r*(1+ramp*(.065*field(t,depth)+.023*field(t,depth,2.8)))
        # Fracture planes change orientation down the rock, avoiding parallel fluting.
        radial+=ramp*r*.009*math.sin(31*t+depth*.20)
        depth_extra=0
        for a,rr,h,aw,rw in spurs:
            da=abs(math.atan2(math.sin(t-a),math.cos(t-a)))
            w=max(0,1-da/aw)**.85*max(0,1-abs(r-rr)/rw)**.9
            depth_extra=max(depth_extra,h*w)
        z=depth-depth_extra+ramp*r*(1.3*field(t,depth,1.7)+.7*math.sin(4*t+.5))
        shift=max(0,1-r)**1.3
        verts.append((x*radial+7*shift,y*radial-3*shift,z))
faces=[]
for j in range(len(profiles)-1):
    for i in range(N):
        a=j*N+i;b=j*N+(i+1)%N;c=a+N;d=b+N
        faces.extend([(a,c,b),(b,c,d)] if (i+j)%2 else [(a,c,d),(a,d,b)])
tip=len(verts);verts.append((7,-3,-68.4));start=(len(profiles)-1)*N
faces.extend((start+i,tip,start+(i+1)%N) for i in range(N))
me=bpy.data.meshes.new('Asteroid_Rock_v03_JoinedCliffs');me.from_pydata(verts,[],faces);me.update()
bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free()
me.materials.append(rock.data.materials[0]);rock.data=me
colors=me.color_attributes.new(name='Color',type='BYTE_COLOR',domain='POINT')
for v,c in zip(me.vertices,colors.data):
    x,y,z=v.co
    broad=noise.noise_vector(Vector((x*.12+3.7,y*.12+9.1,z*.08))).x
    fine=noise.noise_vector(Vector((x*.42,y*.42,z*.29))).x
    variation=.96+.32*broad+.13*fine
    soil=max(0,min(1,(z+4)/4))
    c.color=(*( ((.20,.225,.245)[i]*(1-soil)+(.245,.18,.105)[i]*soil)*variation for i in range(3)),1)
rock['note']='Continuous broad shoulders, asymmetrical rock buttresses and offset pointed central keel.'
root['version']='v03';s.name='Asteroid_Review_v03'
assert original_top==[tuple(v.co) for v in top.data.vertices]
# Reuse the same independent seam validation and clean export procedure.
previous=(OUT.parent/'asteroid-v02'/'revise_asteroid_v02.py').read_text(encoding='utf-8')
tail=previous[previous.index('# Weld only'):].replace('v02','v03')
exec(compile(tail,str(OUT/'validation_and_export'),'exec'))
