"""Audit evaluated asset meshes and architectural contacts in metres."""
import bpy
import json
import hashlib
from pathlib import Path
from collections import Counter
from mathutils import Vector

ROOT=Path(__file__).resolve().parent
scene=bpy.data.scenes['GardenStage_Review']
bpy.context.window.scene=scene
bpy.context.view_layer.update()
asset=bpy.data.collections['GardenStage_ASSET']
dg=bpy.context.evaluated_depsgraph_get()
issues=[]
triangles=0
bounds={}
for obj in asset.objects:
    if obj.type!='MESH': continue
    ev=obj.evaluated_get(dg)
    mesh=ev.to_mesh()
    mesh.calc_loop_triangles()
    triangles+=len(mesh.loop_triangles)
    zero=sum(t.area<1e-10 for t in mesh.loop_triangles)
    edges=Counter()
    for p in mesh.polygons:
        ids=list(p.vertices)
        for a,b in zip(ids,ids[1:]+ids[:1]): edges[tuple(sorted((a,b)))]+=1
    nonmanifold=sum(n!=2 for n in edges.values())
    if zero or nonmanifold:
        issues.append({'object':obj.name,'degenerateTriangles':zero,'nonManifoldEdges':nonmanifold})
    vs=[ev.matrix_world@v.co for v in mesh.vertices]
    bounds[obj.name]={'min':[min(v[i] for v in vs) for i in range(3)],
                      'max':[max(v[i] for v in vs) for i in range(3)]}
    ev.to_mesh_clear()

checks={}
checks['meshManifoldAndNonDegenerate']=not issues
checks['triangleBudgetUnder22000']=triangles<=22000
checks['fourLamps']=sum(o.name.startswith('Stage_LampLens_') for o in asset.objects)==4
checks['deckTopAt192']=all(abs(b['max'][2]-1.92)<1e-5 for n,b in bounds.items() if n.startswith('Stage_Plank_'))
checks['postFeetTouchDeck']=all(abs(b['min'][2]-1.92)<1e-5 for n,b in bounds.items() if n.startswith('Stage_PostFoot_'))
checks['groundContact']=all(abs(bounds['Stage_Sub_'+side]['min'][2])<1e-5 for side in ('Left','Right'))
checks['stairsMeetDeck']=all(abs(bounds['Stage_StairTread_'+side+'_11']['max'][1]+6)<1e-5 for side in ('Left','Right'))
checks['equalRisers016']=all(abs(bounds[f'Stage_StairTread_{s}_{i}']['max'][2]-.16*i)<1e-5 for s in ('Left','Right') for i in range(1,12))
checks['monitorFacesPerformer']=all(bpy.data.objects[f'Stage_Monitor_{s}'].data.polygons[-1].normal.y>0 for s in (-1,1))
checks['lampsHavePivotAttachment']=sum(o.name.startswith('Stage_LampPivot_') for o in asset.objects)==8

lo=[min(v['min'][i] for v in bounds.values()) for i in range(3)]
hi=[max(v['max'][i] for v in bounds.values()) for i in range(3)]
report={'asset':'garden-stage','source':'garden-stage.blend','meshObjects':len(bounds),
        'evaluatedTriangles':triangles,'boundsMinMeters':lo,'boundsMaxMeters':hi,
        'dimensionsMeters':[b-a for a,b in zip(lo,hi)],'deckMeters':[24,12,1.92],
        'structureScale':3,'microphoneAndMonitorScale':1,
        'lampCount':4,'humanApproval':'user requested concert scale 3x','runtimeExported':False,'runtimeTested':False}
(ROOT/'geometry-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
report={'status':'passed' if all(checks.values()) else 'failed','checks':checks,
        'meshIssues':issues,'evaluatedTriangles':triangles,
        'sourceSha256':hashlib.sha256((ROOT/'garden-stage.blend').read_bytes()).hexdigest(),
        'limits':'Authoring mesh/contact checks only; no runtime collision or performance validation.'}
(ROOT/'verification.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
result=report
assert all(checks.values()), report
