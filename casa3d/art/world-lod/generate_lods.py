"""Rebuild the two approved props' LODs; originals are never overwritten.

Run with Blender 5.2: blender --background --factory-startup --python generate_lods.py
The source glTF hierarchy, transforms and material definitions are copied verbatim;
only mesh accessors/buffers and the far hive's embedded images are replaced.
"""
import copy
import hashlib
import itertools
import json
from pathlib import Path
import struct
import tempfile

import bpy
import bmesh
import numpy as np
from mathutils import Matrix, Quaternion, Vector

ART = Path(__file__).resolve().parent
REPO = ART.parents[2]
MODELS = REPO / "casa3d/src/assets/models"
OUTPUT = MODELS / "lod"
ASSETS = {
    "fountain": "triton-chocolate-fountain",
    "beehive": "beehive-dreamy",
}
TIERS = {
    "medium": {"ratio": .20, "textureMaxSize": None},
    "far": {"ratio": .05, "textureMaxSize": 128},
}


def read_glb(path):
    raw = Path(path).read_bytes()
    magic, version, length = struct.unpack_from("<4sII", raw)
    assert magic == b"glTF" and version == 2 and length == len(raw)
    offset, document, binary = 12, None, None
    while offset < length:
        size, kind = struct.unpack_from("<II", raw, offset)
        payload = raw[offset + 8:offset + 8 + size]
        if kind == 0x4E4F534A:
            document = json.loads(payload)
        elif kind == 0x004E4942:
            binary = payload
        offset += 8 + size
    assert document is not None and binary is not None
    return document, binary


def write_glb(path, document, binary):
    encoded = json.dumps(document, ensure_ascii=False, separators=(",", ":")).encode("utf8")
    encoded += b" " * (-len(encoded) % 4)
    binary = bytes(binary) + b"\0" * (-len(binary) % 4)
    total = 12 + 8 + len(encoded) + 8 + len(binary)
    Path(path).write_bytes(struct.pack("<4sII", b"glTF", 2, total)
                          + struct.pack("<II", len(encoded), 0x4E4F534A) + encoded
                          + struct.pack("<II", len(binary), 0x004E4942) + binary)


def node_matrix(node):
    if "matrix" in node:
        return Matrix(np.array(node["matrix"]).reshape(4, 4).T.tolist())
    x, y, z, w = node.get("rotation", [0, 0, 0, 1])
    return Matrix.LocRotScale(Vector(node.get("translation", [0, 0, 0])),
                              Quaternion((w, x, y, z)), Vector(node.get("scale", [1, 1, 1])))


def world_matrices(document):
    result = {}

    def visit(index, parent):
        matrix = parent @ node_matrix(document["nodes"][index])
        result[index] = matrix
        for child in document["nodes"][index].get("children", []):
            visit(child, matrix)

    for root in document["scenes"][document.get("scene", 0)]["nodes"]:
        visit(root, Matrix.Identity(4))
    return result


def accessor_array(document, binary, index):
    accessor = document["accessors"][index]
    view = document["bufferViews"][accessor["bufferView"]]
    dtype = {5121: "u1", 5123: "<u2", 5125: "<u4", 5126: "<f4"}[accessor["componentType"]]
    width = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}[accessor["type"]]
    itemsize = np.dtype(dtype).itemsize
    return np.ndarray((accessor["count"], width), dtype=dtype, buffer=binary,
                      offset=view.get("byteOffset", 0) + accessor.get("byteOffset", 0),
                      strides=(view.get("byteStride", itemsize * width), itemsize))


def measure(path):
    document, binary = read_glb(path)
    all_boxes, all_points, triangles, vertices = [], [], 0, 0
    for node_index, matrix in world_matrices(document).items():
        node = document["nodes"][node_index]
        if "mesh" not in node:
            continue
        transform = np.array(matrix, dtype=np.float64)
        for primitive in document["meshes"][node["mesh"]]["primitives"]:
            assert primitive.get("mode", 4) == 4
            position = accessor_array(document, binary, primitive["attributes"]["POSITION"])
            assert np.isfinite(position).all()
            vertices += len(position)
            triangles += (document["accessors"][primitive["indices"]]["count"]
                          if "indices" in primitive else len(position)) // 3
            bounds = np.array(list(itertools.product(*zip(position.min(axis=0), position.max(axis=0)))))
            all_boxes.append(bounds @ transform[:3, :3].T + transform[:3, 3])
            all_points.append(position @ transform[:3, :3].T + transform[:3, 3])

    def bounds(rows):
        joined = np.concatenate(rows)
        return {"min": joined.min(axis=0).tolist(), "max": joined.max(axis=0).tolist()}

    raw = Path(path).read_bytes()
    return {"path": Path(path).relative_to(REPO).as_posix(), "sha256": hashlib.sha256(raw).hexdigest(),
            "bytes": len(raw), "triangles": triangles, "vertices": vertices,
            "nodes": len(document["nodes"]), "materials": len(document["materials"]),
            "bounds": bounds(all_boxes), "tightBounds": bounds(all_points)}


def pack_tier(source, reduced, target, resized_images):
    original, original_binary = read_glb(source)
    exported, exported_binary = read_glb(reduced)
    result = copy.deepcopy(original)
    result["accessors"], result["bufferViews"] = [], []
    result["asset"]["generator"] = "Animal House approved prop LODs / Blender " + bpy.app.version_string
    binary, views, accessors = bytearray(), {}, {}

    def append_view(payload, template=None):
        binary.extend(b"\0" * (-len(binary) % 4))
        view = copy.deepcopy(template or {})
        view.update(buffer=0, byteOffset=len(binary), byteLength=len(payload))
        result["bufferViews"].append(view)
        binary.extend(payload)
        return len(result["bufferViews"]) - 1

    def copy_accessor(index):
        if index in accessors:
            return accessors[index]
        accessor = copy.deepcopy(exported["accessors"][index])
        assert "sparse" not in accessor
        view_index = accessor["bufferView"]
        if view_index not in views:
            view = exported["bufferViews"][view_index]
            start = view.get("byteOffset", 0)
            views[view_index] = append_view(exported_binary[start:start + view["byteLength"]], view)
        accessor["bufferView"] = views[view_index]
        result["accessors"].append(accessor)
        accessors[index] = len(result["accessors"]) - 1
        return accessors[index]

    exported_nodes = {node["name"]: node for node in exported["nodes"]}
    for node in original["nodes"]:
        if "mesh" not in node:
            continue
        replacement = exported_nodes[node["name"]]
        # Blender's axis conversion may round floats but must not move the model.
        error = np.abs(np.array(node_matrix(node)) - np.array(node_matrix(replacement))).max()
        assert error < 2e-6, (node["name"], "transform drift", error)
        source_primitives = original["meshes"][node["mesh"]]["primitives"]
        replacements = exported["meshes"][replacement["mesh"]]["primitives"]
        assert len(source_primitives) == len(replacements) == 1
        primitive = copy.deepcopy(replacements[0])
        primitive["attributes"] = {key: copy_accessor(index) for key, index in primitive["attributes"].items()}
        primitive["indices"] = copy_accessor(primitive["indices"])
        primitive["material"] = source_primitives[0]["material"]
        assert {"POSITION", "NORMAL", "TEXCOORD_0"}.issubset(primitive["attributes"])
        result["meshes"][node["mesh"]]["primitives"] = [primitive]

    for index, image in enumerate(result.get("images", [])):
        source_image = original["images"][index]
        view = original["bufferViews"][source_image["bufferView"]]
        start = view.get("byteOffset", 0)
        payload = resized_images.get(index, original_binary[start:start + view["byteLength"]])
        image["bufferView"] = append_view(payload)
    result["buffers"] = [{"byteLength": len(binary)}]
    assert result["nodes"] == original["nodes"] and result["scenes"] == original["scenes"]
    assert result["materials"] == original["materials"]
    write_glb(target, result, binary)


def generate(source, target, settings, temp):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(source), merge_vertices=True)
    objects = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    per_mesh = []
    for obj in objects:
        bpy.context.view_layer.objects.active = obj
        before = sum(len(face.vertices) - 2 for face in obj.data.polygons)
        # Evaluate error in world units even for highly non-uniform authored scale.
        world = obj.matrix_world.copy()
        obj.data.transform(world)
        # The authored exports contain split coincident vertices. Weld geometry
        # only within a microscopic tolerance; UV seams remain loop attributes.
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-6)
        bmesh.ops.dissolve_degenerate(bm, edges=list(bm.edges), dist=1e-8)
        bm.to_mesh(obj.data)
        bm.free()
        obj.data.validate(clean_customdata=False)
        modifier = obj.modifiers.new("Offline LOD simplification", "DECIMATE")
        modifier.decimate_type = "COLLAPSE"
        modifier.ratio = settings["ratio"]
        modifier.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        obj.data.validate(clean_customdata=False)
        obj.data.transform(world.inverted())
        after = sum(len(face.vertices) - 2 for face in obj.data.polygons)
        per_mesh.append({"name": obj.name, "before": before, "after": after})

    resized_images, image_report = {}, []
    original, _ = read_glb(source)
    for index, image in enumerate(original.get("images", [])):
        loaded = bpy.data.images.get(image["name"])
        assert loaded is not None
        before = list(loaded.size)
        maximum = settings["textureMaxSize"]
        if maximum and max(before) > maximum:
            factor = maximum / max(before)
            loaded.scale(max(1, round(before[0] * factor)), max(1, round(before[1] * factor)))
            loaded.filepath_raw = str(temp / (str(index) + ".png"))
            loaded.file_format = "PNG"
            loaded.save()
            resized_images[index] = Path(loaded.filepath_raw).read_bytes()
        image_report.append({"name": image["name"], "originalSize": before, "size": list(loaded.size)})

    intermediate = temp / "reduced.glb"
    bpy.ops.export_scene.gltf(filepath=str(intermediate), export_format="GLB", export_yup=True,
                              export_apply=False, export_animations=False, export_cameras=False,
                              export_lights=False, export_extras=False, export_materials="EXPORT")
    pack_tier(source, intermediate, target, resized_images)
    measured = measure(target)
    measured.update(settings=settings, meshReduction=per_mesh, textures=image_report,
                    preserved={"nodesAndHierarchy": True, "authoredTransforms": True,
                               "materialDefinitions": True, "uvAttribute": True})
    return measured


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    manifest = {"schemaVersion": 1, "generator": "casa3d/art/world-lod/generate_lods.py",
                "blenderVersion": bpy.app.version_string, "coordinateSystem": "glTF Y-up",
                "boundsPolicy": "Union of local primitive AABBs transformed to world; matches Three.Box3.setFromObject default",
                "simplification": "Blender COLLAPSE decimation in world metric, triangulated; original material JSON and node transforms retained",
                "assets": {}}
    metadata = {}
    with tempfile.TemporaryDirectory(prefix="animal-house-lod-") as work:
        for key, basename in ASSETS.items():
            source = MODELS / "props" / (basename + ".glb")
            asset = {"source": measure(source), "tiers": {}}
            for tier, settings in TIERS.items():
                target = OUTPUT / (basename + "-" + tier + ".glb")
                asset["tiers"][tier] = generate(source, target, settings, Path(work))
                reduction = asset["tiers"][tier]["triangles"] / asset["source"]["triangles"]
                maximum = .25 if tier == "medium" else (.10 if key == "beehive" else .065)
                assert (.15 if tier == "medium" else .03) <= reduction <= maximum, (key, tier, reduction)
                print("LOD_RESULT", key, tier, asset["tiers"][tier]["triangles"], flush=True)
            assert measure(source)["sha256"] == asset["source"]["sha256"]
            if key == "beehive":
                asset["farBudgetException"] = "The honeycomb contains disconnected hexagonal cells. Retain their shape at the decimator's safe minimum rather than delete cells to force a 5% total. Actual far tier remains below 10%."
            manifest["assets"][key] = asset
            metadata[key] = {
                "bounds": asset["source"]["bounds"],
                "triangles": {"near": asset["source"]["triangles"], **{tier: item["triangles"] for tier, item in asset["tiers"].items()}},
                "bytes": {"near": asset["source"]["bytes"], **{tier: item["bytes"] for tier, item in asset["tiers"].items()}},
            }
    (ART / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
    (OUTPUT / "metadata.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf8")


if __name__ == "__main__":
    main()
