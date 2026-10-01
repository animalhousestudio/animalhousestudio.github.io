import * as THREE from 'three';
import { WORLD_SCALE } from './layout.mjs';

// Adapted from the height/velocity ping-pong approach in jeantimex/threejs-water.
// See assets/water-reference/LICENSE and README.md for provenance and differences.
const simulationFragment = `
  precision highp float;
  uniform sampler2D uPrevious;
  uniform vec2 uTexel;
  uniform vec2 uCourant;
  uniform float uDamping;
  uniform vec4 uImpulse;
  varying vec2 vUv;
  void main() {
    vec2 point = vUv * 2.0 - 1.0;
    float radius = length(point);
    if (radius >= 1.0) { gl_FragColor = vec4(0.0); return; }
    vec2 state = texture2D(uPrevious, vUv).rg;
    float lapX = texture2D(uPrevious, vUv + vec2(uTexel.x, 0.0)).r
      + texture2D(uPrevious, vUv - vec2(uTexel.x, 0.0)).r - 2.0 * state.r;
    float lapZ = texture2D(uPrevious, vUv + vec2(0.0, uTexel.y)).r
      + texture2D(uPrevious, vUv - vec2(0.0, uTexel.y)).r - 2.0 * state.r;
    state.g = (state.g + dot(uCourant * uCourant, vec2(lapX, lapZ))) * uDamping;
    float drop = max(0.0, 1.0 - distance(vUv, uImpulse.xy) / max(.001, uImpulse.z));
    state.r += state.g + (.5 - .5 * cos(drop * 3.14159265)) * uImpulse.w;
    state *= 1.0 - smoothstep(.86, 1.0, radius);
    gl_FragColor = vec4(clamp(state, vec2(-.035), vec2(.035)), 0.0, 1.0);
  }
`;

export function supportsPondSimulation(renderer) {
  return renderer.capabilities.isWebGL2 && renderer.capabilities.maxVertexTextures > 0
    && renderer.extensions.has('EXT_color_buffer_float');
}

/** Two small, lazily allocated buffers. No normal, caustic or scene reflection passes. */
export function createPondSimulation(renderer, layout) {
  const scene = new THREE.Scene(), camera = new THREE.Camera();
  const uniforms = {
    uPrevious: { value: null }, uTexel: { value: new THREE.Vector2() },
    uCourant: { value: new THREE.Vector2() }, uDamping: { value: 1 },
    uImpulse: { value: new THREE.Vector4(0, 0, 1, 0) },
  };
  const material = new THREE.ShaderMaterial({ uniforms, depthTest: false, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}',
    fragmentShader: simulationFragment });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false; scene.add(quad);
  const savedViewport = new THREE.Vector4(), savedScissor = new THREE.Vector4(), savedColor = new THREE.Color();
  let read = null, write = null, size = 0, failed = false, disposed = false, nextWind = 0, windIndex = 0;
  // At most one pending interaction; future input cannot create an unbounded queue.
  const pendingImpulse = new THREE.Vector4();
  let hasImpulse = false;
  const state = { size: 0, bytes: 0, passes: 0, failed: false };

  function preserveRenderState(action) {
    const target = renderer.getRenderTarget();
    const face = renderer.getActiveCubeFace(), mip = renderer.getActiveMipmapLevel();
    const autoClear = renderer.autoClear, scissorTest = renderer.getScissorTest();
    const alpha = renderer.getClearAlpha();
    renderer.getViewport(savedViewport); renderer.getScissor(savedScissor); renderer.getClearColor(savedColor);
    try { renderer.autoClear = false; action(); }
    finally {
      renderer.setRenderTarget(target, face, mip);
      renderer.setViewport(savedViewport); renderer.setScissor(savedScissor);
      renderer.setScissorTest(scissorTest); renderer.setClearColor(savedColor, alpha);
      renderer.autoClear = autoClear;
    }
  }
  function release() {
    read?.dispose(); write?.dispose(); read = null; write = null;
    uniforms.uPrevious.value = null;
    size = 0; state.size = 0; state.bytes = 0; hasImpulse = false;
  }
  function allocate(resolution) {
    if (failed || disposed) return false;
    if (size === resolution) return true;
    release();
    try {
      const options = { type: THREE.HalfFloatType, format: THREE.RGBAFormat,
        minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
        depthBuffer: false, stencilBuffer: false, generateMipmaps: false };
      read = new THREE.WebGLRenderTarget(resolution, resolution, options);
      write = new THREE.WebGLRenderTarget(resolution, resolution, options);
      preserveRenderState(() => {
        renderer.setClearColor(0x000000, 0);
        for (const target of [read, write]) {
          renderer.setRenderTarget(target);
          const gl = renderer.getContext();
          if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
            throw new Error('Pond half-float framebuffer unavailable');
          }
          renderer.clear(true, false, false);
        }
      });
      size = resolution; state.size = size; state.bytes = 2 * size * size * 4 * 2;
      uniforms.uTexel.value.set(1 / size, 1 / size);
      nextWind = 0;
      return true;
    } catch {
      release(); failed = true; state.failed = true;
      return false;
    }
  }
  function disturb(x, z, strength = .009, radius = .08) {
    if (disposed || failed || !layout.contains(x, z)) return false;
    pendingImpulse.set((x - layout.x) / (2 * layout.rx) + .5, (z - layout.z) / (2 * layout.rz) + .5,
      THREE.MathUtils.clamp(radius, .025, .2), THREE.MathUtils.clamp(strength, -.015, .015));
    hasImpulse = true;
    return true;
  }
  function step(seconds, dt, resolution) {
    if (!allocate(resolution)) return null;
    // CFL-stable in physical units at both 64²/15Hz and 128²/30Hz.
    const speed = .22;
    uniforms.uCourant.value.set(speed * dt * size / (2 * layout.rx), speed * dt * size / (2 * layout.rz));
    uniforms.uDamping.value = Math.exp(-.7 * dt);
    uniforms.uImpulse.value.set(0, 0, 1, 0);
    if (hasImpulse) { uniforms.uImpulse.value.copy(pendingImpulse); hasImpulse = false; }
    else if (seconds >= nextWind) {
      const angle = ++windIndex * 2.399963;
      uniforms.uImpulse.value.set(.5 + .24 * Math.cos(angle), .5 + .24 * Math.sin(angle), .07, .006);
      nextWind = seconds + 3.5;
    }
    uniforms.uPrevious.value = read.texture;
    try {
      preserveRenderState(() => { renderer.setRenderTarget(write); renderer.render(scene, camera); });
    } catch {
      release(); failed = true; state.failed = true;
      return null;
    }
    const previous = read; read = write; write = previous;
    state.passes++;
    return read.texture;
  }
  return { state, step, disturb, release,
    dispose() { if (disposed) return; disposed = true; release(); quad.geometry.dispose(); material.dispose(); } };
}

export function createPondSurfaceGeometry(layout, rings = 6) {
  const sides = layout.sides, positions = [], uv = [], depth = [], indices = [];
  function vertex(x, z, u, v) {
    positions.push(x, layout.waterY, z); uv.push(u, v); depth.push(layout.sampleDepth(x, z));
  }
  vertex(layout.x, layout.z, .5, .5);
  for (let ring = 1; ring <= rings; ring++) {
    const radius = ring / rings;
    for (let i = 0; i < sides; i++) {
      const angle = i / sides * Math.PI * 2, x = Math.cos(angle) * radius, z = Math.sin(angle) * radius;
      vertex(layout.x + layout.rx * x, layout.z + layout.rz * z, x * .5 + .5, z * .5 + .5);
    }
  }
  for (let i = 0; i < sides; i++) indices.push(0, 1 + (i + 1) % sides, 1 + i);
  for (let ring = 0; ring < rings - 1; ring++) for (let i = 0; i < sides; i++) {
    const a = 1 + ring * sides + i, b = 1 + ring * sides + (i + 1) % sides;
    indices.push(a, b, a + sides, b, b + sides, a + sides);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setAttribute('pondDepth', new THREE.Float32BufferAttribute(depth, 1));
  geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  geometry.boundingSphere.radius += .05;
  return geometry;
}

export function createPondSurface(layout, simulationSupported) {
  const neutral = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  neutral.needsUpdate = true;
  const uniforms = { uTime: { value: 0 }, uSimulation: { value: 0 }, uWaves: { value: neutral },
    uTexel: { value: new THREE.Vector2(1 / 64, 1 / 64) }, uSize: { value: new THREE.Vector2(layout.rx * 2, layout.rz * 2) },
    uMotion: { value: 1 }, uWorldScale: { value: WORLD_SCALE } };
  const geometries = [3, 6, 12].map(rings => createPondSurfaceGeometry(layout, rings));
  const material = new THREE.ShaderMaterial({ uniforms, side: THREE.DoubleSide,
    defines: { POND_SIMULATION: simulationSupported ? 1 : 0 },
    vertexShader: `
      uniform float uTime, uSimulation, uMotion;
      uniform vec2 uTexel, uSize;
      #if POND_SIMULATION == 1
        uniform sampler2D uWaves;
      #endif
      attribute float pondDepth;
      varying vec3 vPondWorld, vPondNormal;
      varying vec2 vPondUv;
      varying float vDepth, vCrest;
      void main() {
        vec2 p = (uv - .5) * uSize;
        float shore = 1.0 - smoothstep(.72, 1.0, length(uv * 2.0 - 1.0));
        float phaseA = dot(p, vec2(5.2, 2.1)) + uTime * 1.25;
        float phaseB = dot(p, vec2(-3.0, 6.3)) + uTime * .87;
        float height = (.005 * sin(phaseA) + .003 * sin(phaseB)) * uMotion;
        vec2 slope = (.005 * cos(phaseA) * vec2(5.2, 2.1)
          + .003 * cos(phaseB) * vec2(-3.0, 6.3)) * uMotion;
        #if POND_SIMULATION == 1
        if (uSimulation > .5) {
          height += texture2D(uWaves, uv).r;
          slope += vec2(texture2D(uWaves, uv + vec2(uTexel.x, 0.0)).r
              - texture2D(uWaves, uv - vec2(uTexel.x, 0.0)).r,
            texture2D(uWaves, uv + vec2(0.0, uTexel.y)).r
              - texture2D(uWaves, uv - vec2(0.0, uTexel.y)).r) / (2.0 * uTexel * uSize);
        }
        #endif
        vec3 point = position + vec3(0.0, height * shore, 0.0);
        vPondWorld = (modelMatrix * vec4(point, 1.0)).xyz;
        vPondNormal = normalize(mat3(modelMatrix) * vec3(-slope.x * shore, 1.0, -slope.y * shore));
        vPondUv = uv; vDepth = pondDepth; vCrest = height * shore;
        gl_Position = projectionMatrix * viewMatrix * vec4(vPondWorld, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uWorldScale;
      varying vec3 vPondWorld, vPondNormal;
      varying vec2 vPondUv;
      varying float vDepth, vCrest;
      void main() {
        vec3 view = normalize(cameraPosition - vPondWorld);
        vec3 normal = normalize(vPondNormal);
        bool above = gl_FrontFacing;
        if (!above) normal = -normal;
        float facing = clamp(dot(normal, view), 0.0, 1.0);
        float fresnel = .02037 + .97963 * pow(1.0 - facing, 5.0);
        vec3 ray = refract(-view, normal, above ? 1.0 / 1.333 : 1.333);
        vec3 reflected = reflect(-view, normal);
        vec3 sky = mix(vec3(.095, .15, .19), vec3(.015, .04, .09), smoothstep(0.0, .9, reflected.y));
        vec2 bottomPoint = vPondUv * 35.0 + ray.xz * min(vDepth, .8);
        float stone = .5 + .5 * sin(bottomPoint.x * 2.7 + sin(bottomPoint.y * 2.1));
        vec3 bottom = mix(vec3(.13, .15, .105), vec3(.22, .25, .17), stone);
        float opticalDepth = max(0.0, vDepth) * uWorldScale / max(.25, abs(ray.y));
        vec3 transmission = exp(-vec3(.32, .115, .075) * opticalDepth);
        vec3 deep = vec3(.008, .065, .085);
        vec3 water = mix(deep, bottom, transmission);
        vec3 color = mix(water, sky, fresnel);
        vec3 light = normalize(vec3(.45, .82, .35));
        float glint = pow(max(0.0, dot(reflected, light)), 90.0);
        color += vec3(.7, .8, .86) * glint * .22 + vec3(.015, .027, .03) * clamp(vCrest * 25.0, 0.0, 1.0);
        if (!above) color = mix(deep, color, .42);
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    ` });
  const mesh = new THREE.Mesh(geometries[0], material);
  mesh.name = 'DeepPond_WaterSurface'; mesh.userData.collisionDisabled = true;
  mesh.userData.staticDetail = true;
  return { mesh, uniforms, neutral,
    setLevel(level) { mesh.geometry = geometries[Math.max(0, level - 1)]; },
    dispose() { geometries.forEach(geometry => geometry.dispose()); material.dispose(); neutral.dispose(); } };
}
