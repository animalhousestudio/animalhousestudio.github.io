import bpy, bmesh, json
from pathlib import Path
S=bpy.context.scene;OUT=Path(__file__).resolve().parent
S['source_revision']=str(OUT.parent/'mansion-v07'/'mansion-v07-refined.blend')
S['revision_notes']='Fitted through-windows, clear door reveals, extended cellar lift shaft, shared cat poses; runtime capsule collisions.'
objects=[o for o in S.objects if o.type=='MESH' and not o.hide_render and not any('Presentation' in c.name or 'Review_Views' in c.name for c in o.users_collection)]
dg=bpy.context.evaluated_depsgraph_get();triangles=0;issues=[];checked=0
for o in objects:
    ev=o.evaluated_get(dg);me=ev.to_mesh();me.calc_loop_triangles();triangles+=len(me.loop_triangles);ev.to_mesh_clear()
    if o.name.startswith(('M08_Window_', 'M01_Reuse_CURVE_Front_Clapboard_', 'M01_Reuse_CURVE_Left_Clapboard_')):
        if '_Glass' in o.name:continue
        bm=bmesh.new();bm.from_mesh(o.data)
        bad=sum(1 for f in bm.faces if f.calc_area()<1e-10)
        mult=sum(1 for e in bm.edges if len(e.link_faces)>2)
        if bad or mult:issues.append({'object':o.name,'zero_area':bad,'multiple_faces':mult})
        bm.free();checked+=1
report={'objects':len(objects),'triangles':triangles,'unique_meshes':len({o.data for o in objects}),
        'topology_checked_objects':checked,'issues':issues}
assert not issues,issues
(OUT/'source-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'mansion-v08-refined.blend'),compress=True)
print(json.dumps(report))
