"""Keep the approved playable top; sculpt one continuous, fractured rock shell."""
import bpy,bmesh,math,json,hashlib
from pathlib import Path
from mathutils import Vector,noise
OUT=Path(__file__).resolve().parent;OUT.mkdir(parents=True,exist_ok=True)
s=bpy.context.scene
assert s.name=='Asteroid_Review_v01','Apply once to the original review.'
if bpy.context.object and bpy.context.object.mode!='OBJECT':bpy.ops.object.mode_set(mode='OBJECT')
top=bpy.data.objects['Asteroid_Surface'];rock=bpy.data.objects['Asteroid_Rock'];root=bpy.data.objects['Asteroid_Root']
original_top=[tuple(v.co) for v in top.data.vertices]
N=160
rim=original_top[-N:]
angles=[math.atan2(y/46,x/50) for x,y,z in rim]
profiles=[(1,0),(1.006,-.6),(.993,-1.9),(.975,-4),(.951,-7),(.925,-9.5),(.89,-11),(.85,-11.5),(.81,-12),(.76,-13),(.71,-14),(.66,-15),(.61,-16),(.56,-17),(.51,-19),(.46,-22),(.42,-28),(.39,-36),(.37,-44),(.35,-50),(.325,-55),(.29,-58),(.25,-60),(.20,-60.8),(.14,-61.2),(.07,-61.3)]
verts=[]
for j,(r,depth) in enumerate(profiles):
    for i,(x,y,_) in enumerate(rim):
        t=angles[i]
        if j==0:verts.append((x,y,0));continue
        ramp=min(1,max(0,(j-1)/4))
        fracture=.020*math.sin(19*t+.3)+.011*math.sin(37*t+1.2)+.006*math.sin(61*t)
        radial=r+fracture*ramp*min(1,r/.23)
        radial+=.003*math.sin(11*t+j*.67)*ramp
        z=depth
        # Different lengths of narrow edge buttresses create a broken cliff silhouette.
        fringe=max(0,1-abs(r-.745)/.225)**.8
        teeth=12*(.5+.5*math.sin(9*t+.45))**7+5*(.5+.5*math.sin(23*t-1))**10
        major=[]
        for a,h,w in [(-2.55,17,.17),(-.55,16,.15),(.9,13,.19),(2.1,15,.14)]:
            d=abs(math.atan2(math.sin(t-a),math.cos(t-a)))
            major.append(h*max(0,1-d/w)**.65)
        z-=fringe*(teeth+max(major))
        z+=ramp*(.9*math.sin(5*t+.2)+.55*math.sin(17*t)+.22*math.sin(j*.8+29*t))
        # Broad central column keeps substantial width all the way down to its blunt foot.
        shift=max(0,1-r)**1.2
        verts.append((x*radial+4.0*shift,y*radial+1.0*shift,z))
faces=[]
for j in range(len(profiles)-1):
    for i in range(N):
        a=j*N+i;b=j*N+(i+1)%N;c=a+N;d=b+N
        faces.extend([(a,c,b),(b,c,d)] if (i+j)%2 else [(a,c,d),(a,d,b)])
tip=len(verts);verts.append((4,1,-61.1));start=(len(profiles)-1)*N
faces.extend((start+i,tip,start+(i+1)%N) for i in range(N))
me=bpy.data.meshes.new('Asteroid_Rock_v02_ContinuousShell');me.from_pydata(verts,[],faces);me.update()
bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free()
me.materials.append(rock.data.materials[0]);rock.data=me
colors=me.color_attributes.new(name='Color',type='BYTE_COLOR',domain='POINT')
for v,c in zip(me.vertices,colors.data):
    x,y,z=v.co;t=math.atan2((y-1)/46,(x-4)/50)
    broad=noise.noise_vector(Vector((x*.11+3.7,y*.11+9.1,z*.06+1.3))).x
    fine=noise.noise_vector(Vector((x*.4,y*.4,z*.3))).x
    seam=(.5+.5*math.sin(19*t+.3))**7
    variation=.99+.23*broad+.08*fine-.14*seam
    soil=max(0,min(1,(z+4)/4))
    color=tuple(((.20,.225,.245)[i]*(1-soil)+(.245,.18,.105)[i]*soil)*variation for i in range(3))
    c.color=(*color,1)
rock['note']='Broad central mass and fractured lateral buttresses; one continuous shell, no internal faces.'
root['version']='v02';s.name='Asteroid_Review_v02'
assert original_top==[tuple(v.co) for v in top.data.vertices],'Playable surface changed'
# Weld only a temporary validation mesh: the actual asset remains two material-specific meshes.
bm=bmesh.new()
allv=[];allf=[]
for ob in [top,rock]:
    off=len(allv);allv.extend(tuple(v.co) for v in ob.data.vertices);allf.extend(tuple(off+i for i in p.vertices) for p in ob.data.polygons)
tmp=bpy.data.meshes.new('VALIDATION_ONLY');tmp.from_pydata(allv,[],allf);bm.from_mesh(tmp)
bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.0001)
boundary=sum(e.is_boundary for e in bm.edges);nonmanifold=sum(not e.is_manifold for e in bm.edges)
assert boundary==0 and nonmanifold==0,'Combined volume must be closed'
bm.free();bpy.data.meshes.remove(tmp)
camera=s.camera;camera.location=(110,-180,25);camera.rotation_euler=(Vector((0,0,-23))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.ortho_scale=130
s.cycles.samples=24;s.render.resolution_x=1250;s.render.resolution_y=1100;s.render.resolution_percentage=100
s.render.filepath=str(OUT/'asteroid-v02-preview.png')
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            sp=area.spaces.active;sp.region_3d.view_location=(0,0,-23);sp.region_3d.view_distance=150;sp.region_3d.view_rotation=camera.rotation_euler.to_quaternion();sp.shading.type='MATERIAL'
for ob in s.objects:ob.select_set(False)
for ob in [top,rock,root]:ob.select_set(True)
bpy.context.view_layer.objects.active=rock
bpy.ops.export_scene.gltf(filepath=str(OUT/'asteroid-v02.glb'),export_format='GLB',use_selection=True,use_active_scene=True,export_yup=True,export_animations=False,export_cameras=False,export_lights=False)
for ob in s.objects:ob.select_set(False)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'asteroid-v02.blend'),compress=True)
stats={'version':'v02','meshes':2,'materials':2,'triangles':sum(len(o.data.polygons) for o in [top,rock]),'glb_bytes':(OUT/'asteroid-v02.glb').stat().st_size,'top_unchanged':True,'welded_boundary_edges':boundary,'welded_nonmanifold_edges':nonmanifold,'game_modified':False}
(OUT/'stats.json').write_text(json.dumps(stats,indent=2),encoding='utf-8');result=stats
