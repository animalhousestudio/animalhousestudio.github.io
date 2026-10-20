"""Reproduce the static game temple from the archived Blender source.

Run: blender --background --factory-startup Tempio_della_Lince.blend --python export_temple.py
The source and interactive Blender session are never saved or modified.
"""
import bpy, bmesh, json, hashlib, math, struct, time
from pathlib import Path
from mathutils import Matrix, Vector

ART=Path(__file__).resolve().parent
CASA=ART.parent.parent
MODELS=CASA/'src/assets/models'
TEX=ART/'textures'; TEX.mkdir(exist_ok=True)
source=next(s for s in bpy.data.scenes if s.name.startswith('TEMPIO'))
bpy.context.window.scene=source
source.frame_set(1)
bpy.context.view_layer.update()
dg=bpy.context.evaluated_depsgraph_get()
selected=[o for o in source.objects if o.type in {'MESH','CURVE','FONT'} and any(c.name[:2] in {'01','02','03','04','05','07'} for c in o.users_collection) and not o.hide_render and not o.hide_get()]
original_materials={m.name:m for o in selected for m in o.data.materials if m}
game=bpy.data.scenes.new('LynxTempleExport')
game.render.engine='CYCLES'; game.cycles.samples=1; game.cycles.device='CPU'
game.render.threads_mode='FIXED';game.render.threads=8
game.render.bake.margin=8
material_map={}; original_outputs={}
for name,material in original_materials.items():
    m=material.copy();m.name='Temple_'+name
    material_map[name]=m
    nodes=m.node_tree.nodes; links=m.node_tree.links
    attr=nodes.new('ShaderNodeAttribute');attr.attribute_name='SourceGenerated'
    # Implicit Noise coordinates are Generated; freeze them before joining objects.
    for n in list(nodes):
        if n.type=='TEX_NOISE' and not n.inputs['Vector'].is_linked:
            links.new(attr.outputs['Vector'],n.inputs['Vector'])
    output=next(n for n in nodes if n.type=='OUTPUT_MATERIAL')
    original_outputs[m.name]=output.inputs['Surface'].links[0].from_socket

visuals=[]
for obj in selected:
    ev=obj.evaluated_get(dg)
    me=bpy.data.meshes.new_from_object(ev,preserve_all_data_layers=True,depsgraph=dg)
    if not me.polygons:
        bpy.data.meshes.remove(me);continue
    coords=[v.co.copy() for v in me.vertices]
    lo=[min(v[i] for v in coords) for i in range(3)];hi=[max(v[i] for v in coords) for i in range(3)]
    attr=me.attributes.new('SourceGenerated','FLOAT_VECTOR','POINT')
    for d,co in zip(attr.data,coords):d.vector=[(co[i]-lo[i])/(hi[i]-lo[i]) if hi[i]-lo[i]>1e-8 else 0 for i in range(3)]
    for i,m in enumerate(me.materials):
        if m:me.materials[i]=material_map[m.name]
    me.transform(obj.matrix_world)
    copy=bpy.data.objects.new(obj.name,me);game.collection.objects.link(copy);visuals.append(copy)
bpy.context.window.scene=game
bpy.ops.object.select_all(action='DESELECT')
for o in visuals:o.select_set(True)
bpy.context.view_layer.objects.active=visuals[0]
bpy.ops.object.join()
near=bpy.context.object;near.name='TempleVisual';near.matrix_world=Matrix.Identity(4)
for i in reversed(range(len(near.data.materials))):
    if near.data.materials[i] is None:near.data.materials.pop(index=i)
print('JOINED',len(near.data.vertices),len(near.data.polygons),flush=True)

def activate(obj):
    bpy.ops.object.select_all(action='DESELECT');obj.hide_set(False);obj.hide_render=False
    obj.select_set(True);bpy.context.view_layer.objects.active=obj

activate(near)
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(66),island_margin=.001,area_weight=.4)
bpy.ops.object.mode_set(mode='OBJECT')

def bake_image(name,kind,size):
    img=bpy.data.images.new(name,width=size,height=size,alpha=False)
    img.colorspace_settings.name='sRGB' if kind=='EMIT' else 'Non-Color'
    for m in near.data.materials:
        n=m.node_tree.nodes.new('ShaderNodeTexImage');n.image=img;n.name='BakeTarget_'+kind
        m.node_tree.nodes.active=n
    game.render.bake.use_clear=True
    print('BAKING',name,flush=True)
    bpy.ops.object.bake(type=kind)
    img.filepath_raw=str(TEX/(name+'.png'));img.file_format='PNG';img.save()
    return img

for m in near.data.materials:
    ns=m.node_tree.nodes;links=m.node_tree.links
    p=next(n for n in ns if n.type=='BSDF_PRINCIPLED')
    output=next(n for n in ns if n.type=='OUTPUT_MATERIAL')
    em=ns.new('ShaderNodeEmission')
    if p.inputs['Base Color'].is_linked:links.new(p.inputs['Base Color'].links[0].from_socket,em.inputs['Color'])
    else:em.inputs['Color'].default_value=p.inputs['Base Color'].default_value
    links.new(em.outputs[0],output.inputs['Surface'])
base=bake_image('lynx-temple-basecolor','EMIT',2048)
for m in near.data.materials:
    output=next(n for n in m.node_tree.nodes if n.type=='OUTPUT_MATERIAL')
    m.node_tree.links.new(original_outputs[m.name],output.inputs['Surface'])
normal=bake_image('lynx-temple-normal','NORMAL',2048)

# Replace all procedural inputs with their baked equivalents while retaining PBR values.
for m in near.data.materials:
    ns=m.node_tree.nodes;links=m.node_tree.links
    p=next(n for n in ns if n.type=='BSDF_PRINCIPLED')
    for slot in ('Base Color','Normal'):
        for link in list(p.inputs[slot].links):links.remove(link)
    color=ns.new('ShaderNodeTexImage');color.image=base;color.name='RuntimeBaseColor'
    links.new(color.outputs['Color'],p.inputs['Base Color'])
    norm=ns.new('ShaderNodeTexImage');norm.image=normal;norm.name='RuntimeNormal'
    tangent=ns.new('ShaderNodeNormalMap');links.new(norm.outputs['Color'],tangent.inputs['Color']);links.new(tangent.outputs['Normal'],p.inputs['Normal'])
    p.inputs['Base Color'].default_value=(1,1,1,1)

def export(obj,path):
    activate(obj)
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,use_active_scene=True,
        export_yup=True,export_apply=True,export_animations=False,export_cameras=False,export_lights=False,
        export_extras=False,export_materials='EXPORT',export_image_format='AUTO')

def tris(obj):return sum(len(p.vertices)-2 for p in obj.data.polygons)

tiers={};tierobjects={}
for tier,ratio,size in [('near',1,2048),('medium',.27,1024),('far',.095,512)]:
    obj=near if tier=='near' else near.copy()
    if tier!='near':
        obj.data=near.data.copy();game.collection.objects.link(obj);obj.name='TempleVisual'
        activate(obj)
        dec=obj.modifiers.new('Preserve silhouette '+tier,'DECIMATE');dec.ratio=ratio;dec.use_collapse_triangulate=True
        bpy.ops.object.modifier_apply(modifier=dec.name)
        obj.data.validate(clean_customdata=False)
        img_base=base.copy();img_base.name='lynx-temple-basecolor-'+tier;img_base.scale(size,size)
        img_norm=normal.copy();img_norm.name='lynx-temple-normal-'+tier;img_norm.scale(size,size)
        for im in (img_base,img_norm):im.filepath_raw=str(TEX/(im.name+'.png'));im.save()
        for m in obj.data.materials:
            m.node_tree.nodes['RuntimeBaseColor'].image=img_base
            m.node_tree.nodes['RuntimeNormal'].image=img_norm
    tierobjects[tier]=obj
    dest=MODELS/('props' if tier=='near' else 'lod')/('lynx-temple-'+tier+'.glb')
    export(obj,dest);tiers[tier]=dest
    obj.hide_render=True;obj.hide_set(True)
    print('TIER',tier,tris(obj),dest.stat().st_size,flush=True)

# Dedicated physical shell; no material/detail and no changing LOD dependencies.
collscene=bpy.data.scenes.new('LynxTempleCollision');bpy.context.window.scene=collscene
colliders=[]
def collision_copy(src,name,ratio=1,remove_bevel=True):
    copy=src.copy();copy.data=src.data.copy();collscene.collection.objects.link(copy)
    copy.name=name;copy.parent=None;copy.matrix_world=src.matrix_world.copy();copy.animation_data_clear()
    for mod in list(copy.modifiers):
        if remove_bevel and mod.type in {'BEVEL','SUBSURF'}:copy.modifiers.remove(mod)
    activate(copy)
    if copy.type!='MESH':bpy.ops.object.convert(target='MESH')
    for mod in list(copy.modifiers):bpy.ops.object.modifier_apply(modifier=mod.name)
    if ratio<1:
        mod=copy.modifiers.new('Physical approximation','DECIMATE');mod.ratio=ratio;mod.use_collapse_triangulate=True
        bpy.ops.object.modifier_apply(modifier=mod.name)
    copy.data.materials.clear();colliders.append(copy)
    return copy

for o in selected:
    name=o.name
    target=None;ratio=1
    if name.startswith('Basamento • gradino'):target='Step'+name[-2:]
    elif name=='Cella • parete cava':target='CellaWall'
    elif name.startswith('Colonna') and 'fusto' in name:target='Column'+name.split(' ')[1];ratio=.28
    elif name.startswith('Colonna') and 'base' in name:target='ColumnBase'+name.split(' ')[1];ratio=.35
    elif name.startswith('Colonna') and 'abaco' in name:target='ColumnCapital'+name.split(' ')[1]
    elif name.startswith('Oracolo • piedistallo'):target='Pedestal'+name[-3:].replace('.','') if '.' in name else 'Pedestal'
    elif name=='Cupola • calotta in bronzo':target='Dome';ratio=.10
    elif name=='Tamburo • muratura':target='Drum'
    elif name=='Trabeazione • anello':target='Entablature'
    elif name=='UNDERGROUND | removable sealed hatch cover':target='HatchCover'
    elif name.startswith('Pozzo • spalla') or name.startswith('Pozzo • testata'):target='WellWall'+str(len(colliders))
    elif name=='LYNX | continuous seated bronze body':target='LynxBody';ratio=.025
    elif name=='LYNX | sculpted head, ears, and cheek ruff':target='LynxHead';ratio=.012
    elif name=='LYNX | articulated right foreleg and paw':target='LynxPaw';ratio=.03
    if target:collision_copy(o,'TempleCollision_'+target,ratio)
bpy.ops.object.select_all(action='DESELECT')
for o in colliders:o.select_set(True)
bpy.context.view_layer.objects.active=colliders[0]
collision_path=MODELS/'props/lynx-temple-collision.glb'
bpy.ops.export_scene.gltf(filepath=str(collision_path),export_format='GLB',use_selection=True,use_active_scene=True,
    export_yup=True,export_apply=True,export_animations=False,export_cameras=False,export_lights=False,
    export_extras=False,export_materials='NONE')

def glb_stats(path):
    data=path.read_bytes();length=struct.unpack_from('<I',data,12)[0];j=json.loads(data[20:20+length])
    vertices=[];triangles=0
    # Vertex positions are world-space in visuals; physical nodes keep their matrices.
    def matrix(node):
        if 'matrix' in node:return Matrix([node['matrix'][i::4] for i in range(4)])
        loc=Vector(node.get('translation',[0,0,0]));q=node.get('rotation',[0,0,0,1])
        from mathutils import Quaternion
        rot=Quaternion((q[3],q[0],q[1],q[2])).to_matrix().to_4x4()
        return Matrix.Translation(loc)@rot@Matrix.Diagonal([*node.get('scale',[1,1,1]),1])
    def walk(i,parent):
        nonlocal triangles
        node=j['nodes'][i];trans=parent@matrix(node)
        if 'mesh' in node:
            for p in j['meshes'][node['mesh']]['primitives']:
                a=j['accessors'][p['attributes']['POSITION']]
                for x in (a['min'][0],a['max'][0]):
                    for y in (a['min'][1],a['max'][1]):
                        for z in (a['min'][2],a['max'][2]):vertices.append(trans@Vector((x,y,z)))
                triangles+=j['accessors'][p['indices']]['count']//3 if 'indices' in p else a['count']//3
        for child in node.get('children',[]):walk(child,trans)
    for n in j['scenes'][j.get('scene',0)]['nodes']:walk(n,Matrix.Identity(4))
    return dict(path=path.relative_to(CASA).as_posix(),sha256=hashlib.sha256(data).hexdigest(),triangles=triangles,bytes=len(data),bounds={'min':[min(v[i] for v in vertices) for i in range(3)],'max':[max(v[i] for v in vertices) for i in range(3)]},materials=[m.get('name') for m in j.get('materials',[])],images=len(j.get('images',[])),semanticNodes=[n['name'] for n in j.get('nodes',[]) if 'mesh' in n])

records={k:glb_stats(p) for k,p in tiers.items()}
collision=glb_stats(collision_path)
metadata={'bounds':records['near']['bounds'],'triangles':{k:v['triangles'] for k,v in records.items()},'bytes':{k:v['bytes'] for k,v in records.items()}}
(MODELS/'lod/lynx-temple-metadata.json').write_text(json.dumps(metadata,indent=2)+'\n',encoding='utf-8')
manifest={'schema':'casa3d.lynx-temple-export.v1','source':{'path':'art/lynx-temple-v01/Tempio_della_Lince.blend','sha256':hashlib.sha256((ART/'Tempio_della_Lince.blend').read_bytes()).hexdigest(),'originalPath':'C:/Users/Amministratore/Documents/Codex/2026-10-08/aggiungiamo-al-nostro-asteroide-un-tempietto/outputs/Tempio_della_Lince.blend'},'frame':1,'coordinateSystem':'glTF +Y up; entrance +Z; source coordinates and metre units preserved','placement':{'foundationBottomY':-.11,'stairTopsY':[.11,.33,.62],'interiorFloorY':.62,'undergroundBottomY':-1.28},'includedCollections':['01','02','03','04','05','07'],'excludedCollections':['06','90','98','Collection'],'animationExported':False,'hatch':'Closed by authored removable cover','prophecies':'Disabled; no future paper or text exported','materials':{'method':'Cycles diffuse-color emission bake and tangent-normal bake; original per-object Generated coordinates frozen before joining','atlasResolution':{'near':2048,'medium':1024,'far':512},'samePbrConstants':True},'tiers':records,'collision':collision,'notes':['Visual LOD decimation retains the same origin, UV and material semantics.','Collision GLB uses actual shell apertures and individual columns, preserving a walkable entrance.','Source authoring evidence is archived unchanged; prior authoring-only scope is superseded by the explicit user integration request.','Generic skill validator results retained as source-form-validation.txt; Meshy-generation schema requirements do not describe this procedural source.']}
(ART/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('EXPORT_COMPLETE',json.dumps(metadata),flush=True)
