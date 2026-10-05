"""Concert-scale revision: structure 3x; microphone and monitors stay life-size.

Run after loading garden-stage-small.blend. The small source is preserved.
Rebuild access with 16 cm risers instead of tripling stair riser height.
"""
import bpy
import json
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parent
scene=bpy.data.scenes['GardenStage_Review']
bpy.context.window.scene=scene
asset=bpy.data.collections['GardenStage_ASSET']
root=bpy.data.objects['GardenStage']
assert abs(root.get('deck_top_m',.64)-.64)<1e-5, 'Load the preserved small source before resizing.'
for obj in tuple(asset.objects):
    if obj.type!='MESH': continue
    if obj.name.startswith(('Stage_StairRiser_','Stage_StairTread_','Stage_StairStringer_')):
        bpy.data.objects.remove(obj,do_unlink=True)
        continue
    if obj.name.startswith(('Stage_Microphone','Stage_Monitor_')):
        obj.location.x*=3
        obj.location.y*=3
        obj.location.z=1.92+(obj.location.z-.64)
    else:
        obj.location*=3
        obj.scale*=3

def box(name,position,size,material,bevel):
    bpy.ops.mesh.primitive_cube_add(size=1,location=position)
    obj=bpy.context.object
    obj.name=name
    obj.scale=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    for coll in tuple(obj.users_collection): coll.objects.unlink(obj)
    asset.objects.link(obj)
    obj.parent=root
    obj.data.materials.append(material)
    modifier=obj.modifiers.new('Soft manufactured edges','BEVEL')
    modifier.width=bevel; modifier.segments=2
    obj.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL')
    return obj

for side,label in [(-1,'Left'),(1,'Right')]:
    x=side*7.95
    for step in range(11):
        y=-9.36+step*.32
        top=.16*(step+1)
        box(f'Stage_StairRiser_{label}_{step+1}',(x,y,(top-.04)/2),
            (3.90,.314,top-.04),bpy.data.materials['Stage_CharcoalSteel'],.008)
        box(f'Stage_StairTread_{label}_{step+1}',(x,y,top-.02),
            (4.02,.32,.04),bpy.data.materials['Stage_Walnut_3'],.005)
    for edge in (-1,1):
        a=Vector((x+edge*2.04,-9.49,.075))
        b=Vector((x+edge*2.04,-5.97,1.82))
        bpy.ops.mesh.primitive_cylinder_add(vertices=12,radius=.06,depth=(b-a).length,location=(a+b)*.5)
        obj=bpy.context.object
        obj.name=f'Stage_StairStringer_{label}_{edge}'
        obj.rotation_mode='QUATERNION'
        obj.rotation_quaternion=(b-a).to_track_quat('Z','Y')
        for coll in tuple(obj.users_collection): coll.objects.unlink(obj)
        asset.objects.link(obj); obj.parent=root
        obj.data.materials.append(bpy.data.materials['Stage_CharcoalSteel'])
        for poly in obj.data.polygons: poly.use_smooth=len(poly.vertices)==4

root['structure_scale']=3
root['deck_top_m']=1.92
root['deck_width_m']=24
root['deck_depth_m']=12
root['preserved_scale']='Microphone assembly and monitor speakers remain 1x; their layout follows the enlarged stage.'
root['scope']='Concert-size asset approved by user; local runtime integration.'
scene.camera.location*=3
scene.camera.data.ortho_scale*=3
for obj in bpy.data.collections['ReviewStudio_DO_NOT_EXPORT'].objects:
    if obj.type=='LIGHT':
        obj.location*=3
        obj.data.energy*=9
        obj.data.size*=3
for o in bpy.context.selected_objects: o.select_set(False)
root.select_set(True)
bpy.context.view_layer.objects.active=root
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            area.spaces.active.region_3d.view_distance=45
            area.spaces.active.region_3d.view_location=(0,0,6)
            area.spaces.active.region_3d.view_perspective='PERSP'
bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'garden-stage.blend'),compress=True)
fixtures=json.loads((ROOT/'fixtures.json').read_text(encoding='utf-8'))
for fixture in fixtures:
    # Reproducible source is the original four fixed lamp pivots.
    n=int(fixture['id'].split('-')[-1])-1
    fixture['positionMeters']=[(-2.7,-.9,.9,2.7)[n]*3,-1.72*3,3.86*3]
(ROOT/'fixtures.json').write_text(json.dumps(fixtures,indent=2),encoding='utf-8')
result={'deck':[24,12,1.92],'structureScale':3,'microphoneAndMonitorScale':1,'stairRisers':12,'riserMeters':.16}
