import { Box3, CatmullRomCurve3, Euler, MathUtils, Quaternion, Vector3 } from 'three';
import { COASTER_TUNNEL } from './coasterLayout.mjs';
import { WORLD_SCALE } from './layout.mjs';

export const FISH_LANE = 3.12;
const TUNNEL_Y = -8.05;
const SPEED = 2.05;
const SAMPLES = 1800;

export function createFishSchoolRoute(ponds, formationRadius) {
  const { x, startZ, endZ } = COASTER_TUNNEL;
  const [near, far] = ponds.map(pond => pond.z * WORLD_SCALE);
  const lane = FISH_LANE, y = TUNNEL_Y;
  // At carriage height in the passage, above the shark's lower transit.
  // Circle the opposite half of each lake from the shark's surface loop.
  const points = [
    [lane, y, startZ + 4], [lane, y, startZ + 10], [lane, y, endZ - 10],
    [lane, y, endZ - 4], [lane, y, endZ + .5], [2.92, -8.35, endZ + 1.65],
    [2.25, -8.75, far - .45], [1.4, -8.5, far + .95], [.72, -8.05, far + 2.65], [-.38, -7.25, far + 4.1], [-2.05, -5.8, far + 5],
    [-4.8, -4.6, far + 4.7], [-5.9, -4.15, far + 1.9], [-5.55, -4.60, far + .55],
    [-5.12, -5.92, far - .05], [-4.59, -7.5, far - .37], [-3.90, -8.88, far - .55], [-lane, -9.30, endZ + 2.6], [-lane, -8.75, endZ + .5],
    [-lane, y, endZ - 4], [-lane, y, endZ - 10], [-lane, y, startZ + 10],
    [-lane, y, startZ + 4], [-lane, y, startZ - .6], [-lane, y, startZ - 2.5],
    [-1.9, -8.3, near - .8], [-.95, -7.5, near - 3.2], [1.15, -6.2, near - 4.75],
    [3.9, -5.0, near - 4.1], [5.8, -4.4, near - 1.85], [5.9, -4.15, near + .35],
    [5.05, -5.75, near + 1.0], [4.65, -7.9, near + .75], [3.90, -9.05, near + .55], [lane, -9.65, near + .70], [lane, -9.6, startZ - 2.45], [lane, -8.70, startZ - .55],
  ].map(([dx, y, z]) => new Vector3(x + dx, y, z));
  const curve = new CatmullRomCurve3(points, true, 'centripetal');
  curve.arcLengthDivisions = SAMPLES;
  const duration = curve.getLength() / SPEED;
  const bounds = new Box3().setFromPoints(curve.getSpacedPoints(SAMPLES)).expandByScalar(formationRadius + .05);
  const direction = new Vector3(), ahead = new Vector3(), behind = new Vector3();
  const rotation = new Euler(0, 0, 0, 'YXZ');
  const halfLook = .55 / curve.getLength();
  const reviewPoints = [
    ['outbound', new Vector3(x + lane, y, (startZ + endZ) * .5)],
    ['return', new Vector3(x - lane, y, (startZ + endZ) * .5)],
    ['near', new Vector3(x + 5.8, -4.4, near - 1.85)],
    ['far', new Vector3(x - 5.9, -4.15, far + 1.9)],
  ];
  const reviewTimes = {};
  for (const [name, goal] of reviewPoints) {
    let closest = Infinity;
    for (let i = 0; i < SAMPLES; i++) {
      const distance = curve.getPointAt(i / SAMPLES, ahead).distanceToSquared(goal);
      if (distance < closest) {
        closest = distance;
        reviewTimes[name] = i * duration / SAMPLES;
      }
    }
  }

  return {
    duration, bounds, reviewTimes: Object.freeze(reviewTimes), radius: formationRadius,
    sample(seconds, pose) {
      const u = MathUtils.euclideanModulo(seconds, duration) / duration;
      curve.getPointAt(u, pose.position);
      curve.getPointAt(MathUtils.euclideanModulo(u + halfLook, 1), ahead);
      curve.getPointAt(MathUtils.euclideanModulo(u - halfLook, 1), behind);
      direction.subVectors(ahead, behind);
      const yaw = Math.atan2(direction.x, direction.z);
      const pitch = MathUtils.clamp(Math.atan2(direction.y, Math.hypot(direction.x, direction.z)), -1.32, 1.32);
      pose.orientation.setFromEuler(rotation.set(-pitch, yaw, 0));
      pose.yaw = yaw;
      return pose;
    },
  };
}

export function fishSchoolPose() {
  return { position: new Vector3(), orientation: new Quaternion(), yaw: 0 };
}
