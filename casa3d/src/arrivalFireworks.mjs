import {
  AdditiveBlending, BufferGeometry, Color, Float32BufferAttribute, Group,
  LineSegments, Points, ShaderMaterial,
} from 'three';

// [seconds, horizontal and vertical screen position, depth, spread, palette].
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
const VOLLEY_TIMES = [.18, .76, 1.55, 2.55, 3.65, 4.73, 5.80, 7.02, 8.15, 9.27, 10.36, 11.22];
// World metres. Each nozzle ignites at a cue and sweeps through a different azimuth.
const FOUNTAINS = [
  [5.3, -51, 108], [5.6, 56, 117], [6.0, -73, 155], [6.35, 75, 150],
  [6.8, -30, 162], [7.1, 28, 170], [7.5, -49, 133], [7.8, 47, 138],
  [8.2, -66, 174], [8.5, 68, 177], [8.9, -25, 187], [9.2, 26, 185],
  [9.6, -47, 189], [9.85, 52, 187], [10.2, -18, 194], [10.4, 19, 193],
  [10.8, -30, 199], [11.1, 32, 199], [11.35, -10, 203], [11.55, 12, 204],
];
const WHITE = new Color(0xfff5df);
const GOLD = new Color(0xffbb3f);

const vertex = /* glsl */ `
  uniform float elapsed, aspect, fovScale, viewportHeight;
  attribute vec3 velocity, tint;
  attribute vec4 spark;
  attribute float tail, effect;
  varying vec3 vTint;
  varying float vAlpha;
  void main() {
    float age = elapsed - spark.x;
    float t = max(0.0, age - tail * spark.w);
    float travel = (1.0 - exp(-t * 1.65)) / 1.65 + t * .16;
    vec4 eye;
    if (effect < .5) {
      vec3 center = vec3(position.xy * position.z * fovScale * vec2(aspect, 1.), -position.z);
      vec3 p = center + velocity * travel;
      p.y -= t * t * 1.28;
      p.z += age * 1.5;
      eye = modelViewMatrix * vec4(p, 1.0);
    } else {
      vec3 p;
      if (effect < 1.5) {
        float fraction = 1.0 - pow(1.0 - clamp(t * .86, 0.0, .995), 2.0);
        float phase = t * 15.0 + spark.z * 20.0;
        vec3 scatter = vec3(sin(phase), cos(phase * .83), sin(phase * .51));
        p = position + velocity * fraction + scatter * t * (1.2 + spark.w * 10.0);
      } else {
        float rise = (1.0 - exp(-t * 1.8)) / 1.8 + t * .22;
        p = position + velocity * rise - vec3(0.0, t * t * 4.0, 0.0);
      }
      eye = viewMatrix * vec4(p, 1.0);
    }
    gl_Position = projectionMatrix * eye;
    gl_PointSize = clamp(viewportHeight * spark.z / max(.1, -eye.z), effect > .5 ? 2.3 : 1.0, 27.0);
    float fade = 1.0 - smoothstep(spark.y * .40, spark.y, t);
    float visible = smoothstep(0.0, .105, t);
    float last = 1.0 - smoothstep(12.72, 13.90, elapsed);
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

function createBuffers({ launchAt, target, groundAt, duration }) {
  const makeBuffer = () => ({ position: [], velocity: [], tint: [], spark: [], tail: [], effect: [] });
  const sparks = makeBuffer();
  const trails = makeBuffer();
  let seed = 76291;
  function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  function addSpark(mode, position, velocity, color, time, life, size, lag, withTrail) {
    function emit(buffer, tail) {
      buffer.position.push(...position);
      buffer.velocity.push(...velocity);
      buffer.tint.push(color.r, color.g, color.b);
      buffer.spark.push(time, life, size, lag);
      buffer.tail.push(tail);
      buffer.effect.push(mode);
    }
    emit(sparks, 0);
    if (withTrail) for (const tail of [0, .46, .46, 1]) emit(trails, tail);
  }
  for (const [time, x, y, depth, force, palette] of BURSTS) {
    const [outer, inner] = PALETTES[palette];
    for (let i = 0; i < SPARKS_PER_BURST; i++) {
      const vertical = 1 - 2 * (i + .5) / SPARKS_PER_BURST;
      const azimuth = i * 2.399963 + time;
      const radius = Math.sqrt(1 - vertical ** 2);
      const fast = i % 4 !== 0;
      const speed = force * (fast ? .78 + random() * .42 : .27 + random() * .39);
      const color = fast ? outer : inner;
      const vx = Math.cos(azimuth) * radius * speed;
      const vy = vertical * speed;
      const vz = Math.sin(azimuth) * radius * speed;
      const life = 1.25 + random() * .95;
      const size = (fast ? .27 : .33) + random() * .24;
      const lag = .115 + random() * .155;
      const sparkTime = time + random() * .11;
      addSpark(0, [x, y, depth], [vx, vy, vz], color, sparkTime, life, size, lag, fast);
    }
  }
  for (const [index, time] of VOLLEY_TIMES.entries()) {
    const eye = launchAt(time / duration);
    const forward = target.clone().sub(eye).normalize();
    const right = forward.clone().set(forward.z, 0, -forward.x).normalize();
    const start = eye.clone().addScaledVector(forward, 6.6).addScaledVector(right, index % 2 ? -3.5 : 3.5);
    start.y -= 1.9;
    for (let i = 0; i < 92; i++) {
      const offset = .12 + random() * .62;
      const origin = start.clone().addScaledVector(right, (random() - .5) * 1.35);
      origin.y += (random() - .5) * 1.1;
      const path = target.clone().sub(origin);
      path.x += (random() - .5) * 14;
      path.y += (random() - .5) * 9;
      addSpark(1, origin.toArray(), path.toArray(), i % 4 ? WHITE : GOLD, time + offset,
        1.10 + random() * .47, 1.6 + random() * 2.55, .17 + random() * .23, i % 3 !== 0);
    }
  }
  for (const [index, [time, x, z]] of FOUNTAINS.entries()) {
    const position = [x, groundAt(x, z) + .12, z];
    for (let i = 0; i < 145; i++) {
      const offset = random() * 1.32;
      const rotation = offset * 6.2 + index * 2.4;
      const angle = rotation + (random() - .5) * 2.0;
      const radius = 1.5 + random() * 9.0;
      const velocity = [Math.cos(angle) * radius, 13 + random() * 23, Math.sin(angle) * radius];
      addSpark(2, position, velocity, i % 5 ? WHITE : GOLD, time + offset,
        .60 + random() * .84, .30 + random() * .62, .095 + random() * .12, i % 4 !== 0);
    }
  }
  function geometry(buffer) {
    const result = new BufferGeometry();
    for (const [name, values] of Object.entries(buffer)) {
      result.setAttribute(name, new Float32BufferAttribute(values,
        name === 'spark' ? 4 : name === 'tail' || name === 'effect' ? 1 : 3));
    }
    return result;
  }
  return [geometry(sparks), geometry(trails)];
}

export function createArrivalFireworks(camera, layout) {
  const uniforms = {
    elapsed: { value: 0 }, aspect: { value: camera.aspect },
    fovScale: { value: 0 }, viewportHeight: { value: 1 },
  };
  const materials = [sparkFragment, trailFragment].map(fragmentShader => new ShaderMaterial({
    uniforms, vertexShader: vertex, fragmentShader, blending: AdditiveBlending,
    transparent: true, depthWrite: false, toneMapped: false,
  }));
  const geometries = createBuffers(layout);
  const group = new Group();
  group.name = 'ArrivalFireworks';
  group.add(new Points(geometries[0], materials[0]), new LineSegments(geometries[1], materials[1]));
  for (const child of group.children) child.frustumCulled = false;
  camera.add(group);
  return {
    update(seconds, viewportHeight) {
      uniforms.elapsed.value = seconds;
      uniforms.aspect.value = camera.aspect;
      uniforms.fovScale.value = Math.tan(camera.fov * Math.PI / 360);
      uniforms.viewportHeight.value = viewportHeight;
    },
    dispose() {
      group.removeFromParent();
      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(material => material.dispose());
    },
  };
}
