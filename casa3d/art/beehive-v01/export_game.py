import bpy, os, math, json
import numpy as np
from mathutils import Vector
ROOT=r"C:\Users\Amministratore\y.worktrees\copilot-worktrees\animalhousestudio.github.io\animalhousestudio-expert-fortnight"
ART=os.path.join(ROOT,"casa3d","art","beehive-v01")
OUTPUT=os.path.join(ROOT,"casa3d","src","assets","models","props","beehive-dreamy.glb")
os.makedirs(ART,exist_ok=True)
source=bpy.context.scene
assert source.name.startswith("Alveare"),"Expected the authored beehive scene"
if not os.path.exists(os.path.join(ART,"beehive-dreamy.blend")):
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ART,"beehive-dreamy.blend"),copy=True)
sources=[o for c in source.collection.children if not c.name.startswith("05") for o in c.objects if o.type in {'MESH','CURVE'}]
depsgraph=bpy.context.evaluated_depsgraph_get()
game=bpy.data.scenes.new("Alveare • export gioco")
exported=[]
material_cache={}
def export_material(material):
    if material.name in material_cache:return material_cache[material.name]
    copy=material.copy();copy.name="Hive_"+material.name
    nodes=copy.node_tree.nodes
    ramp=next((n for n in material.node_tree.nodes if n.type=='VALTORGB'),None)
    if ramp:
        # Compact directional grain image: portable glTF colour texture.
        lo=np.array(ramp.color_ramp.elements[0].color[:3])
        hi=np.array(ramp.color_ramp.elements[-1].color[:3])
        w,h=512,256
        u=np.linspace(0,1,w)[None,:];v=np.linspace(0,1,h)[:,None]
        wave=v*88+2.0*np.sin(u*8+np.sin(v*5))+0.7*np.sin(u*21+v*9)
        grain=.50+.21*np.sin(wave)+.085*np.sin(wave*3.7)+.04*np.sin(wave*13.3)
        grain=np.clip(grain,0,1)
        rgb=lo[None,None,:]+(hi-lo)[None,None,:]*grain[:,:,None]
        rgba=np.ones((h,w,4),dtype=np.float32);rgba[:,:,:3]=rgb
        image=bpy.data.images.new(copy.name+"_grain",width=w,height=h,alpha=False)
        image.pixels.foreach_set(rgba.ravel())
        image.update()
        image.filepath_raw=os.path.join(ART,("Hive_"+material.name).replace(" • ","_").replace(" ","_")+".png")
        image.file_format='PNG';image.save();image.pack()
        nodes.clear()
        out=nodes.new('ShaderNodeOutputMaterial')
        shader=nodes.new('ShaderNodeBsdfPrincipled')
        shader.inputs['Roughness'].default_value=.52
        tex=nodes.new('ShaderNodeTexImage');tex.image=image
        copy.node_tree.links.new(tex.outputs['Color'],shader.inputs['Base Color'])
        copy.node_tree.links.new(shader.outputs['BSDF'],out.inputs['Surface'])
    material_cache[material.name]=copy
    return copy, bool(ramp)

# Preserve original object geometry/materials, evaluating only independent copies.
for obj in sources:
    evaluated=obj.evaluated_get(depsgraph)
    mesh=bpy.data.meshes.new_from_object(evaluated,preserve_all_data_layers=True,depsgraph=depsgraph)
    copy=bpy.data.objects.new("Hive_"+obj.name,mesh);game.collection.objects.link(copy)
    copy.matrix_world=obj.matrix_world.copy()
    original_materials=list(mesh.materials);mesh.materials.clear()
    wood=False
    for material in original_materials:
        material = material or obj.active_material
        if material is None:
            continue
        if material.name not in material_cache:
            output=export_material(material)
            wood=wood or (isinstance(output,tuple) and output[1])
        else:wood=wood or any(n.type=='VALTORGB' for n in material.node_tree.nodes)
        mesh.materials.append(material_cache[material.name])
    if wood:
        uv=mesh.uv_layers.active or mesh.uv_layers.new(name='UVMap')
        bounds=np.array([v.co[:] for v in mesh.vertices])
        lo=bounds.min(axis=0);extent=np.maximum(bounds.max(axis=0)-lo,1e-6)
        grain_axis=int(np.argmax(extent))
        for poly in mesh.polygons:
            face_axis=max(range(3),key=lambda a:abs(poly.normal[a]))
            axes=[a for a in range(3) if a!=face_axis]
            primary=grain_axis if grain_axis in axes else axes[0]
            secondary=next(a for a in axes if a!=primary)
            for loop_idx in poly.loop_indices:
                co=mesh.vertices[mesh.loops[loop_idx].vertex_index].co
                uv.data[loop_idx].uv=((co[primary]-lo[primary])/extent[primary],(co[secondary]-lo[secondary])/extent[secondary])
    exported.append(copy)
bpy.context.window.scene=game
try:
    # Merge independent static pieces by material: a compact prop, no studio.
    groups={}
    for obj in exported:
        key=obj.data.materials[0].name if obj.data.materials else 'Unpainted'
        groups.setdefault(key,[]).append(obj)
    merged=[]
    for name,objects in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for obj in objects:obj.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]
        bpy.ops.object.join()
        obj=bpy.context.object;obj.name=name
        merged.append(obj)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in merged:obj.select_set(True)
    bpy.context.view_layer.objects.active=merged[0]
    bpy.ops.export_scene.gltf(filepath=OUTPUT,export_format='GLB',use_selection=True,use_active_scene=True,
        export_yup=True,export_apply=True,export_animations=False,export_cameras=False,export_lights=False,
        export_extras=False,export_materials='EXPORT')
    vertices=sum(len(o.data.vertices) for o in merged)
    triangles=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in merged)
    report={"source":"beehive-dreamy.blend","output":"../../src/assets/models/props/beehive-dreamy.glb",
      "objects":len(merged),"vertices":vertices,"triangles":triangles,"bytes":os.path.getsize(OUTPUT),
      "materials":len(material_cache),"front":"+Z in glTF","authoringAxes":"Blender Z-up, front -Y",
      "notes":"Authoring scene preserved. Studio excluded. Wood colour textures embedded. Two side bee badges retained."}
    with open(os.path.join(ART,"export.json"),'w',encoding='utf-8') as f:json.dump(report,f,ensure_ascii=False,indent=2)
finally:
    bpy.context.window.scene=source
result={"status":"exported","file":OUTPUT,"report":report}

