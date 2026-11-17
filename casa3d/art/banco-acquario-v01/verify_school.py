import bpy
from collections import Counter
from itertools import combinations
from mathutils.bvhtree import BVHTree

scene = bpy.context.scene
school = bpy.data.collections["Banco di pesci"]
fish = sorted(school.objects, key=lambda o: o.name)
frames = range(scene.frame_start, scene.frame_end + 1)
original_frame = scene.frame_current
original_subframe = scene.frame_subframe
pairs = Counter()
swim = {f.name: [] for f in fish}
triangle_count = 0
degenerate_triangles = 0
try:
    for frame in frames:
        scene.frame_set(frame)
        graph = bpy.context.evaluated_depsgraph_get()
        colliders = []
        for f in fish:
            obj = f.evaluated_get(graph)
            mesh = obj.data
            coords = [obj.matrix_world @ v.co for v in mesh.vertices]
            bounds = [(min(v[i] for v in coords),max(v[i] for v in coords)) for i in range(3)]
            colliders.append((f.name, bounds, BVHTree.FromPolygons(coords, [tuple(p.vertices) for p in mesh.polygons])))
            swim[f.name].append((tuple(obj.location), f.data.shape_keys.key_blocks["Flessione coda"].value))
            if frame == scene.frame_start:
                mesh.calc_loop_triangles()
                triangle_count += len(mesh.loop_triangles)
                degenerate_triangles += sum(t.area < 1e-12 for t in mesh.loop_triangles)
        for (name_a, a, tree_a), (name_b, b, tree_b) in combinations(colliders, 2):
            if all(x[0] <= y[1] and y[0] <= x[1] for x,y in zip(a,b)) and tree_a.overlap(tree_b):
                pairs[(name_a,name_b)] += 1
finally:
    scene.frame_set(original_frame, subframe=original_subframe)
result = {"triangles": triangle_count, "degenerate":degenerate_triangles, "pair_contacts":[[a,b,n] for (a,b),n in pairs.items()], "frames":len(frames),"swim_preview":{k:[v[0],v[59],v[119],v[179],v[-1]] for k,v in swim.items()},"filepath":bpy.data.filepath}

import json
assert len(fish)==19
assert result["triangles"]==44985
assert result["degenerate"]==0 and not result["pair_contacts"]
print(json.dumps({k:v for k,v in result.items() if k!="swim_preview"},indent=2))
