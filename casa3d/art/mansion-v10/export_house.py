"""Export the saved v10 house source without rebuilding or changing its scene."""
import bpy
import json
from pathlib import Path

out = Path(__file__).resolve().parent
root = out.parents[1]
scene = bpy.context.scene
assert scene.name == 'Mansion_Architecture_v10_CircularLift'
assert Path(bpy.data.filepath).resolve() == (out / 'mansion-v10-circular-lift.blend').resolve()
destination = root / 'src/assets/models/mansion-v10.glb'

bpy.ops.object.select_all(action='DESELECT')
objects = [obj for obj in scene.objects
           if obj.type in {'MESH', 'EMPTY'} and not obj.hide_render
           and not any('Presentation' in collection.name or 'Review_Views' in collection.name
                       for collection in obj.users_collection)]
depsgraph = bpy.context.evaluated_depsgraph_get()
temporary = []
try:
    for obj in objects:
        if obj.type == 'MESH' and obj.modifiers:
            evaluated = bpy.data.meshes.new_from_object(obj.evaluated_get(depsgraph),
                preserve_all_data_layers=True, depsgraph=depsgraph)
            temporary.append((obj, obj.data, evaluated,
                              [(mod, mod.show_viewport, mod.show_render) for mod in obj.modifiers]))
            obj.data = evaluated
            for mod in obj.modifiers:
                mod.show_viewport = False
                mod.show_render = False
        obj.hide_set(False)
        obj.select_set(True)
    bpy.context.view_layer.update()
    bpy.ops.export_scene.gltf(filepath=str(destination), export_format='GLB',
        use_selection=True, export_apply=False, export_extras=False,
        export_cameras=False, export_lights=False)
finally:
    for obj, original, evaluated, settings in temporary:
        obj.data = original
        for mod, viewport, render in settings:
            mod.show_viewport = viewport
            mod.show_render = render
        bpy.data.meshes.remove(evaluated)

report = {'source': bpy.data.filepath, 'asset': str(destination),
          'bytes': destination.stat().st_size, 'objects': len(objects),
          'evaluated_modifiers': len(temporary)}
(out / 'export-report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps(report))
