"""Check Blender import and geometry without changing the house."""
import bpy, json
from pathlib import Path
from mathutils import Vector

source=Path('C:/Users/Amministratore/Desktop/trees')
report=[]
for file in sorted(source.glob('*.glb')):
    before=set(bpy.context.scene.objects)
    try:
        bpy.ops.import_scene.gltf(filepath=str(file))
        imported=[o for o in bpy.context.scene.objects if o not in before]
        meshes=[o for o in imported if o.type=='MESH']
        bpy.context.view_layer.update()
        verts=[o.matrix_world@v.co for o in meshes for v in o.data.vertices]
        item={'file':file.name,'imported':True,'objects':len(imported),'meshes':len(meshes),
              'triangles':sum(len(o.data.loop_triangles) for o in meshes),
              'bounds':[[min(v[i] for v in verts),max(v[i] for v in verts)] for i in range(3)],
              'mesh_names':[o.name for o in meshes]}
    except Exception as exc:item={'file':file.name,'imported':False,'error':repr(exc)}
    report.append(item)
    for o in list(bpy.context.scene.objects):
        if o not in before:bpy.data.objects.remove(o,do_unlink=True)
out=Path(__file__).with_name('blender-import-report.json')
out.write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report,indent=2))
