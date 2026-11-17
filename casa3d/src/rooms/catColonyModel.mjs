import { AnimationMixer, Box3, Color, Group, MathUtils, Quaternion, Vector3, Vector4 } from 'three';
import { clone } from 'three/addons/utils/SkeletonUtils.js';

const MODEL_SCALE = .00116;
const WALK_GROUND_SAMPLES = 40;
const patterns = ['solid', 'tabby', 'tuxedo', 'point', 'patched', 'calico'];
const paws = ['FL', 'FR', 'BL', 'BR'];

// Modify the fur islands of the original atlas. Facial features and inner ears
// keep the source colours. Bind-space markings deform with the original skin.
function coatMaterial(source, { fur, markings, pattern, build, seed }) {
  const material = source.clone();
  const colour = new Color(fur);
  const trim = new Color(markings);
  const details = new Vector4(patterns.indexOf(pattern), seed, build, 0);
  material.customProgramCacheKey = () => 'asteroid-cat-coat';
  material.onBeforeCompile = shader => {
    shader.uniforms.catFur = { value: colour };
    shader.uniforms.catTrim = { value: trim };
    shader.uniforms.catDetails = { value: details };
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
      varying vec3 catPosition;
      uniform vec4 catDetails;`).replace('#include <begin_vertex>', `#include <begin_vertex>
      catPosition = position;
      float belly = smoothstep(-.85, .65, position.y) *
        (1.0 - smoothstep(1.4, 2.4, position.y)) *
        smoothstep(-2.3, -1.55, position.z) * (1.0 - smoothstep(-.1, .85, position.z));
      transformed.x *= 1.0 + catDetails.z * belly;`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 catPosition;
      uniform vec3 catFur;
      uniform vec3 catTrim;
      uniform vec4 catDetails;`).replace('#include <map_fragment>', `#include <map_fragment>
      vec3 p = catPosition;
      float kind = catDetails.x;
      float seed = catDetails.y;
      float furPatch = sin(3.4*p.z + 3.2*p.x + seed*11.0) +
        .58*sin(4.3*p.y - 3.7*p.x + seed*16.0) + .25*sin(8.0*p.x + 4.0*p.z);
      float socks = 1.0 - smoothstep(.13, .39, p.y + .12*sin(p.z*4.0));
      float mask = 0.0;
      vec3 pigment = catTrim;
      if (kind == 1.0) {
        mask = .8*smoothstep(.3, .82, sin(8.1*p.z + 1.5*sin(p.y*3.7) + seed*6.0));
      } else if (kind == 2.0) {
        float bib = smoothstep(.12, .4, p.z) * (1.0 - smoothstep(.18, .47, abs(p.x)))
          * (1.0 - smoothstep(1.64, 2.2, p.y));
        mask = max(socks, bib);
      } else if (kind == 3.0) {
        float face = smoothstep(1.45, 2.15, p.z) * smoothstep(1.4, 1.8, p.y);
        mask = max(.88*socks, max(face, max(smoothstep(2.96, 3.67, p.y), 1.0-smoothstep(-3.2, -1.96, p.z))));
      } else if (kind > 3.0) {
        mask = smoothstep(.38, .48, furPatch);
        if (kind == 5.0) {
          float darkPatch = 1.0 - smoothstep(-.92, -.82, furPatch);
          pigment = mix(catTrim, vec3(.071, .054, .057), darkPatch);
          mask = max(mask, darkPatch);
        }
      }
      float luminance = dot(diffuseColor.rgb, vec3(.299, .587, .114));
      float furShade = mix(.51, 1.24, smoothstep(.055, .50, luminance));
      float furUV = (1.0 - step(.32, vMapUv.x)) * (1.0 - step(.64, vMapUv.y));
      diffuseColor.rgb = mix(diffuseColor.rgb, mix(catFur, pigment, mask) * furShade, furUV);`);
  };
  return material;
}

function findSkin(scene) {
  return scene.getObjectByProperty('isSkinnedMesh', true);
}

function capturePose(bones, mesh) {
  mesh.computeBoundingBox();
  const box = new Box3().copy(mesh.boundingBox).applyMatrix4(mesh.matrixWorld);
  return { joints: bones.map(bone => ({ position: bone.position.clone(), rotation: bone.quaternion.clone() })),
    ground: box.min.y };
}

function applyPose(bones, pose) {
  pose.joints.forEach(({ position, rotation }, i) => {
    bones[i].position.copy(position);
    bones[i].quaternion.copy(rotation);
  });
}

// Author poses once on the source rig. CCD folds the legs while keeping
// support paws on the ground. The raised paw follows the muzzle in the wash.
function makePoses(scene, mesh, mixer, walk) {
  const bones = mesh.skeleton.bones;
  const bone = name => bones.find(joint => joint.name.startsWith(name + '_'));
  const torso = bone('torso'), neck = bone('neck'), head = bone('head'), mouth = bone('mouth');
  const feet = paws.map(paw => bone('foot' + paw));
  const tip = new Vector3(), pivot = new Vector3(), from = new Vector3(), to = new Vector3();
  const parentRotation = new Quaternion(), delta = new Quaternion();
  function aim(joint, end, target, amount = 1) {
    joint.getWorldPosition(pivot);
    from.subVectors(end.getWorldPosition(tip), pivot).normalize();
    to.subVectors(target, pivot).normalize();
    delta.identity().slerp(new Quaternion().setFromUnitVectors(from, to), amount);
    joint.parent.getWorldQuaternion(parentRotation);
    joint.quaternion.premultiply(delta.premultiply(parentRotation.clone().invert()).multiply(parentRotation));
    joint.updateWorldMatrix(false, true);
  }
  const footRotations = [];
  const ground = new Float32Array(WALK_GROUND_SAMPLES + 1);
  for (let i = 0; i <= WALK_GROUND_SAMPLES; i++) {
    mixer.setTime(walk.duration * i / WALK_GROUND_SAMPLES);
    scene.updateMatrixWorld(true);
    mesh.computeBoundingBox();
    ground[i] = mesh.boundingBox.clone().applyMatrix4(mesh.matrixWorld).min.y;
  }
  // For each foot pick an authored ground-contact orientation from the walk.
  for (const [i, foot] of feet.entries()) {
    mixer.setTime([.16, .55, .14, .28][i]);
    scene.updateMatrixWorld(true);
    footRotations.push(foot.getWorldQuaternion(new Quaternion()));
  }
  function placePaw(i, x, y, z, amount = 1) {
    const foot = feet[i];
    const target = new Vector3(x, y, z).multiplyScalar(100);
    const chain = [foot.parent, foot.parent.parent];
    if (i >= 2) chain.push(chain.at(-1).parent);
    for (let pass = 0; pass < 10; pass++) {
      for (const joint of chain) aim(joint, foot, target, .81);
    }
    foot.parent.getWorldQuaternion(parentRotation);
    foot.quaternion.slerp(parentRotation.invert().multiply(footRotations[i]), amount);
  }
  function lowerTorso(units) {
    const target = torso.getWorldPosition(new Vector3());
    target.y -= units * 100;
    torso.position.copy(torso.parent.worldToLocal(target));
    scene.updateMatrixWorld(true);
  }
  mixer.setTime(.19);
  scene.updateMatrixWorld(true);
  placePaw(0, .44, .087, .91);
  placePaw(1, -.44, .087, .88);
  placePaw(2, .54, .087, -1.39);
  placePaw(3, -.54, .087, -1.37);
  scene.updateMatrixWorld(true);
  const standing = capturePose(bones, mesh);

  lowerTorso(1.02);
  aim(neck, mouth, new Vector3(0, 32, 204), .6);
  placePaw(0, .39, .09, .96);
  placePaw(1, -.39, .09, .86);
  placePaw(2, .65, .095, -1.06, .83);
  placePaw(3, -.66, .095, -1.18, .83);
  bone('tail').rotateZ(.31);
  bone('tail01').rotateZ(.45);
  scene.updateMatrixWorld(true);
  const rest = capturePose(bones, mesh);

  const groom = [];
  for (const side of [1, -1]) {
    const frames = [];
    for (const dip of [false, true]) {
      applyPose(bones, standing);
      scene.updateMatrixWorld(true);
      lowerTorso(.38);
      aim(neck, mouth, new Vector3(side * 50, dip ? 87 : 145, 176), dip ? .87 : .68);
      if (dip) {
        aim(head, mouth, new Vector3(side * 49, 102, 176), .47);
        mouth.rotateX(.22);
      }
      const i = side > 0 ? 0 : 1;
      placePaw(1 - i, -side * .5, .09, 1.14);
      placePaw(2, .56, .09, -1.26);
      placePaw(3, -.56, .09, -1.34);
      const muzzle = mouth.getWorldPosition(new Vector3()).multiplyScalar(.01);
      placePaw(i, side * .52, dip ? muzzle.y - .07 : muzzle.y - .27,
        Math.min(1.72, muzzle.z - .14), .38);
      scene.updateMatrixWorld(true);
      frames.push(capturePose(bones, mesh));
    }
    groom.push(frames);
  }
  applyPose(bones, standing);
  scene.updateMatrixWorld(true);
  return { standing, rest, groom, ground };
}

export function createCatColonyModel({ scene, animations: [walk] }) {
  const mesh = findSkin(scene);
  const sourceMixer = new AnimationMixer(scene);
  sourceMixer.clipAction(walk).play();
  const poses = makePoses(scene, mesh, sourceMixer, walk);
  sourceMixer.uncacheRoot(scene);
  const { standing, rest, groom, ground } = poses;
  const tailIndex = mesh.skeleton.bones.findIndex(bone => bone.name.startsWith('tail_'));
  const headIndex = mesh.skeleton.bones.findIndex(bone => bone.name.startsWith('head_'));
  const torsoIndex = mesh.skeleton.bones.findIndex(bone => bone.name.startsWith('torso_'));
  const eyes = mesh.skeleton.bones.flatMap((bone, i) => /^eye[LR]_/.test(bone.name) ? [i] : []);

  return {
    createActor(route) {
      const rig = clone(scene);
      const skin = findSkin(rig);
      const material = skin.material = coatMaterial(mesh.material, route);
      skin.frustumCulled = false; // The controller tests a conservative sphere around the whole animated cat.
      skin.castShadow = false;
      skin.receiveShadow = true;
      const node = new Group();
      node.name = route.id;
      node.scale.set(route.size * (1 + route.build * .45), route.size, route.size);
      rig.scale.setScalar(MODEL_SCALE);
      node.add(rig);
      const bones = skin.skeleton.bones;
      const mixer = new AnimationMixer(rig);
      mixer.clipAction(walk).play();
      const [groomUp, groomDown] = groom[route.seed < .5 ? 0 : 1];
      const rotation = new Quaternion(), position = new Vector3();
      let wasWalking = false;

      return {
        node,
        evaluate(pose, seconds) {
          const { action, amount, distance, elapsed } = pose;
          let bottom = standing.ground;
          if (action === 'walk') {
            // Drive the authored stride by distance so playback follows ground travel.
            const phase = (distance / (.39 * route.size)) % 1;
            mixer.setTime(phase * walk.duration);
            wasWalking = true;
            const i = phase * WALK_GROUND_SAMPLES, j = Math.floor(i);
            bottom = MathUtils.lerp(standing.ground, MathUtils.lerp(ground[j], ground[j + 1], i - j), amount);
            if (amount < 1) {
              bones.forEach((bone, k) => {
                bone.quaternion.slerp(standing.joints[k].rotation, 1 - amount);
                bone.position.lerp(standing.joints[k].position, 1 - amount);
              });
            }
          } else {
            // setTime uses cached bindings, so reactivate them after manual poses.
            if (wasWalking) {
              mixer.stopAllAction();
              mixer.clipAction(walk).play();
              wasWalking = false;
            }
            const isRest = action === 'rest';
            const lick = isRest ? 0 : .5 - .5 * Math.cos(elapsed * 10);
            const a = isRest ? rest : groomUp, b = isRest ? rest : groomDown;
            bottom = MathUtils.lerp(standing.ground, MathUtils.lerp(a.ground, b.ground, lick), amount);
            bones.forEach((bone, i) => {
              rotation.copy(a.joints[i].rotation).slerp(b.joints[i].rotation, lick);
              position.lerpVectors(a.joints[i].position, b.joints[i].position, lick);
              bone.quaternion.copy(standing.joints[i].rotation).slerp(rotation, amount);
              bone.position.copy(standing.joints[i].position).lerp(position, amount);
            });
            bones[tailIndex].rotateZ(Math.sin(seconds * 1.63 + route.seed * 9) * .18 * amount);
            if (isRest) {
              bones[headIndex].rotateY(Math.sin(seconds * .86 + route.seed * 11) * .16 * amount);
              bones[torsoIndex].scale.y = 1 + .017 * Math.sin(seconds * 2.7) * amount;
            }
          }
          if (action !== 'rest') bones[torsoIndex].scale.y = 1;
          const drowsy = action === 'rest' ? amount * (.59 + .29 * Math.cos(elapsed * 1.2) ** 4) : 0;
          for (const eye of eyes) bones[eye].scale.y = 1 - drowsy;
          // Correct the local pivot so the lowest paw stays at terrain level.
          rig.position.set(0, -bottom * MODEL_SCALE + .012, 0);
        },
        dispose() {
          node.removeFromParent();
          mixer.uncacheRoot(rig);
          skin.skeleton.dispose();
          material.dispose();
        },
      };
    },
  };
}
