"""One source inventory for the compact lift and topology pass (no runtime QA)."""
import bpy, json
from pathlib import Path
from mathutils import Vector

out = Path(__file__).resolve().parent
scene = bpy.context.scene
bpy.context.view_layer.update()
dg = bpy.context.evaluated_depsgraph_get()
rows = []
for obj in scene.objects:
    if obj.type != 'MESH' or obj.hide_render:
        continue
    evaluated = obj.evaluated_get(dg)
    mesh = evaluated.to_mesh()
    mesh.calc_loop_triangles()
    points = [obj.matrix_world @ Vector(v) for v in obj.bound_box]
    rows.append(dict(name=obj.name, triangles=len(mesh.loop_triangles), polygons=len(mesh.polygons),
                     source_polygons=len(obj.data.polygons), mesh=obj.data.name, users=obj.data.users,
                     materials=[m.name for m in obj.data.materials if m], uv=len(obj.data.uv_layers),
                     modifiers=[dict(name=m.name,type=m.type) for m in obj.modifiers],
                     low=[min(p[i] for p in points) for i in range(3)],
                     high=[max(p[i] for p in points) for i in range(3)]))
    evaluated.to_mesh_clear()
report = dict(file=bpy.data.filepath, scene=scene.name, triangles=sum(r['triangles'] for r in rows), objects=rows)
(out / 'source-inventory.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps(dict(triangles=report['triangles'], largest=sorted(rows,key=lambda r:r['triangles'],reverse=True)[:12],
                     lift=[r for r in rows if any(k in r['name'] for k in ['Elevator','Lift_','Floor','Ceiling'])]),indent=2))
