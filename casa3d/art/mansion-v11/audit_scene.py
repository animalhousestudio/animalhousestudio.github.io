"""Read-only topology and evaluated-geometry audit of the current source."""
import bpy, bmesh, json, math
from pathlib import Path
from collections import Counter
from mathutils import Vector

OUT = Path(__file__).resolve().parent

def run_audit(label):
    dg = bpy.context.evaluated_depsgraph_get()
    rows = []
    for obj in bpy.context.scene.objects:
        if obj.type != 'MESH':
            continue
        evaluated = obj.evaluated_get(dg)
        mesh = evaluated.to_mesh()
        mesh.calc_loop_triangles()
        bm = bmesh.new()
        bm.from_mesh(mesh)
        low = [min((obj.matrix_world @ Vector(p))[i] for p in obj.bound_box) for i in range(3)]
        high = [max((obj.matrix_world @ Vector(p))[i] for p in obj.bound_box) for i in range(3)]
        closed = all(e.is_manifold for e in bm.edges)
        row = dict(name=obj.name, mesh=obj.data.name, collections=[c.name for c in obj.users_collection],
                   hidden_render=obj.hide_render, hidden_viewport=obj.hide_get(),
                   verts=len(mesh.vertices), polygons=len(mesh.polygons), triangles=len(mesh.loop_triangles),
                   bounds=[low,high], location=list(obj.location), scale=list(obj.scale),
                   modifiers=[dict(name=m.name, type=m.type, viewport=m.show_viewport, render=m.show_render,
                                   target=m.object.name if m.type=='BOOLEAN' and m.object else None) for m in obj.modifiers],
                   materials=[m.name if m else None for m in obj.data.materials],
                   boundary_edges=sum(e.is_boundary for e in bm.edges),
                   wire_edges=sum(e.is_wire for e in bm.edges),
                   multi_face_edges=sum(len(e.link_faces)>2 for e in bm.edges),
                   noncontiguous_edges=sum(e.is_manifold and not e.is_contiguous for e in bm.edges),
                   loose_verts=sum(not v.link_edges for v in bm.verts),
                   zero_faces=sum(f.calc_area()<1e-10 for f in bm.faces),
                   zero_triangles=sum(t.area<1e-10 for t in mesh.loop_triangles),
                   closed=closed, signed_volume=bm.calc_volume(signed=True) if closed else None,
                   negative_transform=obj.matrix_world.determinant()<0)
        rows.append(row)
        bm.free()
        evaluated.to_mesh_clear()
    visible = [r for r in rows if not r['hidden_render'] and not any('Presentation' in c or 'Review_Views' in c for c in r['collections'])]
    report = dict(source=bpy.data.filepath, scene=bpy.context.scene.name, meshes=len(rows),
                  visible_meshes=len(visible), triangles=sum(r['triangles'] for r in visible),
                  polygons=sum(r['polygons'] for r in visible), objects=rows)
    OUT.mkdir(parents=True,exist_ok=True)
    (OUT / (label+'.json')).write_text(json.dumps(report,indent=2),encoding='utf-8')
    return report

report = run_audit(globals().get('AUDIT_LABEL','audit-before'))
defect_rows = [r for r in report['objects'] if not r['hidden_render'] and (r['zero_faces'] or r['wire_edges'] or r['multi_face_edges'] or r['noncontiguous_edges'] or r['loose_verts'] or (r['signed_volume'] is not None and r['signed_volume']< -1e-8))]
result = {k:v for k,v in report.items() if k!='objects'}
result['defects'] = [{k:r[k] for k in ('name','triangles','boundary_edges','wire_edges','multi_face_edges','noncontiguous_edges','loose_verts','zero_faces','zero_triangles','signed_volume')} for r in defect_rows]
result['boundary_meshes'] = [r['name'] for r in report['objects'] if r['boundary_edges'] and not r['hidden_render']]
