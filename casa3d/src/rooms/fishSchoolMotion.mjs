import { Euler, MathUtils, Quaternion, Vector3 } from 'three';
import { COASTER_TUNNEL } from './coasterLayout.mjs';
import { fishSchoolPose } from './fishSchoolRoute.mjs';

export const FISH_SOURCE_COUNT = 19;
export const FISH_TAIL_SWING = .34;
export const FISH_BODY_ANGLES = Object.freeze([.15, .085, .16]);
export const FISH_SCHOOL_RADIUS = 3.6;

// Each row starts at different depths. More detail stays on the original fish;
// the new fish reuse the inexpensive meshes from the same GLB.
const crossSection = [
  [-.30, -.35], [-.035, -.37], [.25, -.34],
  [-.30, .017], [.004, -.004], [.29, .029],
  [-.285, .361], [.036, .372], [.267, .355],
];
const extras = [0, 2, 3, 4, 6, 7, 10, 11, 13, 15, 17, 4, 13, 3, 10, 0, 11];
export const FISH_FORMATION = Object.freeze(Array.from({ length: 36 }, (_, index) => {
  const slot = (index * 11 + 2) % 36;
  const column = slot % 9;
  const row = Math.floor(slot / 9);
  const [x, y] = crossSection[column];
  const phase = index * 2.3999632;
  return Object.freeze({
    source: index < FISH_SOURCE_COUNT ? index : extras[index - FISH_SOURCE_COUNT],
    scale: 1.29 + .19 * MathUtils.euclideanModulo(index * .618034, 1),
    row, x, y, phase,
    wave: (column % 3) * 1.24 + row * .41,
    surge: column * 2.10 + row * .13,
    sideWave: Math.floor(column / 3) * 1.46 + row * .73,
    lag: (1.5 - row) * 1.51 / 2.05,
    stagger: Math.sin(column * 2.03) * .19,
  });
}));

export function createFishMotionSampler(route) {
  const rows = Array.from({ length: 4 }, () => ({
    pose: fishSchoolPose(), seconds: NaN, room: 0, straight: 0,
  }));
  const bob = new Vector3(), local = new Vector3(), body = new Quaternion();
  const turn = new Euler(0, 0, 0, 'YXZ');
  const { x, startZ, endZ } = COASTER_TUNNEL;

  function spaceFor(fish, seconds) {
    const row = rows[fish.row];
    if (row.seconds === seconds) return row;
    row.seconds = seconds;
    const { position } = route.sample(seconds + fish.lag, row.pose);
    row.room = MathUtils.smoothstep(Math.abs(position.x - x), 3.45, 5.8)
      * MathUtils.smoothstep(position.y, -7.2, -4.4);
    row.straight = MathUtils.smoothstep(position.z, startZ + 5, startZ + 12)
      * (1 - MathUtils.smoothstep(position.z, endZ - 12, endZ - 5));
    return row;
  }

  function anchor(fish, room, straight, offset, travel) {
    offset.set(fish.x * (1 + room * .48),
      fish.y * (.98 + .10 * straight + .22 * room), fish.stagger);
    travel.set(.021 + room * .082, .037 + straight * .086 + room * .082,
      .105 + straight * .047 + room * .11);
  }

  return {
    // Swept bounds account for any phase of the independent fish motion.
    envelope(fish, seconds, position, orientation, offset, travel) {
      const { pose, room, straight } = spaceFor(fish, seconds);
      anchor(fish, room, straight, offset, travel);
      position.copy(pose.position);
      orientation.copy(pose.orientation);
    },
    sample(fish, seconds, position, orientation) {
      const { pose, room, straight } = spaceFor(fish, seconds);
      anchor(fish, room, straight, local, bob);
      const phase = fish.phase;
      const breathing = seconds * (1.42 + .12 * fish.x) + fish.wave;
      const steering = Math.sin(seconds * 1.16 + phase * 1.21);
      local.x += bob.x * (.90 * Math.sin(seconds * 1.16 + fish.sideWave) + .10 * steering);
      local.y += bob.y * (.94 * Math.sin(breathing) + .06 * Math.sin(seconds * 1.84 + phase));
      local.z += bob.z * Math.sin(seconds * 1.03 + fish.surge);
      position.copy(local.applyQuaternion(pose.orientation)).add(pose.position);
      body.setFromEuler(turn.set(
        -FISH_BODY_ANGLES[0] * Math.cos(breathing),
        FISH_BODY_ANGLES[1] * steering,
        FISH_BODY_ANGLES[2] * Math.cos(seconds * 1.3 + phase * .68),
      ));
      orientation.copy(pose.orientation).multiply(body);
    },
  };
}
