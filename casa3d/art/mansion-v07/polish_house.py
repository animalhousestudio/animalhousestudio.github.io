"""Refine the open v06 house. v06 remains the recoverable source revision."""
import bpy, bmesh, math, json, hashlib, struct
from pathlib import Path
from collections import defaultdict
from mathutils import Vector, Matrix

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[1]
S = bpy.context.scene
assert 'v06' in bpy.data.filepath, 'Open the v06 source before running this revision'
OUT.mkdir(parents=True, exist_ok=True)
SOURCE = bpy.data.filepath
LOG = []
def game_objects():
    return [o for o in S.objects if o.type == 'MESH' and not o.hide_render
            and not any('Presentation' in c.name or 'Disabled' in c.name for c in o.users_collection)]
def stats():
    dg = bpy.context.evaluated_depsgraph_get(); objects = game_objects(); count = 0
    for o in objects:
        e = o.evaluated_get(dg); m = e.to_mesh(); m.calc_loop_triangles()
        count += len(m.loop_triangles); e.to_mesh_clear()
    return dict(objects=len(objects), triangles=count, unique_meshes=len({o.data for o in objects}))
def bounds(o):
    p = [o.matrix_world @ Vector(v) for v in o.bound_box]
    return [min(v[i] for v in p) for i in range(3)], [max(v[i] for v in p) for i in range(3)]
def replace(o, vertices, faces):
    old = o.data; m = bpy.data.meshes.new(o.name + '_Clean')
    m.from_pydata(vertices, [], faces); m.update()
    for mat in old.materials: m.materials.append(mat)
    bm = bmesh.new(); bm.from_mesh(m)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces)); bm.to_mesh(m); bm.free()
    o.data = m

if bpy.context.mode != 'OBJECT': bpy.ops.object.mode_set(mode='OBJECT')
bpy.context.view_layer.update()
BEFORE = stats()

# The six hood lips had an incorrect quad index, joining adjacent stations
# diagonally and leaving every top edge open. Reuse their original profiles.
for o in game_objects():
    if not ('Canopy_' in o.name and o.name.endswith('_Lip')): continue
    n = len(o.data.vertices) // 3
    if n < 3 or len(o.data.vertices) != n * 3: continue
    faces = []
    for i in range(n - 1):
        for a, b in [(0, 1), (1, 2), (2, 0)]:
            faces.append((a*n+i, b*n+i, b*n+i+1, a*n+i+1))
    faces += [(0, n, 2*n), (n-1, 3*n-1, 2*n-1)]
    replace(o, [tuple(v.co) for v in o.data.vertices], faces)
    LOG.append(dict(object=o.name, change='Closed hood lip with correct continuous profile indices'))

# Resample the actual two wall surfaces. This removes the mismatched joins of
# the previous patch while retaining the curved silhouette and both doorways.
for i in range(3, 36):
    o = S.objects[f'M01_Reuse_CURVE_Left_Clapboard_{i:02d}']
    lo, hi = bounds(o); inv = o.matrix_world.inverted()
    cuts = [(1.487, 4.447, -2.025, -.375), (9.912, 12.872, -1.125, .525)]
    zs = sorted({lo[2], hi[2]} | {z for a,b,_,_ in cuts for z in (a,b) if lo[2] < z < hi[2]})
    count = math.ceil((hi[1]-lo[1])/.115)
    ys = sorted({lo[1]+(hi[1]-lo[1])*j/count for j in range(count+1)}
                | {v for _,_,left,right in cuts for v in (left,right)})
    cells = {(j,k) for j in range(len(ys)-1) for k in range(len(zs)-1)
             if not any(low < (zs[k]+zs[k+1])/2 < high and left < (ys[j]+ys[j+1])/2 < right
                        for low,high,left,right in cuts)}
    vertices=[];faces=[];corners={}
    def corner(j,k,inner,cell):
        key=(j,k,inner)
        if key in corners:return corners[key]
        cj,ck=cell;y=ys[j];z=zs[k]
        sample_y=min(ys[cj+1]-.0002,max(ys[cj]+.0002,y))
        sample_z=min(zs[ck+1]-.00005,max(zs[ck]+.00005,z))
        origin=Vector((0 if inner else -20,sample_y,sample_z))
        direction=inv.to_3x3()@Vector((-1 if inner else 1,0,0));direction.normalize()
        hit,point,_,_=o.ray_cast(inv@origin,direction)
        if not hit:
            toward=1 if sample_y<(lo[1]+hi[1])/2 else -1
            for shift in [.002,.005,.01,.02,.04,.08]:
                origin.y=sample_y+toward*shift
                hit,point,_,_=o.ray_cast(inv@origin,direction)
                if hit:break
        if not hit:raise RuntimeError(f'Wall sampling failed: {o.name}, {y}, {z}')
        corners[key]=len(vertices);vertices.append(((o.matrix_world@point).x,y,z))
        return corners[key]
    for j,k in sorted(cells):
        cell=(j,k)
        a,b,c,d=[corner(jj,kk,False,cell) for jj,kk in [(j,k),(j+1,k),(j+1,k+1),(j,k+1)]]
        e,f,g,h=[corner(jj,kk,True,cell) for jj,kk in [(j,k),(j+1,k),(j+1,k+1),(j,k+1)]]
        faces += [(a,b,c,d),(e,h,g,f)]
        if (j,k-1) not in cells:faces.append((a,e,f,b))
        if (j,k+1) not in cells:faces.append((d,c,g,h))
        if (j-1,k) not in cells:faces.append((a,d,h,e))
        if (j+1,k) not in cells:faces.append((b,f,g,c))
    replace(o, vertices, faces); o.matrix_world = Matrix.Identity(4)
    LOG.append(dict(object=o.name, change='Continuous closed curved wall around measured door openings'))

# Remove paired interior caps between the original adjoining wall segments.
# Never weld arbitrary touching props: this pass only concerns wall boards.
wall_removed = 0
for o in game_objects():
    if 'Clapboard' not in o.name: continue
    o.data = o.data.copy(); bm = bmesh.new(); bm.from_mesh(o.data)
    groups = defaultdict(list)
    for f in bm.faces:
        groups[tuple(sorted(tuple(round(v,5) for v in p.co) for p in f.verts))].append(f)
    internal = [f for group in groups.values() if len(group)==2
                and group[0].normal.dot(group[1].normal)<-.99 for f in group]
    wall_removed += len(internal)
    if internal: bmesh.ops.delete(bm, geom=internal, context='FACES_ONLY')
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=.00001)
    inside = [f for f in bm.faces if all(len(e.link_faces)>2 for e in f.edges)]
    if inside: bmesh.ops.delete(bm, geom=inside, context='FACES_ONLY')
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(o.data); bm.free(); o.data.update()
LOG.append(dict(change='Removed hidden paired wall caps', faces=wall_removed))

# Clean collapsed triangles and genuinely coplanar subdivisions once per mesh.
# Preserve UV seams, material boundaries and the existing smooth/flat shading.
seen=set(); cleaned=0
for o in game_objects():
    m=o.data
    if m in seen: continue
    seen.add(m)
    bm=bmesh.new();bm.from_mesh(m)
    zero=[f for f in bm.faces if f.calc_area()<1e-10]
    if zero: bmesh.ops.delete(bm,geom=zero,context='FACES_ONLY');cleaned+=len(zero)
    loose=[v for v in bm.verts if not v.link_faces]
    if loose: bmesh.ops.delete(bm,geom=loose,context='VERTS')
    # Minimal geometric simplification; no collapse decimation on architecture.
    if not m.uv_layers and not any(k in o.name for k in ['Cat','Flower','Ivy','Plant','Leaf','Foliage','Glass','JETPACK']):
        bmesh.ops.dissolve_limit(bm,angle_limit=math.radians(.3),verts=list(bm.verts),
                                edges=list(bm.edges),delimit={'MATERIAL','SEAM'})
    if bm.edges and all(e.is_manifold for e in bm.edges):
        bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    bm.to_mesh(m);bm.free();m.update()
LOG.append(dict(change='Removed collapsed faces', faces=cleaned))

# Glass is a shared material, including small lower-case named window panes.
glass_names=set()
for o in game_objects():
    for slot in o.material_slots:
        mat=slot.material
        if not mat or not any(s in mat.name.lower() for s in ['glass','amber_window']): continue
        if 'trim' in mat.name.lower():continue
        glass_names.add(mat.name);mat.use_nodes=True;bs=mat.node_tree.nodes.get('Principled BSDF')
        if bs:
            bs.inputs['Alpha'].default_value=.18 if 'Observatory_Clear' in mat.name else .28
            bs.inputs['Roughness'].default_value=.18;bs.inputs['Metallic'].default_value=.06
        mat.use_backface_culling=False
        if hasattr(mat,'surface_render_method'):mat.surface_render_method='DITHERED'
LOG.append(dict(change='Consistent shared window glazing', materials=sorted(glass_names)))

# Data sharing preserves separate named objects and transforms for later edits.
# Center only unparented static meshes, avoiding animation/controller origins.
for o in game_objects():
    if o.parent or o.children or o.animation_data or o.constraints or o.modifiers or o.data.users>1:continue
    if any(k in o.name for k in ['Elevator','JETPACK','Portal_']):continue
    m=o.data
    if not m.vertices:continue
    center=sum((v.co for v in m.vertices),Vector())/len(m.vertices)
    m.transform(Matrix.Translation(-center));o.matrix_world=o.matrix_world@Matrix.Translation(center)

def mesh_key(m):
    h=hashlib.sha256()
    for v in m.vertices: h.update(struct.pack('<3f', *(round(c,5) for c in v.co)))
    for p in m.polygons:
        h.update(struct.pack('<II?',len(p.vertices),p.material_index,p.use_smooth))
        h.update(struct.pack('<'+'I'*len(p.vertices),*p.vertices))
    for uv in m.uv_layers:
        for d in uv.data:h.update(struct.pack('<2f',*d.uv))
    h.update('|'.join(mat.name if mat else '' for mat in m.materials).encode())
    return h.digest()
shared={};linked=0
for o in game_objects():
    key=mesh_key(o.data)
    if key in shared and o.data != shared[key]:o.data=shared[key];linked+=1
    else:shared[key]=o.data
LOG.append(dict(change='Linked identical mesh datablocks', objects=linked))

# Archive geometry lives in the preceding .blend, rather than in the new scene.
# Retain cutters referenced by live modifiers and the presentation cameras.
required={mod.object for o in S.objects for mod in o.modifiers if mod.type=='BOOLEAN' and mod.object}
removed=[]
for o in list(S.objects):
    if o.hide_render and o not in required and o.type=='MESH':
        removed.append(o.name);bpy.data.objects.remove(o,do_unlink=True)
for c in list(bpy.data.collections):
    if not c.objects and not c.children and 'Disabled' in c.name:bpy.data.collections.remove(c)
repairs=bpy.data.collections.get('M06_Interior_Repairs')
if repairs:
    for name, keywords in [('M07_01_Floors_and_Thresholds',('Floor','Threshold','Step','Landing','Bridge','Collar')),
                           ('M07_02_Elevator_Glazing',('Glass',)),('M07_03_Rails_and_Clearance',())]:
        collection=bpy.data.collections.new(name);S.collection.children.link(collection)
        for o in list(repairs.objects):
            if keywords and not any(k in o.name for k in keywords):continue
            repairs.objects.unlink(o);collection.objects.link(o)
    if not repairs.objects:bpy.data.collections.remove(repairs)
S.name='Mansion_Architecture_v07_Refined'
S['source_revision']=SOURCE
S['revision_notes']='Closed wall boards and hood lips; shared meshes; normalized glazing; clean editable collections.'
for m in list(bpy.data.meshes):
    if m.users==0:bpy.data.meshes.remove(m)
bpy.context.view_layer.update()
AFTER=stats()
report=dict(source=SOURCE,before=BEFORE,after=AFTER,changes=LOG,archived_objects_removed=len(removed))
(OUT/'refinement-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'mansion-v07-refined.blend'),compress=True)
result=report
