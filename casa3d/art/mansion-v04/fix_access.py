import bpy, math
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[2]
scene=bpy.context.scene
changed=[]
def cut(name,center,size,predicate):
    bpy.ops.mesh.primitive_cube_add(size=1,location=center)
    cutter=bpy.context.object;cutter.name='Temporary_Access_Cutter';cutter.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    for o in list(scene.objects):
        if o.type!='MESH' or o==cutter or not predicate(o.name):continue
        points=[o.matrix_world@Vector(c) for c in o.bound_box]
        if any(max(v[i] for v in points)<center[i]-size[i]/2 or min(v[i] for v in points)>center[i]+size[i]/2 for i in range(3)):continue
        o.data=o.data.copy()
        mod=o.modifiers.new(name,'BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=cutter
        bpy.context.view_layer.objects.active=o
        bpy.ops.object.modifier_apply(modifier=mod.name);changed.append(o.name)
    bpy.data.objects.remove(cutter,do_unlink=True)
cut('Veranda doorway',(-8,-1.2,3.00),(2.4,1.65,3.15),lambda n:n.startswith('M01_Reuse_CURVE_Left_Clapboard'))
cut('Aviary doorway',(-8,-.3,11.37),(2.8,1.6,3.0),lambda n:n.startswith('M01_Reuse_CURVE_Left_Clapboard') or n=='M01_Reuse_AVIARY_Left_Connector')
cut('East bridge threshold',(8,-.1,11.50),(2.4,1.65,3.30),lambda n:n.startswith('M01_Reuse_CURVE_Right_Clapboard'))
# Keep the central stair route clear through the hidden attic soffit.
cut('Stair shaft',(0,0,23.5),(1.44,1.44,5),lambda n:n=='M01_Reuse_CURVE_Roof_Soffit')
# The observatory drum covers this roof opening; remove the roof from its interior.
bpy.ops.mesh.primitive_cylinder_add(vertices=64,radius=1,depth=5,location=(-1.04,1.045,27.3))
cutter=bpy.context.object;cutter.scale=(4.72,3.98,1)
bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
for o in list(scene.objects):
    if o.type=='MESH' and (o.name=='M01_Reuse_CURVE_BellGable_SlateRoof' or o.name.startswith('M01_Reuse_CURVE_Roof_StandingSeam')):
        o.data=o.data.copy();mod=o.modifiers.new('Observatory interior clearance','BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=cutter
        bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
bpy.data.objects.remove(cutter,do_unlink=True)
# Frame the new west openings using one shared finish.
mat=bpy.data.materials.get('M01_Oak') or next(m for m in bpy.data.materials if 'Oak' in m.name or 'oak' in m.name)
for label,y,z in [('Veranda',-1.2,1.487),('Aviary',-.3,9.912)]:
    for suffix,pos,dims in [('L',(-8,y-.88,z+1.48),(.5,.12,2.96)),('R',(-8,y+.88,z+1.48),(.5,.12,2.96)),('Top',(-8,y,z+2.96),(.5,1.88,.14))]:
        bpy.ops.mesh.primitive_cube_add(size=1,location=pos);o=bpy.context.object;o.name='ACCESS_'+label+'_'+suffix;o.dimensions=dims;o.data.materials.append(mat)
bpy.ops.wm.save_as_mainfile(filepath=str(root/'art/mansion-v04/mansion-v04-access.blend'),compress=True)
bpy.ops.object.select_all(action='DESELECT')
curves=[o for o in scene.objects if o.type=='CURVE' and not o.hide_render and not any('Presentation' in c.name for c in o.users_collection)]
if curves:
    for o in curves:o.hide_set(False);o.select_set(True)
    bpy.context.view_layer.objects.active=curves[0];bpy.ops.object.convert(target='MESH')
bpy.ops.object.select_all(action='DESELECT')
for o in scene.objects:
    if o.type=='MESH' and not o.hide_render and not any('Presentation' in c.name for c in o.users_collection):o.hide_set(False);o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(root/'src/assets/models/mansion-v04.glb'),export_format='GLB',use_selection=True,export_apply=True,export_extras=False,export_cameras=False,export_lights=False)
result={'doorway_meshes_corrected':len(changed)}
