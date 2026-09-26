"""Import the supplied two rocks as a small reusable, packed asset library."""
import bpy, bmesh, math, json
from pathlib import Path
from mathutils import Matrix, Vector

OUT=Path(__file__).resolve().parent;OUT.mkdir(parents=True,exist_ok=True)
ROOT=OUT.parents[1];SOURCE=Path('C:/Users/Amministratore/Desktop/rocks')
house=bpy.context.scene
scene=bpy.data.scenes.new('Rocks_v01_Library');bpy.context.window.scene=scene
bpy.ops.import_scene.fbx(filepath=str(SOURCE/'rock.fbx'))
rock_a=next(o for o in scene.objects if o.type=='MESH')
before=set(scene.objects)
bpy.ops.wm.obj_import(filepath=str(SOURCE/'Rock1/Rock1.obj'))
rock_b=next(o for o in scene.objects if o not in before and o.type=='MESH' and len(o.data.polygons)>1)
for o in list(scene.objects):
    if o not in [rock_a,rock_b]:bpy.data.objects.remove(o,do_unlink=True)
# The older OBJ contains a Y-up rock and an exhibition plane. Only the rock is used.
rock_b.matrix_world=Matrix.Rotation(math.pi/2,4,'X')@rock_b.matrix_world
bpy.context.view_layer.update()

def texture(path,name,noncolor=False):
    image=bpy.data.images.load(str(path),check_existing=False);image.name=name
    if noncolor:image.colorspace_settings.name='Non-Color'
    width,height=image.size;scale=min(1,1024/max(width,height))
    if scale<1:image.scale(round(width*scale),round(height*scale))
    image.pack();return image

def material(name,color_path,normal=None,ao=None):
    m=bpy.data.materials.new(name);m.use_nodes=True;n=m.node_tree.nodes;links=m.node_tree.links
    bs=n.get('Principled BSDF');bs.inputs['Roughness'].default_value=.87;bs.inputs['Metallic'].default_value=0
    tex=n.new('ShaderNodeTexImage');tex.image=texture(color_path,name+'_BaseColor')
    links.new(tex.outputs['Color'],bs.inputs['Base Color'])
    if normal:
        tex=n.new('ShaderNodeTexImage');tex.image=texture(normal,name+'_Normal',True)
        nm=n.new('ShaderNodeNormalMap');links.new(tex.outputs['Color'],nm.inputs['Color']);links.new(nm.outputs['Normal'],bs.inputs['Normal'])
    if ao:
        group=bpy.data.node_groups.new('glTF Material Output','ShaderNodeTree')
        group.interface.new_socket(name='Occlusion',in_out='INPUT',socket_type='NodeSocketFloat')
        output=n.new('ShaderNodeGroup');output.node_tree=group
        tex=n.new('ShaderNodeTexImage');tex.image=texture(ao,name+'_Occlusion',True)
        links.new(tex.outputs['Color'],output.inputs['Occlusion'])
    return m

mats=[material('Rock_A_Stone',SOURCE/'initialShadingGroup_Base_Color.png',SOURCE/'rock_normals.jpg',SOURCE/'rock_occlusion.jpg'),
      material('Rock_B_Stone',SOURCE/'Rock1/Rock-Texture-Surface.jpg')]
report=[]
for i,(o,mat) in enumerate(zip([rock_a,rock_b],mats)):
    o.name='Rock_A' if i==0 else 'Rock_B'
    o.data.transform(o.matrix_world);o.matrix_world=Matrix.Identity(4)
    xs=[v.co.x for v in o.data.vertices];ys=[v.co.y for v in o.data.vertices];zs=[v.co.z for v in o.data.vertices]
    center=Vector(((min(xs)+max(xs))/2,(min(ys)+max(ys))/2,min(zs)))
    width=max(max(xs)-min(xs),max(ys)-min(ys))
    for v in o.data.vertices:v.co=(v.co-center)/width
    o.data.materials.clear();o.data.materials.append(mat)
    bm=bmesh.new();bm.from_mesh(o.data)
    bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-6)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free()
    for f in o.data.polygons:f.material_index=0;f.use_smooth=True
    o.data.name=o.name+'_SharedMesh';o.location.x=(i-.5)*1.3
    o['source_file']='rock.fbx' if i==0 else 'Rock1/Rock1.obj'
    o.data.calc_loop_triangles();report.append(dict(name=o.name,triangles=len(o.data.loop_triangles),width=1))
bpy.context.view_layer.update()
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(ROOT/'src/assets/models/rocks-natural.glb'),export_format='GLB',
    use_selection=True,export_apply=False,export_image_format='JPEG',export_jpeg_quality=88,
    export_cameras=False,export_lights=False,export_extras=False)
bpy.data.libraries.write(str(OUT/'rocks-natural.blend'),{scene},path_remap='RELATIVE_ALL',fake_user=True,compress=True)
(OUT/'import-report.json').write_text(json.dumps(dict(source=str(SOURCE),variants=report,texture_limit=1024),indent=2),encoding='utf-8')
bpy.context.window.scene=house
for o in list(scene.objects):bpy.data.objects.remove(o,do_unlink=True)
bpy.data.scenes.remove(scene)
result={'variants':report,'output':str(ROOT/'src/assets/models/rocks-natural.glb')}
