"""Finalize the user-approved exterior and export only that asset.
Execute in Blender after build_review.py or loading contact-booth-review.blend.
"""
import bpy, json, hashlib
from pathlib import Path
from mathutils import Vector

p = Path(PACKAGE)
scene = bpy.data.scenes['ContactBooth_DesignReview']
bpy.context.window.scene = scene
if bpy.context.object and bpy.context.object.mode != 'OBJECT':
    bpy.ops.object.mode_set(mode='OBJECT')
# Finish headers beneath the roof, preserving the approved silhouette.
red = bpy.data.materials['Review_EnamelRed']
for x in [-.72,.72]:
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x,0,2.68))
    ob=bpy.context.object; ob.name='Booth_SideHeader'; ob.dimensions=(.16,1.6,.32)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    ob.data.materials.append(red)
for ob in list(scene.objects):
    if ob.type=='FONT':
        bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); bpy.context.view_layer.objects.active=ob
        bpy.ops.object.convert(target='MESH')
asset=[ob for ob in scene.objects if ob.type=='MESH' or ob.name=='Review_DoorHinge']
for ob in asset:
    if ob.type!='MESH': continue
    bevel=ob.modifiers.new('Enamel edge highlights','BEVEL'); bevel.width=.008; bevel.segments=2
    bpy.context.view_layer.objects.active=ob
    bpy.ops.object.modifier_apply(modifier=bevel.name)
bpy.ops.object.select_all(action='DESELECT')
for ob in asset: ob.select_set(True)
target=p.parents[1]/'src'/'assets'/'models'/'props'/'contact-booth.glb'
target.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(target),export_format='GLB',use_selection=True,export_yup=True)
bpy.context.view_layer.update()
vertices=[ob.matrix_world@v.co for ob in asset if ob.type=='MESH' for v in ob.data.vertices]
metadata={'source':'contact-booth.blend','units':'metres','front':'Blender -Y / glTF +Z',
    'boundsBlender':{'min':[min(v[i] for v in vertices) for i in range(3)],'max':[max(v[i] for v in vertices) for i in range(3)]},
    'triangles':sum(len(poly.vertices)-2 for ob in asset if ob.type=='MESH' for poly in ob.data.polygons),
    'bytes':target.stat().st_size,'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),
    'approval':'User: perfetto! ora inseriamola nel sito',
    'scope':'Exterior only. Interior and empty lower room authored separately in Three.js.'}
(p/'exterior-metadata.json').write_text(json.dumps(metadata,indent=2),encoding='utf-8')
bpy.ops.wm.save_as_mainfile(filepath=str(p/'contact-booth.blend'),copy=True)
scene.render.filepath=str(p/'renders'/'exterior-final.png')
bpy.ops.render.render(write_still=True)
result=metadata
