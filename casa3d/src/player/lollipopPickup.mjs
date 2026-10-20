import { Vector3 } from 'three';

export const LOLLIPOP_REACH_METRES = 3;
export function createLollipopPickup({ equipment, getBasket, getEye, isBlocked, hasLineOfSight = () => true, targetHeight = .9 }) {
  const target = new Vector3();
  function available(hitPoint = null) {
    const basket = getBasket();
    if (equipment.equipped || isBlocked() || !basket?.userData.ready) return false;
    for (let node = basket; node; node = node.parent) if (!node.visible) return false;
    basket.updateWorldMatrix(true, false);
    if (hitPoint) target.copy(hitPoint);
    else basket.localToWorld(target.set(0, targetHeight, 0));
    const eye = getEye();
    return eye.distanceTo(target) <= LOLLIPOP_REACH_METRES && hasLineOfSight(eye, target);
  }
  return {
    available,
    collect(hitPoint = null) { return available(hitPoint) && equipment.collect(); },
  };
}
