"""Export only the player for the local trial; never save over the .blend."""
import bpy
from pathlib import Path

out = Path(__file__).resolve().parents[2] / 'src/assets/models/player-bear.glb'
scene = bpy.context.scene
scene.frame_set(1)
bpy.ops.object.select_all(action='DESELECT')
rig = bpy.data.objects['Player_Rig']
actors = [rig, *rig.children_recursive]
for obj in actors:
    obj.hide_set(False)
    obj.hide_render = False
    if obj.type == 'MESH':
        obj.data.validate(clean_customdata=False)
bpy.context.view_layer.update()
for obj in actors:
    obj.select_set(True)
# Procedural fur relief has no glTF equivalent; the quick trial uses its flat PBR colour.
fur = bpy.data.materials.get('Bear | near-black fur')
if fur:
    normal = fur.node_tree.nodes.get('Principled BSDF').inputs['Normal']
    for link in list(normal.links):
        fur.node_tree.links.remove(link)
# The authoring logo composites alpha over candy colour. Export the original
# image directly with alpha masking, retaining the solid candy behind it.
logo = bpy.data.materials.get('Prop | Original Animal House logo')
if logo:
    nodes, links = logo.node_tree.nodes, logo.node_tree.links
    shader = nodes.get('Principled BSDF')
    texture = next(node for node in nodes if node.type == 'TEX_IMAGE')
    links.new(texture.outputs['Color'], shader.inputs['Base Color'])
    links.new(texture.outputs['Alpha'], shader.inputs['Alpha'])
    logo.surface_render_method = 'DITHERED'
bpy.context.view_layer.objects.active = bpy.data.objects['Player_Rig']
bpy.ops.export_scene.gltf(filepath=str(out), export_format='GLB', use_selection=True,
    export_cameras=False, export_lights=False, export_animations=True,
    export_force_sampling=True, export_apply=False)
print('LOCAL_PLAYER_EXPORTED', str(out), out.stat().st_size)
