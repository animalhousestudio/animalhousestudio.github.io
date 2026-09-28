"""Temporary structural review renders; restore all authoring settings."""
import bpy, math
from pathlib import Path
from mathutils import Vector

OUT = Path(__file__).resolve().parent / 'renders'
OUT.mkdir(exist_ok=True)
scene = bpy.context.scene
camera = scene.objects['M04_Camera_Front']
settings = {'engine':scene.render.engine, 'resolution_x':scene.render.resolution_x,
            'resolution_y':scene.render.resolution_y, 'resolution_percentage':scene.render.resolution_percentage,
            'filepath':scene.render.filepath, 'film_transparent':scene.render.film_transparent}
old_camera = scene.camera
old_matrix = camera.matrix_world.copy()
old_lens, old_type = camera.data.lens, camera.data.type
shade = scene.display.shading
shade_keys = ['light','color_type','single_color','show_shadows','show_cavity','cavity_type','show_specular_highlight','background_type','background_color']
shade_backup = {k:tuple(getattr(shade,k)) if k.endswith('color') else getattr(shade,k) for k in shade_keys}
old_format = scene.render.image_settings.file_format
hidden = []
views = {
    'front': ((-48,-83,39),(0,0,15),50,False),
    'rear': ((46,78,37),(0,0,15),50,False),
    'living': ((4.5,3.8,3.2),(-3,-3,3.1),20,True),
    'first-floor': ((4.5,3.8,11.7),(-3,-3,11.6),20,True),
    'upper-hall': ((4,-4,18.9),(-4,2,19),22,True),
    'observatory': ((-2.3,-1.8,27.35),(-1,3,27.6),22,True),
    'veranda': ((-4,-1.2,3.15),(-9,-1.2,3.15),22,True),
    'aviary': ((-4,-.3,11.6),(-9,-.3,11.6),22,True),
    'lift-floor': ((.6,-.85,10.6),(0,0,9.9),48,True),
    'ceiling-up': ((2,1,19),(2,1,23),16,True),
    'ceiling-a': ((-5,-4,19.5),(3,3,22.3),18,True),
    'ceiling-b': ((5,4,19.5),(-3,-3,22.3),18,True),
}
labels = globals().get('REVIEW_LABELS',['front','upper-hall','observatory','lift-floor'])
prefix = globals().get('REVIEW_PREFIX','before')
try:
    scene.camera = camera
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.render.resolution_x = 1050
    scene.render.resolution_y = 760
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.film_transparent = False
    shade.light = 'STUDIO'
    shade.color_type = 'MATERIAL'
    shade.show_shadows = True
    shade.show_cavity = True
    shade.cavity_type = 'BOTH'
    shade.show_specular_highlight = True
    shade.background_type = 'WORLD'
    camera.data.type = 'PERSP'
    for label in labels:
        position,target,lens,interior = views[label]
        hidden = []
        if interior:
            for obj in scene.objects:
                if obj.type=='MESH' and any(m and ('Glass' in m.name or 'Amber_Window' in m.name) for m in obj.data.materials):
                    hidden.append((obj,obj.hide_render))
                    obj.hide_render=True
        camera.location = position
        camera.rotation_euler = (Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler()
        camera.data.lens = lens
        scene.render.filepath = str(OUT/(prefix+'-'+label+'.png'))
        bpy.ops.render.render(write_still=True)
        for obj,state in hidden: obj.hide_render=state
        hidden=[]
finally:
    for obj,state in hidden: obj.hide_render=state
    camera.matrix_world = old_matrix
    camera.data.lens, camera.data.type = old_lens, old_type
    scene.camera = old_camera
    for k,v in settings.items():setattr(scene.render,k,v)
    for k,v in shade_backup.items():setattr(shade,k,v)
    scene.render.image_settings.file_format = old_format
result = {'renders':[str(OUT/(prefix+'-'+label+'.png')) for label in labels],
          'mode':'Structural workbench review; glazing temporarily hidden in interiors.'}
