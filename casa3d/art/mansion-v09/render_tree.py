import bpy,json
from pathlib import Path
from mathutils import Vector
OUT=Path(__file__).resolve().parent;S=bpy.context.scene
data=bpy.data.cameras.new('TreeReview');cam=bpy.data.objects.new('TreeReview',data);S.collection.objects.link(cam)
cam.location=(-36,-25,20);cam.rotation_euler=(Vector((-10,0,11))-cam.location).to_track_quat('-Z','Y').to_euler();data.lens=40;S.camera=cam
light_data=bpy.data.lights.new('TreeReviewLight','AREA');light_data.energy=6000;light_data.size=18
light=bpy.data.objects.new('TreeReviewLight',light_data);S.collection.objects.link(light);light.location=(-28,-14,28);light.rotation_euler=(Vector((-12,0,9))-light.location).to_track_quat('-Z','Y').to_euler()
S.world.use_nodes=True;S.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.5,.6,.7,1);S.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.85
S.render.engine='CYCLES';S.cycles.device='CPU';S.cycles.samples=12;S.cycles.use_denoising=True
S.render.resolution_x=1000;S.render.resolution_y=850;S.render.resolution_percentage=100
S.render.filepath=str(OUT/'house-tree-5.png');bpy.ops.render.render(write_still=True)
report=[]
for o in S.objects:
    if not o.name.startswith('M09_HouseTree_'):continue
    p=[o.matrix_world@Vector(v) for v in o.bound_box]
    report.append({'name':o.name,'bounds':[[min(v[i] for v in p),max(v[i] for v in p)] for i in range(3)]})
(OUT/'tree-bounds.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
