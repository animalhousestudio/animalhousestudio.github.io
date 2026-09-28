"""Save the reviewed Blender source and maintenance evidence, without export."""
import bpy,json,hashlib
from pathlib import Path
from mathutils import Vector

OUT=Path(__file__).resolve().parent
verification=json.loads((OUT/'verification.json').read_text())
assert verification['status']=='passed'
scene=bpy.context.scene
scene.name='Mansion_Architecture_v11_StructuralPolish'
scene['source_revision']='mansion-v10-circular-lift.blend'
scene['revision_notes']='Structural refinement only; same layout, objects and materials; 2588 fewer evaluated runtime triangles. Source review only, no export or build.'
scene['refinement_report']='verification.json'
for obj in bpy.context.selected_objects:obj.select_set(False)
bpy.context.view_layer.objects.active=None
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            space=area.spaces.active
            space.region_3d.view_perspective='PERSP'
            space.region_3d.view_rotation=scene.objects['M04_Camera_Front'].matrix_world.to_quaternion()
            space.region_3d.view_location=Vector((0,0,16))
            space.region_3d.view_distance=32
            space.clip_end=max(space.clip_end,300)

brief={
    'schema':'game-room.room-brief.v1','roomId':'mansion-v11','family':'gameplay-room',
    'purpose':'Scoped refinement of the open v10 scene; preserve all environments and existing furnishing.',
    'runtimeSurface':'Existing casa3d runtime, unchanged by this source-only task',
    'scope':'maintenance of existing authored scene; no new composition or gate crossing',
    'source':'baseline-v10.blend','output':'mansion-v11-refined.blend',
    'performanceBudget':{'maxSceneTriangles':347992,'maxScenePolygons':168391,'maxNewObjects':0},
    'creditBudget':{'maximumCredits':0,'approvalRequired':True},
    'constraints':['Preserve object names, transforms, materials and environments','No new furniture or decorations','No net increase in triangles or polygons'],
    'productionCamera':{'name':scene.camera.name,'inherited':True},
    'symmetry':{'mode':'inherited','exceptions':['Existing front access to circular lift']},
    'circulation':{'description':'All five lift stops and six structural floor/ceiling apertures preserved.'}}
(OUT/'room-brief.json').write_text(json.dumps(brief,indent=2),encoding='utf-8')
openings={'schema':'game-room.openings.v1','roomId':'mansion-v11','scope':'Existing openings retained; this is a partial maintenance schedule, not a redesigned layout.',
          'openings':[{'id':'existing-lift-'+str(i),'object':r['object'],'kind':'existing-lift-clearance',
                       'diameter_model':.46,'diameter_game_m':2.3,'layout_changed':False}
                      for i,r in enumerate(verification['floor_apertures'])]}
(OUT/'openings.json').write_text(json.dumps(openings,indent=2),encoding='utf-8')
reviews={'schema':'game-room.milestone-reviews.v1','roomId':'mansion-v11',
         'scope':'Local authoring maintenance, not a new Function/Form/Runtime approval.',
         'function':{'status':'pending','notes':'Existing composition inherited; no new assets requested.'},
         'form':{'status':'pending','evidence':['verification.json','renders/final-front.png','renders/final-observatory.png'],
                 'notes':'Agent geometry/visual checks complete; no human Form approval inferred.'},
         'runtime':{'status':'pending','notes':'No export, build, runtime modification or deployment requested or performed.'}}
(OUT/'milestone-reviews.json').write_text(json.dumps(reviews,indent=2),encoding='utf-8')
report={'schema':'game-room.room-final-report.v1','roomId':'mansion-v11',
        'scope':'Completed source refinement; full production gates are outside this task.',
        'gates':{'function':False,'form':False,'runtime':False},
        'verification':verification,'changes':'changes.json',
        'reviewRenders':{'interiors':['renders/after-living.png','renders/after-first-floor.png','renders/final-upper-hall.png','renders/final-observatory.png'],
                         'ceiling':['renders/after-ceiling-up.png','renders/after-ceiling-a.png','renders/after-ceiling-b.png'],
                         'exterior':['renders/final-front.png','renders/after-rear.png']},
        'reviewMethod':'Workbench structure renders; glazing temporarily hidden for interior inspection, then restored. Runtime and textured appearance not validated.',
        'postmortem':{'observations':['Coincident vertices and a collapsed fin at earlier facade cuts','Overlapping floor and landing surfaces','Solidified roof aperture intruded into observatory','Redundant flower-pole and canopy-cusp vertices'],
                      'corrections':['Targeted welds and collapsed-fin cleanup','2 mm game-space offsets on existing surfaces','Existing roof aperture reshaped with original topology and modifiers','Zero-length edges dissolved without changing visible flowers'],
                      'remainingRisks':['Intentional open leaves, glazing and thin decorative surfaces remain open','Scene presentation renders do not validate gameplay collision or alpha-textured vegetation']},
        'proposedLessons':[]}
(OUT/'final-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')

path=OUT/'mansion-v11-refined.blend'
bpy.ops.wm.save_as_mainfile(filepath=str(path),compress=True)
assert bpy.data.filepath==str(path) and path.is_file()
result={'saved':str(path),'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
        'triangles':verification['triangles_after'],'polygons':verification['polygons_after'],'objects':len(scene.objects)}
