"""Export evaluated modifiers while retaining linked meshes and editable source."""
import bpy, json
from pathlib import Path

OUT=Path(__file__).resolve().parent;ROOT=OUT.parents[1];S=bpy.context.scene
assert S.name=='Mansion_Architecture_v08_Repaired'
bpy.ops.object.select_all(action='DESELECT')
objects=[o for o in S.objects if o.type in {'MESH','EMPTY'} and not o.hide_render
         and not any('Presentation' in c.name or 'Review_Views' in c.name for c in o.users_collection)]
dg=bpy.context.evaluated_depsgraph_get();temporary=[]
try:
    for o in objects:
        if o.type=='MESH' and o.modifiers:
            m=bpy.data.meshes.new_from_object(o.evaluated_get(dg),preserve_all_data_layers=True,depsgraph=dg)
            temporary.append((o,o.data,m,[(mod,mod.show_viewport,mod.show_render) for mod in o.modifiers]))
            o.data=m
            for mod in o.modifiers:mod.show_viewport=False;mod.show_render=False
        o.hide_set(False);o.select_set(True)
    bpy.context.view_layer.update()
    bpy.ops.export_scene.gltf(filepath=str(ROOT/'src/assets/models/mansion-v08.glb'),export_format='GLB',
        use_selection=True,export_apply=False,export_extras=False,export_cameras=False,export_lights=False)
finally:
    for o,source,m,mods in temporary:
        o.data=source
        for mod,viewport,render in mods:mod.show_viewport=viewport;mod.show_render=render
        bpy.data.meshes.remove(m)
bpy.ops.object.select_all(action='DESELECT')
bpy.data.orphans_purge(do_local_ids=True,do_linked_ids=False,do_recursive=True)
bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'mansion-v08-refined.blend'),compress=True)
result={'file':str(ROOT/'src/assets/models/mansion-v08.glb'),'bytes':(ROOT/'src/assets/models/mansion-v08.glb').stat().st_size,'objects':len(objects),'evaluated_modifiers':len(temporary)}
(OUT/'export-report.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
