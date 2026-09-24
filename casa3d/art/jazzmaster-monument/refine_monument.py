"""Refine original monument in-place; save separate v02. Run once after create_monument.py."""
import bpy, math
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from pathlib import Path

OUT=Path(__file__).resolve().parent
s=bpy.context.scene
assert s.name=='Jazzmaster | Carrara monument'
assert not s.get('refined_v02'), 'Refinement already applied'
g=bpy.data.objects['JAZZMASTER | monumental assembly']
if bpy.context.mode!='OBJECT': bpy.ops.object.mode_set(mode='OBJECT')

# Remove the explicitly unwanted floating relic fragments and tubular border.
for o in list(s.objects):
    if o.name.startswith('Relic | chipped lacquer') or o.name=='Jazzmaster | dark relic perimeter':
        bpy.data.objects.remove(o,do_unlink=True)

# Raise the neck/fret plane so string action remains small along the entire neck.
for o in g.children:
    if o.name.startswith(('Neck |','Fingerboard |','Fret |','Nut |')):
        o.location.y-=.115
    elif o.name.startswith('Fretboard | pearl dot'):
        o.location.y=-.322

def reshape(v):
    v=Vector(v)
    return Vector((v.x*.88,v.y,v.z*1.12 if v.z<=3.44 else v.z+.4128))

# Slightly lengthen the body and narrow all hardware together, retaining neck scale.
for o in list(g.children):
    old=o.matrix_basis.copy()
    o.location=reshape(o.location)
    newinv=o.matrix_basis.inverted()
    if o.type=='MESH':
        for v in o.data.vertices:v.co=newinv@reshape(old@v.co)
        o.data.update()
    elif o.type=='CURVE':
        for sp in o.data.splines:
            for p in sp.bezier_points:
                co=old@p.co; hl=old@p.handle_left; hr=old@p.handle_right
                p.co=newinv@reshape(co); p.handle_left=newinv@reshape(hl); p.handle_right=newinv@reshape(hr)

# More asymmetric, elongated offset outline; higher bass horn and rounded lower bout.
body=[(-.08,.04),(-.70,.07),(-1.12,.31),(-1.27,.75),(-1.16,1.19),(-.91,1.77),(-.96,2.29),(-1.07,2.97),(-1.02,3.66),(-.81,3.75),(-.61,3.30),(-.29,3.20),(.01,3.31),(.22,3.28),(.48,2.99),(.79,2.91),(1.01,3.02),(1.12,2.84),(1.04,2.29),(.93,1.75),(1.10,1.12),(1.14,.53),(.78,.13)]
o=bpy.data.objects['Jazzmaster | offset ash body']
for p,(x,z) in zip(o.data.splines[0].bezier_points,body):
    p.co=(x,z,0); p.handle_left_type='AUTO'; p.handle_right_type='AUTO'
o.data.bevel_depth=.045; o.data.bevel_resolution=5

# Tensioned strings must be straight between anchor, saddle, nut and tuning post.
for i in range(6):
    o=bpy.data.objects['String | %d'%(i+1)]
    x=-.29 if i<3 else -.34; z=6.46+i*.20
    pts=[((i-2.5)*.125,-.345,.39),((i-2.5)*.125,-.373,1.05),((i-2.5)*.061,-.341,6.13),(x,-.205,z)]
    for p,co in zip(o.data.splines[0].bezier_points,pts):
        p.co=reshape(co); p.handle_left_type='VECTOR'; p.handle_right_type='VECTOR'
    o.data.bevel_depth=.0028+i*.00052

# Restore flat, crisp material shading on machined surfaces.
for o in g.children:
    if o.type=='MESH' and o.name.startswith(('Pickup | wide','Neck |','Bridge |','Control |','Tuner | oval')):
        for p in o.data.polygons:p.use_smooth=False
        if not any(m.type=='WEIGHTED_NORMAL' for m in o.modifiers):o.modifiers.new('Clean hardware normals','WEIGHTED_NORMAL')

# Replace the round-looking tremolo plate with controlled straight lower corners.
o=bpy.data.objects['Tremolo | floating chrome plate']
for p in o.data.splines[0].bezier_points:p.handle_left_type='VECTOR';p.handle_right_type='VECTOR'
o.data.bevel_depth=.025

# A fine wood grain and restrained oxblood guard are more convincing at close range.
m=bpy.data.materials['Relic | aged amber ash']; n=m.node_tree.nodes; l=m.node_tree.links
tex=next(x for x in n if x.type=='TEX_NOISE')
coord=n.new('ShaderNodeTexCoord'); mapping=n.new('ShaderNodeVectorMath'); mapping.operation='MULTIPLY'; mapping.inputs[1].default_value=(4,.20,2)
l.new(coord.outputs['Generated'],mapping.inputs[0]); l.new(mapping.outputs[0],tex.inputs['Vector']); tex.inputs['Scale'].default_value=7
r=next(x for x in n if x.type=='VALTORGB')
for e,c in zip(r.color_ramp.elements,[(.16,.074,.024,1),(.36,.21,.075,1),(.50,.33,.13,1)]):e.color=c
bump=n.new('ShaderNodeBump'); bump.inputs['Strength'].default_value=.12; bump.inputs['Distance'].default_value=.007
l.new(tex.outputs['Fac'],bump.inputs['Height']); l.new(bump.outputs[0],n.get('Principled BSDF').inputs['Normal'])
m=bpy.data.materials['Pickguard | mottled oxblood tortoiseshell']; r=next(x for x in m.node_tree.nodes if x.type=='VALTORGB')
for e,c in zip(r.color_ramp.elements,[(.008,.002,.001,1),(.052,.008,.004,1),(.17,.029,.013,1),(.30,.11,.036,1)]):e.color=c

chrome=bpy.data.materials['Hardware | nickel chrome']; rubber=bpy.data.materials['Jack cables | black rubber']; red=bpy.data.materials['Jack cable | oxblood woven']; gold=bpy.data.materials['Jack contacts | brass']; black=bpy.data.materials['Black lacquer | worn charcoal']
def tube(name,pts,r,mat,straight=False):
    c=bpy.data.curves.new(name,'CURVE'); c.dimensions='3D'; c.resolution_u=12;c.bevel_depth=r;c.bevel_resolution=4
    sp=c.splines.new('BEZIER'); sp.bezier_points.add(len(pts)-1)
    for p,co in zip(sp.bezier_points,pts):p.co=co;p.handle_left_type='VECTOR' if straight else 'AUTO';p.handle_right_type=p.handle_left_type
    o=bpy.data.objects.new(name,c);s.collection.objects.link(o);c.materials.append(mat);return o
def cylinder(name,loc,axis,r,depth,mat):
    bpy.ops.mesh.primitive_cylinder_add(vertices=48,radius=r,depth=depth,location=loc)
    o=bpy.context.object;o.name=name;o.rotation_euler=Vector(axis).to_track_quat('Z','Y').to_euler();o.data.materials.append(mat)
    b=o.modifiers.new('Connector edge bevel','BEVEL');b.width=.006;b.segments=3
    for p in o.data.polygons:p.use_smooth=True
    return o
def plug(name,base,direction):
    v=Vector(direction).normalized();p=Vector(base)
    for label,offset,r,depth,m in [('strain relief',.07,.042,.14,rubber),('barrel',.22,.064,.19,chrome),('collar',.33,.071,.045,chrome),('tip',.44,.029,.18,gold)]:
        cylinder(name+' | '+label,p+v*offset,v,r,depth,m)
    for off in [.09,.12,.15]:cylinder(name+' | grip',p+v*off,v,.046,.010,black)
    for off in [.39,.46]:cylinder(name+' | insulator',p+v*off,v,.031,.012,black)

# Small visible saddle screws and pickup mounting screws.
for z in [1.43,2.30]:
    for x in [-.38,.38]:
        o=cylinder('Pickup | mounting screw',reshape((x,-.350,z+.10)),(0,1,0),.013,.008,chrome);o.parent=g
for i in range(6):
    o=cylinder('Bridge | adjustment screw',reshape(((i-2.5)*.13,-.355,1.04)),(0,1,0),.012,.055,chrome);o.parent=g

# Remove only the three loose old windings and their connectors; ground coil stays.
for o in list(s.objects):
    if (o.name.startswith('Cable ') and not o.name.startswith('Cable 04')) or (o.name.startswith('Jack ') and not o.name.startswith('Jack 04')):
        bpy.data.objects.remove(o,do_unlink=True)

# Build a surface query from evaluated stone only. Every new winding follows the
# actual changing radius of shaft, leaves and scrolls rather than a floating cylinder.
bpy.context.view_layer.update(); dg=bpy.context.evaluated_depsgraph_get();verts=[];faces=[]
for o in s.objects:
    if not o.name.startswith(('Carrara |','Acanthus |','Corinthian |')):continue
    e=o.evaluated_get(dg); me=e.to_mesh()
    if not me:continue
    me.calc_loop_triangles();offset=len(verts);verts.extend(e.matrix_world@v.co for v in me.vertices)
    faces.extend(tuple(offset+i for i in p.vertices) for p in me.loop_triangles);e.to_mesh_clear()
bvh=BVHTree.FromPolygons(verts,faces,all_triangles=True)
def radial(a,z):
    direction=Vector((math.cos(a),math.sin(a),0)); origin=direction*4;origin.z=z
    hit=bvh.ray_cast(origin,-direction,4)
    return math.hypot(hit[0].x,hit[0].y) if hit[0] else 1.1
def contact(a,z,clear=.055):
    r=max(radial(a+da,z+dz) for da,dz in [(0,0),(-.035,0),(.035,0),(0,.025),(0,-.025)])+clear
    return (r*math.cos(a),r*math.sin(a),z)
def winding(a0,z0,z1,turns,clear=.055):
    return [contact(a0+math.tau*turns*i/140,z0+(z1-z0)*i/140,clear) for i in range(141)]

socket=g.matrix_world@reshape((.99,-.32,.65))
exit=socket+Vector((.08,-.18,-.03))
cylinder('Instrument jack | chrome plug',socket+Vector((.03,-.06,0)),(0,-1,0),.045,.14,chrome)
wrap=winding(-.36,2.68,.70,1.22)
pts=[tuple(exit),(1.49,-.59,3.39),(1.85,-.65,3.16),(1.87,-.68,3.01),wrap[0]]+wrap[1:]
a=-.36+math.tau*1.22
pts += [contact(a,.49),contact(a,.28),(1.6,-1.95,.08),(1.8,-2.65,.07),(2.55,-2.64,.07)]
tube('Cable 01 | surface-following instrument lead',pts,.033,rubber);plug('Jack 01 floor',pts[-1],(1,.10,0))

for j in range(2):
    a0=1.1+j*1.25
    # Both ends on the ground; rear rise reaches and wraps the capital.
    wrap=winding(a0,2.22-j*.36,.73+j*.12,1.02,.058+j*.055)
    pts=[(-2.65-j*.25,.6+j*.4,.075),(-1.9,1.35+j*.2,.08),contact(a0,.32),contact(a0,.55),contact(a0,.85),contact(a0,1.20),contact(a0,1.50),contact(a0,1.85)]+wrap
    end=a0+math.tau*1.02
    pts += [contact(end,.52),contact(end,.29),(2.0+j*.35,.30,.075),(2.40+j*.4,-.65,.075),(2.5+j*.30,-1.75,.075),(1.9+j*.35,-2.1,.075)]
    tube('Cable %02d | fitted marble winding'%(j+2),pts,.031,red if j else rubber)
    plug('Jack %02d rear'%(j+2),pts[0],(-1,0,0));plug('Jack %02d front'%(j+2),pts[-1],(-1,-.15,0))

s.cycles.samples=48;s.render.filepath=str(OUT/'jazzmaster-v02.png');s['refined_v02']=True
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'jazzmaster-monument-v02.blend'))
