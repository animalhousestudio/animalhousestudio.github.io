import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import bearUrl from '../assets/models/player-bear.glb?url';
import { EYE_HEIGHT } from '../rooms/layout.mjs';

// One full body, with an independent camera. This initial trial uses the hold/idle pose.
export function createFirstPersonBody(scene, player) {
  const root = new THREE.Group();
  root.name = 'FirstPersonBear';
  scene.add(root); // Metres, outside the environment's WORLD_SCALE group.
  let mixer;
  const ready = new GLTFLoader().loadAsync(bearUrl).then(gltf => {
    gltf.scene.traverse(node => {
      if (node.name.startsWith('Head_Bear_Separate')) node.visible = false;
      if (node.isMesh) {
        // Conservative for skinned geometry whose extremities move outside rest bounds.
        node.frustumCulled = false;
      }
    });
    root.add(gltf.scene);
    if (gltf.animations.length) {
      mixer = new THREE.AnimationMixer(gltf.scene);
      const idle = gltf.animations.find(clip => clip.name.includes('Idle_Hold')) ?? gltf.animations[0];
      mixer.clipAction(idle).play();
    }
    return root;
  });
  return {
    root, ready,
    update(dt, visible) {
      root.visible = visible;
      // Blender -Y becomes glTF +Z. Keep the authoring eye reference .291 m ahead of the body.
      root.rotation.y = player.yaw;
      root.position.set(
        player.camera.position.x - Math.sin(player.yaw) * .291,
        player.camera.position.y - EYE_HEIGHT,
        player.camera.position.z - Math.cos(player.yaw) * .291,
      );
      if (visible) mixer?.update(dt);
    },
  };
}
