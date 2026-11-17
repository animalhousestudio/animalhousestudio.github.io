import { Box3, CatmullRomCurve3, MathUtils, Vector3 } from 'three';
import { COASTER_TUNNEL } from './coasterLayout.mjs';
import { WORLD_SCALE } from './layout.mjs';

const SPEED = 2.55;
const SURFACE_SPEED = .95;
export const SHARK_SCALE = .84;

export function createSharkRoute(ponds) {
  const { x, startZ, endZ, floor } = COASTER_TUNNEL;
  const [near, far] = ponds;
  const nearZ = near.z * WORLD_SCALE, farZ = far.z * WORLD_SCALE;
  const surfaceDepth = .93 * SHARK_SCALE;
  const nearSurface = near.waterY * WORLD_SCALE - surfaceDepth;
  const farSurface = far.waterY * WORLD_SCALE - surfaceDepth;
  const tunnelY = floor + .75;
  const lane = 2.50;
  // Metres in the same coordinate system as the coaster. Straight runs
  // pass below the rails. The shark rises off to the side in each basin.
  const points = [
    [lane, tunnelY, startZ + 4], [lane, tunnelY, startZ + 12],
    [lane, tunnelY, endZ - 12], [lane, tunnelY, endZ - 4],
    [lane, tunnelY, endZ + 1.7], [4.3, tunnelY, farZ + 1],
    [4.8, -7.5, farZ + 2.4], [4.8, -3.1, farZ + 4],
    [4.8, farSurface - .65, farZ + 3.2], [4.7, farSurface, farZ + 1.3],
    [6.4, farSurface, farZ + .5], [8.5, farSurface, farZ + 1.7],
    [8.7, farSurface, farZ + 3.5], [7.3, farSurface, farZ + 4.2],
    [5.9, farSurface, farZ + 3.9], [5.2, farSurface, farZ + 2.9],
    [5.7, farSurface - .55, farZ + 1.1],
    [5.9, -5.8, farZ + .2], [4.5, -10.9, farZ + 1.4],
    [1.5, -13.5, farZ + 2.4], [-1.4, -13.5, farZ + 1.8], [-2.5, tunnelY, farZ + .6],
    [-lane, tunnelY, endZ + 1.7], [-lane, tunnelY, endZ - 4],
    [-lane, tunnelY, endZ - 12], [-lane, tunnelY, startZ + 12],
    [-lane, tunnelY, startZ + 4], [-lane, tunnelY, startZ - 1.7],
    [-4.3, tunnelY, nearZ - 1], [-5.0, -7.5, nearZ - 2.3],
    [-5.1, -3.1, nearZ - 3], [-5.0, nearSurface, nearZ - 1.8],
    [-6.6, nearSurface, nearZ + .1], [-8.5, nearSurface, nearZ - 1.0],
    [-8.8, nearSurface, nearZ - 3.0], [-7.5, nearSurface, nearZ - 4.2],
    [-5.9, nearSurface, nearZ - 3.9], [-5.1, nearSurface, nearZ - 2.6],
    [-5.1, nearSurface - .2, nearZ + 1.2],
    [-5.5, -5.8, nearZ + 1.0], [-4.2, -10.7, nearZ - .8],
    [-1.5, -13.4, nearZ - 2.5], [1.4, -13.4, nearZ - 2],
    [2.5, tunnelY, nearZ - .8], [lane, tunnelY, startZ - 1.7],
  ].map(([offset, y, z]) => new Vector3(x + offset, y, z));
  const curve = new CatmullRomCurve3(points, true, 'centripetal');
  curve.arcLengthDivisions = 1600;
  const length = curve.getLength();
  const steps = curve.arcLengthDivisions;
  const elapsed = new Float64Array(steps + 1);
  const midpointZ = (nearZ + farZ) / 2;
  const waterAt = z => (z < midpointZ ? near : far).waterY * WORLD_SCALE;
  const point = new Vector3();
  // Build the time-to-distance map once. Slow smoothly as the fin approaches
  // the surface and keep the established speed below the basins.
  for (let i = 0; i < steps; i++) {
    curve.getPointAt((i + .5) / steps, point);
    const depth = waterAt(point.z) - point.y;
    const speed = MathUtils.lerp(SURFACE_SPEED, SPEED, MathUtils.smoothstep(depth, 1, 3.4));
    elapsed[i + 1] = elapsed[i] + length / (steps * speed);
  }
  const duration = elapsed[steps];
  const bounds = new Box3().setFromPoints(curve.getSpacedPoints(600)).expandByScalar(2.5);
  const tangent = new Vector3(), ahead = new Vector3(), behind = new Vector3();
  const look = .65 / length;

  return {
    bounds, duration,
    sample(seconds, pose) {
      const time = MathUtils.euclideanModulo(seconds, duration);
      let low = 0, high = steps;
      while (high - low > 1) {
        const mid = (low + high) >>> 1;
        if (elapsed[mid] <= time) low = mid;
        else high = mid;
      }
      const u = (low + (time - elapsed[low]) / (elapsed[high] - elapsed[low])) / steps;
      curve.getPointAt(u, pose.position);
      curve.getTangentAt(u, tangent);
      pose.yaw = Math.atan2(tangent.x, tangent.z);
      // The body pitches into depth changes, returning to level as the
      // dorsal fin reaches the surface. Avoid lifting the caudal tip there.
      const layout = pose.position.z < midpointZ ? near : far;
      const water = waterAt(pose.position.z);
      // Round off the final ascent and flatten any spline overshoot. The
      // pond surface can dip by .215 m in world coordinates.
      const surfaceY = water - surfaceDepth;
      const ease = .24;
      const cap = MathUtils.clamp((pose.position.y - surfaceY + ease) / ease, 0, 1);
      if (cap > 0) pose.position.y = surfaceY - ease * (1 - cap) ** 2 * (1 + cap);
      const depth = water - pose.position.y;
      const submerged = MathUtils.smoothstep(depth, 1.6, 3.4);
      curve.getPointAt(MathUtils.euclideanModulo(u + look, 1), ahead);
      curve.getPointAt(MathUtils.euclideanModulo(u - look, 1), behind);
      pose.pitch = MathUtils.clamp(Math.atan2(ahead.y - behind.y,
        Math.hypot(ahead.x - behind.x, ahead.z - behind.z)), -.26, .26) * submerged;
      pose.surface = depth < 1.05 * SHARK_SCALE && layout.contains(pose.position.x / WORLD_SCALE, pose.position.z / WORLD_SCALE);
      pose.water = water;
      return pose;
    },
  };
}
