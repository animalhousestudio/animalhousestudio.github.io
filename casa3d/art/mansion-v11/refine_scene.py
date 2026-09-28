"""Conservative v10 refinement. No props, layout changes, export or build."""
import bpy, bmesh, json
from pathlib import Path

OUT = Path(__file__).resolve().parent
scene = bpy.context.scene
assert not scene.get('m11_repairs_applied'), 'Refinement already applied'
assert bpy.context.mode == 'OBJECT'
source = bpy.data.filepath
names = [r['name'] for r in json.loads((OUT/'weld-candidates.json').read_text())]
changes = []
bpy.ops.ed.undo_push(message='Before conservative structural refinement')
for name in names:
    obj = scene.objects[name]
    assert not obj.modifiers and obj.data.users == 1, name
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    before = dict(vertices=len(bm.verts), polygons=len(bm.faces), triangles=sum(len(f.verts)-2 for f in bm.faces))
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-6)
    fins = []
    if name == 'M01_Conservatory_RoofRafter.006':
        # Previous facade clipping collapsed one arm into a zero-thickness fin.
        # Only this dangling sheet has both open and >2-face attachment edges.
        fins = [f for f in bm.faces if any(len(e.link_faces)>2 for e in f.edges)
                and all(e.is_boundary or len(e.link_faces)>2 for e in f.edges)]
        assert len(fins)==1
        bmesh.ops.delete(bm, geom=fins, context='FACES')
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    after = dict(vertices=len(bm.verts), polygons=len(bm.faces), triangles=sum(len(f.verts)-2 for f in bm.faces))
    assert all(e.is_manifold and e.is_contiguous for e in bm.edges), name
    assert after['triangles']<=before['triangles'] and after['polygons']<=before['polygons'], name
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    changes.append(dict(object=name, action='Weld coincident vertices; remove collapsed fin' if fins else 'Weld coincident vertices',before=before,after=after))

# Lift tops were exactly coplanar with both band and adjoining slab.
# Raise only existing threshold top vertices 0.4 mm in model space (2 mm game).
for i in range(5):
    obj=scene.objects[f'M10_Lift_BoardingBridge_{i:02d}']
    top=max((obj.matrix_world@v.co).z for v in obj.data.vertices)
    inverse=obj.matrix_world.inverted()
    moved=0
    for v in obj.data.vertices:
        p=obj.matrix_world@v.co
        if abs(p.z-top)<1e-5:
            p.z+=.0004
            v.co=inverse@p
            moved+=1
    obj.data.update()
    changes.append(dict(object=obj.name,action='Separate threshold top from coplanar landing band and slab',top_delta_model=.0004,vertices=moved))

# Existing ring and interior floor overlap. Lower ring top 2 mm game-space;
# the occupied interior floor and every lift stop retain their original level.
obj=scene.objects['M01_Observatory_GalleryDeck']
top=max((obj.matrix_world@v.co).z for v in obj.data.vertices)
inverse=obj.matrix_world.inverted()
moved=0
for v in obj.data.vertices:
    p=obj.matrix_world@v.co
    if abs(p.z-top)<1e-5:
        p.z-=.0004
        v.co=inverse@p
        moved+=1
obj.data.update()
changes.append(dict(object=obj.name,action='Separate overlapping ring top from observatory interior floor',top_delta_model=-.0004,vertices=moved))

scene['m11_repairs_applied']=True
bpy.context.view_layer.update()
(OUT/'changes.json').write_text(json.dumps(dict(source=source,changes=changes),indent=2),encoding='utf-8')
result={'changed_objects':len(changes),'triangles_removed':sum(c.get('before',{}).get('triangles',0)-c.get('after',{}).get('triangles',0) for c in changes)}
