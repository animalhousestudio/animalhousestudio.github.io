"""Architectural v03 review. Run once in the inspected v02 Blender scene."""
import bpy, math, json, bmesh
from pathlib import Path
from mathutils import Vector, Matrix

OUT=Path(__file__).resolve().parent
scene=bpy.context.scene
if scene.name!='Mansion_Architecture_v02':
    raise RuntimeError('Expected the reviewed v02 scene; refusing to apply twice.')
if bpy.context.object and bpy.context.object.mode!='OBJECT': bpy.ops.object.mode_set(mode='OBJECT')
OUT.mkdir(parents=True,exist_ok=True)
bpy.data.libraries.write(str(OUT/'before-v03.blend'),{scene},fake_user=True,compress=True)
scene.name='Mansion_Architecture_v03'
scene['revision_v03']=True

def bounds(o):
    p=[o.matrix_world@Vector(v) for v in o.bound_box]
    return Vector(tuple(min(v[i] for v in p) for i in range(3))),Vector(tuple(max(v[i] for v in p) for i in range(3)))
def remove(objects):
    for o in list(objects): bpy.data.objects.remove(o,do_unlink=True)
def prefix(*terms): return [o for o in scene.objects if o.name.startswith(terms)]
def move(objects,matrix):
    for o in list(objects): o.matrix_world=matrix@o.matrix_world

# Reuse immutable primitive meshes and the established material palette.
base=(OUT.parent/'mansion-v01'/'create_mansion.py').read_text(encoding='utf-8')
ns={'bpy':bpy,'math':math,'Vector':Vector,'Matrix':Matrix}
for key,name in {'oak':'CURVE_AgedOak_Trim','slate':'CURVE_Slate_BlueGrey','bronze':'CURVE_AgedBronze','sage':'M01_Sage_Timber','glass':'M01_Amber_Window','gold':'M01_Brass_Accents','dark':'M01_Ironwork','cream':'CURVE_PaintedTimber_Warm','plaster':'M01_Rose_Limestone'}.items(): ns[key]=bpy.data.materials[name]
exec(base[base.index('def mesh_obj('):base.index('# The new upper storey')],ns)
for o in scene.objects:
    if o.type=='MESH' and len(o.data.vertices)==8 and len(o.data.polygons)==6 and len(o.data.materials)==1:
        if all(all(abs(abs(v.co[i])-.5)<1e-5 for i in range(3)) for v in o.data.vertices): ns['cube_cache'][o.data.materials[0].name]=o.data
box,line,lathe,mesh_obj,bay,ring=(ns[k] for k in ['box','line','lathe','mesh_obj','bay','ring'])
oak,slate,bronze,sage,glass,gold,dark,cream,plaster=(ns[k] for k in ['oak','slate','bronze','sage','glass','gold','dark','cream','plaster'])
balcony=bpy.data.collections['M01_03_Balconies'];tower=bpy.data.collections['M01_04_East_Tower_Wing']
floor=bpy.data.collections['M01_02_New_Upper_Floor'];obs=bpy.data.collections['M01_06_Observatory']
retained=bpy.data.collections['M01_01_Retained_House'];life=bpy.data.collections['M01_07_Plants_Cats']
details=bpy.data.collections.new('M03_08_Architectural_Details');scene.collection.children.link(details)
studio=bpy.data.collections['M01_90_Presentation']
wood=bpy.data.materials.new('M03_Antique_Walnut');wood.diffuse_color=(.115,.047,.022,1);wood.use_nodes=True
wood.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=wood.diffuse_color
wood.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.52

def cap_profile(name,cx,cy,profile,ma,col,segments=8):
    ob=lathe(name,cx,cy,profile,ma,col,segments)
    bm=bmesh.new();bm.from_mesh(ob.data)
    bmesh.ops.holes_fill(bm,edges=[e for e in bm.edges if e.is_boundary],sides=segments)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(ob.data);bm.free()
    return ob

def cylinder(name,a,b,r,ma,col,segments=16):
    a,b=Vector(a),Vector(b)
    bpy.ops.mesh.primitive_cylinder_add(vertices=segments,radius=r,depth=(b-a).length,location=(a+b)/2)
    o=bpy.context.object;o.name='M03_'+name;o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();o.data.materials.append(ma)
    for c in list(o.users_collection): c.objects.unlink(o)
    col.objects.link(o);return o

def roof(name,x0,x1,y0,y1,eave,ridge,col=details):
    ym=(y0+y1)/2
    ob=mesh_obj(name,[(x0,y0,eave),(x1,y0,eave),(x0,ym,ridge),(x1,ym,ridge),(x0,y1,eave),(x1,y1,eave)],[(0,1,3,2),(2,3,5,4)],slate,col)
    mod=ob.modifiers.new('Roof thickness','SOLIDIFY');mod.thickness=.1
    for x in [x0,x1]:line(name+'_Barge',[(x,y0,eave),(x,ym,ridge),(x,y1,eave)],.085,oak,col)
    line(name+'_Ridge',[(x0-.06,ym,ridge),(x1+.06,ym,ridge)],.08,bronze,col)
    for y in [y0,y1]:line(name+'_Eaves',[(x0,y,eave),(x1,y,eave)],.075,oak,col)
    return ob

# Balcony: half the projection, with masonry-anchored cantilever brackets.
remove(prefix('M01_Balcony_Support','M01_Balcony_Brace','M01_Balcony_Corbel'))
balcony_xform=Matrix.Translation((0,-5.85,0))@Matrix.Diagonal((.94,.52,1,1))@Matrix.Translation((0,5.85,0))
move(list(balcony.objects)+prefix('M01_Balcony_Planter','M01_Balcony_Plant'),balcony_xform)
for x in [-5.5,-2.7,2.7,5.5]:
    wall_y=-6.15*math.sqrt(1-(x/8.0)**2)
    box('V03_Balcony_WallPlate',(x,wall_y-.08,15.5),(.32,.30,2.65),oak,balcony)
    line('V03_Balcony_Knee',[(x,wall_y+.05,14.2),(x,wall_y-.22,14.75),(x,-7.28,16.96)],.17,oak,balcony)
    line('V03_Balcony_Bearer',[(x,wall_y+.16,16.92),(x,-7.65,16.92)],.16,oak,balcony)
    for z in [14.5,16.65]: cylinder('Balcony_AnchorBolt',(x,wall_y-.27,z),(x,wall_y-.32,z),.075,dark,balcony,8)

# Tower: detach from the wall, close its underside, provide real intermediate floors.
level=9.784561157226562
remove(prefix('M01_Tower_ConnectionFloor','M01_Tower_Cantilever','M01_Tower_SuspendedBase'))
move(list(tower.objects),Matrix.Translation((4.8,0,0)))
cx,cy=14.85,-.1
cap_profile('V03_Tower_ClosedBase',cx,cy,[(.60,level-1.25),(1.12,level-.98),(2.48,level-.18),(2.64,level+.10)],slate,tower,8)
for z in [level+.04,level+4.331,level+8.662]:
    cap_profile('V03_Tower_Floor',cx,cy,[(2.36,z-.14),(2.36,z+.02)],oak,tower,8)
west=cx-3.05*.75
west_bay=[]
for o in tower.objects:
    if o.name.startswith('M01_Tower_ArchedBay'):
        lo,hi=bounds(o)
        if abs((lo.x+hi.x)/2-west)<.40 and lo.z>=level-.15 and hi.z<level+4.40: west_bay.append(o)
remove(west_bay)
before=set(tower.objects)
bay('V03_Tower_PassagePortal',(west,cy,level),2*3.05*math.tan(math.pi/8)*.75,4.331,(1.36,3.60),0,plaster,tower,-math.pi/2)
remove([o for o in tower.objects if o not in before and any(k in o.name for k in ['Glass','Mullion','Transom','LowerRail','Sill'])])

# Timber bridge: treaded rise from the main first floor to the aviary/tower level.
x0,x1=7.65,west+.15
for i in range(10):
    x=x0+(x1-x0)*(i+.5)/10;z=8.4+(level-8.4)*(i+1)/10
    box('V03_Bridge_Tread',(x,cy,z-.10),((x1-x0)/10+.02,2.35,.22),oak,details)
for y in [cy-1.15,cy+1.15]:
    line('V03_Bridge_Stringer',[(7.45,y,8.05),(x1+.1,y,level-.24)],.19,oak,details)
    line('V03_Bridge_TopBeam',[(7.25,y,14.15),(x1+.2,y,14.15)],.16,oak,details)
    for x in [7.6,10.15,x1-.08]:
        z=8.4+(level-8.4)*max(0,min(1,(x-x0)/(x1-x0)))
        box('V03_Bridge_Post',(x,y,(z+14.15)/2),(.22,.22,14.15-z),oak,details)
    for a,b in [(7.6,10.15),(10.15,x1-.08)]:
        line('V03_Bridge_Arch',[(a,y,12.5),(a+.3,y,13.3),((a+b)/2,y,13.9),(b-.3,y,13.3),(b,y,12.5)],.12,oak,details)
    line('V03_Bridge_Handrail',[(7.55,y,9.70),(x1,y,level+1.3)],.08,oak,details)
    for i in range(16):
        x=x0+(x1-x0)*i/15;z=8.4+(level-8.4)*i/15
        line('V03_Bridge_Baluster',[(x,y,z+.12),(x,y,z+1.27)],.035,dark,details)
    # Deep wall sockets, triangulated support and tower bearing are visibly connected.
    box('V03_Bridge_WallSocket',(7.64,y,6.5),(.55,.52,3.3),plaster,details)
    line('V03_Bridge_StructuralBrace',[(7.55,y,5.15),(10.0,y,7.5),(14.8,y,level-.3)],.23,oak,details)
    line('V03_Bridge_Tie',[(9.9,y,7.45),(9.9,y,8.8)],.12,dark,details)
roof('V03_Bridge_Roof',7.2,x1+.30,cy-1.5,cy+1.5,14.26,15.55)

# Unequal bays replace the repeated upper-storey modules, including actual reveals.
remove(prefix('M01_UpperFloor_Front_','M01_UpperFloor_Rear_'))
front_specs=[(-4.85,5.3,2.05,3.40,.95),(-.2,4.0,2.4,4.8,.05),(3.225,2.85,1.30,2.95,1.0),(6.075,2.85,1.55,3.60,.45)]
rear_specs=[(-6.0,3.0,1.35,2.60,1.55),(-1.9,5.2,3.5,3.5,.8),(2.2,3.0,1.35,3.55,.5),(5.6,3.8,1.75,2.7,1.30)]
for i,(x,w,ow,oh,bottom) in enumerate(front_specs):bay('V03_FrontBay_'+str(i),(x,-5.95,17.2),w,5.05,(ow,oh),bottom,sage,floor)
for i,(x,w,ow,oh,bottom) in enumerate(rear_specs):bay('V03_RearBay_'+str(i),(x,5.95,17.2),w,5.05,(ow,oh),bottom,sage,floor,math.pi)
# Twin lancet subdivision inside the wide rear opening.
box('V03_Rear_BiforaPier',(-1.9,6.14,19.35),(.15,.2,2.7),oak,details)
for x in [-2.73,-1.07]:
    pts=[(x+.78*math.cos(t*math.pi/20),6.22,20.48+.77*math.sin(t*math.pi/20)) for t in range(21)]
    line('V03_Rear_BiforaArch',pts,.055,oak,details)
def shutter(name,x,y,z,w,h,side=1):
    box(name+'_Panel',(x,y,z+h/2),(w,.12,h),sage,details)
    for zz in [z+.12,z+h-.12]:box(name+'_Rail',(x,y+side*.08,zz),(w+.04,.10,.10),oak,details)
    for k in range(1,8):box(name+'_Louver',(x,y+side*.09,z+h*k/8),(w-.10,.07,.065),oak,details)
    for zz in [z+.28,z+h-.28]:box(name+'_Hinge',(x,y+side*.15,zz),(w*.82,.045,.075),dark,details)
shutter('V03_Front_Shutter',-6.23,-6.23,18.15,.58,2.45,-1)
shutter('V03_Rear_Shutter_L',-3.94,6.27,18.0,.48,2.40)
shutter('V03_Rear_Shutter_R',.14,6.32,18.0,.48,2.40)
shutter('V03_Rear_NarrowShutter',3.28,6.24,17.7,.45,2.85)
cat=bpy.data.objects.get('M01_BalconyCat_Resting')
if cat:cat.location=Vector((6.07,-6.4,17.90))

# Shift rear openings with their wall geometry and every associated frame/canopy.
# The mapping is zero at the corner posts and floor bands, avoiding seam gaps.
def smooth(a,b,x):
    t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)
def rear_offset(p):
    if p.y<3.7 or p.z>17.1:return 0
    zweight=1.25*smooth(1.1,2.35,p.z)*(1-smooth(7.05,8.25,p.z))-1.65*smooth(8.8,10.1,p.z)*(1-smooth(15.65,16.85,p.z))
    return zweight*(1-smooth(1.7,5.25,abs(p.x)))*smooth(3.7,4.4,p.y)
warped=[]
for o in list(retained.objects):
    if o.type not in {'MESH','CURVE'}:continue
    lo,hi=bounds(o)
    if lo.y<3.7 or lo.z>17.1 or hi.z<1.1:continue
    coords=[]
    if o.type=='MESH': coords=[v.co.copy() for v in o.data.vertices]
    else:
        for sp in o.data.splines:
            coords.extend([p.co.copy() if sp.type=='BEZIER' else p.co.xyz.copy() for p in (sp.bezier_points if sp.type=='BEZIER' else sp.points)])
    offsets=[rear_offset(o.matrix_world@p) for p in coords]
    if not offsets or max(abs(v) for v in offsets)<1e-5:continue
    if max(offsets)-min(offsets)<1e-5:o.location.x+=offsets[0]
    else:
        o.data=o.data.copy();inv=o.matrix_world.inverted()
        def warp(co):
            p=o.matrix_world@co;p.x+=rear_offset(p);return inv@p
        if o.type=='MESH':
            for v in o.data.vertices:v.co=warp(v.co)
            o.data.update()
        else:
            for sp in o.data.splines:
                if sp.type=='BEZIER':
                    for p in sp.bezier_points:p.co=warp(p.co);p.handle_left=warp(p.handle_left);p.handle_right=warp(p.handle_right)
                else:
                    for p in sp.points:p.co=(*warp(p.co.xyz),p.co.w)
    warped.append(o.name)

# Ancient double door in the existing opening, with raised panels and strap hinges.
remove(prefix('M01_Reuse_EXT_WideDoor_','M01_Reuse_EXT_EntryDoor_','M01_Reuse_EXT_Canopy_Entry'))
dcx,dy,bottom=-.98,-6.38,1.58
for side in [-1,1]:
    x=dcx+side*.49
    box('V03_Portal_WalnutLeaf',(x,dy,4.56),(.96,.24,5.96),wood,details)
    for z,h in [(2.6,1.55),(4.6,1.85),(6.6,1.3)]:
        box('V03_Portal_RecessedPanel',(x,dy-.145,z),(.72,.05,h),oak,details)
        box('V03_Portal_PanelField',(x,dy-.185,z),(.60,.05,h-.16),wood,details)
    for z in [2.0,4.7,7.15]:
        box('V03_Portal_IronStrap',(x,dy-.24,z),(.82,.075,.12),dark,details)
        for dx in [-.29,.29]:cylinder('Portal_Rivet',(x+dx,dy-.27,z),(x+dx,dy-.31,z),.038,gold,details,8)
    hx=dcx+side*.18
    cylinder('Portal_KnockerBoss',(hx,dy-.22,4.20),(hx,dy-.31,4.20),.115,bronze,details)
    line('V03_Portal_RingKnocker',[(hx+.13*math.cos(k*math.tau/24),dy-.34,4.06+.17*math.sin(k*math.tau/24)) for k in range(25)],.03,bronze,details)
    for z in [2.1,4.6,7.1]:cylinder('Portal_Hinge',(dcx+side*.96,dy-.08,z-.14),(dcx+side*.96,dy-.08,z+.14),.07,dark,details,12)
    for k in range(9):box('V03_Portal_JambStone',(dcx+side*1.20,dy-.01,1.72+k*.64),(.35,.45,.61),plaster,details)
box('V03_Portal_Threshold',(dcx,dy-.16,1.49),(2.65,.70,.20),plaster,details)
for i in range(13):
    t=math.pi*i/12
    ob=box('V03_Portal_ArchStone',(dcx+1.21*math.cos(t),dy-.02,7.27+.70*math.sin(t)),(.32,.46,.30),plaster,details)
    ob.rotation_euler.y=t-math.pi/2
box('V03_Portal_Keystone',(dcx,dy-.10,8.01),(.36,.53,.49),cream,details)
box('V03_Portal_UpperInfill',(dcx,dy+.10,7.7),(2.0,.22,.50),wood,details)
roof('V03_Portal_Hood',dcx-1.70,dcx+1.70,dy-1.0,dy+.50,8.27,9.03)
for x in [dcx-1.45,dcx+1.45]:line('V03_Portal_HoodBracket',[(x,dy+.05,7.35),(x,dy-.68,8.22)],.09,oak,details)

# Turn the existing aperture around the elliptical dome without distorting its silhouette.
ocx,ocy=-1.04,1.045
dome_xform=Matrix.Translation((ocx,ocy,0))@Matrix.Diagonal((4.94,4.18,1,1))@Matrix.Rotation(math.pi/2,4,'Z')@Matrix.Diagonal((1/4.94,1/4.18,1,1))@Matrix.Translation((-ocx,-ocy,0))
move(prefix('M01_Reuse_ObsDome_Curved','M01_Reuse_CURVE_Dome_Meridian'),dome_xform)
remove(prefix('M02_Telescope_','M01_Telescope_'))
mount=Vector((ocx,ocy,30.02));direction=Vector((1,0,0))
for t in [0,math.tau/3,2*math.tau/3]:cylinder('Telescope_Tripod',(ocx+1.15*math.cos(t),ocy+1.15*math.sin(t),25.86),mount,.095,bronze,obs)
cylinder('Telescope_AzimuthMount',mount-Vector((0,0,.20)),mount+Vector((0,0,.18)),.34,dark,obs)
back=mount-direction*1.10;front=mount+direction*6.15
cylinder('Telescope_HorizontalBarrel',back,front,.30,wood,obs,32)
for d in [-.9,.3,4.2,6.05]:cylinder('Telescope_BrassBand',mount+direction*(d-.07),mount+direction*(d+.07),.34,gold,obs,24)
cylinder('Telescope_Lens',front,front+direction*.065,.27,glass,obs,32)
cylinder('Telescope_Eyepiece',back-direction*.38,back,.12,dark,obs)
cylinder('Telescope_FindScope',mount+Vector((-.3,.42,.25)),mount+Vector((1.0,.42,.25)),.07,bronze,obs)
dome=bpy.data.objects['M01_Reuse_ObsDome_Curved']
bm=bmesh.new();bm.from_mesh(dome.data)
for sign in [-1,1]:
    pts=[dome.matrix_world@v.co for v in bm.verts if v.is_boundary]
    pts=[p for p in pts if p.x>ocx+.1 and p.z>29.1 and (p.y-ocy)*sign>0]
    pts.sort(key=lambda p:p.z)
    if len(pts)>1:line('V03_Dome_ApertureLip',pts,.055,bronze,obs)
bm.free()

# Roof silhouette: capped chimney stacks, mounted aerials, an unmistakable wind vane.
for i,(x,y,z,w) in enumerate([(-5.65,3.25,26.15,.95),(5.8,-1.75,25.60,.70)]):
    box('V03_Chimney_Stack',(x,y,(22.15+z)/2),(w,w, z-22.15),plaster,details)
    for zz in [z-1.6,z-.75,z-.1]:box('V03_Chimney_Coping',(x,y,zz),(w+.17,w+.17,.16),oak,details)
    for dx in [-.20,.20] if i==0 else [0]:
        cap_profile('V03_Chimney_Pot',x+dx,y,[(.17,z),(.14,z+.68),(.22,z+.75)],plaster,details,12)
        cylinder('Chimney_DarkMouth',(x+dx,y,z+.75),(x+dx,y,z+.755),.13,dark,details,12)
for i,(x,y,z,h) in enumerate([(-6.05,1.3,24.1,3.9),(5.65,4.9,24.0,3.2)]):
    box('V03_Aerial_Base',(x,y,z),(.48,.48,.18),bronze,details)
    line('V03_Aerial_Mast',[(x,y,z),(x,y,z+h)],.045,dark,details)
    for dx in [-.38,.38]:line('V03_Aerial_Foot',[(x+dx,y,z-.4),(x,y,z+.8)],.035,bronze,details)
    for k in range(5):ring('V03_Aerial_Coil',x,y,z+h*.55+k*.15,.14,bronze,details,.023,12)
    line('V03_Aerial_Whip',[(x,y,z+h),(x+.35,y+.08,z+h+.8)],.025,bronze,details)
# Smaller window hoods sit on brackets at their reveals.
roof('V03_Rear_WindowHood',-4.0,.25,5.8,7.10,21.45,22.10)
for x in [-3.65,-.1]:line('V03_Rear_HoodBracket',[(x,6.08,20.65),(x,6.85,21.42)],.075,oak,details)
roof('V03_Front_WindowHood',-6.35,-3.35,-6.85,-5.74,21.65,22.04)
for x in [-6.15,-3.55]:line('V03_Front_HoodBracket',[(x,-6.08,20.85),(x,-6.62,21.6)],.065,oak,details)
wx,wy,wz=-5.65,3.25,27.6
cylinder('WindVane_Mast',(wx,wy,26.9),(wx,wy,29.0),.045,bronze,details)
line('V03_WindVane_ArrowShaft',[(wx-.85,wy,28.50),(wx+1.1,wy,28.50)],.038,gold,details)
mesh_obj('V03_WindVane_ArrowHead',[(wx+1.35,wy,28.50),(wx+.9,wy,28.73),(wx+.9,wy,28.27)],[(0,1,2)],gold,details)
mesh_obj('V03_WindVane_Tail',[(wx-.85,wy,28.5),(wx-1.2,wy,28.9),(wx-1.2,wy,28.1)],[(0,1,2)],bronze,details)
for t in [0,math.tau/3,2*math.tau/3]:
    ex,ey=wx+.58*math.cos(t),wy+.58*math.sin(t)
    line('V03_Anemometer_Arm',[(wx,wy,29.10),(ex,ey,29.1)],.026,bronze,details)
    cap_profile('V03_Anemometer_Cup',ex,ey,[(.05,29.0),(.18,29.12)],bronze,details,12)

# Recalculate only new mesh normals, once per shared data block.
new_meshes={o.data for o in scene.objects if o.type=='MESH' and ('V03_' in o.name or o.name.startswith('M03_'))}
for me in new_meshes:
    bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free();me.update()
bpy.context.view_layer.update()
for o in scene.objects:o.select_set(False)
def aim(o,target):o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
hero=bpy.data.objects['M01_Camera_Hero'];hero.location=(49,-82,40);hero.data.ortho_scale=48;aim(hero,(2,0,16.5));scene.camera=hero
camdata=bpy.data.cameras.new('M03_Camera_Rear');camdata.type='ORTHO';camdata.ortho_scale=48
rear=bpy.data.objects.new('M03_Camera_Rear',camdata);studio.objects.link(rear);rear.location=(46,78,37);aim(rear,(2,0,16.5))
scene.render.resolution_x=1100;scene.render.resolution_y=1150;scene.render.resolution_percentage=100
scene.cycles.samples=20;scene.cycles.use_denoising=True
scene.render.filepath=str(OUT/'mansion-v03-front.png')
for screen in bpy.data.screens:
    for a in screen.areas:
        if a.type=='VIEW_3D':
            sp=a.spaces.active;sp.region_3d.view_location=(2,0,16.5);sp.region_3d.view_distance=53
            sp.region_3d.view_rotation=hero.rotation_euler.to_quaternion()
bpy.data.libraries.write(str(OUT/'mansion-v03.blend'),{scene},fake_user=True,compress=True)
meshes=[o for o in scene.objects if o.type=='MESH' and o.name not in studio.objects]
stats={'revision':'v03','balcony_depth':1.872,'balcony_free_posts':0,'tower_center':[cx,cy],'tower_base_closed':True,'tower_level':level,'telescope_axis':[1,0,0],'rear_components_repositioned':len(warped),'mesh_objects':len(meshes),'unique_meshes':len({o.data for o in meshes}),'shared_mesh_objects':sum(o.data.users>1 for o in meshes),'game_modified':False}
(OUT/'stats.json').write_text(json.dumps(stats,indent=2),encoding='utf-8')
finish=OUT/'finish_v03.py'
exec(compile(finish.read_text(encoding='utf-8'),str(finish),'exec'),dict(__file__=str(finish)))
result=json.loads((OUT/'stats.json').read_text(encoding='utf-8'))
