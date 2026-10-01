import bpy, os, json
from mathutils import Vector
ROOT=r"C:\Users\Amministratore\y.worktrees\copilot-worktrees\animalhousestudio.github.io\animalhousestudio-expert-fortnight"
ART=os.path.join(ROOT,"casa3d","art","triton-fountain-v01")
OUTPUT=os.path.join(ROOT,"casa3d","src","assets","models","props","triton-chocolate-fountain.glb")
os.makedirs(ART,exist_ok=True)
source=bpy.context.scene
assert source.name.startswith("Fontana • Tritone"),"Expected the authored Triton fountain scene"
saved=os.path.join(ART,"triton-chocolate-fountain.blend")
if not os.path.exists(saved):bpy.ops.wm.save_as_mainfile(filepath=saved,copy=True)
objects=[o for c in source.collection.children if not c.name.startswith("06") for o in c.objects if o.type in {'MESH','CURVE'}]
depsgraph=bpy.context.evaluated_depsgraph_get()
game=bpy.data.scenes.new("Fontana • export gioco")
material_cache={}
exported=[]
for obj in objects:
    evaluated=obj.evaluated_get(depsgraph)
    rendered=bpy.data.meshes.new_from_object(evaluated,preserve_all_data_layers=True,depsgraph=depsgraph)
    if not rendered.vertices or not rendered.polygons:continue
    original=list(rendered.materials)
    copy=bpy.data.objects.new("Fountain_"+obj.name,rendered)
    game.collection.objects.link(copy)
    copy.matrix_world=obj.matrix_world.copy()
    rendered.materials.clear()
    for material in original:
        material=material or obj.active_material
        if not material:continue
        if material.name not in material_cache:
            replacement=material.copy()
            replacement.name="Fountain_"+material.name
            if replacement.use_nodes:
                p=replacement.node_tree.nodes.get('Principled BSDF')
                if p:
                    for socket_name in ('Base Color','Normal'):
                        socket=p.inputs.get(socket_name)
                        if socket:
                            for link in list(socket.links):replacement.node_tree.links.remove(link)
                    p.inputs['Base Color'].default_value=material.diffuse_color
            material_cache[material.name]=replacement
        rendered.materials.append(material_cache[material.name])
    exported.append(copy)
bpy.context.window.scene=game
try:
    groups={}
    for obj in exported:
        key=obj.data.materials[0].name if obj.data.materials else "Unpainted"
        groups.setdefault(key,[]).append(obj)
    merged=[]
    for name,group in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for obj in group:obj.select_set(True)
        bpy.context.view_layer.objects.active=group[0]
        bpy.ops.object.join()
        obj=bpy.context.object;obj.name=name
        if len(obj.data.polygons)>8000:
            ratio=.32 if 'Travertino' in name else .40 if 'Pietra' in name else .55 if 'Cioccolato' in name else .7
            modifier=obj.modifiers.new('Game scale geometry','DECIMATE');modifier.ratio=ratio
            bpy.ops.object.modifier_apply(modifier=modifier.name)
        merged.append(obj)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in merged:obj.select_set(True)
    bpy.context.view_layer.objects.active=merged[0]
    bpy.ops.export_scene.gltf(filepath=OUTPUT,export_format='GLB',use_selection=True,use_active_scene=True,
        export_yup=True,export_apply=True,export_animations=False,export_cameras=False,export_lights=False,
        export_extras=False,export_materials='EXPORT')
    report={"source":"triton-chocolate-fountain.blend","output":"../../src/assets/models/props/triton-chocolate-fountain.glb",
        "meshes":len(merged),"vertices":sum(len(o.data.vertices) for o in merged),
        "triangles":sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in merged),
        "bytes":os.path.getsize(OUTPUT),"materials":len(material_cache),
        "coordinateSystem":"glTF +Y up; sculpt front +Z",
        "notes":"Stone sculpture and modeled chocolate preserved; studio excluded. Game animation adds flow highlights and falling droplets."}
    with open(os.path.join(ART,"export.json"),'w',encoding='utf-8') as f:json.dump(report,f,ensure_ascii=False,indent=2)
finally:
    bpy.context.window.scene=source
result={"status":"exported","file":OUTPUT,"report":report}

