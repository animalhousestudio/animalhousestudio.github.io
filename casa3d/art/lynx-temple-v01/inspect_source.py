import bpy, json
from pathlib import Path
ROOT = Path(__file__).resolve().parent
scene = next(s for s in bpy.data.scenes if s.name.startswith('TEMPIO'))
bpy.context.window.scene = scene
scene.frame_set(1)
dg = bpy.context.evaluated_depsgraph_get()
rows=[]
for o in scene.objects:
    if o.type not in {'MESH','CURVE','FONT'}: continue
    me=bpy.data.meshes.new_from_object(o.evaluated_get(dg), depsgraph=dg)
    vs=[o.matrix_world@v.co for v in me.vertices]
    rows.append(dict(name=o.name,collections=[c.name for c in o.users_collection],hidden=o.hide_render,viewportHidden=o.hide_get(),triangles=sum(len(p.vertices)-2 for p in me.polygons),bounds={'min':[min(v[i] for v in vs) for i in range(3)],'max':[max(v[i] for v in vs) for i in range(3)]} if vs else None,materials=[m.name if m else None for m in me.materials],modifiers=[m.type for m in o.modifiers]))
    bpy.data.meshes.remove(me)
(ROOT/'source-inventory.json').write_text(json.dumps({'scene':scene.name,'frame':scene.frame_current,'objects':rows},ensure_ascii=False,indent=2),encoding='utf-8')
print('SOURCE_INVENTORY',len(rows),sum(r['triangles'] for r in rows if r['collections'][0][:2] in ['01','02','03','04','05','07']))
