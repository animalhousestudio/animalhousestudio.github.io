"""Run in background Blender. House-local coordinates; export maps Z-up to Y-up.
The same profile drives the game's walking support. Never opens/edits the mansion.
"""
import bpy
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
p = json.loads((ROOT / 'src/rooms/entryProfile.json').read_text())
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

def material(name, color):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = .92
    return m

stone = material('Entry_Warm_Sandstone', (.36, .29, .21))
tread = material('Entry_Honed_Stone', (.49, .40, .30))
edge = material('Entry_Edge_Stone', (.40, .32, .23))

# Outline in game Z/Y coordinates. A single watertight stepped volume, including
# the landing, replaces stacked cubes and the four oversized original blocks.
outline = [(p['front'], -.03)]
for i in range(p['count']):
    z = p['front'] - i * (p['front'] - p['back']) / p['count']
    h = p['top'] * (i + 1) / p['count']
    outline.extend([(z, h), (z - (p['front']-p['back'])/p['count'], h)])
outline.extend([(p['landingBack'], p['top']), (p['landingBack'], -.03)])

def extrude(name, profile, left, right, materials):
    verts = [(x, -z, h) for x in (left, right) for z, h in profile]
    n = len(profile)
    faces = [tuple(range(n-1, -1, -1)), tuple(range(n, n*2))]
    faces += [(i, (i+1)%n, (i+1)%n+n, i+n) for i in range(n)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    for mat in materials: mesh.materials.append(mat)
    if len(materials)>1:
        for i in range(n):
            if abs(profile[i][1]-profile[(i+1)%n][1])<1e-6:
                mesh.polygons[i+2].material_index=1
    bpy.context.view_layer.objects.active=obj
    obj.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    obj.select_set(False)
    tri=obj.modifiers.new('Export triangulation', 'TRIANGULATE')
    return obj

extrude('Entry_Stairs_And_Landing', outline, p['minX'], p['maxX'], [stone,tread])
# Low sloping stone cheeks terminate flush with the landing, framing the flight
# without adding tall walls or an obstacle on the walking surface.
cheek = [(p['front']+.05,-.03),(p['front']+.05,.035),
         (p['back'],p['top']+.045),(p['landingBack'],p['top']+.045),
         (p['landingBack'],-.03)]
extrude('Entry_Left_Cheek', cheek, p['minX']-.11, p['minX'], [edge])
extrude('Entry_Right_Cheek', cheek, p['maxX'], p['maxX']+.11, [edge])
bpy.ops.object.select_all(action='SELECT')
bpy.ops.wm.save_as_mainfile(filepath=str(Path(__file__).with_name('entry-stairs.blend')))
bpy.ops.export_scene.gltf(filepath=str(ROOT/'src/assets/models/entry-stairs.glb'),
                         export_format='GLB', use_selection=True, export_apply=True)
