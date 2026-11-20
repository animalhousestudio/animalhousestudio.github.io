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
const ignitionTime=(cue,duration)=>.15+cue/12.02*(duration-1.85);
export function arrivalFireworkLight(seconds,duration) {
  let light=0;
  for(const [cue] of BURSTS){
    const age=seconds-ignitionTime(cue,duration);
    if(age>=0 && age<.55) light=Math.max(light,Math.min(1,age/.10)*Math.exp(-5.6*Math.max(0,age-.10)));
  }
  return light;
}
export const COASTER_FIREWORKS = Object.freeze({ start:.10, end:.985 });
const RIDE_WINDOW = 5;
const RIDE_CUE_INTERVAL = .51;
// Base X, tip X and tip Y in normalized screen coordinates.
// Each pair opens by the same amount on either side of the vertical jet.
const FLARE_EMITTERS = [
  [-.45,-.90,-.04],
  [-.23,-.52, .11],
  [   0,   0, .24],
  [ .23, .52, .11],
  [ .45, .90,-.04],
];
const FLARE_BASE_DEPTH = 2.15;
const FLARE_TIP_DEPTH = 22;
const FLARE_SPARKS = 384;

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
      cues.push([ignitionTime(cue,duration),x,.20+y*.54,depth,force,palette,i]));
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
  uniform float elapsed, cutoff, viewportHeight;
  uniform vec3 origins[5], tips[5];
  attribute float emitter;
  attribute vec4 pattern;
  attribute vec4 motion;
  varying vec2 local;
  varying float brightness;
  varying float heat;
  varying float axisPosition;

  float redFlame(float age) {
    return smoothstep(0.0,.12,age)*(1.0-smoothstep(.23,.53,age));
  }

  float pressureAt(float time,float spentAt) {
    return 1.0-smoothstep(spentAt-.89,spentAt,time);
  }

  float jetExtent(float time,float ignition,float spentAt,vec3 origin,vec3 tip) {
    float age = time-ignition;
    float height = max(smoothstep(.08,1.00,age),.28*redFlame(age))*pressureAt(time,spentAt);
    // Linear interpolation at different depths reaches most of the screen
    // height too early. Convert the projected height back to the 3-D axis.
    return height*origin.z/mix(tip.z,origin.z,height);
  }

  void main() {
    int id = int(emitter);
    vec3 origin = origins[id];
    vec3 tip = tips[id];
    vec3 axis = normalize(tip-origin);
    vec3 side = normalize(cross(axis,normalize(-origin)));
    local = position.xy;
    float pair = abs(emitter-2.0);
    float ignition = .87+.045*pair;
    float spentAt = cutoff-.74-.047*pair;
    float age = elapsed-ignition;
    float pressure = pressureAt(elapsed,spentAt);
    heat = smoothstep(.27,.78,age)*(1.0-smoothstep(spentAt-.52,spentAt,elapsed));
    float along = 0.0;
    float width = local.y;
    float depth = 0.0;
    #ifdef SPARKS
      // Each ember leaves the column, decelerates in the air and falls.
      // Trails sample the same trajectory slightly earlier than the head.
      float life = fract(elapsed*pattern.y + pattern.x);
      float birth = elapsed-life/pattern.y;
      // A small last spit survives the jet and cools on its way down.
      float finalBirth = spentAt-.25-(1.0-pattern.x)*1.4;
      bool lastEmber = pattern.x>.91 && elapsed>=finalBirth;
      if (lastEmber) {
        birth = finalBirth;
        life = clamp((elapsed-birth)/.91,0.0,1.0);
      }
      float emberAge = max(0.0,life-local.x);
      float travel = 1.0-exp(-2.8*emberAge);
      float force = smoothstep(.11,.86,birth-ignition)*pressureAt(birth,spentAt);
      float launch = pattern.z*jetExtent(birth,ignition,spentAt,origin,tip);
      if (lastEmber) {
        launch = .027+pattern.z*.09;
        force = .56;
      }
      along = max(0.0,launch + motion.x*travel*force - motion.y*emberAge*emberAge);
      float nearTip = smoothstep(.53,.88,pattern.z);
      float spreadAtTip = 1.0-.58*nearTip;
      width = spreadAtTip*(pattern.w*travel*(.48+.52*force)
        + .022*emberAge*sin(emberAge*13.0+pattern.x*42.0));
      depth = motion.z*travel*spreadAtTip;
      heat = smoothstep(.25,.76,birth-ignition)*pressureAt(birth,spentAt)
        *(1.0-smoothstep(.16,.85,emberAge));
      brightness = position.z*smoothstep(0.0,.034,emberAge)*(1.0-smoothstep(.28,1.0,life));
      brightness *= (.66+.34*sin(elapsed*37.0+pattern.x*92.0))*(1.0-.63*nearTip);
      if (birth<ignition+.10 || birth>=spentAt) brightness=0.0;
      #ifdef HEADS
        gl_PointSize = clamp(viewportHeight*motion.w*(.70+.38*heat),1.0,20.0);
      #endif
    #else
      float ignitionFlash = redFlame(age);
      float sputter = smoothstep(spentAt-.70,spentAt-.27,elapsed);
      float pulse = mix(1.0,.35+.65*smoothstep(-.35,.4,sin(elapsed*42.0+pair)),sputter);
      along = position.x*jetExtent(elapsed,ignition,spentAt,origin,tip)*pulse;
      brightness = max(ignitionFlash,smoothstep(.05,.30,age))*sqrt(pressure)*pulse;
      width *= (1.0+.32*ignitionFlash)*(.58+.42*pressure);
    #endif
    axisPosition = along;
    vec3 p = mix(origin,tip,along);
    float spread = min(9.0,-p.z)*.72;
    p += side*width*spread;
    p += cross(axis,side)*depth*spread;
    gl_Position = projectionMatrix*modelViewMatrix*vec4(p,1.0);
  }
`;

const flareFragment = /* glsl */ `
  uniform float elapsed;
  varying vec2 local;
  varying float brightness;
  varying float heat;
  varying float axisPosition;
  void main() {
    // Measure the color band in projected space so it stays at the base
    // during ignition, full extension and the final sputter.
    float projectedRise = axisPosition*FLARE_DEPTH_RATIO/mix(1.0,FLARE_DEPTH_RATIO,axisPosition);
    float redBase = 1.0-smoothstep(.31,.46,projectedRise);
    #ifdef SPARKS
      vec3 tint = mix(vec3(1.0,.39,.035),vec3(1.0,.96,.82),heat);
      float alpha = brightness;
      #ifdef HEADS
        vec2 p = abs(gl_PointCoord*2.0-1.0);
        float radius = length(p);
        float core = 1.0-smoothstep(.08,.37,radius);
        float halo = exp(-radius*radius*4.8)*(1.0-smoothstep(.66,1.0,radius));
        float star = exp(-19.0*min(p.x,p.y))*(1.0-smoothstep(.22,.95,max(p.x,p.y)));
        tint = mix(tint,vec3(1.0),core*.67*heat);
        alpha *= core*.86+halo*.40+star*.26*heat;
      #endif
    #else
      float t = local.x;
      float width = mix(.091,.009,smoothstep(.035,.93,t));
      width *= .84+.16*sin(t*109.0-elapsed*27.0);
      float r = abs(local.y)/width;
      float grain = .79+.21*sin(117.0*t-78.0*elapsed+local.y*217.0);
      float core = (1.0-smoothstep(.34,1.03,r))*grain;
      float halo = exp(-r*r*.39)*.35;
      float tip = 1.0-smoothstep(.62,.98,t);
      float alpha = brightness*(core+halo)*tip;
      vec3 tint = mix(vec3(.92,.12,.009),vec3(1.0,.47,.045),heat);
      tint = mix(tint,vec3(1.0,.98,.86),smoothstep(.08,.66,core)*heat);
    #endif
    tint = mix(tint,vec3(1.0,.002,.001),redBase);
    gl_FragColor = vec4(tint,alpha);
    #include <colorspace_fragment>
  }
`;

function flareGeometry(part) {
  const position = [], emitters = [], patterns = [], motions = [];
  for (const [finger] of FLARE_EMITTERS.entries()) {
    const put = (x,y,alpha,pattern,motion) => {
      position.push(x,y,alpha);
      emitters.push(finger);
      patterns.push(...pattern);
      motions.push(...motion);
    };
    if (part==='core') {
      for (const [x,y] of [[0,-1],[1,-1],[0,1],[0,1],[1,-1],[1,1]]) {
        put(x,y*.27,1,[0,0,0,0],[0,0,0,0]);
      }
      continue;
    }
    for (let ray=0;ray<FLARE_SPARKS;ray++) {
      const seed = (ray*.618034+finger*.417)%1;
      const variation = (ray*.754878+finger*.291)%1;
      const launch = (ray*.414214+finger*.263)%1;
      const sign = ray%2 ? 1 : -1;
      const nearBase = ray % 4 !== 0;
      const launchPoint = nearBase ? .006+launch**1.65*.20 : .23+launch*.66;
      const lateralSpread = sign*(.065+variation*(nearBase ? .54 : .33));
      const rise = .033+launch*.16+seed*.075;
      const fall = nearBase ? .09+variation*.15 : .095;
      const pattern = [seed,1.35+variation*2.49,launchPoint,lateralSpread];
      const motion = [rise,fall,.24*Math.sin(ray*2.4),.0035+variation**3*.0105];
      put(0,0,part==='heads'?1:.67,pattern,motion);
      if (part==='trails') put(.09+seed*.26,0,.065,pattern,motion);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position',new Float32BufferAttribute(position,3));
  geometry.setAttribute('emitter',new Float32BufferAttribute(emitters,1));
  geometry.setAttribute('pattern',new Float32BufferAttribute(patterns,4));
  geometry.setAttribute('motion',new Float32BufferAttribute(motions,4));
  return geometry;
}

export function createArrivalFlares(camera,cutoff) {
  const group = new Group();
  group.name = 'ArrivalFlares';
  group.userData.emitters = FLARE_EMITTERS.length;
  const origins = FLARE_EMITTERS.map(()=>new Vector3());
  const tips = origins.map(()=>new Vector3());
  const uniforms = {elapsed:{value:0},cutoff:{value:cutoff},origins:{value:origins},tips:{value:tips},
    viewportHeight:{value:720}};
  const material = defines => new ShaderMaterial({
    defines:{FLARE_DEPTH_RATIO:FLARE_TIP_DEPTH/FLARE_BASE_DEPTH,...defines},
    uniforms,vertexShader:flareVertex,fragmentShader:flareFragment,
    side:DoubleSide,forceSinglePass:true,transparent:true,blending:AdditiveBlending,
    depthWrite:false,toneMapped:false,
  });
  group.add(new Mesh(flareGeometry('core'),material({})),
    new LineSegments(flareGeometry('trails'),material({SPARKS:1})),
    new Points(flareGeometry('heads'),material({SPARKS:1,HEADS:1})));
  for (const [order,child] of group.children.entries()) {
    child.frustumCulled = false;
    child.renderOrder = 100 + order;
  }
  camera.add(group);
  group.visible = false;
  return {
    update(seconds,viewportHeight=720) {
      uniforms.elapsed.value = seconds;
      uniforms.viewportHeight.value = viewportHeight;
      group.visible = seconds < cutoff;
      if (!group.visible) return;
      const projection = camera.projectionMatrix.elements;
      const width = Math.min(1,1.9/camera.aspect)/projection[0];
      const height = 1/projection[5];
      for (const [i,[baseX,tipX,tipY]] of FLARE_EMITTERS.entries()) {
        origins[i].set(baseX*width*FLARE_BASE_DEPTH,-1.14*height*FLARE_BASE_DEPTH,-FLARE_BASE_DEPTH);
        tips[i].set(tipX*width*FLARE_TIP_DEPTH,tipY*height*FLARE_TIP_DEPTH,-FLARE_TIP_DEPTH);
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
