import bpy,json
from pathlib import Path
bpy.ops.import_scene.gltf(filepath='C:/Users/Amministratore/Desktop/trees/tree (2).glb')
result={}
for o in bpy.context.scene.objects:
    if o.type!='MESH':continue
    result[o.name]={'tris':len(o.data.loop_triangles),'materials':[m.name for m in o.data.materials],
                    'uv_layers':[x.name for x in o.data.uv_layers]}
for image in bpy.data.images:
    if image.source!='FILE':continue
    result['image_'+image.name]={'size':list(image.size),'channels':image.channels,'packed':bool(image.packed_file),
                                  'filepath':image.filepath}
print(json.dumps(result,indent=2))
