import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Color, HalfFloatType, NearestFilter, Vector3, Vector4, WebGLRenderTarget } from 'three';
import { createPondLayout } from '../src/rooms/pondLayout.mjs';
import { createPondSimulation, createPondSurface, createPondSurfaceGeometry,
  supportsPondSimulation } from '../src/rooms/pondWater.mjs';

const layout = createPondLayout(new Box3(new Vector3(-40, -26, -40), new Vector3(40, 0, 40)));
const close = (actual, expected, tolerance = 1e-5) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);

// Records observable renderer/resource behavior without a DOM, GPU or shader compiler.
function rendererStub({ incompleteAt = 0, throwRender = false, autoClear = true } = {}) {
  const originalTarget = new WebGLRenderTarget(16, 16);
  const viewport = new Vector4(7, 9, 320, 180), scissor = new Vector4(11, 13, 160, 90);
  const color = new Color(0x385c72), targets = new Map(), renders = [], clears = [];
  let target = originalTarget, face = 3, mip = 2, alpha = .37, scissorTest = true, checks = 0, contextQueries = 0;
  const renderer = {
    autoClear,
    capabilities: { isWebGL2: true, maxVertexTextures: 16 },
    extensions: { has: name => name === 'EXT_color_buffer_float' },
    getRenderTarget: () => target, getActiveCubeFace: () => face, getActiveMipmapLevel: () => mip,
    getViewport: out => out.copy(viewport), getScissor: out => out.copy(scissor),
    getScissorTest: () => scissorTest, getClearColor: out => out.copy(color), getClearAlpha: () => alpha,
    setViewport: value => viewport.copy(value), setScissor: value => scissor.copy(value),
    setScissorTest: value => { scissorTest = value; },
    setClearColor(value, nextAlpha = alpha) { color.set(value); alpha = nextAlpha; },
    setRenderTarget(value, nextFace = 0, nextMip = 0) {
      target = value; face = nextFace; mip = nextMip;
      if (value && value !== originalTarget && !targets.has(value)) {
        const record = { disposed: 0 };
        targets.set(value, record);
        value.addEventListener('dispose', () => record.disposed++);
      }
      if (value) {
        viewport.copy(value.viewport); scissor.copy(value.scissor); scissorTest = value.scissorTest;
      }
    },
    getContext() {
      contextQueries++;
      return { FRAMEBUFFER: 0x8d40, FRAMEBUFFER_COMPLETE: 0x8cd5,
        checkFramebufferStatus: () => ++checks === incompleteAt ? 0x8cd6 : 0x8cd5 };
    },
    clear: (...args) => clears.push({ target, args, color: color.clone(), alpha }),
    render(scene) {
      const mesh = scene.children[0], uniforms = mesh.material.uniforms;
      renders.push({ target, mesh, previous: uniforms.uPrevious.value,
        impulse: uniforms.uImpulse.value.toArray(), courant: uniforms.uCourant.value.toArray(),
        damping: uniforms.uDamping.value, autoClear: renderer.autoClear });
      if (throwRender) throw new Error('Synthetic render failure');
    },
  };
  const snapshot = () => ({ target, face, mip, viewport: viewport.toArray(), scissor: scissor.toArray(),
    color: color.toArray(), alpha, scissorTest, autoClear: renderer.autoClear });
  return { renderer, targets, renders, clears, snapshot, original: snapshot(),
    get checks() { return checks; }, get contextQueries() { return contextQueries; } };
}

test('all surface tiers exactly fill the pond polygon with upward, non-degenerate triangles', () => {
  for (const [rings, vertices, triangles] of [[3, 145, 240], [6, 289, 528], [12, 577, 1104]]) {
    const geometry = createPondSurfaceGeometry(layout, rings);
    const position = geometry.getAttribute('position'), normals = geometry.getAttribute('normal');
    const uv = geometry.getAttribute('uv'), depth = geometry.getAttribute('pondDepth'), index = geometry.index;
    assert.equal(position.count, vertices);
    assert.equal(index.count / 3, triangles);
    const edges = new Map();
    let area = 0;
    for (let triangle = 0; triangle < index.count; triangle += 3) {
      const ids = [index.getX(triangle), index.getX(triangle + 1), index.getX(triangle + 2)];
      const [a, b, c] = ids;
      assert.ok(ids.every(id => id >= 0 && id < vertices));
      const abX = position.getX(b) - position.getX(a), abZ = position.getZ(b) - position.getZ(a);
      const acX = position.getX(c) - position.getX(a), acZ = position.getZ(c) - position.getZ(a);
      const twiceArea = abZ * acX - abX * acZ;
      assert.ok(twiceArea > 1e-8, 'every triangle is non-degenerate and faces upward');
      area += twiceArea / 2;
      for (let edge = 0; edge < 3; edge++) {
        const a = ids[edge], b = ids[(edge + 1) % 3], key = a < b ? `${a},${b}` : `${b},${a}`;
        edges.set(key, (edges.get(key) ?? 0) + 1);
      }
    }
    const polygonArea = layout.sides / 2 * layout.rx * layout.rz * Math.sin(2 * Math.PI / layout.sides);
    close(area, polygonArea, 2e-5);
    assert.equal([...edges.values()].filter(count => count === 1).length, layout.sides);
    assert.ok([...edges.values()].every(count => count === 1 || count === 2), 'surface has no non-manifold edges');
    for (let vertex = 0; vertex < vertices; vertex++) {
      const x = position.getX(vertex), z = position.getZ(vertex);
      close(position.getY(vertex), layout.waterY);
      assert.ok(layout.normalizedRadius(x, z) <= 1 + 1e-6);
      close(normals.getY(vertex), 1);
      close(uv.getX(vertex), (x - layout.x) / (2 * layout.rx) + .5);
      close(uv.getY(vertex), (z - layout.z) / (2 * layout.rz) + .5);
      assert.ok(depth.getX(vertex) >= 0 && depth.getX(vertex) <= layout.depth + 1e-5);
      if (vertex < vertices - layout.sides) close(depth.getX(vertex), layout.sampleDepth(x, z), 3e-5);
      else close(depth.getX(vertex), 0);
      const point = new Vector3(x, layout.waterY + .043, z);
      assert.ok(geometry.boundingSphere.containsPoint(point), 'bounds cover displaced wave crests');
    }
    close(depth.getX(0), layout.depth);
    geometry.dispose();
  }
});

test('surface tier changes retain one opaque draw and low-tier shaders need no vertex textures', () => {
  for (const supported of [false, true]) {
    const surface = createPondSurface(layout, supported), geometries = new Set();
    assert.equal(surface.mesh.material.transparent, false);
    assert.equal(surface.mesh.material.depthWrite, true);
    assert.equal(surface.mesh.material.defines.POND_SIMULATION, supported ? 1 : 0);
    assert.equal(surface.uniforms.uSimulation.value, 0);
    assert.equal(surface.uniforms.uWaves.value, surface.neutral);
    assert.equal(surface.neutral.image.width * surface.neutral.image.height, 1);
    const triangles = [240, 240, 528, 1104];
    for (let level = 0; level < 4; level++) {
      surface.setLevel(level);
      geometries.add(surface.mesh.geometry);
      assert.equal(surface.mesh.geometry.index.count / 3, triangles[level]);
      assert.equal(surface.mesh.children.length, 0);
    }
    const disposed = [];
    for (const resource of [...geometries, surface.mesh.material, surface.neutral]) {
      resource.addEventListener('dispose', () => disposed.push(resource));
    }
    surface.dispose();
    assert.equal(new Set(disposed).size, 5, 'all three cached geometries, the material and neutral texture are released');
    assert.equal(disposed.length, 5);
  }
});

test('simulation requires WebGL2, vertex texture support, and renderable half-float buffers', () => {
  const { renderer } = rendererStub();
  assert.equal(supportsPondSimulation(renderer), true);
  renderer.capabilities.isWebGL2 = false;
  assert.equal(supportsPondSimulation(renderer), false);
  renderer.capabilities.isWebGL2 = true; renderer.capabilities.maxVertexTextures = 0;
  assert.equal(supportsPondSimulation(renderer), false);
  renderer.capabilities.maxVertexTextures = 16; renderer.extensions.has = () => false;
  assert.equal(supportsPondSimulation(renderer), false);
});

test('simulation lazily allocates exactly two bounded targets and runs one pass per step', () => {
  const stub = rendererStub(), simulation = createPondSimulation(stub.renderer, layout);
  assert.deepEqual(simulation.state, { size: 0, bytes: 0, passes: 0, failed: false });
  assert.equal(stub.targets.size, 0);
  for (let frame = 0; frame < 20; frame++) {
    const texture = simulation.step(frame / 15, 1 / 15, 64);
    assert.equal(stub.renders.length, frame + 1);
    assert.equal(texture, stub.renders.at(-1).target.texture);
    assert.notEqual(stub.renders.at(-1).previous, texture, 'read and write never alias');
    assert.equal(stub.targets.size, 2);
    assert.deepEqual(stub.snapshot(), stub.original);
  }
  assert.equal(simulation.state.size, 64);
  assert.equal(simulation.state.bytes, 65536);
  assert.equal(simulation.state.passes, 20);
  assert.equal(stub.contextQueries, 2, 'framebuffer queries occur only when allocating');
  assert.equal(stub.clears.length, 2);
  for (const [target, record] of stub.targets) {
    assert.equal(target.width, 64); assert.equal(target.height, 64);
    assert.equal(target.texture.type, HalfFloatType);
    assert.equal(target.texture.minFilter, NearestFilter);
    assert.equal(target.texture.magFilter, NearestFilter);
    assert.equal(target.texture.generateMipmaps, false);
    assert.equal(target.depthBuffer, false); assert.equal(target.stencilBuffer, false);
    assert.equal(record.disposed, 0);
  }
  for (const clear of stub.clears) {
    assert.deepEqual(clear.args, [true, false, false]);
    assert.deepEqual(clear.color.toArray(), [0, 0, 0]);
    assert.equal(clear.alpha, 0);
  }
  const oldTargets = [...stub.targets.keys()];
  simulation.step(2, 1 / 30, 128);
  assert.equal(simulation.state.bytes, 262144);
  assert.equal(simulation.state.size, 128);
  assert.equal(stub.targets.size, 4);
  assert.ok(oldTargets.every(target => stub.targets.get(target).disposed === 1));
  assert.equal([...stub.targets.values()].filter(record => record.disposed === 0).length, 2);
  assert.deepEqual(stub.snapshot(), stub.original);
  simulation.dispose();
  assert.ok([...stub.targets.values()].every(record => record.disposed === 1));
});

test('simulation conserves renderer state for either autoClear setting and thrown renders', () => {
  for (const autoClear of [true, false]) {
    const stub = rendererStub({ autoClear, throwRender: true });
    const simulation = createPondSimulation(stub.renderer, layout);
    assert.throws(() => simulation.step(0, 1 / 15, 64), /Synthetic render failure/);
    assert.deepEqual(stub.snapshot(), stub.original);
    assert.equal(stub.renders[0].autoClear, false);
    assert.equal(simulation.state.passes, 0);
    simulation.dispose();
  }
});

test('incomplete framebuffer releases both targets, restores all renderer state, and fails closed', () => {
  const stub = rendererStub({ incompleteAt: 2 }), simulation = createPondSimulation(stub.renderer, layout);
  assert.equal(simulation.step(0, 1 / 15, 64), null);
  assert.deepEqual(simulation.state, { size: 0, bytes: 0, passes: 0, failed: true });
  assert.deepEqual(stub.snapshot(), stub.original);
  assert.equal(stub.targets.size, 2);
  assert.ok([...stub.targets.values()].every(record => record.disposed === 1));
  assert.equal(stub.renders.length, 0);
  assert.equal(simulation.step(1, 1 / 30, 128), null);
  assert.equal(stub.targets.size, 2, 'unsupported drivers are not retried every frame');
  assert.equal(stub.checks, 2);
  simulation.dispose();
  assert.ok([...stub.targets.values()].every(record => record.disposed === 1));
});

test('interactions retain one bounded impulse and stable wave coefficients at either simulation tier', () => {
  const stub = rendererStub(), simulation = createPondSimulation(stub.renderer, layout);
  simulation.step(0, 1 / 15, 64);
  assert.equal(simulation.disturb(layout.x, layout.z), true);
  assert.equal(simulation.disturb(layout.x + layout.rx * .5, layout.z, 20, 20), true);
  assert.equal(simulation.disturb(layout.x + layout.rx * 2, layout.z), false);
  simulation.step(1 / 15, 1 / 15, 64);
  assert.deepEqual(stub.renders.at(-1).impulse, [.75, .5, .2, .015]);
  simulation.step(2 / 15, 1 / 15, 64);
  assert.equal(stub.renders.at(-1).impulse[3], 0, 'a queued interaction is consumed exactly once');
  const medium = stub.renders.at(-1);
  simulation.step(3 / 15, 1 / 30, 128);
  const high = stub.renders.at(-1);
  assert.deepEqual(high.courant, medium.courant, 'doubling resolution and rate preserves wave speed');
  assert.ok(high.courant[0] ** 2 + high.courant[1] ** 2 < 1, 'the finite difference step obeys its CFL bound');
  close(high.damping ** 2, medium.damping);
  simulation.dispose();
});

test('release is idempotent, clears pending interactions and permits clean reallocation', () => {
  const stub = rendererStub(), simulation = createPondSimulation(stub.renderer, layout);
  simulation.step(0, 1 / 15, 64);
  const mesh = stub.renders[0].mesh;
  let geometryDisposals = 0, materialDisposals = 0;
  mesh.geometry.addEventListener('dispose', () => geometryDisposals++);
  mesh.material.addEventListener('dispose', () => materialDisposals++);
  simulation.disturb(layout.x, layout.z, .013, .15);
  simulation.release(); simulation.release();
  assert.equal(simulation.state.size, 0); assert.equal(simulation.state.bytes, 0);
  assert.ok([...stub.targets.values()].every(record => record.disposed === 1));
  assert.equal(mesh.material.uniforms.uPrevious.value, null);
  assert.equal(geometryDisposals, 0); assert.equal(materialDisposals, 0);
  simulation.step(100, 1 / 15, 64);
  assert.equal(stub.targets.size, 4);
  assert.notEqual(stub.renders.at(-1).impulse[3], .013);
  simulation.dispose();
  assert.equal(geometryDisposals, 1); assert.equal(materialDisposals, 1);
  assert.ok([...stub.targets.values()].every(record => record.disposed === 1));
});
