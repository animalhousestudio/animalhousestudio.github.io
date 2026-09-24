import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from pathlib import Path
root=Path(__file__).resolve().parents[2]
scene=bpy.context.scene
dome=scene.objects.get('M01_Reuse_ObsDome_Curved')
if dome is None:raise RuntimeError('Observatory dome missing')
glass=bpy.data.materials.new('Observatory_Clear_Glass');glass.use_nodes=True
glass.diffuse_color=(.57,.78,.83,.18)
bsdf=glass.node_tree.nodes.get('Principled BSDF')
bsdf.inputs['Base Color'].default_value=(.57,.78,.83,1)
bsdf.inputs['Alpha'].default_value=.18
bsdf.inputs['Roughness'].default_value=.16
bsdf.inputs['Metallic'].default_value=.08
if hasattr(glass,'surface_render_method'):glass.surface_render_method='DITHERED'
dome.data=dome.data.copy();dome.data.materials.clear();dome.data.materials.append(glass)
# Move shared ivy modules just outside the curved cladding. No leaf mesh copies.
vertices=[];faces=[]
for o in scene.objects:
    if o.type!='MESH' or 'Clapboard' not in o.name:continue
    off=len(vertices);vertices.extend(o.matrix_world@v.co for v in o.data.vertices)
    faces.extend(tuple(off+i for i in p.vertices) for p in o.data.polygons)
wall=BVHTree.FromPolygons(vertices,faces)
adjusted=[]
for o in scene.objects:
    if not o.name.startswith('M04_Ivy_Pier') or o.type!='MESH':continue
    normal=o.matrix_world.to_3x3()@Vector((0,1,0));normal.normalize()
    shift=0
    for v in o.data.vertices:
        point=o.matrix_world@v.co
        hit,n,idx,dist=wall.ray_cast(point+normal*1.5,-normal,3)
        if hit is not None:shift=max(shift,1.5-dist+.035)
    if shift>.005:
        o.location+=normal*shift;adjusted.append((o.name,round(shift,3)))
bpy.ops.wm.save_as_mainfile(filepath=str(root/'art/mansion-v04/mansion-v04-polished.blend'),compress=True)
bpy.ops.object.select_all(action='DESELECT')
curves=[o for o in scene.objects if o.type=='CURVE' and not o.hide_render and not any('Presentation' in c.name for c in o.users_collection)]
if curves:
    for o in curves:o.hide_set(False);o.select_set(True)
    bpy.context.view_layer.objects.active=curves[0];bpy.ops.object.convert(target='MESH')
bpy.ops.object.select_all(action='DESELECT')
for o in scene.objects:
    if o.type=='MESH' and not o.hide_render and not any('Presentation' in c.name for c in o.users_collection):o.hide_set(False);o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(root/'src/assets/models/mansion-v04.glb'),export_format='GLB',use_selection=True,export_apply=True,export_extras=False,export_cameras=False,export_lights=False)
result={'dome':dome.name,'ivy_adjusted':adjusted}
