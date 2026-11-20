"""Surface model in metres. Pixel coordinates refer to the supplied portrait."""

from math import atan2, cos, exp, pi, sin, sqrt, tau
from pathlib import Path
from tempfile import TemporaryDirectory

import bpy
import numpy as np
import OpenImageIO as oiio
from mathutils import Vector

from scimmia_mesh import Skin, body, linear_color

HERE = Path(__file__).resolve().parent


def coat_atlas():
    # Reserve the empty margin above the drawing for a seamless brush-grain strip.
    source = oiio.ImageInput.open(str(HERE / "riferimento.jpg"))
    rgb = source.read_image(format=oiio.UINT8)[:, :, :3].copy()
    source.close()
    h, w, _ = rgb.shape
    assert (w, h) == (768, 1024)
    v, u = np.mgrid[0:128, 0:w] / np.array([128, w])[:, None, None]
    rng = np.random.default_rng(1703)
    grain = np.zeros_like(u)
    for frequency in (14, 26, 43, 64, 86, 109):
        phase = rng.uniform(0, tau, 3)
        flow = .64*np.sin(tau*v + phase[0]) + .24*np.sin(tau*(v+2*u) + phase[1])
        strands = .5 + .5*np.cos(tau*frequency*u + flow + phase[2])
        grain += (strands**7) * (.55+.45*np.cos(tau*v + phase[2]))
    # Short tapered fibres break up the long brush marks on the shoulder and limbs.
    field = 219 + grain*9
    for _ in range(3500):
        x,y = rng.integers([0,0],[w,128])
        length = rng.integers(4,25)
        t = np.linspace(0,1,length)
        dx = np.rint(rng.uniform(-4,4)*t + sin(x*.08)*np.sin(pi*t)*1.6).astype(int)
        field[(y+np.arange(length))%128,(x+dx)%w] += rng.uniform(-26,19)*np.sin(pi*t)
    rgb[:128] = np.clip(field[:, :, None], 0, 255)
    with TemporaryDirectory() as scratch:
        path = str(Path(scratch) / "Maschera-e-mantello.jpg")
        buf = oiio.ImageBuf(rgb)
        buf.specmod().attribute("CompressionQuality", 92)
        buf.write(path)
        image = bpy.data.images.load(path)
        image.pack()
        image.filepath = "//Maschera-e-mantello.jpg"
    return image


class PaintedSkin(Skin):
    def __init__(self):
        super().__init__()
        self.uv = []
        self.nape = set()

    def tube(self, sections, count=10):
        if sections[-1][3] == "tail_3":
            # Smooth the centreline through the four animated links, including the hook.
            knots = [Vector(s[0]) for s in sections[::2]]
            radii = (.074,.060,.049,.033,.009)
            curve = []
            for i in range(4):
                p0,p1,p2,p3 = [knots[min(4,max(0,k))] for k in (i-1,i,i+1,i+2)]
                for j in range(6):
                    t = j/6
                    p = .5*(2*p1+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t
                            +(-p0+3*p1-3*p2+p3)*t**3)
                    r = radii[i]*(1-t)+radii[i+1]*t
                    bone = f"tail_{i}"
                    neighbor = (f"tail_{i-1}" if i else "hips") if t<.5 else f"tail_{min(i+1,3)}"
                    fraction = abs(t-.5)
                    w = {bone:1-fraction,neighbor:fraction} if neighbor != bone else bone
                    curve.append((p,r,r*.95,w,"coal"))
            curve.append((knots[-1],.002,.002,"tail_3","ivory"))
            return super().tube(curve,12)
        # A rounded elbow/knee needs skin on either side of the rotation centre.
        rounded = []
        for i, section in enumerate(sections):
            point,width,depth,weights,color = section
            if isinstance(weights,dict) and len(weights)==2 and any(
                    b.startswith(("shin.","forearm.")) for b in weights) and i not in (0,len(sections)-1):
                upper, lower = weights
                for side, weight in ((-1,.80),(0,.50),(1,.20)):
                    q,w,d,_,_ = sections[i+side]
                    rounded.append((Vector(point).lerp(Vector(q),.38),
                                    width*.62+w*.38,depth*.62+d*.38,
                                    {upper:weight,lower:1-weight},color))
            else:
                rounded.append(section)
        super().tube(rounded,count)

    def ellipsoid(self, center, radii, bone, color, n=16, bands=10, axis=None):
        if bone.startswith("hand.") and radii[0] == .068:
            # Flatten the palm and expose the four fingers beyond the metacarpals.
            super().ellipsoid(Vector(center)+Vector((0,.006,.015)),(.060,.046,.079),
                              bone,"dark",14,9,axis)
        elif bone.startswith("hand.") and radii[0] == .018:
            # Curled phalanges with a rounded contact pad on the knuckle.
            c = Vector(center)
            finger = [((0,.019,.032),.016,.017),((0,-.006,.018),.020,.021),
                      ((0,-.015,-.008),.019,.019),((0,-.010,-.027),.014,.012),
                      ((0,.006,-.026),.010,.009)]
            self.tube([(c+Vector(offset),w,d,bone,"coal" if i<2 else color)
                       for i,(offset,w,d) in enumerate(finger)],9)
            super().ellipsoid(c+Vector((0,-.029,-.003)),(.011,.004,.012),
                              bone,"lid",8,5)
        else:
            super().ellipsoid(center,radii,bone,color,n,bands,axis)

    def vert(self, point, weight, color):
        index = super().vert(point, weight, color)
        # Coat fibres run along the limbs. The face receives its own projection below.
        x, y, z = point
        self.uv.append((.50 + .46*sin(7*x+5*y), 1-(64+55*sin(3*z))/1024))
        return index

    def create(self, rig, collection):
        obj = super().create(rig, collection)
        uv = obj.data.uv_layers.new(name="Mantello")
        for loop in obj.data.loops:
            uv.data[loop.index].uv = self.uv[loop.vertex_index]
        for polygon in obj.data.polygons:
            if any(i in self.nape for i in polygon.vertices):
                for j in polygon.loop_indices:
                    x,y,z = obj.data.vertices[obj.data.loops[j].vertex_index].co
                    uv.data[j].uv = (.5+x, 1-(60+46*sin(5*z+y))/1024)
        material = obj.data.materials[0]
        nodes = material.node_tree.nodes
        texture = nodes.new("ShaderNodeTexImage")
        texture.image = coat_atlas()
        # glTF multiplies the base texture by COLOR_0 automatically.
        multiply = nodes.new("ShaderNodeMixRGB")
        multiply.blend_type = "MULTIPLY"
        multiply.inputs[0].default_value = 1
        links = material.node_tree.links
        pigment = next(n for n in nodes if n.type == "VERTEX_COLOR")
        links.new(pigment.outputs["Color"], multiply.inputs[1])
        links.new(texture.outputs["Color"], multiply.inputs[2])
        shader = nodes.get("Principled BSDF")
        links.new(multiply.outputs[0], shader.inputs["Base Color"])
        shader.inputs["Roughness"].default_value = .82
        return obj


# Widths follow the furry cheeks, taper towards the chin and leave the ears free.
# image row, centre X, half-width in pixels, profile radius in metres
PROFILE = np.array([
    (174,380,9,.015),(195,379,91,.089),(223,381,151,.140),(260,381,192,.177),
    (310,379,221,.202),(375,378,252,.218),(450,375,273,.225),(520,374,278,.221),
    (590,369,289,.211),(655,366,282,.201),(715,362,256,.172),(778,361,209,.141),
    (824,362,146,.099),(857,369,89,.066),(887,370,20,.019),
])


def sculpt_face(skin):
    # Elliptical cross-sections with relief for the muzzle, nose, brow and recessed eyes.
    def bump(x, y, cx, cy, width, height):
        return exp(-((x-cx)/width)**2 - ((y-cy)/height)**2)

    rings = []
    for row in np.linspace(PROFILE[0,0], PROFILE[-1,0], 41):
        cx, width, depth = [np.interp(row, PROFILE[:,0], PROFILE[:,i]) for i in (1,2,3)]
        ring = []
        for j in range(68):
            a = tau*j/68
            front = max(0, cos(a))
            px = cx + width*sin(a)
            x = (px-371)*.00092
            z = 1.348 + (527-row)*.00083
            y = -.091 - depth*cos(a)
            relief = .077*bump(px,row,350,577,67,49) + .021*bump(px,row,350,519,35,82)
            for ex in (245,512):
                relief += .032*bump(px,row,ex,422,87,46) - .020*bump(px,row,ex,482,63,47)
            for mx in (270,439):
                relief += .086*bump(px,row,mx,652,96,81)
            relief += .044*bump(px,row,357,791,146,49) - .022*bump(px,row,359,728,112,30)
            y -= front*relief
            i = skin.vert((x,y,z), "head", "chalk")
            if cos(a) >= -1e-6:
                skin.uv[i] = (px/768, 1-row/1024)
                skin.colors[i] = (1,1,1,1)
            else:
                skin.nape.add(i)
                nape = max(0, -cos(a)) * max(0, (row-540)/350)
                skin.colors[i] = (1-.32*nape,1-.34*nape,1-.34*nape,1)
            ring.append(i)
        rings.append(ring)
    skin.connect(rings)
    skin.faces.extend((tuple(rings[0]),tuple(reversed(rings[-1]))))


def lock(skin, base, tip, width, depth, weight, shade):
    a, b = Vector(base), Vector(tip)
    mid = a.lerp(b,.48)
    mid.y -= depth*.40
    skin.tube([(a,width*.66,depth*.68,weight,shade),
               (mid,width,depth,weight,shade),
               (a.lerp(b,.82),width*.45,depth*.54,weight,shade),
               (b,.001,.001,weight,shade)], 7)


def ears_and_ruff(skin):
    # Cupped pinnae, with the inner bowl recessed into a thick rolled helix.
    for s in (-1,1):
        rings = []
        for rx, rz, y, col in ((.027,.038,.069,"dark"),(.098,.113,.040,"coal"),
                               (.112,.121,-.006,"coal"),(.106,.118,-.057,"coal"),
                               (.070,.084,-.075,"lid"),(.053,.064,-.057,"dark"),
                               (.027,.040,-.033,"dark"),(.002,.002,-.031,"dark")):
            ring = []
            for j in range(32):
                a = tau*j/32
                ring.append(skin.vert((s*(.245+rx*cos(a)+rz*.29*sin(a)), y+.014*cos(a),
                                      1.538+rz*sin(a)), "head", col))
            rings.append(ring)
        skin.connect(rings)
        skin.faces.extend((tuple(rings[0]),tuple(reversed(rings[-1]))))
        for i in range(7):
            z = 1.49-.053*i
            width = (.207,.236,.251,.245,.224,.183,.125)[i]
            lock(skin,(s*width,-.104,z),(s*(width+.027+.012*sin(i*2)),-.072,z-.069),
                 .023,.016,"head","ivory")
        for i in range(3):
            x = s*(.021+.046*i)
            lock(skin,(x,-.085,1.606-.015*i),(x+s*(.020+.008*i),-.045,1.656-.016*i),
                 .028,.022,"head","chalk")


def coat(skin, joints):
    body(skin,joints)
    for i,(p,weights) in enumerate(zip(skin.points,skin.weights)):
        bone = max(weights, key=weights.get)
        p = Vector(p)
        x,y,z = p
        if bone in ("hips","spine","chest","head"):
            # Barrel chest over a narrow flank, pearly silverback saddle and a tapered bib.
            p.x *= 1+.14*exp(-((z-.99)/.13)**2)-.10*exp(-((z-.72)/.10)**2)
            p.y += .043*exp(-((z-.95)/.17)**2)*max(0,y/.17)
            if y > .035 and z > .70+.21*abs(x):
                color = "B6B4AC" if z>.85 else "75777A"
            elif y < -.047 and z > .76+1.26*abs(x):
                color = "CEC7B5" if z<.94+.35*abs(x) else "E9E3D6"
            else:
                color = "37383B"
        elif bone.startswith("tail_"):
            color = {"tail_0":"353438","tail_1":"56585B","tail_2":"A09E95","tail_3":"DFDBCB"}[bone]
        elif bone.startswith(("upper_arm","forearm","thigh","shin")):
            # Broad deltoid, ropey forearm and powerful upper thigh.
            a,b,_ = joints[bone]
            axis = Vector(b)-Vector(a)
            t = min(1,max(0,(p-Vector(a)).dot(axis)/axis.length_squared))
            center = Vector(a)+axis*t
            p += (p-center)*(.24*sin(pi*t) if bone.startswith(("forearm","thigh")) else .10*sin(pi*t))
            if bone.startswith("upper_arm") and t < .58 and abs(x)>.245:
                color = "A8A79E" if t < .29 else "747578"
            elif bone.startswith("forearm") and abs(x)>.36 and t<.75:
                color = "535557"
            else:
                color = "323339" if y<.06 else "414246"
        else:
            continue  # Finger pads and opposing thumbs keep their own pigmentation.
        skin.points[i] = p
        skin.colors[i] = linear_color(color)
    for sign,side in ((1,"L"),(-1,"R")):
        arm = "upper_arm."+side
        for i in range(4):
            lock(skin,(sign*(.258+.012*i),.060-.032*i,1.082-.014*i),
                 (sign*(.348+.006*i),.083-.036*i,.941-.014*i),.026,.017,arm,"shadow")
        for i in range(3):
            lock(skin,(sign*(.040+.051*i),-.139+.012*i,1.09+.012*i),
                 (sign*(.042+.062*i),-.145+.012*i,.856+.052*i),.044,.020,"chest","ivory")
        for i in range(4):
            # A small fan of overlapping guard hairs follows the outside of the forearm.
            lock(skin,(sign*(.393+.006*cos(i)),.077-.027*i,.539-.012*i),
                 (sign*(.422-.003*i),.065-.026*i,.420-.016*i),.020,.014,
                 "forearm."+side,"silver")
