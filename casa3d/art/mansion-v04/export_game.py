import bpy, math, json
from pathlib import Path
from mathutils import Matrix, Vector

root=Path(__file__).resolve().parents[2]
# A separate playable revision preserves the approved modelling source.
removed=[]
for o in list(bpy.context.scene.objects):
    if o.name.startswith('M01_Reuse_INT_LivingWindow_') or 'TestWindow' in o.name:
        removed.append(o.name)
        bpy.data.objects.remove(o,do_unlink=True)

# Open the existing detailed leaves statically, including their hardware.
moving=('WalnutLeaf','RecessedPanel','PanelField','IronStrap','Rivet','KnockerBoss','RingKnocker','Hinge')
for o in bpy.context.scene.objects:
    if o.name.startswith('M03_Portal_') and any(o.name.startswith('M03_Portal_'+s) for s in moving):
        center=o.matrix_world@Vector((0,0,0))
        if o.type=='MESH':
            center=sum((o.matrix_world@Vector(c) for c in o.bound_box),Vector())/8
        left=center.x < -.98
        hinge=Vector((-1.95 if left else -.01,-6.38,0))
        o.matrix_world=Matrix.Translation(hinge)@Matrix.Rotation(math.radians(100 if left else -100),4,'Z')@Matrix.Translation(-hinge)@o.matrix_world

# Cut genuine openings in the retained solid ground and first-floor slabs.
bpy.ops.mesh.primitive_cube_add(size=1,location=(0,0,13))
cutter=bpy.context.object
cutter.name='Temporary_Stairwell_Cutter'
cutter.scale=(4.2,4.2,40)
bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
for o in list(bpy.context.scene.objects):
    if o.name.startswith('M01_Reuse_INT_Slab_'):
        mod=o.modifiers.new('Playable stairwell','BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=cutter
        bpy.context.view_layer.objects.active=o
        bpy.ops.object.modifier_apply(modifier=mod.name)
bpy.data.objects.remove(cutter,do_unlink=True)

out=root/'art'/'mansion-v04'/'mansion-v04-game.blend'
bpy.ops.wm.save_as_mainfile(filepath=str(out),compress=True)
# Include evaluated curves as meshes, but never the presentation set.
bpy.ops.object.select_all(action='DESELECT')
selected=[]
for o in bpy.context.scene.objects:
    if o.type in {'MESH','CURVE'} and not o.hide_render and not any('Presentation' in c.name for c in o.users_collection):
        o.hide_set(False);o.select_set(True);selected.append(o)
curves=[o for o in selected if o.type=='CURVE']
if curves:
    bpy.ops.object.select_all(action='DESELECT')
    for o in curves:o.select_set(True)
    bpy.context.view_layer.objects.active=curves[0]
    bpy.ops.object.convert(target='MESH')
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.context.scene.objects:
    if o.type=='MESH' and not o.hide_render and not any('Presentation' in c.name for c in o.users_collection):o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(root/'src/assets/models/mansion-v04.glb'),export_format='GLB',use_selection=True,export_apply=True,export_extras=False,export_cameras=False,export_lights=False)
result={'removed_interior_duplicates':len(removed),'exported_objects':len(bpy.context.selected_objects),'blend':str(out)}
(root/'art/mansion-v04/game-export.json').write_text(json.dumps(result,indent=2))
