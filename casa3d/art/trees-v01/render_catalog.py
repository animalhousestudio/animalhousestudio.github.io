"""Make a temporary visual contact sheet for selecting authored tree assets."""
import bpy
from pathlib import Path
from mathutils import Vector,Matrix
S=bpy.context.scene
names=['tree.glb','tree (2).glb','tree (3).glb','tree (4).glb','tree (5).glb','tree (1).glb']
for i,name in enumerate(names):
    before=set(S.objects)
    bpy.ops.import_scene.gltf(filepath=str(Path('C:/Users/Amministratore/Desktop/trees')/name))
    objects=[o for o in S.objects if o not in before and o.type=='MESH']
    bpy.context.view_layer.update()
    points=[o.matrix_world@v.co for o in objects for v in o.data.vertices]
    lo=[min(v[k] for v in points) for k in range(3)]
    hi=[max(v[k] for v in points) for k in range(3)]
    center=Vector(((lo[0]+hi[0])/2,(lo[1]+hi[1])/2,lo[2]))
    position=Vector(([-8,0,8][i%3],8 if i>=3 else -2,0))
    transform=Matrix.Translation(position)@Matrix.Scale(7/(hi[2]-lo[2]),4)@Matrix.Translation(-center)
    for o in objects:
        world=o.matrix_world.copy();o.parent=None;o.matrix_world=transform@world
        for material in o.data.materials:
            if material and material.use_nodes and 'leaf' in material.name.lower():material.diffuse_color=(.21,.38,.17,1)
        o.name='Catalog_'+name+'_'+o.name
camera_data=bpy.data.cameras.new('CatalogCamera');camera=bpy.data.objects.new('CatalogCamera',camera_data);S.collection.objects.link(camera)
camera.location=(0,-24,12);camera.rotation_euler=(Vector((0,3,3.2))-camera.location).to_track_quat('-Z','Y').to_euler();camera_data.lens=38;S.camera=camera
for loc,energy,size in [((-9,-8,17),2200,13),((11,7,13),1500,16)]:
    data=bpy.data.lights.new('CatalogLight','AREA');data.energy=energy;data.size=size
    light=bpy.data.objects.new('CatalogLight',data);S.collection.objects.link(light);light.location=loc;light.rotation_euler=(Vector((0,3,3))-light.location).to_track_quat('-Z','Y').to_euler()
S.world.use_nodes=True;S.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.32,.37,.45,1);S.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.9
S.render.engine='CYCLES';S.cycles.device='CPU';S.cycles.samples=16;S.cycles.use_denoising=True
S.render.resolution_x=1400;S.render.resolution_y=900;S.render.resolution_percentage=100
S.render.filepath=str(Path(__file__).with_name('catalog.png'))
bpy.ops.render.render(write_still=True)
print(S.render.filepath)
