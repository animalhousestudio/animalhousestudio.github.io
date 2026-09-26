"""Replace the legacy house tree with the selected packed tree library."""
import bpy, json, math
from pathlib import Path
from mathutils import Matrix

OUT=Path(__file__).resolve().parent;ROOT=OUT.parents[1]
S=bpy.context.scene
assert 'v08' in bpy.data.filepath and S.name=='Mansion_Architecture_v08_Repaired'
previous=[o for o in S.objects if o.name.startswith('M01_Reuse_TREE_Left_')]
assert len(previous)==2,[o.name for o in previous]
previous_names=[o.name for o in previous]
with bpy.data.libraries.load(str(ROOT/'art/trees-v01/trees-natural.blend'),link=False) as (source,destination):
    destination.objects=[name for name in source.objects if name.startswith('Tree_Red_')]
green=[o for o in destination.objects if o and o.type=='MESH']
assert len(green)==2,[o.name for o in green]
collection=bpy.data.collections.new('M09_01_Packed_House_Tree');S.collection.children.link(collection)
site=Matrix.Translation((-16.0,1.1,-.18))
orientation=Matrix.Rotation(math.radians(-10),4,'Z')
size=Matrix.Scale(18.5,4)
for o in green:
    part='Leaves' if 'Leaves' in o.name else 'Branches'
    o.parent=None;o.matrix_world=site@orientation@size
    o.name='M09_HouseTree_Number5_'+part
    for old in list(o.users_collection):old.objects.unlink(o)
    collection.objects.link(o)
for o in previous:bpy.data.objects.remove(o,do_unlink=True)
S.name='Mansion_Architecture_v09_Trees'
S['source_revision']=str(OUT.parent/'mansion-v08'/'mansion-v08-refined.blend')
S['revision_notes']='All v08 architecture; tree (5).glb replaces the left legacy tree with original proportions.'
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'mansion-v09-trees.blend'),compress=True)
report={'replaced':previous_names,'new':[o.name for o in green],
        'source':'tree (5).glb','site':[-16.0,1.1,-.18],'height':18.5}
(OUT/'tree-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report))
