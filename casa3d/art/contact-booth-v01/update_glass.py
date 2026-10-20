"""Make the authored glass transparent and re-export without rebuilding geometry."""
import bpy, json, hashlib
from pathlib import Path
p=Path(PACKAGE)
scene=bpy.data.scenes['ContactBooth_DesignReview']
bpy.context.window.scene=scene
scene.objects['Review_DoorHinge'].rotation_euler.z=0
glass=bpy.data.materials['Review_GlassPlaceholder']
glass.diffuse_color=(.7,.86,.88,.10)
shader=glass.node_tree.nodes.get('Principled BSDF')
shader.inputs['Base Color'].default_value=(.7,.86,.88,1)
shader.inputs['Alpha'].default_value=.10
shader.inputs['Roughness'].default_value=.08
shader.inputs['Metallic'].default_value=.02
if hasattr(glass,'surface_render_method'):glass.surface_render_method='DITHERED'
bpy.ops.object.select_all(action='DESELECT')
for ob in scene.objects:
    if ob.type=='MESH' or ob.name=='Review_DoorHinge':ob.select_set(True)
target=p.parents[1]/'src'/'assets'/'models'/'props'/'contact-booth.glb'
bpy.ops.export_scene.gltf(filepath=str(target),export_format='GLB',use_selection=True,export_yup=True)
bpy.ops.wm.save_as_mainfile(filepath=str(p/'contact-booth.blend'))
metadata=json.loads((p/'exterior-metadata.json').read_text(encoding='utf-8'))
metadata.update(bytes=target.stat().st_size,sha256=hashlib.sha256(target.read_bytes()).hexdigest(),
    glass='Transparent alpha 0.10, roughness 0.08. Runtime keeps alpha blending and disables pane shadow casting.')
bpy.context.view_layer.update()
vertices=[ob.matrix_world@v.co for ob in scene.objects if ob.type=='MESH' for v in ob.data.vertices]
metadata['boundsBlender']={'min':[min(v[i] for v in vertices) for i in range(3)],'max':[max(v[i] for v in vertices) for i in range(3)]}
metadata['initialDoor']='closed; runtime hinge opens outwards on interaction'
(p/'exterior-metadata.json').write_text(json.dumps(metadata,indent=2),encoding='utf-8')
result=metadata
