import { Group } from 'three';
import { clone } from 'three/addons/utils/SkeletonUtils.js';

// A separate render scene restores the complete head without exposing it to
// the first-person camera or mutating the original rig, materials or inventory.
export function createIntercomPortrait(source) {
  const root = new Group(); root.name = 'IntercomPortrait';
  const model = clone(source); root.add(model);
  const originals = [], copies = [];
  source.traverse(node => originals.push(node)); model.traverse(node => copies.push(node));
  return {
    root,
    sync() {
      for (let i = 0; i < copies.length; i++) {
        const from = originals[i], to = copies[i];
        to.position.copy(from.position); to.quaternion.copy(from.quaternion); to.scale.copy(from.scale);
        to.visible = from.name.startsWith('Head_Bear_Separate') || from.visible;
      }
      source.updateWorldMatrix(true, false);
      source.matrixWorld.decompose(root.position, root.quaternion, root.scale);
      // The model root transform is already included in matrixWorld above.
      model.position.set(0, 0, 0); model.quaternion.identity(); model.scale.set(1, 1, 1);
      root.updateMatrixWorld(true);
    },
  };
}
