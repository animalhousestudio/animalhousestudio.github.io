"""Remove only collapsed edges at existing flower poles and canopy cusps."""
import bpy,bmesh,json
from pathlib import Path

OUT=Path(__file__).resolve().parent
report=json.loads((OUT/'changes.json').read_text())
targets=[o for o in bpy.context.scene.objects if o.type=='MESH' and
         (o.name.startswith('M04_WindowFlowers') or o.name in {
             'M01_Reuse_EXT_Canopy_BackHigh_Braces','M01_Reuse_EXT_Canopy_BackLow_Braces',
             'M01_Reuse_EXT_Canopy_RightLower_Braces','M01_Reuse_EXT_Canopy_RightUpper_Braces'})]
seen=set()
for obj in targets:
    data=obj.data
    if data in seen:continue
    seen.add(data)
    assert not obj.modifiers
    data.calc_loop_triangles()
    before=dict(vertices=len(data.vertices),polygons=len(data.polygons),triangles=len(data.loop_triangles))
    bm=bmesh.new();bm.from_mesh(data)
    bmesh.ops.dissolve_degenerate(bm,dist=1e-8,edges=list(bm.edges))
    assert not any(len(e.link_faces)>2 for e in bm.edges)
    bm.to_mesh(data);bm.free();data.update();data.calc_loop_triangles()
    after=dict(vertices=len(data.vertices),polygons=len(data.polygons),triangles=len(data.loop_triangles))
    assert after['triangles']<before['triangles'] and after['polygons']==before['polygons']
    assert not any(t.area<1e-10 for t in data.loop_triangles)
    report['changes'].append(dict(objects=[o.name for o in targets if o.data==data],
        action='Dissolve zero-length pole/cusp edges; preserve leaves and material boundaries',before=before,after=after))

# The authoring presentation ground is a closed cube with inverted normals.
ground=bpy.data.objects['M01_Presentation_Ground']
bm=bmesh.new();bm.from_mesh(ground.data)
assert bm.calc_volume(signed=True)<0
bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
assert bm.calc_volume(signed=True)>0
bm.to_mesh(ground.data);bm.free();ground.data.update()
report['changes'].append(dict(object=ground.name,action='Correct inward normals on presentation ground; no topology change; excluded from runtime budget'))
(OUT/'changes.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
bpy.context.view_layer.update()
result={'cleaned_meshes':len(seen),'instances':len(targets)}
