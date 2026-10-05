"""Render review evidence from the saved authored geometry (background Blender)."""
import bpy
import json
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parent
scene=bpy.data.scenes['GardenStage_Review']
bpy.context.window.scene=scene
camera=scene.camera
poses=[
    ('stage-three-quarter',(11,-17,10),(0,-.1,2),12.8,1600,1100),
    ('stage-front',(0,-19,7.4),(0,-.2,2.1),11.8,1500,1050),
    ('stage-rear',(-11,15,9),(0,-.1,2),12.8,1400,1000),
    ('stage-top',(0,-.3,20),(0,-.3,0),11.4,1400,1000),
]
manifest=[]
for name,location,target,scale,width,height in poses:
    camera.location=Vector(location)*3
    camera.rotation_euler=(Vector(target)*3-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.ortho_scale=scale*3
    scene.render.resolution_x=width
    scene.render.resolution_y=height
    scene.render.filepath=str(ROOT/'renders'/f'{name}.png')
    bpy.ops.render.render(write_still=True,scene=scene.name)
    manifest.append({'name':name,'path':f'renders/{name}.png','camera':list(location),'target':list(target)})
(ROOT/'renders'/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
