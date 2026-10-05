"""Read-only provenance/structure checks using the Python standard library.

python casa3d/art/world-lod/verify_assets.py
"""
import hashlib
import json
from pathlib import Path
import struct

ART = Path(__file__).resolve().parent
REPO = ART.parents[2]
manifest = json.loads((ART / "manifest.json").read_text(encoding="utf8"))
metadata = json.loads((REPO / "casa3d/src/assets/models/lod/metadata.json").read_text(encoding="utf8"))


def inspect(record):
    raw = (REPO / record["path"]).read_bytes()
    assert len(raw) == record["bytes"], record["path"]
    assert hashlib.sha256(raw).hexdigest() == record["sha256"], record["path"]
    magic, version, size, json_size, kind = struct.unpack_from("<4sIIII", raw)
    assert magic == b"glTF" and version == 2 and size == len(raw) and kind == 0x4E4F534A
    document = json.loads(raw[20:20 + json_size])
    triangles = 0
    for node in document["nodes"]:
        if "mesh" not in node:
            continue
        for primitive in document["meshes"][node["mesh"]]["primitives"]:
            assert primitive.get("mode", 4) == 4
            assert {"POSITION", "NORMAL", "TEXCOORD_0"}.issubset(primitive["attributes"])
            triangles += document["accessors"][primitive["indices"]]["count"] // 3
    assert triangles == record["triangles"]
    return document


report = {}
for name, asset in manifest["assets"].items():
    source = inspect(asset["source"])
    assert metadata[name]["bounds"] == asset["source"]["bounds"]
    assert metadata[name]["triangles"]["near"] == asset["source"]["triangles"]
    assert metadata[name]["bytes"]["near"] == asset["source"]["bytes"]
    report[name] = {}
    for tier, record in asset["tiers"].items():
        actual = inspect(record)
        for field in ("nodes", "scenes", "scene", "materials", "textures", "samplers"):
            assert actual.get(field) == source.get(field), (name, tier, field)
        assert metadata[name]["triangles"][tier] == record["triangles"]
        assert metadata[name]["bytes"][tier] == record["bytes"]
        report[name][tier] = {
            "sha256Matches": True, "sourceHashUnchanged": True, "nodesAndTransformsIdentical": True,
            "materialsAndSamplersIdentical": True, "uvAndNormalAttributesPresent": True,
            "metadataMatches": True, "triangles": record["triangles"], "bytes": record["bytes"],
        }
print(json.dumps(report, indent=2))
