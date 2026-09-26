"""Pack three selected glTF trees into a small, reusable Blender/game library."""
import bpy, json
from pathlib import Path
from mathutils import Vector, Matrix

OUT=Path(__file__).resolve().parent;ROOT=OUT.parents[1]
S=bpy.context.scene;S.name='Trees_v01_Reusable_Library'
for o in list(S.objects):bpy.data.objects.remove(o,do_unlink=True)
variants=[('Green','tree (2).glb',-4),('Gold','tree.glb',0),('Red','tree (5).glb',4)]
report=[]
for label,filename,display_x in variants:
    before=set(S.objects);images_before=set(bpy.data.images)
    bpy.ops.import_scene.gltf(filepath=str(Path('C:/Users/Amministratore/Desktop/trees')/filename))
    meshes=[o for o in S.objects if o not in before and o.type=='MESH']
    assert len(meshes)==2,(filename,[o.name for o in meshes])
    bpy.context.view_layer.update()
    points=[o.matrix_world@v.co for o in meshes for v in o.data.vertices]
    lo=Vector(min(v[i] for v in points) for i in range(3))
    hi=Vector(max(v[i] for v in points) for i in range(3))
    height=hi.z-lo.z;center=Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z))
    transform=Matrix.Scale(1/height,4)@Matrix.Translation(-center)
    c=bpy.data.collections.new('Tree_'+label);S.collection.children.link(c)
    parts={}
    for o in meshes:
        kind='Leaves' if any('leav' in m.name.lower() for m in o.data.materials) else 'Branches'
        world=o.matrix_world.copy();o.parent=None;o.data=o.data.copy();o.data.transform(transform@world)
        o.matrix_world=Matrix.Translation((display_x,0,0));o.name='Tree_'+label+'_'+kind
        o.data.name=o.name+'_SharedMesh'
        for old in list(o.users_collection):old.objects.unlink(o)
        c.objects.link(o)
        o.data.calc_loop_triangles();parts[kind]=len(o.data.loop_triangles)
    for o in list(S.objects):
        if o in before or o in meshes:continue
        bpy.data.objects.remove(o,do_unlink=True)
    images=list(set(bpy.data.images)-images_before)
    for image in images:
        if image.source!='FILE':continue
        width,height_px=image.size;ratio=min(1,512/max(width,height_px))
        if ratio<1:image.scale(max(1,round(width*ratio)),max(1,round(height_px*ratio)))
        image.pack()
    report.append({'variant':label,'source':filename,'source_height_m':height,'parts':parts,
                   'total_triangles':sum(parts.values()),'texture_sizes':[list(i.size) for i in images if i.source=='FILE']})
bpy.ops.object.select_all(action='DESELECT')
for o in S.objects:
    if o.type=='MESH':o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(ROOT/'src/assets/models/trees-natural.glb'),
    export_format='GLB',use_selection=True,export_apply=False,export_cameras=False,export_lights=False)
bpy.ops.object.select_all(action='DESELECT')
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'trees-natural.blend'),compress=True)
report_out={'variants':report,'glb_bytes':(ROOT/'src/assets/models/trees-natural.glb').stat().st_size,
            'source':'C:/Users/Amministratore/Desktop/trees'}
(OUT/'library-report.json').write_text(json.dumps(report_out,indent=2),encoding='utf-8')
print(json.dumps(report_out,indent=2))
