import { Frustum, Group, MathUtils, Matrix4, Sphere } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { STATIC_ASSETS } from '../world/assetCatalog.mjs';
import { disposeVisualObject } from '../world/visualLod.mjs';
import { WORLD_SCALE } from './layout.mjs';
import { createFishSchoolRoute, fishSchoolPose } from './fishSchoolRoute.mjs';
import { createFishSchoolModel } from './fishSchoolModel.mjs';
import { FISH_FORMATION, FISH_SCHOOL_RADIUS } from './fishSchoolMotion.mjs';

const LOAD_DISTANCE = 32;
const DRAW_DISTANCE = 48;
const UNLOAD_AFTER = 30;
const SWIM_STEP = 1 / 24;

export function addFishSchool(garden, coaster) {
  const route = createFishSchoolRoute(coaster.ponds.map(pond => pond.layout), FISH_SCHOOL_RADIUS);
  const root = new Group();
  root.name = 'PondFishSchool';
  root.scale.setScalar(1 / WORLD_SCALE);
  root.userData.streamingBoundary = true;
  root.userData.collisionDisabled = true;
  root.userData.worldLocalBounds = route.bounds;
  garden.add(root);

  const pose = fishSchoolPose();
  const sphere = new Sphere(pose.position, route.radius);
  const projection = new Matrix4(), frustum = new Frustum();
  let model, pending, disposed = false, failed = false;
  let time = 0, idle = 0, swimAge = 0, evaluations = 0, forcedTime = null;
  let show = true;

  function preload() {
    if (model || pending || failed) return;
    pending = new GLTFLoader().loadAsync(STATIC_ASSETS['banco-acquario'].url).then(({ scene }) => {
      try {
        if (disposed || idle >= UNLOAD_AFTER) return;
        model = createFishSchoolModel(scene, route);
        model.mesh.visible = false;
        coaster.submergedScene.add(model.mesh);
      } finally {
        disposeVisualObject(scene);
      }
    }).catch(error => {
      if (disposed) return;
      failed = true;
      console.warn('Banco di pesci non disponibile', error);
    }).finally(() => { pending = undefined; });
  }

  function update(dt, camera, { enabled, underwater }) {
    if (disposed) return;
    if (enabled) {
      time += dt;
      if (route.bounds.distanceToPoint(camera.position) < LOAD_DISTANCE) {
        idle = 0;
        preload();
      } else {
        idle += dt;
        if (idle >= UNLOAD_AFTER && model) {
          model.dispose();
          model = undefined;
        }
      }
    }
    if (!model) return;
    const { mesh } = model;
    const lastVisible = mesh.visible;
    mesh.visible = false;
    if (!enabled || !underwater || !show) return;
    const seconds = forcedTime ?? time;
    route.sample(seconds, pose);
    if (sphere.center.distanceToSquared(camera.position) >= DRAW_DISTANCE ** 2) return;
    camera.updateWorldMatrix(true, false);
    frustum.setFromProjectionMatrix(projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    if (!frustum.intersectsSphere(sphere)) return;
    mesh.visible = true;
    swimAge += dt;
    if (!lastVisible || swimAge >= SWIM_STEP) {
      mesh.position.copy(pose.position);
      model.swim(seconds, pose.position);
      swimAge %= SWIM_STEP;
      evaluations++;
    }
  }

  return {
    route, update,
    alignWithRide(secondsToMidpoint) {
      // The school is out of sight from the boarding station. Phase the first
      // crossing so the riders see it ahead before coming alongside.
      time = MathUtils.euclideanModulo(route.reviewTimes.outbound + 3 - secondsToMidpoint, route.duration);
    },
    review({ seconds = null, visible = true } = {}) {
      forcedTime = seconds;
      show = visible;
      swimAge = SWIM_STEP;
    },
    get state() {
      const seconds = forcedTime ?? time;
      route.sample(seconds, pose);
      return { ready: Boolean(model), visible: Boolean(model?.mesh.visible), failed, evaluations, count: FISH_FORMATION.length,
        position: pose.position.toArray(), yaw: pose.yaw, duration: route.duration,
        seconds: MathUtils.euclideanModulo(seconds, route.duration) };
    },
    dispose() {
      disposed = true;
      root.removeFromParent();
      model?.dispose();
      model = undefined;
    },
  };
}
