"""Export only the approved stage; bake wood colour without studio lighting.

Run in a background Blender process loading garden-stage.blend. The source
is not saved or modified. All export inputs and hashes are recorded locally.
"""
import bpy
import hashlib
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parent
OUTPUT=ROOT.parents[1]/'src/assets/models/props/garden-stage.glb'
OUTPUT.parent.mkdir(parents=True,exist_ok=True)
(ROOT/'textures').mkdir(exist_ok=True)
scene=bpy.data.scenes['GardenStage_Review']
bpy.context.window.scene=scene
asset=bpy.data.collections['GardenStage_ASSET']
scene.render.engine='CYCLES'
scene.cycles.samples=1
scene.render.bake.margin=4
for o in bpy.context.selected_objects: o.select_set(False)
bpy.ops.mesh.primitive_plane_add(size=1)
plane=bpy.context.object
plane.name='ExportWoodBakePlane'
textures=[]
wood_materials=[m for m in bpy.data.materials if m.name.startswith('Stage_Walnut_')]
for material in wood_materials:
    bake=material.copy()
    plane.data.materials.clear()
    plane.data.materials.append(bake)
    nt=bake.node_tree
    ramp=next(n for n in nt.nodes if n.type=='VALTORGB')
    emission=nt.nodes.new('ShaderNodeEmission')
    nt.links.new(ramp.outputs['Color'],emission.inputs['Color'])
    nt.links.new(emission.outputs[0],nt.nodes.get('Material Output').inputs['Surface'])
    image=bpy.data.images.new(material.name+'_BaseColor',512,512,alpha=False)
    image.colorspace_settings.name='sRGB'
    target=nt.nodes.new('ShaderNodeTexImage')
    target.image=image
    nt.nodes.active=target
    bpy.context.view_layer.objects.active=plane
    plane.select_set(True)
    bpy.ops.object.bake(type='EMIT')
    image.filepath_raw=str(ROOT/'textures'/(material.name+'.png'))
    image.file_format='PNG'
    image.save()
    # Replace procedural nodes in this background process only.
    nt=material.node_tree
    nt.nodes.clear()
    bs=nt.nodes.new('ShaderNodeBsdfPrincipled')
    bs.inputs['Roughness'].default_value=.64
    tex=nt.nodes.new('ShaderNodeTexImage')
    tex.image=image
    output=nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(tex.outputs['Color'],bs.inputs['Base Color'])
    nt.links.new(bs.outputs['BSDF'],output.inputs['Surface'])
    textures.append({'material':material.name,'file':'textures/'+Path(image.filepath_raw).name,
                     'size':[512,512],'sha256':hashlib.sha256(Path(image.filepath_raw).read_bytes()).hexdigest()})
    bpy.data.materials.remove(bake)
bpy.data.objects.remove(plane,do_unlink=True)

for obj in asset.objects:
    if obj.type!='MESH' or not any(m in wood_materials for m in obj.data.materials): continue
    mesh=obj.data
    uv=mesh.uv_layers.active or mesh.uv_layers.new(name='UVMap')
    low=[min(v.co[i] for v in mesh.vertices) for i in range(3)]
    high=[max(v.co[i] for v in mesh.vertices) for i in range(3)]
    for face in mesh.polygons:
        normal=face.normal
        axes=(0,1) if abs(normal.z)>.5 else (0,2) if abs(normal.y)>.5 else (1,2)
        for idx in face.loop_indices:
            v=mesh.vertices[mesh.loops[idx].vertex_index].co
            uv.data[idx].uv=[(v[a]-low[a])/max(1e-9,high[a]-low[a]) for a in axes]

for obj in bpy.context.selected_objects: obj.select_set(False)
for obj in asset.objects: obj.select_set(True)
bpy.context.view_layer.objects.active=bpy.data.objects['GardenStage']
bpy.ops.export_scene.gltf(filepath=str(OUTPUT),export_format='GLB',
    use_selection=True,use_active_scene=True,export_apply=True,
    export_animations=False,export_cameras=False,export_lights=False,
    export_extras=False,export_yup=True)
data=OUTPUT.read_bytes()
doc=json.loads(data[20:20+int.from_bytes(data[12:16],'little')])
report={'source':'garden-stage.blend',
    'sourceSha256':hashlib.sha256((ROOT/'garden-stage.blend').read_bytes()).hexdigest(),
    'output':'../../src/assets/models/props/garden-stage.glb','sha256':hashlib.sha256(data).hexdigest(),
    'bytes':len(data),'meshCount':len(doc['meshes']),'materialCount':len(doc['materials']),
    'textures':textures,'triangles':sum(doc['accessors'][p['indices']]['count']//3 for m in doc['meshes'] for p in m['primitives']),
    'axisConversion':'Blender Z up / -Y front -> glTF Y up / +Z front',
    'approval':'User: ok, ora inseriamolo ... (2026-10-05)',
    'scope':'Local runtime integration; no publication'}
(ROOT/'export-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report))
