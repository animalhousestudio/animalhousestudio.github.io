"""Record the proposed design honestly; human approvals remain pending."""
import json
from pathlib import Path

p = Path(__file__).parent
def update(name, **values):
    d = json.loads((p/name).read_text(encoding='utf-8'))
    d.update(values)
    (p/name).write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

update('room-brief.json',
    purpose='Pagina contatti privata attraverso un telegrafo dentro una cabina rossa.',
    runtimeSurface='Casa3D / Three.js; esterno Blender, interno procedurale caricato solo entrando.',
    boundsMeters=[1.64,1.64,3.15],
    hero={'id':'telegraph','role':'Comporre e inviare un messaggio privato','reservedBoundsMeters':[.65,.4,.35]},
    symmetry={'mode':'bilateral','order':2,'appliesTo':['architecture','barriers','circulation','repeatedProps'],
              'exceptions':['Porta incernierata a sinistra, aperta verso esterno.','Maniglia e leva del telegrafo laterali.']},
    circulation={'description':'Ingresso frontale 1.20 m; interno fermo davanti al banco. Uscita sempre disponibile. Eccezione alla larghezza 2.4 m: cabina per una persona, non corridoio pubblico.', 'minimumClearanceMeters':1.2},
    productionCamera={'viewport':[1440,900],'location':[0,2,.38],'target':[0,1.15,-.48],'verticalFovDegrees':60},
    performanceBudget={'maxSceneTriangles':12000,'maxVLowBytes':500000,'maxHighTextureBytes':1048576},
    creditBudget={'maximumCredits':0,'approvalRequired':True},
    artifacts={'floorPlan':'plans/lower-room.svg','reflectedCeilingPlan':'plans/ceiling.svg','planMetadata':'plan-metadata.json',
               'wallElevations':['plans/elevation.svg'],'visualTarget':'renders/exterior-concept.png','openingContactSheet':'masks/openings.svg'})
update('props.json',generation={'provider':'procedural-blender-and-threejs','maximumCredits':0,'note':'No Meshy, no paid calls. Generic validator requires Meshy; deliberately not claiming compliance.'}, assets=[
    {'id':'booth-exterior','function':'Ingresso alla pagina contatti','description':'Cabina rossa di riferimento, tetto curvo, porta a vetri.',
     'class':'hero','dimensionsMeters':[1.64,1.64,3.15],'attachmentFace':'floor','semanticFront':'negative-y',
     'targetPolycount':8000,'intendedInstances':1,'rejectionCriteria':['Porta non leggibile','Passaggio sotto 1.2 m','Silhouette non riconoscibile'],
     'image':{'source':'renders/exterior-concept.png','generator':'Blender procedural concept','prompt':'Red British telephone booth exterior, arched roof, glazed grid door, TELEGRAMMI sign.','approved':False,'approvedBy':''}},
    {'id':'telegraph','function':'Scrittura messaggio','description':'Base in legno, ottone, leva e bobine realizzati esclusivamente in Three.js.',
     'class':'hero','dimensionsMeters':[.65,.4,.35],'attachmentFace':'freestanding','semanticFront':'negative-z',
     'targetPolycount':3000,'intendedInstances':1,'rejectionCriteria':['Base sospesa sopra banco','Testo non accessibile da touch o tastiera'],
     'image':{'source':'','generator':'Three.js planned, not built','prompt':'Brass Morse telegraph on a wooden base, lever and twin coils.','approved':False,'approvedBy':''}}])
update('room-layout.json',units='meters',surfaces=[
    {'id':'floor','dimensionsMeters':[1.44,1.44,.12]},
    {'id':'back','dimensionsMeters':[1.44,.12,2.6]},
    {'id':'left','dimensionsMeters':[.12,1.44,2.6]},
    {'id':'right','dimensionsMeters':[.12,1.44,2.6]},
    {'id':'ceiling','dimensionsMeters':[1.44,1.44,.12]}],instances=[
    {'id':'contact-booth','assetId':'booth-exterior','position':[0,0,0]},
    {'id':'contact-telegraph','assetId':'telegraph','position':[0,1.1,-.45]}],
    placementProposal={'zone':'outdoor:arrival','root':'ContactBooth','worldMeters':[-14,0,204],
                       'note':'Sinistra del percorso, come screenshot. Posizione proposta: verificare sostegni giostra in runtime.','underWorldScale':.2})
update('openings.json',openings=[{'id':'front-door','kind':'door','wall':'front','widthMeters':1.2,'heightMeters':2.35,
    'thresholdMeters':.16,'depthMeters':.12,'destination':'Isolated contact interior','exception':'Single-user booth, not a 2.4 m circulation hall.'},
    *[{'id':side+'-window','kind':'window','wall':side,'widthMeters':1.25,'heightMeters':1.9,'sillMeters':.58,'depthMeters':.12,'destination':'Outdoor view in exterior only; frosted backing in isolated interior.'} for side in ['left','right']]])
# Draft diagrams are explicit proposals, not final Boolean/shell evidence.
svg='<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600"><rect width="600" height="600" fill="white"/>{}</svg>'
(p/'plans'/'ceiling.svg').write_text(svg.format('<rect x="100" y="100" width="400" height="400" fill="none" stroke="black" stroke-width="20"/><circle cx="300" cy="300" r="24" fill="white" stroke="black"/>'),encoding='utf-8')
(p/'plans'/'elevation.svg').write_text(svg.format('<rect x="180" y="100" width="240" height="460" fill="none" stroke="black" stroke-width="16"/><rect x="200" y="180" width="200" height="350" fill="none" stroke="black" stroke-width="4"/><path d="M180 100 Q300 20 420 100" fill="none" stroke="black" stroke-width="12"/>'),encoding='utf-8')
(p/'masks'/'openings.svg').write_text(svg.format('<rect x="30" y="30" width="540" height="540" fill="black"/><rect x="65" y="95" width="150" height="350" fill="white"/><rect x="265" y="120" width="110" height="280" fill="white"/><rect x="415" y="120" width="110" height="280" fill="white"/>'),encoding='utf-8')
update('plan-metadata.json',projectionSource='actual-mesh-bounds-for-lower-plan; schematic-other-proposals',
    style='monochrome-engineering',layers=['lower-room','reflected-ceiling'],semanticLabelsOutsideImage=True,
    aiInspirationIncluded=False,
    note='Lower-room plan generated from Blender concept mesh bounds at 1.2 m. Other diagrams schematic pending Function review. No final room parity claim.')
