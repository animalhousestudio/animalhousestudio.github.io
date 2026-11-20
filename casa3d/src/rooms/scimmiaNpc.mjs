import { AnimationMixer, Frustum, Group, LoadingManager, Matrix4, Sphere, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { STATIC_ASSETS } from '../world/assetCatalog.mjs';
import { disposeVisualObject } from '../world/visualLod.mjs';
import { WORLD_SCALE } from './layout.mjs';
import { createScimmiaRoute } from './scimmiaRoute.mjs';

const clipNames = { walk: 'Walk', mount: 'Mount', leap: 'Leap', grip: 'Grip' };

export function addScimmiaNpc(garden, supports, heightAt, rockBounds) {
  const root = new Group();
  root.name = 'ArrivalScimmia';
  root.scale.setScalar(1/WORLD_SCALE);
  root.userData.streamingBoundary = true;
  root.userData.collisionDisabled = true;
  garden.add(root);

  const makeRoute = () => createScimmiaRoute(supports, (x,z) => {
    const h = heightAt(x/WORLD_SCALE,z/WORLD_SCALE);
    return h === null ? null : h*WORLD_SCALE;
  }, Math.random, rockBounds);
  let route = makeRoute();
  root.userData.worldLocalBounds = route?.bounds;
  const clipActions = new Map();
  const frustum = new Frustum(), projection = new Matrix4(), sphere = new Sphere(new Vector3(),1.5);
  let loading, actor, mixer, action, pose;
  let active = false, disposed = false, failed = false, lastPhase, poseAge = 0;
  let poseEvaluations = 0;
  let showModel = true, paused = false;

  function preload() {
    if (loading || !route || disposed) return loading;
    // The optional NPC uses its own manager and never holds up ATTERRA.
    loading = new GLTFLoader(new LoadingManager()).loadAsync(STATIC_ASSETS['scimmia-npc'].url)
      .then(({ scene, animations }) => {
        if (disposed || Object.values(clipNames).some(name => !animations.some(clip => clip.name === name))) {
          disposeVisualObject(scene);
          if (!disposed) failed = true;
          return;
        }
        actor = scene;
        actor.visible = false;
        actor.traverse(node => { if (node.isSkinnedMesh) node.frustumCulled = false; });
        root.add(actor);
        mixer = new AnimationMixer(actor);
        for (const clip of animations) clipActions.set(clip.name,mixer.clipAction(clip));
      }).catch(error => { failed = true; console.warn('Scimmia NPC unavailable',error); });
    return loading;
  }

  function start({ restart = false } = {}) {
    if (!route || disposed || (active && !restart)) return;
    if (restart) route = makeRoute();
    active = true;
    pose = route.sample();
    preload();
  }

  function update(dt, camera, { enabled = true, follow } = {}) {
    if (!actor || !active || !enabled) {
      if (actor) actor.visible = false;
      return;
    }
    pose = paused ? route.sample() : route.update(dt);
    follow?.(pose.position,pose.yaw);
    sphere.center.copy(pose.position);
    sphere.center.y += .75;
    camera.updateWorldMatrix(true,false);
    const distanceSq = sphere.center.distanceToSquared(camera.position);
    if (!showModel || distanceSq > 65**2
      || !frustum.setFromProjectionMatrix(projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse))
        .intersectsSphere(sphere)) {
      actor.visible = false;
      return;
    }
    actor.position.copy(pose.position);
    actor.rotation.y = pose.yaw;
    poseAge += dt;
    const phaseChanged = lastPhase !== pose.phase;
    if (phaseChanged) {
      action?.stop();
      action = clipActions.get(clipNames[pose.phase]).reset().play();
      action.paused = true;
      lastPhase = pose.phase;
    }
    const holding = pose.phase === 'grip';
    const interval = holding ? 1/12 : 1/30;
    const animate = !holding || distanceSq <= 12**2;
    if (phaseChanged || !actor.visible || (!paused && animate && poseAge >= interval)) {
      action.time = pose.clipTime*action.getClip().duration;
      mixer.update(0);
      poseAge %= interval;
      poseEvaluations++;
    }
    actor.visible = true;
  }

  return {
    preload, start, update,
    get state() {
      return { ready: Boolean(actor), failed, active, visible: actor?.visible ?? false, poseEvaluations,
        phase: pose?.phase ?? null, position: pose?.position.toArray(), post: route?.posts[pose?.target]?.id,
        returning: pose?.returning ?? false,
        hold: pose?.hold, posts: route?.posts.map(({id,position,size,anchor,yaw}) => ({
          id, center: position.toArray(), size: size.toArray(), anchor: anchor.toArray(), yaw,
        })) };
    },
    review({ visible = true, freeze = false } = {}) {
      showModel = visible;
      paused = freeze;
    },
    dispose() {
      disposed = true;
      mixer?.stopAllAction();
      if (actor) {
        mixer.uncacheRoot(actor);
        actor.traverse(node => { if (node.isSkinnedMesh) node.skeleton.dispose(); });
        disposeVisualObject(actor);
        actor.removeFromParent();
      }
    },
  };
}
