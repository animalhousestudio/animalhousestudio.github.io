import {
  AdditiveBlending, Box3, BoxGeometry, Color, ConeGeometry, DataTexture, DoubleSide, Group,
  InstancedBufferAttribute, InstancedBufferGeometry, InstancedMesh, LinearFilter, Matrix4,
  Mesh, MeshStandardMaterial, PlaneGeometry, RepeatWrapping, ShaderMaterial, SpotLight, Vector3,
} from 'three';
import { LANDING_Z } from '../arrival.mjs';
import { HOUSE_X, HOUSE_Z, WORLD_SCALE } from './layout.mjs';

// Clockwise, from the front of the house. Origins and targets are offsets from the house.
const GROUND_LIGHTS = [
  [0,57, 0,47,13, 0xffd9a3], [45,0, 11,54,0, 0x9dcaff],
  [0,-55, 0,53,-15, 0xffbadd], [-45,0, -13,47,0, 0xffdb9e],
];
const HIGH_TINTS = [0xffdcaf,0x9ccaff,0xc6baff,0xffc2a2,0x94d9ff];
const VENTS = [
  [-31,185,0xff56ad,0,22], [31,159,0xffd34b,1.8,26],
  [-42,81,0x519cff,7,23], [61,69,0xf34d63,12,28],
  [-66,19,0xffcb4c,2,25], [74,-30,0xff56ad,10,29],
  [-47,-66,0xf25168,15,27], [30,-69,0x508dff,5,24],
  [-120,171,0xffd34b,8,33], [112,139,0x519cff,16,35],
  [154,53,0xff56ad,14,32], [153,-76,0xf34d63,24,37],
  [81,-129,0xffd34b,11,32], [-7,-147,0x519cff,20,34],
  [-96,-121,0xff56ad,4,30], [-152,-57,0xf34d63,17,36],
  [-166,6,0x508dff,10,31], [111,22,0xffcb4c,21,33],
  [9,111,0xf25168,3,30], [-71,118,0xff56ad,13,35],
  [-74,170,0x519cff,2,30], [69,119,0xff56ad,4,33],
  [20,79,0xffd34b,1,28], [-22,61,0xf34d63,3,33],
  [-97,51,0xffd34b,5,33], [113,-44,0x519cff,10,36],
  [-84,-63,0xf34d63,8,33], [42,-109,0xff56ad,6,31],
  [-46,204,0xffd34b,2,31], [48,200,0xf34d63,6,34],
  [-94,202,0xff56ad,9,34], [87,192,0x519cff,7,35],
  [-148,150,0xf34d63,8,36], [148,148,0xffd34b,9,34],
  [-140,105,0xff56ad,4,32], [139,93,0xf34d63,6,34],
  [-153,52,0xffd34b,2,37], [176,10,0x519cff,4,32],
  [-109,4,0x519cff,6,34], [97,2,0xff56ad,3,29],
  [-48,-20,0xff56ad,2,32], [46,-32,0xffd34b,3,29],
  [-129,-91,0x519cff,6,31], [130,-111,0xff56ad,5,34],
  [-122,-145,0xffd34b,9,32], [122,-145,0xf34d63,8,33],
  [-61,-167,0xf34d63,5,30], [53,-168,0x519cff,4,32],
  [-3,-182,0xff56ad,8,37], [3,-104,0xffd34b,2,33],
  [-112,128,0xf34d63,5,33], [185,56,0xff56ad,6,32],
];
const PUFFS = 18;
const HIGH_SPOTS = 2;
const LANDING_CENTER = LANDING_Z*WORLD_SCALE;
const LANDING_RADIUS = [30,26];
const SMOKE_DRIFT = 114;
const LIGHT_TICK = 1/15;
const up = new Vector3(0,1,0);
const hash = n => { const x = Math.sin(n*57.683+7.123)*43758.5453; return x-Math.floor(x); };

function smokeTexture() {
  const size = 64, data = new Uint8Array(size*size*4);
  const mix = (a,b,t) => a+(b-a)*t;
  function noise(x,y,period) {
    const ix = Math.floor(x), iy = Math.floor(y);
    const a = x-ix,b = y-iy, sx = a*a*(3-2*a),sy = b*b*(3-2*b);
    const at = (px,py) => hash((px%period)*83+(py%period)*173);
    return mix(mix(at(ix,iy),at(ix+1,iy),sx),mix(at(ix,iy+1),at(ix+1,iy+1),sx),sy);
  }
  for (let y=0;y<size;y++) for (let x=0;x<size;x++) {
    const value = [[4,.56],[9,.29],[19,.15]].reduce((sum,[grid,weight]) =>
      sum+weight*noise(x*grid/size,y*grid/size,grid),0);
    const i = (y*size+x)*4;
    data[i] = data[i+1] = data[i+2] = Math.round(value*255);
    data[i+3] = 255;
  }
  const texture = new DataTexture(data,size,size);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.minFilter = texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function createSmoke(vents,texture) {
  const plane = new PlaneGeometry(2,2);
  const geometry = new InstancedBufferGeometry();
  geometry.copy(plane);
  plane.dispose();
  const origins = [], colors = [], params = [], seeds = [];
  for (const [index,vent] of vents.entries()) for (let i=0;i<PUFFS;i++) {
    origins.push(...vent.position.toArray());
    colors.push(...vent.color.toArray());
    params.push(vent.phase,vent.period,i*1.38,index*2.399963);
    seeds.push(hash(index*17+i));
  }
  geometry.setAttribute('origin',new InstancedBufferAttribute(new Float32Array(origins),3));
  geometry.setAttribute('pigment',new InstancedBufferAttribute(new Float32Array(colors),3));
  geometry.setAttribute('parameters',new InstancedBufferAttribute(new Float32Array(params),4));
  geometry.setAttribute('seed',new InstancedBufferAttribute(new Float32Array(seeds),1));
  geometry.instanceCount = vents.length*PUFFS;
  const material = new ShaderMaterial({
    transparent:true,depthWrite:false,toneMapped:false,
    uniforms:{ time:{value:0},grain:{value:texture},maxDistance:{value:240} },
    vertexShader: /* glsl */`
      uniform float time, maxDistance;
      attribute vec3 origin, pigment;
      attribute vec4 parameters;
      attribute float seed;
      varying vec2 cloudUV, smokeXZ;
      varying float density, drift, height;
      varying vec3 tint;
      void main(){
        float age=mod(max(0.0,time-parameters.x-parameters.z),parameters.y);
        vec3 delta=vec3(cos(parameters.w),0.0,sin(parameters.w));
        vec3 side=vec3(-delta.z,0.0,delta.x);
        vec3 center=origin + delta*age*(.84+seed*.63);
        center+=side*sin(age*.13+seed*8.0)*age*.46;
        center.y+=.66+age*(.18+seed*.24);
        vec4 view=modelViewMatrix*vec4(center,1.0);
        density=smoothstep(0.0,1.3,age)*(1.0-smoothstep(29.0,68.0,age));
        float distance=length(view.xyz);
        density*=smoothstep(1.5,5.0,distance)*(1.0-smoothstep(maxDistance*.72,maxDistance,distance));
        tint=pigment;
        drift=seed*7.0+age*.12;
        cloudUV=position.xy;
        float size=min(min(25.0,1.0+age*(.72+seed*.23)),max(2.0,-view.z*.17));
        vec2 offset=position.xy*size*vec2(1.62,.68);
        view.xy+=offset;
        smokeXZ=center.xz+vec2(dot(modelViewMatrix[0].xy,offset),dot(modelViewMatrix[2].xy,offset));
        height=(center.y-origin.y)+position.y*size*.68;
        gl_Position=projectionMatrix*view;
        if (density < .002 || view.z > -.1) gl_Position=vec4(2.0,2.0,2.0,1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D grain;
      varying vec2 cloudUV, smokeXZ;
      varying float density, drift, height;
      varying vec3 tint;
      void main(){
        float n=texture2D(grain,cloudUV*.47+vec2(drift*.21,drift*.16)).r;
        float detail=texture2D(grain,cloudUV*.81-vec2(drift*.14,drift*.11)).r;
        float mass=(1.0-smoothstep(.30,1.06,length(cloudUV)+(n-.48)*.32));
        float alpha=mass*smoothstep(.22,.71,n*.74+detail*.26)*density;
        float landing=length((smokeXZ-vec2(0.0,${LANDING_CENTER.toFixed(1)}))
          /vec2(${LANDING_RADIUS.map(value=>value.toFixed(1)).join(',')}));
        alpha*=smoothstep(-.2,.9,height)*smoothstep(1.0,1.35,landing)*.178;
        gl_FragColor=vec4(tint*(.61+n*.65)+vec3(.028),alpha);
        #include <colorspace_fragment>
      }`,
  });
  const smoke = new Mesh(geometry,material);
  smoke.name = 'AsteroidColorSmoke';
  smoke.frustumCulled = false;
  return smoke;
}

function createGroundMist(vents,texture) {
  const plane = new PlaneGeometry(2,2);
  const geometry = new InstancedBufferGeometry().copy(plane);
  plane.dispose();
  const origins = [], sizes = [], colors = [];
  for (const [i,vent] of vents.entries()) {
    origins.push(...vent.position.toArray());
    colors.push(...vent.color.toArray());
    sizes.push(15+hash(i+93)*17,1.6+hash(i+31)*1.9,hash(i+120));
  }
  geometry.setAttribute('origin',new InstancedBufferAttribute(new Float32Array(origins),3));
  geometry.setAttribute('sizes',new InstancedBufferAttribute(new Float32Array(sizes),3));
  geometry.setAttribute('pigment',new InstancedBufferAttribute(new Float32Array(colors),3));
  geometry.instanceCount = sizes.length/3;
  const material = new ShaderMaterial({
    transparent:true,depthWrite:false,toneMapped:false,
    uniforms:{time:{value:0},grain:{value:texture},strength:{value:0}},
    vertexShader: /* glsl */`
      attribute vec3 origin, sizes, pigment;
      uniform float time;
      varying vec2 mistUV, patchXZ;
      varying float coverage, seed;
      varying vec3 tint;
      void main(){
        seed=sizes.z;
        tint=pigment;
        vec3 center=origin;
        center.xz+=vec2(sin(time*.10+seed*8.0),cos(time*.083+seed*7.0))*5.4;
        vec3 horizontal=vec3(viewMatrix[0].x,0.0,viewMatrix[2].x);
        horizontal=normalize(horizontal);
        vec3 p=center+horizontal*position.x*sizes.x;
        p.y+=1.25+(position.y+1.0)*sizes.y;
        patchXZ=p.xz;
        mistUV=position.xy;
        vec4 eye=modelViewMatrix*vec4(p,1.0);
        float distance=length((modelViewMatrix*vec4(center,1.0)).xyz);
        coverage=smoothstep(4.0,17.0,distance)*(1.0-smoothstep(132.0,205.0,distance));
        gl_Position=projectionMatrix*eye;
        if (coverage<.002) gl_Position=vec4(2.0,2.0,2.0,1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D grain;
      uniform float time,strength;
      varying vec2 mistUV, patchXZ;
      varying float coverage, seed;
      varying vec3 tint;
      void main(){
        float edge=1.0-smoothstep(.17,1.0,length(mistUV*vec2(1.0,.94)));
        float detail=texture2D(grain,vec2(mistUV.x*.45+seed-time*.017,mistUV.y*.21+seed)).r;
        float landing=length((patchXZ-vec2(0.0,${LANDING_CENTER.toFixed(1)}))
          /vec2(${LANDING_RADIUS.map(value=>value.toFixed(1)).join(',')}));
        float alpha=edge*smoothstep(.19,.76,detail)*coverage*smoothstep(1.0,1.42,landing);
        gl_FragColor=vec4(mix(vec3(.42,.32,.27),tint,.63),alpha*.24*strength);
        #include <colorspace_fragment>
      }`,
  });
  const mist = new Mesh(geometry,material);
  mist.name = 'AsteroidGroundMist';
  mist.frustumCulled = false;
  return mist;
}

export function addAsteroidAtmosphere(world,groundAt,supports) {
  const root = new Group();
  root.name = 'AsteroidAtmosphere';
  root.scale.setScalar(1/WORLD_SCALE);
  root.userData.streamingBoundary = true;
  root.userData.collisionDisabled = true;
  world.add(root);
  const at = (x,z) => {
    const y = groundAt(x,z);
    return y === null ? null : new Vector3(x,y,z);
  };
  const highColumns = supports.filter(column=>column.column?.side === 1
    && column.position.y+column.size.y*.5-2.7>=85);
  const mountCount = Math.min(14,highColumns.length);
  const highFixtures = Array.from({length:mountCount},(_,i) => {
    const column = highColumns[Math.floor((i+.5)*highColumns.length/mountCount)];
    const origin = column.position.clone().addScaledVector(up,column.size.y*.5-2.7);
    const facing = origin.clone().sub(new Vector3(HOUSE_X,0,HOUSE_Z)).setY(0).normalize();
    const target = new Vector3(HOUSE_X,37+i%4*13,HOUSE_Z).addScaledVector(facing,14);
    const position = origin.clone().addScaledVector(facing,-.86);
    return {origin,position,target,color:new Color(HIGH_TINTS[i%HIGH_TINTS.length])};
  });
  const groundFixtures = GROUND_LIGHTS.map(([x,z,tx,ty,tz,tint]) => {
    const origin = at(HOUSE_X+x,HOUSE_Z+z);
    if (!origin) return null;
    return {origin,position:origin.clone().addScaledVector(up,1.2),
      target:new Vector3(HOUSE_X+tx,ty,HOUSE_Z+tz),color:new Color(tint)};
  });
  const fixtures = [...highFixtures,...groundFixtures.filter(Boolean)];
  const vents = VENTS.flatMap(([x,z,color,phase,period]) => {
    if (Math.hypot(x/LANDING_RADIUS[0],(z-LANDING_CENTER)/LANDING_RADIUS[1])<1.35) return [];
    const position = at(x,z);
    return position ? [{position,color:new Color(color),phase:phase*.58,period:period+49}] : [];
  });
  const bounds = new Box3();
  fixtures.forEach(fixture => bounds.expandByPoint(fixture.origin).expandByPoint(fixture.target));
  vents.forEach(vent => bounds.expandByPoint(vent.position));
  root.userData.worldLocalBounds = bounds.expandByVector(new Vector3(170,120,170));
  const housings = new InstancedMesh(new BoxGeometry(1,1,1),
    new MeshStandardMaterial({color:0x29343e,metalness:.51,roughness:.5}),fixtures.length+vents.length);
  housings.name = 'AsteroidEffectHousings';
  const matrix = new Matrix4();
  const fixtureSize = new Vector3(2.15,1.62,2.15), ventSize = new Vector3(.68,.49,.67);
  for (const [i,site] of [...fixtures.map(f => f.origin),...vents.map(v => v.position)].entries()) {
    const fixture = i<fixtures.length;
    const elevated = i<highFixtures.length;
    matrix.makeRotationY(i*.86).scale(fixture ? fixtureSize : ventSize)
      .setPosition(site.x,site.y+(elevated ? 0 : fixture ? .72 : .24),site.z);
    housings.setMatrixAt(i,matrix);
  }
  housings.computeBoundingSphere();
  root.add(housings);
  const texture = smokeTexture();
  const smoke = createSmoke(vents,texture);
  const mist = createGroundMist(vents,texture);
  root.add(smoke,mist);
  const coneGeometry = new ConeGeometry(1,1,20,1,true);
  const spots = Array.from({length:HIGH_SPOTS+1},() => {
    const light = new SpotLight(0xffffff,0,0,.55,.57,2);
    const material = new ShaderMaterial({
      transparent:true,side:DoubleSide,forceSinglePass:true,depthWrite:false,toneMapped:false,
      blending:AdditiveBlending,uniforms:{ tint:{value:new Color()},opacity:{value:0} },
      vertexShader: /* glsl */`
        varying vec3 normalV,viewV;
        varying float along;
        void main(){
          vec4 p=modelViewMatrix*vec4(position,1.0);
          normalV=normalMatrix*normal;
          viewV=-p.xyz;
          along=.5-position.y;
          gl_Position=projectionMatrix*p;
        }`,
      fragmentShader: /* glsl */`
        uniform vec3 tint;
        uniform float opacity;
        varying vec3 normalV,viewV;
        varying float along;
        void main(){
          float angle=abs(dot(normalize(normalV),normalize(viewV)));
          float soft=pow(angle,.72)*smoothstep(0.0,.065,along)*(1.0-smoothstep(.67,1.0,along));
          gl_FragColor=vec4(tint,opacity*soft);
          #include <colorspace_fragment>
        }`,
    });
    const beam = new Mesh(coneGeometry,material);
    beam.name = 'AsteroidSpotBeam';
    beam.visible = false;
    root.add(light,light.target,beam);
    return {light,beam};
  });
  const direction = new Vector3();
  const candidates = [];
  const sessionSeed = Math.random()*10000;
  let lastTick = -Infinity, groundIndex = -1, activeLights = 0, visible = false;
  function hide() {
    smoke.visible = false;
    mist.visible = false;
    for (const spot of spots) {
      spot.light.intensity = 0;
      spot.beam.visible = false;
      spot.fixture = undefined;
    }
    activeLights = 0;
    groundIndex = -1;
    lastTick = -Infinity;
  }
  hide();
  return {
    update(time,camera,{enabled = true, smokeRange = 240, previewTarget = null} = {}) {
      if (!enabled) { if (visible) hide(); visible = false; return; }
      visible = true;
      smoke.visible = time > 0 && vents.some(vent => vent.position.distanceToSquared(camera.position)<(smokeRange+SMOKE_DRIFT)**2);
      smoke.material.uniforms.time.value = time;
      smoke.material.uniforms.maxDistance.value = smokeRange;
      mist.visible = time>0 && camera.position.y<58 && camera.position.lengthSq()<330**2;
      mist.material.uniforms.time.value = time;
      mist.material.uniforms.strength.value = Math.min(1,time/4)*(1-Math.max(0,(camera.position.y-40)/18));
      const nextGround = time<10 ? -1 : Math.floor((time-10)/4)%groundFixtures.length;
      if (nextGround === groundIndex && time-lastTick >= 0 && time-lastTick < LIGHT_TICK) return;
      groundIndex = nextGround;
      lastTick = time;
      candidates.length = 0;
      for (const [index,fixture] of highFixtures.entries()) {
        const distance = Math.min(fixture.position.distanceTo(camera.position),fixture.target.distanceTo(camera.position));
        if (distance>330) continue;
        const clock = time+20*hash(sessionSeed+index*19);
        const cycle = Math.floor(clock/24);
        const seed = sessionSeed+cycle*123.1+index*17.3;
        const age = clock%24-(.5+13*hash(seed));
        const length = 4.3+4.2*hash(seed+1);
        const strength = previewTarget ? .94 : Math.max(0,Math.min(1,age/.75,(length-age)/1.15));
        const score = previewTarget ? 1/(1+fixture.target.distanceTo(previewTarget)) : strength*(1-distance/350);
        if (strength>.02) candidates.push({fixture,strength,score});
      }
      candidates.sort((a,b)=>b.score-a.score);
      const chosen = spots.slice(0,HIGH_SPOTS).map(spot => candidates.find(candidate => candidate.fixture === spot.fixture));
      for (let i=0;i<chosen.length;i++) {
        chosen[i] ??= candidates.find(candidate => !chosen.includes(candidate));
      }
      const ground = groundFixtures[groundIndex];
      const groundAge = (time-10)%4;
      chosen.push(ground && {fixture:ground,strength:Math.min(1,.25+groundAge/.24,(4-groundAge)/.24)});
      activeLights = chosen.filter(Boolean).length;
      for (const [i,spot] of spots.entries()) {
        const {light,beam} = spot;
        const choice = chosen[i];
        spot.fixture = choice?.fixture;
        beam.visible = Boolean(choice);
        if (!choice) {light.intensity = 0; continue;}
        const {fixture,strength} = choice;
        light.position.copy(fixture.position);
        light.target.position.copy(fixture.target);
        light.color.copy(fixture.color);
        direction.subVectors(fixture.target,fixture.position);
        const length = direction.length();
        light.intensity = 4.4*length*length*strength;
        light.distance = length+Math.max(44,length*.54);
        const beamLength = length;
        direction.normalize();
        beam.position.copy(fixture.position).addScaledVector(direction,beamLength*.5);
        beam.quaternion.setFromUnitVectors(up,direction.negate());
        const width = Math.tan(light.angle)*beamLength;
        beam.scale.set(width,beamLength,width);
        beam.material.uniforms.tint.value.copy(fixture.color);
        beam.material.uniforms.opacity.value = strength*.092;
      }
    },
    get state() {return {fixtures:fixtures.length,highFixtures:highFixtures.length,groundFixtures:groundFixtures.filter(Boolean).length,
      groundIndex:spots[HIGH_SPOTS].fixture ? groundIndex : -1,vents:vents.length,activeLights,smoke:smoke.visible};},
    dispose() {
      root.removeFromParent();
      housings.geometry.dispose(); housings.material.dispose();
      smoke.geometry.dispose(); smoke.material.dispose();
      mist.geometry.dispose(); mist.material.dispose(); texture.dispose();
      coneGeometry.dispose();
      for (const {beam,light} of spots) {beam.material.dispose();light.dispose();}
    },
  };
}
