"""Export the approved Blender school as local, +Z-forward fish meshes."""
import bpy
from hashlib import sha256
import json
from math import pi
from mathutils import Matrix
from pathlib import Path
import sys

output = Path(sys.argv[sys.argv.index("--") + 1])
school = bpy.data.collections["Banco di pesci"]
fish = sorted(school.objects, key=lambda o: o.name)
assert len(fish) == 19
bpy.ops.object.select_all(action="DESELECT")
copies = []
for i, source in enumerate(fish, 1):
    obj = bpy.data.objects.new(f"Fish_{i:02d}", source.data.copy())
    bpy.context.scene.collection.objects.link(obj)
    obj.shape_key_clear()
    obj.data.transform(Matrix.Rotation(-pi / 2, 4, "Z") @ Matrix.Diagonal((*source.scale, 1)))
    shared = obj.data.materials[obj.data.polygons[0].material_index]
    obj.data.materials.clear()
    obj.data.materials.append(shared)
    for p in obj.data.polygons:
        p.material_index = 0
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    if len(obj.data.vertices) > 1000:
        # Retain extra detail on the small, high-contrast markings.
        decimate = obj.modifiers.new("Runtime silhouette", "DECIMATE")
        decimate.ratio = .43 if len(obj.data.vertices) > 4000 else .55
        decimate.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=decimate.name)
    obj.data.color_attributes.active_color = obj.data.color_attributes["Livrea"]
    obj.data.calc_loop_triangles()
    copies.append({"id": obj.name, "species": source.get("Tipo di pesce"),
                   "triangles": len(obj.data.loop_triangles)})
bpy.ops.export_scene.gltf(filepath=str(output), export_format="GLB", use_selection=True,
    export_animations=False, export_skins=False, export_morph=False, export_texcoords=False,
    export_vertex_color="ACTIVE", export_image_format="NONE")
payload = output.read_bytes()
manifest = {"file": output.name, "sha256": sha256(payload).hexdigest(),
            "source_sha256": sha256(Path(bpy.data.filepath).read_bytes()).hexdigest(),
            "bytes": len(payload), "fish": copies, "triangles": sum(o["triangles"] for o in copies),
            "textures": 0, "materials": 1, "forward": "+Z", "unit": "metre"}
output.with_name("runtime-export.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf8")
print(json.dumps(manifest))
