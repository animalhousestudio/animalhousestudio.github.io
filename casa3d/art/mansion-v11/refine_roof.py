"""Fit the existing roof opening to the drum, with no added mesh topology."""
import bpy, math, json
from pathlib import Path

OUT=Path(__file__).resolve().parent
roof=bpy.data.objects['M01_Reuse_CURVE_BellGable_SlateRoof']
assert not roof.get('m11_clearance_refined')
source=roof.data
data=source.copy()
inverse=roof.matrix_world.inverted()
moved=0
max_shift=0
for vertex in data.vertices:
    p=roof.matrix_world@vertex.co
    dx,dy=p.x+1.04,p.y-1.045
    radius=math.hypot(dx/4.78,dy/4.02)
    if .94<radius<1.12 and p.z>24.8:
        # Monotonic radial remapping preserves the rim's thickness and faces.
        # Blend back into the unchanged roof before leaving the drum junction.
        delta=.053*(1.12-radius)/.14*min(1.,max(0.,(p.z-24.8)/.7))
        q=p.copy()
        q.x=-1.04+dx*(radius+delta)/radius
        q.y=1.045+dy*(radius+delta)/radius
        max_shift=max(max_shift,(q-p).length)
        vertex.co=inverse@q
        moved+=1
assert len(data.vertices)==len(source.vertices) and len(data.polygons)==len(source.polygons)
data.update()
roof.data=data
roof['m11_clearance_refined']=True
bpy.context.view_layer.update()
report=json.loads((OUT/'changes.json').read_text())
report['changes'].append(dict(object=roof.name,action='Fit existing aperture to observatory inner wall; preserve exterior outline and modifiers',
                              vertices_moved=moved,max_vertex_shift_model=max_shift,
                              source_polygons_unchanged=True,source_vertices_unchanged=True))
(OUT/'changes.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
result={'vertices_moved':moved,'source_topology_unchanged':True}
