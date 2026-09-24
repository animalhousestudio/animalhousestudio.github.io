"""Apply the user's proportion changes to the architectural review, once."""
import bpy, math, json, bmesh
from pathlib import Path
from mathutils import Vector, Matrix

OUT=Path(__file__).resolve().parent.parent/'mansion-v02'
OUT.mkdir(parents=True,exist_ok=True)
scene=bpy.context.scene
if scene.name!='Mansion_Architecture_v01' or scene.get('revision_v02'):
    raise RuntimeError('Expected the unmodified v01 review scene.')
bpy.data.libraries.write(str(OUT.parent/'mansion-v01'/'mansion-v01.blend'),{scene},fake_user=True,compress=True)
scene.name='Mansion_Architecture_v02'
scene['revision_v02']=True

def move_group(objects,anchor,target,scale):
    matrix=Matrix.Translation(Vector(target))@Matrix.Diagonal((*scale,1))@Matrix.Translation(-Vector(anchor))
    for obj in objects: obj.matrix_world=matrix@obj.matrix_world

aviary=[o for o in scene.objects if o.name.startswith('M01_Reuse_AVIARY_Left')]
veranda=[o for o in scene.objects if o.name.startswith('M01_Conservatory')]
level=9.784561157226562
move_group(aviary,(-6.7678,-1.1,level),(-6.7678,-.75,level),(.78,.86,.75))
move_group(veranda,(-7.3,-1.1,.025),(-7.3,-1.8,.025),(.73,.65,.64))

# Remove only task-created annexes/ornaments; the source house remains untouched.
remove_prefixes=('M01_EastWing','M01_EastTerrace','M01_Observatory_Spire','M01_Observatory_Armillary','M01_Tower_FinialOrb')
for o in list(scene.objects):
    if o.name.startswith(remove_prefixes): bpy.data.objects.remove(o,do_unlink=True)
turret=[o for o in scene.objects if o.name.startswith('M01_Tower_')]
move_group(turret,(12,-3.1,0),(10.05,-.1,level),(.75,.75,.61))

# Reuse the generator helpers and existing materials without rebuilding v01.
base=(OUT.parent/'mansion-v01'/'create_mansion.py').read_text(encoding='utf-8')
ns={'bpy':bpy,'math':math,'Vector':Vector,'Matrix':Matrix}
for var,name in {'oak':'CURVE_AgedOak_Trim','slate':'CURVE_Slate_BlueGrey','bronze':'CURVE_AgedBronze','sage':'M01_Sage_Timber','glass':'M01_Amber_Window','gold':'M01_Brass_Accents','dark':'M01_Ironwork'}.items(): ns[var]=bpy.data.materials[name]
exec(base[base.index('def mesh_obj('):base.index('# The new upper storey')],ns)
for o in scene.objects:
    if o.type=='MESH' and len(o.data.vertices)==8 and len(o.data.polygons)==6 and len(o.data.materials)==1:
        if all(all(abs(abs(v.co[i])-.5)<1e-5 for i in range(3)) for v in o.data.vertices):ns['cube_cache'][o.data.materials[0].name]=o.data
box,line,lathe,mesh_obj=(ns[k] for k in ['box','line','lathe','mesh_obj'])
oak,slate,bronze,sage,glass,gold,dark=(ns[k] for k in ['oak','slate','bronze','sage','glass','gold','dark'])
tower=bpy.data.collections['M01_04_East_Tower_Wing']
obs=bpy.data.collections['M01_06_Observatory']

# A cantilevered bay, supported from the house rather than by ground-floor walls.
box('Tower_ConnectionFloor',(8.75,-.1,level+.08),(3.1,3.7,.28),oak,tower)
for y in [-1.55,1.35]:
    line('Tower_CantileverBrace',[(7.2,y,level-2.5),(10.4,y,level-.02)],.18,oak,tower)
    line('Tower_CantileverFoot',[(7.2,y,level-2.5),(7.2,y,level+.05)],.14,bronze,tower)
lathe('Tower_SuspendedBase',10.05,-.1,[(1.15,level-.9),(2.5,level-.1),(2.56,level+.10)],slate,tower,32)

# Replace the remaining finial with a plain, vertical lightning rod.
rod=bpy.data.objects.get('M01_Tower_Finial')
if rod: bpy.data.objects.remove(rod,do_unlink=True)
roof_tip=level+29.5*.61
line('Tower_LightningRod',[(10.05,-.1,roof_tip-.05),(10.05,-.1,roof_tip+1.05)],.04,bronze,tower)

# A narrow observing slit in a single-user copy of the preserved dome.
# Original mesh and materials in the source Scene are never edited.
ocx,ocy=-1.04,1.045
dome=bpy.data.objects['M01_Reuse_ObsDome_Curved']
dome.data=dome.data.copy();dome.data.name='M02_Observatory_Dome_WithSlit'
bm=bmesh.new();bm.from_mesh(dome.data)
cut=[]
for f in bm.faces:
    p=dome.matrix_world@f.calc_center_median()
    if p.y<ocy and abs(p.x-ocx)<.78 and p.z>29.07:cut.append(f)
bmesh.ops.delete(bm,geom=cut,context='FACES')
bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
bm.to_mesh(dome.data);bm.free();dome.data.update()
# Hide only meridian strips running across the new opening.
for o in list(obs.objects):
    if o.name.startswith('M01_Reuse_CURVE_Dome_Meridian'):
        pts=[o.matrix_world@Vector(v) for v in o.bound_box]
        if max(p.y for p in pts)<ocy+.2 and min(p.x for p in pts)>ocx-.95 and max(p.x for p in pts)<ocx+.95:
            bpy.data.objects.remove(o,do_unlink=True)

def cylinder_between(name,a,b,radius,material,vertices=24):
    a,b=Vector(a),Vector(b)
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=(b-a).length,location=(a+b)/2)
    o=bpy.context.object;o.name='M02_'+name
    o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler()
    o.data.materials.append(material)
    for c in list(o.users_collection):c.objects.unlink(o)
    obs.objects.link(o)
    return o

# Observatory's optical instrument is centred on the drum, with a visible lens.
basepoint=Vector((ocx,ocy,26.0));mount=Vector((ocx,ocy,28.85))
for t in [0,math.tau/3,2*math.tau/3]:
    cylinder_between('Telescope_Tripod',basepoint+Vector((.92*math.cos(t),.92*math.sin(t),0)),mount,.08,bronze,12)
cylinder_between('Telescope_Mount',mount-Vector((.36,0,0)),mount+Vector((.36,0,0)),.26,dark)
direction=Vector((0,-1,.53)).normalized()
back=mount-direction*.95;front=mount+direction*5.45
cylinder_between('Telescope_Barrel',back,front,.30,oak,32)
for d in [-.65,.3,3.5,5.35]:
    p=mount+direction*d
    cylinder_between('Telescope_BrassRing',p-direction*.06,p+direction*.06,.34,gold,32)
cylinder_between('Telescope_Lens',front,front+direction*.06,.268,glass,32)
cylinder_between('Telescope_Eyepiece',back-direction*.40,back,.115,dark)
line('Telescope_FindScope',[mount+Vector((.43,0,.18))-direction*.25,mount+Vector((.43,0,.18))+direction*.8],.07,bronze,obs)

bpy.context.view_layer.update()
for o in scene.objects:o.select_set(False)
scene.camera=bpy.data.objects['M01_Camera_Hero']
scene.render.filepath=str(OUT/'mansion-v02-hero.png')
bpy.data.libraries.write(str(OUT/'mansion-v02.blend'),{scene},fake_user=True,compress=True)
stats={'revision':'v02','suspended_tower_base':level,'tower_scale':[.75,.75,.61],'aviary_scale':[.78,.86,.75],'veranda_scale':[.73,.65,.64],'house_floor_heights_unchanged':True,'source_scene_unchanged':True,'game_modified':False,'observatory_dome_slit_faces_removed':len(cut)}
(OUT/'stats.json').write_text(json.dumps(stats,indent=2),encoding='utf-8')
result=stats
