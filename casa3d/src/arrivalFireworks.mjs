import {
  AdditiveBlending, BufferGeometry, Color, Float32BufferAttribute, Group,
  DoubleSide, LineSegments, Mesh, Points, ShaderMaterial, Vector3,
} from 'three';

// [cue, horizontal and vertical composition offsets, depth variation, spread, palette].
const BURSTS = [
  [0, -.57, .27, 17, 7.6, 0], [.19, .53, -.26, 23, 10, 1],
  [.50, .05, .49, 31, 12, 2], [.85, -.74, -.25, 34, 10, 3],
  [1.30, .67, .38, 24, 8, 4], [1.75, -.32, -.44, 18, 7.5, 2],
  [2.45, .34, .27, 27, 10, 3], [2.82, -.64, .39, 33, 12, 1],
  [3.18, .75, -.39, 21, 8.3, 0], [3.62, -.15, .56, 23, 9, 4],
  [4.20, -.62, -.32, 24, 9.5, 2], [4.62, .53, .20, 19, 7.2, 1],
  [5.05, .08, -.48, 34, 12, 3], [5.55, -.76, .41, 36, 13, 4],
  [6.00, .65, .42, 23, 8.5, 0], [6.45, -.42, -.29, 22, 8.5, 1],
  [6.90, .41, -.36, 37, 13, 4], [7.43, -.66, .23, 28, 10, 0],
  [7.86, .62, .49, 30, 10, 2], [8.27, .11, -.47, 21, 7.5, 3],
  [8.76, -.69, -.29, 20, 8, 4], [9.20, .54, .28, 25, 10, 1],
  [9.63, -.26, .48, 35, 13, 0], [10.04, .71, -.36, 20, 8, 2],
  [10.47, -.56, .32, 18, 7.8, 3], [10.71, .59, .29, 29, 11, 0],
  [10.94, .05, .55, 33, 12, 1], [11.14, -.69, -.25, 30, 11, 4],
  [11.34, .61, -.35, 18, 7.6, 3], [11.59, -.24, -.49, 29, 11, 2],
  [11.82, -.64, .37, 22, 9, 1], [12.02, .65, .41, 22, 9, 0],
];
const PALETTES = [
  [0xff3679, 0xffa943], [0x3ce8ff, 0x7993ff], [0xffdf67, 0xff7442],
  [0xb1ff61, 0x32e8a7], [0xdd85ff, 0x7254ff],
].map(pair => pair.map(hex => new Color(hex)));
const SPARKS_PER_BURST = 120;
export const COASTER_FIREWORKS = Object.freeze({ start:.10, end:.985 });
const RIDE_WINDOW = 5;
const RIDE_CUE_INTERVAL = .51;
// Ignition x and depth, margin below the frame, yaw around world up, jet length.
const FLARE_EMITTERS = [
  [-1.02,1.18,-1.9,.57,19],
  [-.74,1.27,-2.0,.28,25],
  [-.36,1.33,-2.3,.055,30],
  [.62,1.28,-2.04,-.30,23],
  [1.06,1.19,-1.89,-.61,17],
];
const FLARE_RAYS = 104;

const vertex = /* glsl */ `
  uniform float elapsed, duration, viewportHeight;
  attribute vec3 velocity, tint;
  attribute vec4 spark;
  attribute float tail;
  varying vec3 vTint;
  varying float vAlpha;
  void main() {
    float age = elapsed - spark.x;
    float t = max(0.0, age - tail * spark.w);
    float travel = (1.0 - exp(-t * 1.65)) / 1.65 + t * .16;
    vec3 p = position + velocity * travel;
    p.y -= t * t * 5.2;
    vec4 eye = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * eye;
    gl_PointSize = clamp(viewportHeight * spark.z / max(.1, -eye.z), 1.2, 23.0);
    float fade = 1.0 - smoothstep(spark.y * .40, spark.y, t);
    float visible = smoothstep(0.0, .105, t);
    float last = 1.0 - smoothstep(duration - .92, duration, elapsed);
    float shimmer = .82 + .18 * sin(t * 17.0 + spark.z * 33.0);
    vAlpha = visible * fade * last * shimmer * (1.0 - tail * .90);
    vTint = mix(tint, vec3(1.0, .91, .70), .42 * (1.0 - smoothstep(.05, .42, t)));
    if (vAlpha < .002 || eye.z > -.15) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  }
`;
const sparkFragment = /* glsl */ `
  varying vec3 vTint;
  varying float vAlpha;
  void main() {
    float r = length(gl_PointCoord - .5) * 2.0;
    float core = 1.0 - smoothstep(.05, .36, r);
    float glow = exp(-r * r * 3.8) * (1.0 - smoothstep(.62, 1.0, r));
    gl_FragColor = vec4(mix(vTint, vec3(1.0), core * .56), vAlpha * (core * .78 + glow * .46));
    #include <colorspace_fragment>
  }
`;
const trailFragment = /* glsl */ `
  varying vec3 vTint;
  varying float vAlpha;
  void main() {
    gl_FragColor = vec4(vTint, vAlpha * .76);
    #include <colorspace_fragment>
  }
`;

function createBuffers({ bounds, sample, duration, rideWindow, aspect = 1.5 }) {
  const makeBuffer = () => ({ position: [], velocity: [], tint: [], spark: [], tail: [] });
  const sparks = makeBuffer();
  const trails = makeBuffer();
  let seed = 76291;
  function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  function addSpark(position, velocity, color, time, life, size, lag, withTrail) {
    function emit(buffer, tail) {
      buffer.position.push(...position);
      buffer.velocity.push(...velocity);
      buffer.tint.push(color.r, color.g, color.b);
      buffer.spark.push(time, life, size, lag);
      buffer.tail.push(tail);
    }
    emit(sparks, 0);
    if (withTrail) for (const tail of [0, .46, .46, 1]) emit(trails, tail);
  }
  const normal = rideWindow === undefined
    ? sample(.5).position.clone().sub(bounds.getCenter(new Vector3())).setY(0).normalize() : null;
  const rearEdge = normal ? edgeOf(bounds,normal,false) : null;
  const cues = [];
  if (rideWindow !== undefined) {
    const first = Math.max(0,Math.ceil((rideWindow-2.65)/RIDE_CUE_INTERVAL));
    const end = Math.min(rideWindow+RIDE_WINDOW,duration-.55);
    for (let i=first;i*RIDE_CUE_INTERVAL<end;i++) {
      const pair = i%2 ? [-1,1] : [1,-1];
      for (const [j,side] of pair.entries()) {
        cues.push([i*RIDE_CUE_INTERVAL+j*.17,side*(.24+((i*3+j*2)%5)*.14),
          .22+((i*7+j*3)%6)*.102,16+(i%4)*12,8+(i+j)%5,(i+j*2)%PALETTES.length,i*2+j]);
      }
    }
  } else {
    BURSTS.forEach(([cue,x,y,depth,force,palette],i) =>
      cues.push([.15+cue/12.02*(duration-1.85),x,.20+y*.54,depth,force,palette,i]));
  }
  for (const [time,x,y,depth,force,palette,key] of cues) {
    seed = (76291+Math.imul(key,719393))>>>0;
    const frame = sample(Math.min(1,(time+.55)/duration));
    const { position: eye, forward } = frame;
    const right = new Vector3().crossVectors(forward,frame.up ?? new Vector3(0,1,0)).normalize();
    const up = new Vector3().crossVectors(right,forward).normalize();
    const direction = forward.clone().addScaledVector(right,x*Math.min(.72,.55*aspect)).addScaledVector(up,y);
    const axis = normal ?? forward.clone().setY(Math.max(-.48,Math.min(.48,forward.y))).normalize();
    const incidence = direction.dot(axis);
    let distance;
    if (normal) {
      if (incidence > -.34) direction.addScaledVector(axis,-.34-incidence);
      distance = (rearEdge-285-depth-eye.dot(axis))/direction.dot(axis);
    } else {
      // Facing open space, the cue needs only a clear stand-off. Looking back
      // toward the island, place it beyond the whole visible world along the shot.
      const clearance = edgeOf(bounds,axis,true)-eye.dot(axis);
      distance = Math.max(150+depth,clearance+185+depth)/Math.max(.28,incidence);
    }
    const center = eye.clone().addScaledVector(direction,distance).toArray();
    const worldSpread = (normal ? Math.min(235,Math.max(72,distance*.23))
      : Math.min(148,Math.max(34,distance*.238)))*(.74+force*.024);
    const [outer, inner] = PALETTES[palette];
    for (let i = 0; i < SPARKS_PER_BURST; i++) {
      const vertical = 1 - 2 * (i + .5) / SPARKS_PER_BURST;
      const azimuth = i * 2.399963 + time;
      const radius = Math.sqrt(1 - vertical ** 2);
      const fast = i % 4 !== 0;
      const speed = worldSpread * (fast ? .78 + random() * .42 : .27 + random() * .39);
      const color = fast ? outer : inner;
      const vx = Math.cos(azimuth) * radius * speed;
      const vy = vertical * speed;
      const vz = Math.sin(azimuth) * radius * speed;
      const life = 1.25 + random() * .95;
      const size = Math.min(11,distance*.007)*(.62+random()*.43);
      const lag = .115 + random() * .155;
      const sparkTime = time + random() * .11;
      addSpark(center, [vx, vy, vz], color, sparkTime, life, size, lag, fast);
    }
  }
  function geometry(buffer) {
    const result = new BufferGeometry();
    for (const [name, values] of Object.entries(buffer)) {
      result.setAttribute(name, new Float32BufferAttribute(values,
        name === 'spark' ? 4 : name === 'tail' ? 1 : 3));
    }
    return result;
  }
  return { geometries:[geometry(sparks),geometry(trails)], normal, rearEdge, cues:cues.length };
}

function edgeOf(bounds,axis,far) {
  return ['x','y','z'].reduce((sum,k) =>
    sum + ((axis[k]>=0)===far ? bounds.max[k] : bounds.min[k])*axis[k],0);
}

function createShow(parent,layout,name) {
  const uniforms = {
    elapsed: { value: 0 }, duration: { value:layout.duration }, viewportHeight: { value: 1 },
  };
  const materials = [sparkFragment, trailFragment].map(fragmentShader => new ShaderMaterial({
    uniforms, vertexShader: vertex, fragmentShader, blending: AdditiveBlending,
    transparent: true, depthWrite: false, toneMapped: false,
  }));
  const group = new Group();
  group.name = name;
  group.add(new Points(new BufferGeometry(),materials[0]),new LineSegments(new BufferGeometry(),materials[1]));
  for (const child of group.children) child.frustumCulled = false;
  parent.add(group);
  let window = -1;
  function fill(rideWindow) {
    const {geometries,normal,rearEdge,cues} = createBuffers({...layout,rideWindow});
    for (const [index,child] of group.children.entries()) {
      child.geometry.dispose();
      child.geometry = geometries[index];
    }
    if (normal) group.userData.rearPlane = {normal:normal.toArray(),edge:rearEdge};
    group.userData.cues = cues;
  }
  if (!layout.ride) fill();
  return {
    update(seconds, viewportHeight,visible = true) {
      group.visible = visible;
      if (!visible) return;
      const next = Math.floor(seconds/RIDE_WINDOW)*RIDE_WINDOW;
      if (layout.ride && next !== window) { window = next; fill(window); }
      uniforms.elapsed.value = seconds;
      uniforms.viewportHeight.value = viewportHeight;
    },
    dispose() {
      group.removeFromParent();
      group.children.forEach(child => child.geometry.dispose());
      materials.forEach(material => material.dispose());
    },
  };
}

export function createArrivalFireworks(scene,layout) {
  return createShow(scene,layout,'ArrivalFireworks');
}

export function createCoasterFireworks(scene,layout) {
  return createShow(scene,{...layout,ride:true},'ArrivalFireworks');
}

const flareVertex = /* glsl */ `
  uniform float elapsed, cutoff;
  uniform vec3 origins[5], tips[5];
  attribute float emitter;
  attribute vec4 pattern;
  varying vec2 local;
  varying float brightness;
  void main() {
    int id = int(emitter);
    vec3 origin = origins[id];
    vec3 tip = tips[id];
    vec3 axis = normalize(tip-origin);
    vec3 side = normalize(cross(axis,normalize(-origin)));
    local = position.xy;
    brightness = smoothstep(.06,.43,elapsed)*(1.0-smoothstep(cutoff-2.1,cutoff,elapsed));
    float along = local.x;
    float width = local.y;
    #ifdef SPARKS
      float age = fract(elapsed*pattern.y+pattern.x);
      float drift = 1.0-exp(-age*3.0);
      along = pattern.z + drift*.13 + local.x*(.46+.54*drift);
      width = pattern.w*(.11+drift*.72) + local.y*(.45+.55*drift);
      brightness *= smoothstep(0.0,.075,age)*(1.0-smoothstep(.30,1.0,age));
      brightness *= position.z*(.77+.23*sin(elapsed*24.0+pattern.x*81.0));
    #endif
    vec3 p = mix(origin,tip,along);
    float spread = min(9.0,-p.z)*.72;
    p += side*width*spread;
    #ifdef SPARKS
      p += cross(axis,side)*width*spread*sin(pattern.x*35.0)*.77;
    #endif
    gl_Position = projectionMatrix*modelViewMatrix*vec4(p,1.0);
  }
`;

const flareFragment = /* glsl */ `
  uniform float elapsed;
  varying vec2 local;
  varying float brightness;
  void main() {
    #ifdef SPARKS
      vec3 tint = vec3(1.0,.90,.72);
      float alpha = brightness;
    #else
      float t = local.x;
      float width = .024*(1.0-smoothstep(.29,.84,t))+.0018;
      width *= .93+.07*sin(t*184.0-elapsed*31.0);
      float r = abs(local.y+.003*sin(t*93.0-elapsed*18.0))/width;
      float core = 1.0-smoothstep(.62,1.03,r);
      float halo = exp(-r*r*.38)*.18;
      float tip = 1.0-smoothstep(.57,.92,t);
      float alpha = brightness*(core+halo)*tip;
      vec3 tint = mix(vec3(1.0,.48,.047),vec3(1.0,.985,.91),smoothstep(.008,.19,t));
    #endif
    gl_FragColor = vec4(tint,alpha);
    #include <colorspace_fragment>
  }
`;

function flareGeometry(sparks) {
  const position = [], emitters = [], patterns = [];
  for (const [finger] of FLARE_EMITTERS.entries()) {
    const put = (x,y,alpha,pattern) => {
      position.push(x,y,alpha);
      emitters.push(finger);
      patterns.push(...pattern);
    };
    if (!sparks) {
      for (const [x,y] of [[0,-1],[1,-1],[0,1],[0,1],[1,-1],[1,1]]) {
        put(x,y*.079,1,[0,0,0,0]);
      }
      continue;
    }
    for (let ray=0;ray<FLARE_RAYS;ray++) {
      const seed = (ray*.618034+finger*.417)%1;
      const variation = (ray*.754878+finger*.291)%1;
      const sign = ray%2 ? 1 : -1;
      const side = sign*(.029+variation*.124);
      const length = .025+seed*.118;
      const pattern = [seed,.93+variation*1.44,.018+variation**1.54*.81,side];
      put(0,0,.88,pattern);
      put(length,side*.46,.27,pattern);
      if (ray%4 === 0) {
        put(length*.57,side*.25,.65,pattern);
        put(length*.89,side*.79,.09,pattern);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position',new Float32BufferAttribute(position,3));
  geometry.setAttribute('emitter',new Float32BufferAttribute(emitters,1));
  geometry.setAttribute('pattern',new Float32BufferAttribute(patterns,4));
  return geometry;
}

export function createArrivalFlares(camera,duration,houseTarget) {
  const group = new Group();
  group.name = 'ArrivalFlares';
  group.userData.emitters = FLARE_EMITTERS.length;
  const cutoff = duration*.85;
  const origins = FLARE_EMITTERS.map(()=>new Vector3());
  const tips = origins.map(()=>new Vector3());
  const worldOrigin = new Vector3(), direction = new Vector3(), worldUp = new Vector3(0,1,0);
  const uniforms = {elapsed:{value:0},cutoff:{value:cutoff},origins:{value:origins},tips:{value:tips}};
  const material = defines => new ShaderMaterial({
    defines,uniforms,vertexShader:flareVertex,fragmentShader:flareFragment,
    side:DoubleSide,forceSinglePass:true,transparent:true,blending:AdditiveBlending,
    depthWrite:false,toneMapped:false,
  });
  group.add(new Mesh(flareGeometry(false),material({})),
    new LineSegments(flareGeometry(true),material({SPARKS:1})));
  for (const child of group.children) {
    child.frustumCulled = false;
    child.renderOrder = 100;
  }
  camera.add(group);
  group.visible = false;
  return {
    update(seconds) {
      uniforms.elapsed.value = seconds;
      group.visible = seconds < cutoff;
      if (!group.visible) return;
      const squeeze = Math.min(1,camera.aspect/1.36);
      const verticalProjection = camera.projectionMatrix.elements[5];
      camera.updateWorldMatrix(true,false);
      for (const [i,[x,below,z,yaw,length]] of FLARE_EMITTERS.entries()) {
        const origin = origins[i].set(x*squeeze,z*below/verticalProjection,z);
        worldOrigin.copy(origin).applyMatrix4(camera.matrixWorld);
        direction.subVectors(houseTarget,worldOrigin).normalize().applyAxisAngle(worldUp,yaw);
        tips[i].copy(worldOrigin).addScaledVector(direction,length).applyMatrix4(camera.matrixWorldInverse);
      }
    },
    dispose() {
      group.removeFromParent();
      for (const child of group.children) {
        child.geometry.dispose();
        child.material.dispose();
      }
    },
  };
}
