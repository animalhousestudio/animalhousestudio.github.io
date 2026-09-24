import { CubicBezierCurve3, Vector3 } from 'three';

export const ARRIVAL_DURATION = 14000;
export const LANDING_Z = 43;
export function createArrival(aspect, height) {
  const start = new Vector3(0, 65, 320 * Math.max(1, .85 / aspect));
  const end = new Vector3(0, height, LANDING_Z);
  const curve = new CubicBezierCurve3(start,
    new Vector3(0, 65, start.z - 55), new Vector3(0, 12, 46), end);
  return {
    start, end,
    sample(progress) {
      const t = Math.max(0, Math.min(1, progress));
      const eased = t * t * t * (t * (t * 6 - 15) + 10);
      return {
        position: curve.getPoint(eased),
        focus: new Vector3(0, -12 + 17.4 * eased, 0),
      };
    },
  };
}
