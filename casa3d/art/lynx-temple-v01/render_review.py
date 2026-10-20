"""Same cameras and lighting for source and exported GLB authoring comparisons."""
import bpy, json
from pathlib import Path
from mathutils import Vector
ART=Path(__file__).resolve().parent
CASA=ART.parent.parent
OUT=ART/'authoring-review';OUT.mkdir(exist_ok=True)
source=next(s for s in bpy.data.scenes if s.name.startswith('TEMPIO'))
source.frame_set(1)
def settings(scene):
    scene.render.engine='CYCLES';scene.cycles.samples=16;scene.cycles.use_denoising=True
    scene.render.threads_mode='FIXED';scene.render.threads=8
    scene.render.resolution_x=800;scene.render.resolution_y=800;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.render.film_transparent=False
    scene.view_settings.view_transform=source.view_settings.view_transform
    scene.view_settings.look=source.view_settings.look
    scene.view_settings.exposure=source.view_settings.exposure
    scene.view_settings.gamma=source.view_settings.gamma
def render(scene,name,camera):
    bpy.context.window.scene=scene;settings(scene);scene.camera=camera
    scene.render.filepath=str(OUT/(name+'.png'))
    bpy.ops.render.render(write_still=True)
ext=bpy.data.objects['CAM • Esterno']
interior=bpy.data.objects.new('ComparisonInterior',bpy.data.cameras.new('ComparisonInterior'))
source.collection.objects.link(interior);interior.location=(.0,-3.04,2.2)
interior.rotation_euler=(Vector((0,.65,2.85))-interior.location).to_track_quat('-Z','Y').to_euler()
interior.data.lens=22
render(source,'source-exterior',ext)
render(source,'source-interior',interior)
for tier in ('near','medium','far'):
    scene=bpy.data.scenes.new('Review_'+tier);scene.world=source.world
    bpy.context.window.scene=scene
    for o in source.objects:
        if o.type=='LIGHT' or o in (ext,interior) or o.name.startswith('Studio • appoggio'):
            scene.collection.objects.link(o)
    path=CASA/'src/assets/models'/('props' if tier=='near' else 'lod')/('lynx-temple-'+tier+'.glb')
    bpy.ops.import_scene.gltf(filepath=str(path))
    render(scene,tier+'-exterior',ext)
    if tier=='near':render(scene,tier+'-interior',interior)
(OUT/'review-settings.json').write_text(json.dumps({'engine':'Cycles','samples':16,'size':[800,800],'views':['source-exterior','source-interior','near-exterior','near-interior','medium-exterior','far-exterior'],'lighting':'Original source lights, world and studio support; original exterior camera.','purpose':'Compare export fidelity; runtime camera review remains separate.'},indent=2)+'\n',encoding='utf-8')
