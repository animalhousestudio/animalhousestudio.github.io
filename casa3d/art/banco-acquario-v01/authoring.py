import bpy
from math import cos,sin,tau,pi,sqrt

scene=bpy.context.scene
school=bpy.data.collections["Banco di pesci"]
clown_ids=(2,6,10)
tang_ids=(9,13,17)
violet_ids=(4,8,16)
amber_ids=(3,7,15)
assert bpy.data.filepath.endswith("Banco_di_pesci.blend")
assert bpy.context.mode=="OBJECT" and len(school.objects)==19

def rgb(value):
    raw=(int(value[i:i+2],16)/255 for i in (0,2,4))
    return tuple(c/12.92 if c<.04045 else ((c+.055)/1.055)**2.4 for c in raw)

def mix(a,b,t):
    return tuple(x*(1-t)+y*t for x,y in zip(a,b))

def ease(lo,hi,x):
    t=max(0,min(1,(x-lo)/(hi-lo)))
    return t*t*(3-2*t)

def contour(rows,x):
    for a,b in zip(rows,rows[1:]):
        if x<=b[0]+1e-8:
            return mix(a[1:],b[1:],max(0,min(1,(x-a[0])/(b[0]-a[0]))))
    return rows[-1][1:]

def set_colors(mesh,colors):
    layer=mesh.color_attributes.get("Livrea")
    if layer is None:
        layer=mesh.color_attributes.new(name="Livrea",type="FLOAT_COLOR",domain="POINT")
    layer.data.foreach_set("color",[value for color in colors for value in (*color,1)])
    mesh.color_attributes.active_color=layer

clown_body=[
    (-.46,.018,.031,-.029),(-.37,.042,.064,-.059),(-.25,.074,.110,-.098),
    (-.10,.095,.137,-.111),(.057,.103,.144,-.107),(.185,.089,.108,-.085),
    (.275,.059,.061,-.064),(.320,.032,.031,-.041),(.340,.011,.003,-.021),
]
tang_body=[
    (-.47,.018,.025,-.023),(-.39,.026,.054,-.044),(-.30,.040,.090,-.076),
    (-.15,.063,.125,-.109),(.035,.073,.137,-.125),(.170,.061,.103,-.095),
    (.270,.041,.050,-.062),(.329,.021,.011,-.034),(.340,.009,-.004,-.023),
]
navy=rgb("101D35")
ink=rgb("211526")
ivory=rgb("FFF7E8")
cream=rgb("FFDAA0")
gold=rgb("FFD657")
orange=rgb("FF7825")
cyan=rgb("36D9FB")
cobalt=rgb("1E59EB")
deep_blue=rgb("1242BE")
yellow_tail=rgb("FFE841")

def clown_color(x,z):
    glow=ease(-.16,.06,z)
    base=mix(rgb("FFAE38"),rgb("F15C1B"),glow)
    base=mix(base,rgb("CB3D20"),ease(.052,.17,z)*.65)
    for center,half in ((-.397,.029),(-.175,.054),(.121,.045)):
        d=abs(x-center)
        base=mix(base,ink,1-ease(half+.003,half+.015,d))
        white=1-ease(half-.006,half+.006,d)
        base=mix(base,mix(rgb("F3E3CB"),ivory,ease(-.14,.09,z)),white)
    return base

def tang_color(x,z):
    base=mix(mix(cyan,cobalt,ease(-.12,.029,z)),deep_blue,ease(.02,.138,z))
    base=mix(base,rgb("67E9F8"),.38*(1-ease(.012,.054,abs(z+.057))))
    # The inky shoulder curve comes back around a cobalt oval on the flank.
    outer=((x+.093)/.356)**2+((z-.038)/.124)**2
    window=((x+.018)/.235)**2+((z+.020)/.063)**2
    mask=(1-ease(.80,1.07,outer))*ease(.73,1.15,window)
    base=mix(base,navy,mask*.93)
    return mix(base,yellow_tail,.68*(1-ease(-.468,-.347,x)))

def rounded_fish(kind,length,local_scale,index,material):
    is_clown=kind=="Pesce pagliaccio"
    rows=clown_body if is_clown else tang_body
    height=(.93,1.0,.78)[index] if is_clown else (.95,1.0,.98)[index]
    unit=length/local_scale
    verts,polys,colors=[],[],[]

    def vertex(x,y,z,color):
        verts.append((unit*x,unit*y,unit*z*height))
        colors.append(color)
        return len(verts)-1

    def connect(a,b,closed=True):
        for i in range(len(a) if closed else len(a)-1):
            j=(i+1)%len(a)
            polys.append((a[i],a[j],b[j],b[i]))

    sides=20
    ring_count=50 if is_clown else 38
    station=set(rows[0][0]+(.34-rows[0][0])*j/(ring_count-1) for j in range(ring_count))
    if is_clown:
        station.update(c+d for c,h in ((-.397,.029),(-.175,.054),(.121,.045))
                       for d in (-h-.015,-h-.003,-h+.006,h-.006,h+.003,h+.015))
    last=None
    for u in sorted(station):
        ring=[]
        for j in range(sides):
            a=tau*j/sides
            sw=sin(a)
            # Bend the white ribbons around the shoulders and gill plate.
            warp=(.034*sw-.014*sw*sw)*sin(pi*(u-rows[0][0])/(.34-rows[0][0])) if is_clown else 0
            x=u+warp
            w,top,bottom=contour(rows,x)
            z=(top+bottom)*.5+(top-bottom)*.5*sw
            color=clown_color(u,z) if is_clown else tang_color(x,z)
            ring.append(vertex(x,w*cos(a),z,color))
        if last:
            connect(last,ring)
        else:
            polys.append(tuple(reversed(ring)))
        last=ring
    polys.append(tuple(last))

    for dorsal in (True,False):
        last=None
        sign=1 if dorsal else -1
        limit=.167 if dorsal else -.020
        for j in range(19):
            u=j/18
            x=-.364+(limit+.364)*u
            w,top,bottom=contour(rows,x)
            base=top if dorsal else bottom
            extend=(.071 if dorsal else .060)*(sin(pi*u)**.85 if j not in (0,18) else 0)
            if is_clown and dorsal:
                extend*=.94+.18*cos(tau*u*1.3)
            fin=[]
            for r in (0,.38,.72,.89,1):
                lateral=.0025*(1-r)
                z=base+sign*(r*(.009+extend)-.012)
                tip_color=mix(orange,ink,ease(.78,1,r)) if is_clown else mix(cyan,navy,ease(.58,1,r))
                base_color=clown_color(x,base) if is_clown else tang_color(x,base)
                fin.append(vertex(x-.023*r*sin(pi*u),lateral,z,mix(base_color,tip_color,ease(.06,.82,r))))
            if last:
                connect(last,fin,False)
            last=fin

    last=None
    for i in range(11):
        t=i/10
        fan=[]
        for j in range(19):
            f=2*j/18-1
            if is_clown:
                x=-.422-t*(.238-.078*abs(f)**1.7)
            else:
                x=-.446-t*(.214-.044*abs(f)**1.35)
            z=f*(.027+t*(.112 if is_clown else .100))
            shade=.52+.17*cos(tau*5*(f+1)*.5)
            if is_clown:
                fin=mix(orange,gold,shade)
                fin=mix(fin,ink,ease(.82,.99,t))
            else:
                fin=mix(yellow_tail,rgb("FFF7A0"),shade)
                fin=mix(fin,rgb("D2912D"),.49*ease(.82,.99,t))
            fan.append(vertex(x,.0045*t*(1-f*f),z,fin))
        if last:
            connect(last,fan,False)
        last=fan

    def eye(cx,cy,cz,size,color):
        last=None
        root=vertex(cx,cy,cz-size,color)
        for ii in range(1,5):
            a=pi*ii/5
            ring=[vertex(cx+size*sin(a)*cos(tau*j/12),
                         cy+size*.58*sin(a)*sin(tau*j/12),cz-size*cos(a),color) for j in range(12)]
            if last:
                connect(last,ring)
            else:
                for j in range(12):
                    polys.append((root,ring[(j+1)%12],ring[j]))
            last=ring
        end=vertex(cx,cy,cz+size,color)
        for j in range(12):
            polys.append((last[j],last[(j+1)%12],end))

    for side in (-1,1):
        x=.252 if is_clown else .260
        z=.017 if is_clown else .012
        w,top,bottom=contour(rows,x)
        y=w*sqrt(1-((2*z-top-bottom)/(top-bottom))**2)
        eye(x,side*y,z,.029 if is_clown else .023,rgb("8E4929") if is_clown else rgb("206AA4"))
        eye(x+.002,side*(y+.010),z,.022 if is_clown else .017,navy)
        eye(x+.006,side*(y+.020),z+.005,.005,ivory)
        fin_color=orange if is_clown else rgb("FFDF68")
        tip=gold if is_clown else rgb("FFF5A4")
        a=vertex(.104,side*.079,-.028,fin_color)
        b=vertex(.002,side*.132,-.064,tip)
        c=vertex(-.091,side*.119,-.108,ink if is_clown else rgb("E5AB3F"))
        d=vertex(-.029,side*.074,-.061,fin_color)
        polys.append((a,b,c,d) if side==1 else (d,c,b,a))

    mesh=bpy.data.meshes.new(f"{kind} | {int(length*100)} cm")
    mesh.from_pydata(verts,[],polys)
    mesh.materials.append(material)
    for polygon in mesh.polygons:
        polygon.use_smooth=True
    set_colors(mesh,colors)
    mesh.update()
    return mesh,unit

def accent(o,style):
    points=[v.co for v in o.data.shape_keys.key_blocks[0].data]
    colors=[tuple(c.color[:3]) for c in o.data.color_attributes["Livrea"].data]
    lo=min(v.x for v in points)
    span=max(v.x for v in points)-lo
    h=max(abs(v.z) for v in points[:60])
    if style=="violet":
        upper,ribbon,fin=[rgb(c) for c in ("5636C7","65DDF2","CD7EFE")]
    else:
        upper,ribbon,fin=[rgb(c) for c in ("D05B42","FFF3A4","FFDA5D")]
    for i,(x,y,z) in enumerate(points):
        u=(x-lo)/span
        if i<62:
            side=ease(.12,.30,abs(y)/max(p.y for p in points[:60]))
            streak=(1-ease(.17,.50,abs(z/h+.12-.21*u)))*side*ease(.04,.34,u)*(1-ease(.72,.96,u))
            body=mix(colors[i],upper,.28*ease(0,1,z/h))
            colors[i]=mix(body,ribbon,streak*.81)
        elif not (76<=i<=81 or 85<=i<=90):
            colors[i]=mix(colors[i],fin,.56)
    set_colors(o.data,colors)

assert all(school.objects[f"Pesce {i:02d}"].data.color_attributes.get("Livrea")
           for i in (*clown_ids,*tang_ids,*violet_ids,*amber_ids))
bpy.ops.ed.undo_push(message="Prima dei pesci pagliaccio e chirurgo")
survivors=[]
for ids,kind in ((clown_ids,"Pesce pagliaccio"),(tang_ids,"Pesce chirurgo blu")):
    for index,i in enumerate(ids):
        o=school.objects[f"Pesce {i:02d}"]
        old=o.data
        old_keys=old.shape_keys.animation_data
        mat=old.materials[-1]
        assert mat.name=="Banco | Livrea sfumata"
        m,unit=rounded_fish(kind,o["Lunghezza nominale (m)"],o.scale.x,index,mat)
        o.data=m
        o["Tipo di pesce"]=kind
        o.shape_key_add(name="Base")
        tail=o.shape_key_add(name="Flessione coda")
        tail.slider_min=-1
        for p in tail.data:
            p.co.y+=unit*(.113 if i in clown_ids else .102)*ease(.22,.66,-p.co.x/unit)
        new_keys=m.shape_keys.animation_data_create()
        new_keys.action=old_keys.action
        new_keys.action_slot=old_keys.action_slot
        survivors.append((o.name,kind,len(m.vertices),new_keys.action_slot.identifier))
for ids,style in ((violet_ids,"violet"),(amber_ids,"amber")):
    for i in ids:
        accent(school.objects[f"Pesce {i:02d}"],style)
scene.frame_set(scene.frame_current,subframe=scene.frame_subframe)
bpy.context.view_layer.update()
result={"substitutions":survivors,"ornamental_shoal":6,"small_simple":6,"school":len(school.objects)}


import bpy
s=bpy.context.scene
o=bpy.data.objects["Pesce 10"]
m=o.data
assert o.get("Tipo di pesce")=="Pesce pagliaccio" and len(m.vertices)==2067
for data in (m.vertices,*(k.data for k in m.shape_keys.key_blocks)):
    for v in data:
        v.co.y*=.72
m.update()
m.shape_keys.update_tag()
o.update_tag()
bpy.context.view_layer.update()
result={"name":o.name,"width_scale":.72}


import bpy
from math import cos,sin,tau,pi,sqrt,exp
def rgb(value):
    raw=(int(value[i:i+2],16)/255 for i in (0,2,4))
    return tuple(c/12.92 if c<.04045 else ((c+.055)/1.055)**2.4 for c in raw)

def mix(a,b,t):
    return tuple(x*(1-t)+y*t for x,y in zip(a,b))

def ease(lo,hi,x):
    t=max(0,min(1,(x-lo)/(hi-lo)))
    return t*t*(3-2*t)

def contour(rows,x):
    for a,b in zip(rows,rows[1:]):
        if x<=b[0]+1e-8:
            return mix(a[1:],b[1:],max(0,min(1,(x-a[0])/(b[0]-a[0]))))
    return rows[-1][1:]

def set_colors(mesh,colors):
    layer=mesh.color_attributes.get("Livrea")
    if layer is None:
        layer=mesh.color_attributes.new(name="Livrea",type="FLOAT_COLOR",domain="POINT")
    layer.data.foreach_set("color",[value for color in colors for value in (*color,1)])
    mesh.color_attributes.active_color=layer


school=bpy.data.collections["Banco di pesci"]
o=school.objects["Pesce 15"]
assert bpy.data.filepath.endswith("Banco_di_pesci.blend")
assert o.get("Tipo di pesce")=="Sarago" and o.data.materials[0].name=="Ambra"

# Flattened body, short tapered snout, broad curved fins.
sections=[
    (-.47,.023,.041,-.033),(-.37,.041,.123,-.085),(-.26,.068,.225,-.167),
    (-.13,.093,.256,-.212),(.02,.104,.254,-.225),(.128,.092,.216,-.211),
    (.218,.071,.144,-.186),(.282,.053,.065,-.167),(.326,.035,-.026,-.143),
    (.360,.021,-.077,-.131),(.397,.010,-.100,-.126),(.410,.004,-.107,-.121),
]
bright=rgb("FFF64C")
yellow=rgb("FFD52B")
warm=rgb("E5A71C")
gold=rgb("ABE7D5")
navy=rgb("111932")
olive=rgb("96701C")
black=rgb("0A152A")

def fish_color(x,y,z):
    color=mix(mix(warm,yellow,ease(-.22,-.055,z)),bright,ease(-.08,.225,z)*.76)
    side=ease(.30,.75,abs(y)/max(.018,contour(sections,x)[0]))
    mask=ease(-.184,-.05,z)*(1-ease(.15,.245,z))*side
    for i in range(7):
        center=-.207+i*.038+.035*(z+.075)+.19*(z+.09)**2
        line=exp(-((x-center)/.0058)**2)
        color=mix(color,olive,line*mask*(.38+.24*i/6))
    # The pigment fades at the edge of the asymmetric patch on each cheek.
    patch_x=.259-.097*(z+.056)+.32*(z+.056)**2
    x_width=.056*(.85+.15*ease(-.12,.015,z))
    dist=sqrt(((x-patch_x)/x_width)**2+((z+.067)/.089)**2)
    color=mix(color,navy,(1-ease(.82,1.06,dist))*.98)
    return color

verts,faces,colors,smooth=[],[],[],[]
def vertex(x,y,z,color):
    verts.append((x,y,z))
    colors.append(color)
    return len(verts)-1
def face(ids,shade=True):
    faces.append(tuple(ids))
    smooth.append(shade)
def band(a,b,closed=True,flip=False):
    for j in range(len(a) if closed else len(a)-1):
        k=(j+1)%len(a)
        pts=(a[j],a[k],b[k],b[j])
        face(reversed(pts) if flip else pts)

last=None
stations=set(-.47+.88*i/95 for i in range(96))
stations.update(-.207+i*.038+shift for i in range(7) for shift in (-.009,-.003,.003,.009))
for x in sorted(stations):
    w,top,bottom=contour(sections,x)
    ring=[]
    for k in range(32):
        t=tau*k/32
        y=w*cos(t)
        z=(top+bottom)*.5+(top-bottom)*.5*sin(t)
        ring.append(vertex(x,y,z,fish_color(x,y,z)))
    if last is None:
        face(reversed(ring),False)
    else:
        band(last,ring)
    last=ring
face(last,False)

for dorsal in (True,False):
    sign=1 if dorsal else -1
    stop=.190 if dorsal else .073
    last=None
    for j in range(38):
        u=j/37
        cx=-.410+(stop+.410)*u
        taper=max(0,sin(pi*u))**.74
        extent=(.083 if dorsal else .066)*taper*(1.05-.25*u)
        fin=[]
        for v in (0,.35,.59,.80,1):
            x=cx-.10*v*taper*(1-u)
            w,top,bottom=contour(sections,x)
            base=top if dorsal else bottom
            z=base+sign*(-.013+v*(.010+extent))
            crease=.5+.5*cos(tau*15*(u+.025*v))
            tint=mix(warm,bright,.62+.21*crease)
            tint=mix(tint,gold,.32*ease(.83,1,v)*(1-ease(.63,.95,u)))
            fin.append(vertex(x,.0025*(1-v),z,mix(fish_color(cx,0,base),tint,ease(.05,.72,v))))
        if last:
            band(last,fin,False,dorsal)
        last=fin

last=None
for i in range(14):
    u=i/13
    fan=[]
    for j in range(21):
        v=2*j/20-1
        x=-.437-u*(.223-.089*abs(v)**1.7)
        z=v*(.033+.083*u)
        grain=.5+.5*cos(tau*6*(v+1)*.5)
        color=mix(warm,bright,.53+.17*grain)
        color=mix(color,gold,.33*ease(.76,1,u))
        fan.append(vertex(x,.003*u*(1-v*v),z,color))
    if last:
        band(last,fan,False)
    last=fan

def eye(cx,cy,cz,r,color):
    previous=None
    p=vertex(cx,cy,cz-r,color)
    for k in range(1,7):
        t=pi*k/7
        ring=[]
        for j in range(16):
            a=tau*j/16
            ring.append(vertex(cx+r*cos(a)*sin(t),cy+.58*r*sin(a)*sin(t),cz-r*cos(t),color))
        if previous:
            band(previous,ring)
        else:
            for j in range(16):
                face((p,ring[(j+1)%16],ring[j]))
        previous=ring
    p=vertex(cx,cy,cz+r,color)
    for j in range(16):
        face((previous[j],previous[(j+1)%16],p))

for side in (-1,1):
    eye(.270,side*.057,-.044,.024,rgb("8B661B"))
    eye(.271,side*.066,-.045,.018,black)
    eye(.275,side*.075,-.039,.005,rgb("FAF5C6"))
    a=vertex(.174,side*.075,-.060,yellow)
    b=vertex(.057,side*.126,-.114,bright)
    c=vertex(-.065,side*.137,-.150,warm)
    d=vertex(.016,side*.094,-.103,yellow)
    face((a,b,c,d) if side==1 else (d,c,b,a))

old=o.data
old_anim=old.shape_keys.animation_data
length=.386
scale=length/((max(v[0] for v in verts)-min(v[0] for v in verts))*o.scale.x)
height_scale=.90
mesh=bpy.data.meshes.new("Pesce farfalla giallo | Disco")
mesh.from_pydata([(x*scale,y*scale,z*scale*height_scale) for x,y,z in verts],[],faces)
mesh.materials.append(old.materials[-1])
for p,v in zip(mesh.polygons,smooth):
    p.use_smooth=v
set_colors(mesh,colors)
mesh.update()
bpy.ops.ed.undo_push(message="Prima del pesce farfalla giallo")
o.data=mesh
o["Tipo di pesce"]="Pesce farfalla giallo"
o["Lunghezza nominale (m)"]=length
o.shape_key_add(name="Base")
tail=o.shape_key_add(name="Flessione coda")
tail.slider_min=-1
for p,(x,y,z) in zip(tail.data,verts):
    p.co.y+=scale*.085*ease(.23,.66,-x)
anim=mesh.shape_keys.animation_data_create()
anim.action=old_anim.action
anim.action_slot=old_anim.action_slot
s=bpy.context.scene
s.frame_set(s.frame_current,subframe=s.frame_subframe)
bpy.context.view_layer.update()
result={"fish":o.name,"type":o["Tipo di pesce"],"length_m":length,"vertices":len(mesh.vertices),"animation_slot":anim.action_slot.identifier}


import bpy
from math import sqrt,exp
def rgb(value):
    raw=(int(value[i:i+2],16)/255 for i in (0,2,4))
    return tuple(c/12.92 if c<.04045 else ((c+.055)/1.055)**2.4 for c in raw)

def mix(a,b,t):
    return tuple(x*(1-t)+y*t for x,y in zip(a,b))

def ease(lo,hi,x):
    t=max(0,min(1,(x-lo)/(hi-lo)))
    return t*t*(3-2*t)

def contour(rows,x):
    for a,b in zip(rows,rows[1:]):
        if x<=b[0]+1e-8:
            return mix(a[1:],b[1:],max(0,min(1,(x-a[0])/(b[0]-a[0]))))
    return rows[-1][1:]

def set_colors(mesh,colors):
    layer=mesh.color_attributes.get("Livrea")
    if layer is None:
        layer=mesh.color_attributes.new(name="Livrea",type="FLOAT_COLOR",domain="POINT")
    layer.data.foreach_set("color",[value for color in colors for value in (*color,1)])
    mesh.color_attributes.active_color=layer



sections=[
    (-.47,.023,.041,-.033),(-.37,.041,.123,-.085),(-.26,.068,.225,-.167),
    (-.13,.093,.256,-.212),(.02,.104,.254,-.225),(.128,.092,.216,-.211),
    (.218,.071,.144,-.186),(.282,.053,.065,-.167),(.326,.035,-.026,-.143),
    (.360,.021,-.077,-.131),(.397,.010,-.100,-.126),(.410,.004,-.107,-.121),
]
bright=rgb("FFF64C")
yellow=rgb("FFD52B")
warm=rgb("E5A71C")
gold=rgb("ABE7D5")
navy=rgb("111932")
olive=rgb("96701C")
black=rgb("0A152A")

def fish_color(x,y,z):
    color=mix(mix(warm,yellow,ease(-.22,-.055,z)),bright,ease(-.08,.225,z)*.76)
    side=ease(.30,.75,abs(y)/max(.018,contour(sections,x)[0]))
    mask=ease(-.184,-.05,z)*(1-ease(.15,.245,z))*side
    for i in range(7):
        center=-.207+i*.038+.035*(z+.075)+.19*(z+.09)**2
        line=exp(-((x-center)/.0058)**2)
        color=mix(color,olive,line*mask*(.38+.24*i/6))
    # The pigment fades at the edge of the asymmetric patch on each cheek.
    patch_x=.259-.097*(z+.056)+.32*(z+.056)**2
    x_width=.056*(.85+.15*ease(-.12,.015,z))
    dist=sqrt(((x-patch_x)/x_width)**2+((z+.067)/.089)**2)
    color=mix(color,navy,exp(-.65*dist**5)*.985)
    return color


o=bpy.data.objects["Pesce 15"]
mesh=o.data
n_body=len(set(-.47+.88*i/95 for i in range(96)).union(-.207+i*.038+shift for i in range(7) for shift in (-.009,-.003,.003,.009)))*32
scale=o["Lunghezza nominale (m)"]/(1.07*o.scale.x)
layer=mesh.color_attributes["Livrea"]
for i,p in enumerate(mesh.shape_keys.key_blocks[0].data[:n_body]):
    x,y,z=p.co
    layer.data[i].color=(*fish_color(x/scale,y/scale,z/(scale*.90)),1)
mesh.update()
bpy.ops.ed.undo_push(message="Pesce farfalla giallo nel banco")
result={"body_colors":n_body}
