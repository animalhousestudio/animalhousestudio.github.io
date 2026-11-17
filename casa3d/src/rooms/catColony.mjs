import { Frustum, Group, InstancedMesh, Matrix4, Object3D, PlaneGeometry, ShaderMaterial, Sphere, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { STATIC_ASSETS } from '../world/assetCatalog.mjs';
import { disposeVisualObject } from '../world/visualLod.mjs';
import { createCatColonyLayout, sampleCat, CAT_VISUAL_RADIUS } from './catColonyLayout.mjs';
import { createCatColonyModel } from './catColonyModel.mjs';
import { WORLD_SCALE } from './layout.mjs';

const LOAD_RANGE = 44;
const VISIBLE_RANGE = 34;
const RELEASE_AFTER = 30;

function makeContactShadows(count) {
  const material = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    vertexShader: `
      varying vec2 footprint;
      void main() {
        footprint = uv * 2.0 - 1.0;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      varying vec2 footprint;
      void main() {
        float shade = 1.0 - smoothstep(.02, 1.0, dot(footprint, footprint));
        gl_FragColor = vec4(.018, .013, .013, shade * .34);
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new InstancedMesh(new PlaneGeometry(1, 1).rotateX(-Math.PI / 2), material, count);
  mesh.name = 'CatContactShadows';
  mesh.frustumCulled = false;
  mesh.count = 0;
  return mesh;
}

export function addCatColony(garden, heightAt, layoutOptions) {
  const { routes, bounds } = createCatColonyLayout(heightAt, layoutOptions);
  const root = new Group();
  root.name = 'AsteroidCatColony';
  root.scale.setScalar(1 / WORLD_SCALE);
  root.userData.streamingBoundary = true;
  root.userData.collisionDisabled = true;
  root.userData.worldLocalBounds = bounds.isEmpty() ? null : bounds;
  garden.add(root);

  const cats = routes.map(route => ({ route, pose: { position: new Vector3() }, actor: null, age: 0, visible: false }));
  const projection = new Matrix4(), frustum = new Frustum(), cameraPosition = new Vector3();
  const shadow = new Object3D(), sphere = new Sphere(new Vector3(), CAT_VISUAL_RADIUS);
  let source, model, shadows, pending;
  let disposed = false, failed = false, time = 0, away = 0, evaluations = 0;
  let preview = {};

  function release() {
    for (const cat of cats) {
      cat.actor?.dispose();
      cat.actor = null;
      cat.visible = false;
    }
    shadows?.dispose();
    disposeVisualObject(shadows);
    disposeVisualObject(source);
    shadows = model = source = null;
  }

  function preload() {
    if (model || pending || failed) return;
    pending = new GLTFLoader().loadAsync(STATIC_ASSETS['toon-cat'].url).then(gltf => {
      if (disposed || away >= RELEASE_AFTER) {
        disposeVisualObject(gltf.scene);
        return;
      }
      source = gltf.scene;
      model = createCatColonyModel(gltf);
      shadows = makeContactShadows(cats.length);
      root.add(shadows);
    }).catch(error => {
      release();
      if (disposed) return;
      failed = true;
      console.warn('Colonia di gatti non disponibile', error);
    }).finally(() => { pending = null; });
  }

  function update(dt, camera, { enabled, reducedMotion }) {
    if (disposed) return;
    root.visible = enabled && preview.visible !== false;
    if (!root.visible) return;
    time += dt;
    camera.updateWorldMatrix(true, false);
    cameraPosition.setFromMatrixPosition(camera.matrixWorld);
    const nearby = cats.some(({ route }) => Math.hypot(cameraPosition.x - route.centre.x, cameraPosition.z - route.centre.z) < LOAD_RANGE
      && Math.abs(cameraPosition.y - route.points[0].y) < LOAD_RANGE);
    away = nearby ? 0 : away + dt;
    if (nearby) preload();
    if (away >= RELEASE_AFTER && model) release();
    if (!model) return;

    const seconds = preview.seconds ?? (reducedMotion && !preview.action ? 0 : time);
    frustum.setFromProjectionMatrix(projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    shadows.count = 0;
    for (const cat of cats) {
      const { route, pose } = cat;
      let visible = false;
      const reach = VISIBLE_RANGE + route.radius + CAT_VISUAL_RADIUS;
      if (Math.hypot(route.centre.x - cameraPosition.x, route.centre.z - cameraPosition.z) <= reach) {
        const mode = preview.id === route.id ? preview.action : null;
        sampleCat(route, seconds, pose, mode);
        sphere.center.copy(pose.position);
        sphere.center.y += .3;
        visible = sphere.center.distanceToSquared(cameraPosition) < VISIBLE_RANGE ** 2 && frustum.intersectsSphere(sphere);
      }
      if (!visible) {
        if (cat.visible) cat.actor.node.removeFromParent();
        cat.visible = false;
        continue;
      }
      cat.actor ??= model.createActor(route);
      const { node } = cat.actor;
      if (!cat.visible) root.add(node);
      node.position.copy(pose.position);
      node.rotation.y = pose.yaw;
      cat.age += dt;
      const step = sphere.center.distanceToSquared(cameraPosition) < 16 ** 2 ? 1 / 24 : 1 / 12;
      if (!cat.visible || (cat.age >= step && seconds !== cat.lastPoseTime)) {
        cat.actor.evaluate(pose, seconds);
        cat.age = 0;
        cat.lastPoseTime = seconds;
        evaluations++;
      }
      cat.visible = true;
      shadow.position.copy(pose.position);
      shadow.position.y += .035;
      shadow.rotation.y = pose.yaw;
      shadow.scale.set(route.size * .49, 1, route.size * .83);
      shadow.updateMatrix();
      shadows.setMatrixAt(shadows.count++, shadow.matrix);
    }
    if (shadows.count) shadows.instanceMatrix.needsUpdate = true;
  }

  return {
    update,
    review(options = {}) {
      preview = options;
      for (const cat of cats) {
        cat.age = 1;
        cat.lastPoseTime = undefined;
      }
    },
    reviewPose(clearing, action) {
      const cat = cats.find(cat => cat.route.clearing === clearing);
      if (!cat) return null;
      const pose = sampleCat(cat.route, 0, { position: new Vector3() }, action);
      return { ...pose, id: cat.route.id, pawSide: cat.route.seed < .5 ? 1 : -1 };
    },
    get state() {
      return { ready: Boolean(model), failed, count: cats.length, evaluations,
        visible: root.visible ? cats.filter(cat => cat.visible).map(({ route, pose }) => ({
          id: route.id, clearing: route.clearing, action: pose.action, position: pose.position.toArray(),
        })) : [] };
    },
    dispose() {
      disposed = true;
      release();
      root.removeFromParent();
    },
  };
}
