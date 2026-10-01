"""Bear silhouette and gripping paws, executed by build_bear.py with its helpers.

Uses the previous protagonist's joint naming, grip arrangement and metric basis.
All modelling here is nominal; the main builder applies the camera-aligned scale.
"""
fur=cloth
fur.name='Bear | near-black fur'
fur.diffuse_color=(.003,.0035,.0045,1)
fur.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=fur.diffuse_color
fur.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.87
fur.node_tree.nodes['Principled BSDF'].inputs['Specular IOR Level'].default_value=.28
pads=material('Bear | charcoal paw pads',(.027,.020,.016),.73)
claw=material('Bear | muted ivory claws',(.40,.315,.20),.45)
# Fine surface relief for authoring renders; no strand hair or particle systems.
nt=fur.node_tree
tex=nt.nodes.new('ShaderNodeTexNoise');tex.inputs['Scale'].default_value=170
tex.inputs['Detail'].default_value=2
bump=nt.nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.13;bump.inputs['Distance'].default_value=.0005
nt.links.new(tex.outputs['Fac'],bump.inputs['Height'])
nt.links.new(bump.outputs['Normal'],nt.nodes['Principled BSDF'].inputs['Normal'])

# Reuse the named skeleton, with broader shoulders and compact plantigrade legs.
for i,(name,p,q,parent,deform) in enumerate(bones):
    side=name.rsplit('.',1)[-1];sgn=1 if side=='L' else -1
    replacements={
        'clavicle':((0,0,1.45),(sgn*.247,0,1.455)),
        'upper_arm':((sgn*.247,0,1.455),(sgn*.354,-.19,1.23)),
        'forearm':((sgn*.354,-.19,1.23),(sgn*.312,-.50,1.35)),
        'hand':((sgn*.312,-.50,1.35),(sgn*.337,-.587,1.383)),
        'thigh':((sgn*.130,0,.875),(sgn*.150,-.013,.50)),
        'shin':((sgn*.150,-.013,.50),(sgn*.161,.008,.13)),
        'foot':((sgn*.161,.008,.13),(sgn*.161,-.17,.055)),
        'toe':((sgn*.161,-.17,.055),(sgn*.161,-.26,.05)),
    }
    if '.' in name and name.split('.')[0] in replacements:
        a,b=replacements[name.split('.')[0]];bones[i]=(name,Vector(a),Vector(b),parent,deform)

body_panels=[]
def remember(o):body_panels.append(o.name);return o
remember(loft('Bear torso',[
    (.79,0,.009,.171,.138,{'pelvis':1}),
    (.84,0,.008,.224,.165,{'pelvis':1}),
    (.97,0,.004,.244,.181,{'pelvis':.8,'spine_01':.2}),
    (1.09,0,-.003,.243,.183,{'pelvis':.25,'spine_01':.75}),
    (1.23,0,.005,.238,.173,{'spine_01':.55,'spine_02':.45}),
    (1.36,0,.018,.268,.168,{'spine_02':1}),
    (1.445,0,.021,.276,.145,{'spine_02':1}),
    (1.501,0,.015,.203,.119,{'spine_02':1}),
    (1.546,0,.011,.112,.088,{'spine_02':.6,'neck':.4}),
    (1.557,0,.011,.094,.075,{'neck':1}),
],fur,BODY,n=32))

for side,sgn in [('L',1),('R',-1)]:
    ua='upper_arm.'+side;fa='forearm.'+side;h='hand.'+side
    remember(tube('Bear arm.'+side,
        [(sgn*.19,.007,1.43),(sgn*.265,-.03,1.408),(sgn*.304,-.079,1.345),(sgn*.348,-.15,1.258),(sgn*.354,-.20,1.232),(sgn*.345,-.27,1.255),(sgn*.328,-.38,1.305),(sgn*.313,-.468,1.339),(sgn*.312,-.501,1.35)],
        [.060,.098,.106,.099,.097,.087,.072,.059,.052],fur,BODY,
        [{'spine_02':.6,ua:.4},{'spine_02':.15,ua:.85},{ua:1},{ua:.85,fa:.15},{ua:.5,fa:.5},{ua:.1,fa:.9},{fa:1},{fa:.8,h:.2},{fa:.35,h:.65}],n=24))
    thigh='thigh.'+side;shin='shin.'+side;foot='foot.'+side;toe='toe.'+side
    remember(loft('Bear leg.'+side,[
        (.102,sgn*.16,.012,.075,.083,{shin:.65,foot:.35}),
        (.16,sgn*.16,.008,.082,.093,{shin:1}),
        (.29,sgn*.157,.007,.091,.100,{shin:1}),
        (.43,sgn*.151,-.002,.097,.107,{shin:.85,thigh:.15}),
        (.515,sgn*.149,-.006,.102,.111,{shin:.45,thigh:.55}),
        (.65,sgn*.140,.006,.114,.122,{thigh:1}),
        (.79,sgn*.129,.008,.124,.134,{thigh:.8,'pelvis':.2}),
        (.91,sgn*.118,.010,.124,.138,{thigh:.35,'pelvis':.65}),
        (.973,sgn*.112,.006,.109,.124,{'pelvis':1}),
    ],fur,BODY,n=24))
    remember(loft('Bear hindpaw.'+side,[
        (.005,sgn*.16,-.064,.079,.136,{foot:1}),
        (.012,sgn*.16,-.076,.099,.156,{foot:1}),
        (.043,sgn*.16,-.083,.105,.165,{foot:1}),
        (.078,sgn*.16,-.072,.106,.157,{foot:1}),
        (.123,sgn*.16,-.029,.091,.125,{foot:1}),
        (.16,sgn*.16,.009,.072,.081,{foot:1}),
        (.19,sgn*.16,.011,.062,.064,{foot:1}),
    ],fur,BODY,n=32))
    # Five short rounded toes and curved keratin claws; a barefoot bear stance.
    for j in range(5):
        dx=(j-2)*.034;zz=.067-.004*abs(j-2);yy=-.200+.010*abs(j-2)
        remember(ellipsoid('Hind toe.'+side,(sgn*.16+dx,yy,zz),(.027,.048,.039),fur,BODY,{foot:.45,toe:.55},20,12))
        tube('Hind claw.'+side,[(sgn*.16+dx,yy-.033,zz+.012),(sgn*.16+dx,yy-.051,zz+.013),(sgn*.16+dx,yy-.068,zz+.005),(sgn*.16+dx,yy-.078,zz-.009)], [.011,.009,.005,.0006],claw,BODY,[toe]*4,n=12,level=0)
    # Sole cushions are present but discreet in the standing review pose.
    ellipsoid('Hind sole pad.'+side,(sgn*.16,-.066,.012),(.064,.092,.013),pads,BODY,foot,24,12)

remember(ellipsoid('Bear tail',(0,.167,.897),(.067,.086,.069),fur,BODY,'pelvis',24,16))

paw_parts=[]
def paw(o):paw_parts.append(o.name);return o
for side,sgn in [('L',1),('R',-1)]:
    h='hand.'+side;fa='forearm.'+side
    xoff=.035 if side=='L' else -.04;yoff=-.145
    paw(tube('Paw wrist.'+side,[(sgn*.312,-.474,1.341),(sgn*.313,-.503,1.352),(sgn*.331,-.55,1.369),(sgn*.337,-.58,1.377)],[.052,.052,.047,.041],fur,HANDS,[{fa:.8,h:.2},{fa:.35,h:.65},{h:1},{h:1}],n=20))
    paw(ellipsoid('Paw palm.'+side,(sgn*(.337 if side=='L' else .342),-.571,1.376),(.043,.040,.065),fur,HANDS,h,24,16))
    paw(ellipsoid('Paw thenar.'+side,(sgn*.319,-.575,1.411),(.029,.029,.032),fur,HANDS,h,20,12))
    # Heart-like central pad on the palm, partly concealed by the curled digits.
    cx=sgn*(.342 if side=='L' else .347)
    for dx,dz,sizes in [(0,-.008,(.026,.008,.034)),(-.012,.017,(.018,.008,.020)),(.012,.017,(.018,.008,.020))]:
        ellipsoid('Central paw pad.'+side,(cx+dx,-.606,1.374+dz),sizes,pads,HANDS,h,16,10)
    for i,label in enumerate(['index','middle','ring','little']):
        z=1.425-i*.026
        if side=='L':base=[(.311,-.444,z),(.300,-.478,z+.002),(.272,-.493,z-.001),(.264,-.474,z-.009)]
        else:base=[(-.309,-.442,z),(-.307,-.475,z+.003),(-.280,-.484,z),(-.265,-.463,z-.010)]
        pts=[Vector((p[0]+xoff,p[1]+yoff,p[2])) for p in base]
        names=[];rad=[.014,.015,.014,.012][i]
        for k in range(3):
            bn=f'{label}_{k+1:02d}.{side}';bone(bn,pts[k],pts[k+1],h if k==0 else names[-1]);names.append(bn)
        fine=[];weights=[];rr=[]
        for k in range(3):
            p0=pts[max(0,k-1)];p1=pts[k];p2=pts[k+1];p3=pts[min(3,k+2)]
            for j in range(4):
                t=j/4;q=.5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t*t*t)
                fine.append(q);rr.append(rad*(1-.15*(k+t)/3))
                if j==0 and k>0:weights.append({names[k-1]:.5,names[k]:.5})
                else:weights.append({names[k]:1})
        fine.append(pts[-1]);rr.append(rad*.65);weights.append({names[-1]:1})
        tip=pts[-1]+(pts[-1]-pts[-2]).normalized()*.006
        fine.append(tip);rr.append(rad*.20);weights.append({names[-1]:1})
        paw(tube('Paw digit '+label+'.'+side,fine,rr,fur,HANDS,weights,n=16,level=0))
        padpos=pts[-1].lerp(pts[-2],.18)+Vector((0,-.010,0))
        ellipsoid('Digital paw pad '+label+'.'+side,padpos,(rad*.77,.005,rad*.87),pads,HANDS,names[-1],12,8)
        direction=(pts[-1]-pts[-2]).normalized()
        start=pts[-1]+Vector((0,.004,.004))
        clawpts=[start,start+direction*.009+Vector((0,0,.003)),start+direction*.019,start+direction*.026-Vector((0,0,.009)),start+direction*.028-Vector((0,0,.015))]
        tube('Fore claw '+label+'.'+side,clawpts,[.007,.0075,.005,.0028,.0005],claw,HANDS,[names[-1]]*5,n=12,level=0)
    if side=='L':base=[(.281,-.418,1.407),(.265,-.445,1.443),(.258,-.472,1.442),(.272,-.479,1.430)]
    else:base=[(-.288,-.416,1.407),(-.271,-.431,1.446),(-.26,-.455,1.447),(-.272,-.471,1.434)]
    pts=[Vector((p[0]+xoff,p[1]+yoff,p[2])) for p in base];names=[]
    for k in range(3):
        bn=f'thumb_{k+1:02d}.{side}';bone(bn,pts[k],pts[k+1],h if k==0 else names[-1]);names.append(bn)
    fine=[];ws=[];rs=[]
    for k in range(3):
        for j in range(3):
            t=j/3;fine.append(pts[k].lerp(pts[k+1],t));rs.append(.019-.005*(k+t)/3)
            ws.append({names[k]:1} if j else ({names[k]:.6,names[k-1]:.4} if k else {h:.25,names[0]:.75}))
    fine += [pts[-1],pts[-1]+(pts[-1]-pts[-2]).normalized()*.006]
    rs += [.011,.002];ws += [{names[-1]:1}]*2
    paw(tube('Paw thumb.'+side,fine,rs,fur,HANDS,ws,n=16,level=1))
    tip=pts[-1];direction=(pts[-1]-pts[-2]).normalized()
    tube('Thumb claw.'+side,[tip+Vector((0,.003,.005)),tip+direction*.009+Vector((0,0,.006)),tip+direction*.023,tip+direction*.028-Vector((0,0,.009))],[.008,.007,.0035,.0005],claw,HANDS,[names[-1]]*4,n=12,level=0)
    ellipsoid('Thumb pad.'+side,tip+Vector((0,-.009,0)),(.011,.005,.015),pads,HANDS,names[-1],12,8)

from bear_head import build_head
build_head(globals())
