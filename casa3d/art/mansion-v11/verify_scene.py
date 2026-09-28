"""Validate the actual edited Blender scene, including evaluated modifiers."""
import bpy,json,math
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree

OUT=Path(__file__).resolve().parent
namespace={'__file__':str(OUT/'audit_scene.py'),'AUDIT_LABEL':'audit-after'}
exec(compile((OUT/'audit_scene.py').read_text(encoding='utf-8'),namespace['__file__'],'exec'),namespace)
after=namespace['report']
before=json.loads((OUT/'audit-before.json').read_text())
assert after['triangles']<=before['triangles']
assert after['polygons']<=before['polygons']
old={o['name']:o for o in before['objects']}
new={o['name']:o for o in after['objects']}
assert set(old)==set(new), 'Mesh objects added or removed'
assert len(bpy.context.scene.objects)==1877
for name,row in new.items():
    assert row['location']==old[name]['location'] and row['scale']==old[name]['scale'],name
    assert row['materials']==old[name]['materials'],name
    assert row['hidden_render']==old[name]['hidden_render'],name
    if not row['hidden_render']:
        assert not any(row[k] for k in ['zero_faces','zero_triangles','wire_edges','loose_verts','multi_face_edges','noncontiguous_edges']),name

dg=bpy.context.evaluated_depsgraph_get()
def tree(name):
    obj=bpy.context.scene.objects[name]
    evaluated=obj.evaluated_get(dg)
    mesh=evaluated.to_mesh()
    try:return BVHTree.FromPolygons([obj.matrix_world@v.co for v in mesh.vertices],[list(p.vertices) for p in mesh.polygons])
    finally:evaluated.to_mesh_clear()

roof=tree('M01_Reuse_CURVE_BellGable_SlateRoof')
roof_rays=0
for fraction in [.90,.95,.97,.99,1.0]:
    for i in range(720):
        angle=math.tau*i/720
        origin=Vector((-1.04+4.78*fraction*math.cos(angle),1.045+4.02*fraction*math.sin(angle),25.73))
        assert roof.ray_cast(origin,Vector((0,0,1)),3)[0] is None,'Roof intrusion'
        roof_rays+=1
assert new['M01_Reuse_CURVE_BellGable_SlateRoof']['boundary_edges']==0
assert new['M01_Reuse_CURVE_BellGable_SlateRoof']['bounds']==old['M01_Reuse_CURVE_BellGable_SlateRoof']['bounds']

floor_names=['M01_Reuse_INT_Slab_Living','M01_Reuse_INT_Slab_Kitchen','M01_UpperFloor_Slab',
             'M01_UpperFloor_Ceiling','M06_Observatory_InteriorFloor','M01_Reuse_CURVE_Roof_Soffit']
floor_results=[]
for name in floor_names:
    row=new[name]
    assert row['closed'] and row['signed_volume']>0,name
    floor=tree(name)
    bottom=row['bounds'][0][2]
    for i in range(48):
        a=math.tau*i/48
        origin=Vector((.16*math.cos(a),.16*math.sin(a),bottom-.1))
        assert floor.ray_cast(origin,Vector((0,0,1)),1)[0] is None,name+' blocked aperture'
        origin=Vector((.245*math.cos(a),.245*math.sin(a),bottom-.1))
        assert floor.ray_cast(origin,Vector((0,0,1)),1)[0] is not None,name+' missing support'
    floor_results.append(dict(object=name,clear_aperture_rays=48,support_rays=48,closed=True))

stops=list(bpy.context.scene.objects['M10_Elevator_Controller']['stop_floor_z'])
assert all(abs(a-b)<1e-5 for a,b in zip(stops,[-6.6,1.487,9.912,17.2,25.72]))
thresholds=[]
for i,z in enumerate(stops):
    bridge=tree(f'M10_Lift_BoardingBridge_{i:02d}')
    band=tree(f'M10_Elevator_Landing_Band_{i:02d}')
    origin=Vector((0,-.22,z+.2))
    a=bridge.ray_cast(origin,Vector((0,0,-1)),.5)[0]
    b=band.ray_cast(origin,Vector((0,0,-1)),.5)[0]
    assert a is not None and b is not None and .0003<a.z-b.z<.0005
    thresholds.append(dict(stop=i,separation_model=a.z-b.z))
origin=Vector((3.5,1.045,26))
deck=tree('M01_Observatory_GalleryDeck').ray_cast(origin,Vector((0,0,-1)),1)[0]
interior=tree('M06_Observatory_InteriorFloor').ray_cast(origin,Vector((0,0,-1)),1)[0]
assert deck is not None and interior is not None and .0003<interior.z-deck.z<.0005

result=dict(status='passed',objects=len(bpy.context.scene.objects),mesh_objects=after['meshes'],
            triangles_before=before['triangles'],triangles_after=after['triangles'],
            polygons_before=before['polygons'],polygons_after=after['polygons'],
            zero_area_triangles_after=0,roof_clearance_rays=roof_rays,
            repaired_roof_closed=True,roof_outer_bounds_unchanged=True,
            object_names_transforms_materials_preserved=True,
            floor_apertures=floor_results,thresholds=thresholds,
            observatory_floor_separation_model=interior.z-deck.z,
            runtime_tested=False)
(OUT/'verification.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
