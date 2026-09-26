import bpy, sys
from pathlib import Path
from mathutils import Vector
S=bpy.context.scene;OUT=Path(__file__).resolve().parent
old_camera=S.camera;old_engine=S.render.engine
hidden=[];glass_alpha=[]
for o in S.objects:
    if o.type=='MESH' and any('Glass' in m.name or 'Amber_Window' in m.name for m in o.data.materials if m):
        hidden.append((o,o.hide_render));o.hide_render=True
data=bpy.data.cameras.new('M08_ReviewCamera');cam=bpy.data.objects.new('M08_ReviewCamera',data);S.collection.objects.link(cam);S.camera=cam
S.render.engine='CYCLES';S.cycles.device='CPU';S.cycles.samples=12;S.cycles.use_denoising=True
S.render.resolution_x=900;S.render.resolution_y=650;S.render.resolution_percentage=100
S.world.use_nodes=True;S.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.55,.65,.8,1)
S.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.7
light_data=bpy.data.lights.new('ReviewLight','AREA');light_data.energy=800;light_data.shape='DISK';light_data.size=5
light=bpy.data.objects.new('ReviewLight',light_data);S.collection.objects.link(light)
views=[('entry-interior',(-.98,-1.5,4.3),(-.98,-6.2,4.7),28),
       ('west-door',(-5.9,-1.2,2.65),(-8,-1.2,3.0),23),
       ('east-window',(4.8,1.7,11.7),(7.55,2.6,12.0),30),
       ('front-exterior',(13,-23,9),(0,-5,8),33),
       ('cat-detail',(-3.85,-7.5,3.55),(-3.83,-5.91,3.38),55)]
if '--cats' in sys.argv:
    views=[]
    for label in ['Tuxedo','Ginger','Cream']:
        o=S.objects['M04_WindowCat_'+label];center=o.matrix_world@Vector((0,0,.5))
        face=o.matrix_world.to_quaternion()@Vector((0,1,0))
        views.append(('cat-'+label,center+face*2.4+Vector((.25,0,.22)),center,48))
try:
    for label,position,target,lens in views:
        cam.location=position;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();data.lens=lens
        light.location=position;light.rotation_euler=cam.rotation_euler
        S.render.filepath=str(OUT/(label+'.png'));bpy.ops.render.render(write_still=True)
finally:
    for o,hidden_state in hidden:o.hide_render=hidden_state
    S.camera=old_camera;S.render.engine=old_engine;bpy.data.objects.remove(cam,do_unlink=True);bpy.data.cameras.remove(data)
    bpy.data.objects.remove(light,do_unlink=True);bpy.data.lights.remove(light_data)
result={'renders':[str(OUT/(label+'.png')) for label,*_ in views]}
