import { EYE_HEIGHT } from '../rooms/layout.mjs';
import { getPondOutline } from '../rooms/pondLayout.mjs';

// Swimming uses the same measured basin profile as its mesh. All runtime
// queries are scalar math; deep water never visits the world's collision tree.
export function createPondSwimming(layout, { worldScale = 1 } = {}) {
  const outline = getPondOutline(layout);
  const bounds = {
    minX: Math.min(...outline.map(p => p[0])) * worldScale,
    maxX: Math.max(...outline.map(p => p[0])) * worldScale,
    minZ: Math.min(...outline.map(p => p[1])) * worldScale,
    maxZ: Math.max(...outline.map(p => p[1])) * worldScale,
  };
  const waterY = layout.waterY * worldScale;
  const floorAt = (x, z) => {
    if (x < bounds.minX || x > bounds.maxX || z < bounds.minZ || z > bounds.maxZ) return null;
    const y = layout.floorAt(x / worldScale, z / worldScale);
    return y === null ? null : y * worldScale;
  };
  const safeFloor = (x, z, radius) => {
    let highest = floorAt(x, z);
    if (highest === null) return Infinity;
    for (let i = 0; i < 4; i++) {
      const edge = floorAt(x + (i === 0 ? radius : i === 1 ? -radius : 0),
        z + (i === 2 ? radius : i === 3 ? -radius : 0));
      if (edge === null) return Infinity;
      highest = Math.max(highest, edge);
    }
    return highest;
  };
  const controller = {
    active: false, underwater: false, bounds, waterY,
    reset(player) { setState(player, false, false); },
    update(player, delta) {
      const position = player.camera.position;
      const floor = floorAt(position.x, position.z);
      if (floor === null || position.y > waterY + EYE_HEIGHT + .5) {
        setState(player, false, false);
        return false;
      }
      if (!controller.active) {
        if (position.y > waterY + EYE_HEIGHT * .7 || floor > waterY - .65) return false;
        player.velocity.set(0, 0, 0);
        player.attachedPole = null;
        player.softLanding = false;
        setState(player, true, position.y < waterY - .12);
      }

      const dt = Math.max(0, Math.min(.1, delta));
      const state = player.moveState;
      const forward = Number(state.forward) - Number(state.back);
      const strafe = Number(state.right) - Number(state.left);
      const vertical = Number(state.up) - Number(state.down);
      let dx = Math.sin(player.yaw) * Math.cos(player.pitch) * forward - Math.cos(player.yaw) * strafe;
      let dz = Math.cos(player.yaw) * Math.cos(player.pitch) * forward + Math.sin(player.yaw) * strafe;
      let dy = Math.sin(player.pitch) * forward + vertical;
      const length = Math.hypot(dx, dy, dz);
      if (length > 1) { dx /= length; dy /= length; dz /= length; }
      const speed = player.speed * .7 * (state.run ? 1.25 : 1);
      // Float gently near the surface; retain the chosen depth below it.
      const floatVelocity = !vertical && Math.abs(dy) < .05 && position.y > waterY - .45
        ? (waterY + .28 - position.y) * 2.5 : 0;
      const response = 1 - Math.exp(-8 * dt);
      player.velocity.x += (dx * speed - player.velocity.x) * response;
      player.velocity.z += (dz * speed - player.velocity.z) * response;
      player.velocity.y += (dy * speed + floatVelocity - player.velocity.y) * response;
      player.jetpackThrusting = false;
      player.grounded = false;

      const clearance = player.colliderRadius + .12;
      let x = position.x + player.velocity.x * dt;
      let z = position.z + player.velocity.z * dt;
      let y = Math.min(Math.max(waterY + .4, position.y), position.y + player.velocity.y * dt);
      const nextFloor = floorAt(x, z);
      // Transition back to a standing capsule on the shallow bank. The normal
      // terrain controller resumes on the next frame, including other props.
      if (!state.down && position.y >= waterY - .3 && nextFloor !== null && nextFloor >= waterY - .65) {
        const standingY = nextFloor + EYE_HEIGHT;
        const standing = position.y >= standingY - .025;
        // Stand up over a few frames instead of snapping the eye a metre up.
        position.set(standing ? x : position.x, Math.min(standingY, position.y + dt * 4), standing ? z : position.z);
        player.velocity.set(0, 0, 0);
        player.grounded = standing;
        player.colliderSphere.center.copy(position);
        setState(player, !standing, false);
        return true;
      }

      const ceilingFloor = Math.max(position.y, y) - clearance;
      if (safeFloor(x, z, player.colliderRadius) > ceilingFloor) {
        // A bounded bisection stops at steep banks even on a slow frame.
        let low = 0, high = 1;
        for (let i = 0; i < 8; i++) {
          const t = (low + high) * .5;
          if (safeFloor(position.x + (x - position.x) * t, position.z + (z - position.z) * t, player.colliderRadius) <= ceilingFloor) low = t;
          else high = t;
        }
        x = position.x + (x - position.x) * low;
        z = position.z + (z - position.z) * low;
        player.velocity.x *= low;
        player.velocity.z *= low;
      }
      const bottom = safeFloor(x, z, player.colliderRadius);
      y = Math.max(y, (Number.isFinite(bottom) ? bottom : floor) + clearance);
      if (y >= waterY + .4 && player.velocity.y > 0 || y <= bottom + clearance && player.velocity.y < 0) player.velocity.y = 0;
      position.set(x, y, z);
      player.colliderSphere.center.copy(position);
      const submerged = controller.underwater ? y < waterY + .04 : y < waterY - .12;
      setState(player, true, submerged);
      return true;
    },
  };
  function setState(player, active, underwater) {
    const changed = player.swimming !== active || player.underwater !== underwater;
    controller.active = player.swimming = active;
    controller.underwater = player.underwater = underwater;
    if (changed) player.onSwimmingChange?.({ active, underwater });
  }
  return controller;
}
