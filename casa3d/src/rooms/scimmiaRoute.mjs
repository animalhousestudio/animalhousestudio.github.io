import { Box3, CatmullRomCurve3, CubicBezierCurve3, MathUtils, Vector3 } from 'three';
import { LANDING_Z } from '../arrival.mjs';
import { CONTACT_BOOTH } from './contactBoothLayout.mjs';
import { WORLD_SCALE } from './layout.mjs';

const landingZ = LANDING_Z * WORLD_SCALE;
const speed = 1.34;
const cycleDistance = .795;
const gripOffset = .62;
const gripApproachFraction = .22;
const gripApproachDistance = 1.4;
const forwardYaw = direction => Math.atan2(direction.x, direction.z);
const ease = t => MathUtils.smoothstep(t, 0, 1);
const blendYaw = (a, b, t) => a + MathUtils.euclideanModulo(b - a + Math.PI, 2 * Math.PI) * t - Math.PI * t;

function sampleCrossing(jump,t,target) {
  return jump.curve.getPoint(t,target).addScaledVector(jump.bow,16*t*t*(1-t)*(1-t)*jump.offset);
}

function horizontalClearance(point,box) {
  return Math.hypot(Math.max(box.min.x-point.x,point.x-box.max.x,0),
    Math.max(box.min.z-point.z,point.z-box.max.z,0));
}

function arcHeight(start,end,apex,t) {
  return MathUtils.lerp(start,end,t)+4*apex*t*(1-t);
}

export function createScimmiaRoute(supports, groundAt, random = Math.random, rockBounds = []) {
  const spans = new Map();
  for (const support of supports) {
    if (!support.column || support.size.x !== .32 || support.size.z !== .32 || support.size.y < 3) continue;
    const { span, side } = support.column;
    if (!spans.has(span)) spans.set(span, new Map());
    spans.get(span).set(side,support);
  }
  const rows = new Map();
  for (const [span,pair] of spans) {
    if (pair.size === 2) rows.set(span, {
      pair, center: pair.get(1).position.clone().lerp(pair.get(-1).position,.5),
    });
  }
  // The landing faces -Z. On this side of the track, descending span indices
  // take the NPC away from the landing and along the continuous run of columns.
  const approachZ = landingZ-12;
  let entry;
  for (const [span,{center}] of rows) {
    if (center.x < -5 && center.x > -35 && Math.abs(center.z-approachZ) < 10
      && (!entry || Math.abs(center.z-approachZ) < entry.distance)) {
      entry = {span, distance:Math.abs(center.z-approachZ)};
    }
  }
  if (!entry) return null;
  const ordered = [];
  let side = rows.get(entry.span).pair.get(1).position.x > rows.get(entry.span).pair.get(-1).position.x ? 1 : -1;
  for (let span = entry.span; rows.has(span); span--) {
    const row = rows.get(span);
    const adjacent = rows.get(span-1) ?? rows.get(span+1);
    if (!adjacent) break;
    const forward = row.center.clone().sub(adjacent.center);
    if (rows.has(span-1)) forward.negate();
    forward.y = 0;
    forward.normalize();
    ordered.push({support:row.pair.get(side),other:row.pair.get(-side),forward});
    if (span !== entry.span) {
      side = -side;
      ordered.push({support:row.pair.get(side),other:row.pair.get(-side),forward});
    }
  }
  if (ordered.length < 2) return null;
  const posts = ordered.map(({support,other,forward},index) => {
    const { position, size, column } = support;
    const edge = position.clone().sub(other.position);
    edge.y = 0;
    edge.normalize().addScaledVector(forward,.65);
    // Snap to a real corner of the axis-aligned box so the same baked grip
    // can put each hand and foot on one of its two adjacent faces.
    const outward = new Vector3(edge.x >= 0 ? 1 : -1,0,edge.z >= 0 ? 1 : -1).normalize();
    const bottom = position.y - size.y/2;
    const anchor = new Vector3(position.x,position.y+.16+(index%3)*.08,position.z)
      .addScaledVector(outward,gripOffset);
    for (const rock of rockBounds) {
      if (horizontalClearance(anchor,rock) < 1.6) anchor.y = Math.max(anchor.y,rock.max.y+.13);
    }
    if (anchor.y + 1.45 > bottom+size.y) return null;
    return { id: `${column.span}:${column.side}`, anchor, outward, position, size,
      yaw: forwardYaw(outward.clone().negate()) };
  });
  const blocked = posts.indexOf(null);
  if (blocked !== -1) posts.length = blocked;
  if (posts.length < 2) return null;
  const takeoff = posts[0].anchor.clone().addScaledVector(posts[0].outward, 1.05);
  const onGround = (x,z) => {
    const y = groundAt(x,z);
    return y === null ? null : new Vector3(x,y,z);
  };
  const points = [onGround(-2.7,landingZ+2.8), onGround(-3.2,landingZ-4),
    onGround(-7.6,landingZ-8.1), onGround(takeoff.x,takeoff.z)];
  if (points.some(point => !point)) return null;
  const walk = new CatmullRomCurve3(points);
  const columns = supports.filter(support => support.column);
  const crossing = new Vector3();
  const boothCos = Math.cos(CONTACT_BOOTH.yaw);
  const boothSin = Math.sin(CONTACT_BOOTH.yaw);
  const jumps = posts.slice(0,-1).map((from,index) => {
    const to = posts[index+1];
    const span = from.anchor.distanceTo(to.anchor);
    const exit = from.anchor.clone().addScaledVector(from.outward,gripApproachDistance);
    const entry = to.anchor.clone().addScaledVector(to.outward,gripApproachDistance);
    const handle = gripApproachDistance*(1-2*gripApproachFraction)/(3*gripApproachFraction);
    const heading = forwardYaw(to.anchor.clone().sub(from.anchor));
    const beamClearance = Math.min(from.position.y+from.size.y/2,to.position.y+to.size.y/2)
      -Math.max(from.anchor.y,to.anchor.y)-1.6;
    const jump = {
      exit, entry,
      curve: new CubicBezierCurve3(exit,exit.clone().addScaledVector(from.outward,handle),
        entry.clone().addScaledVector(to.outward,handle),entry),
      duration: .92+.077*span, apex: Math.min(.58+.135*span,Math.max(.24,beamClearance)),
      heading, bow: new Vector3(Math.cos(heading),0,-Math.sin(heading)), offset: 0,
    };
    // Pick the smallest detour that keeps the mid-flight silhouette away
    // from the other posts and from the telegram booth next to the first hop.
    let best = -Infinity, bestOffset = 0;
    for (const offset of [0,1.5,-1.5,3,-3,4.5,-4.5,6,-6]) {
      jump.offset = offset;
      let clearance = Infinity;
      for (let i = 0; i <= 32; i++) {
        sampleCrossing(jump,i/32,crossing);
        for (const {position} of columns) {
          clearance = Math.min(clearance,Math.hypot(position.x-crossing.x,position.z-crossing.z)-.23);
        }
        const dx = crossing.x-CONTACT_BOOTH.x, dz = crossing.z-CONTACT_BOOTH.z;
        clearance = Math.min(clearance,Math.max(Math.abs(dx*boothCos-dz*boothSin),
          Math.abs(dx*boothSin+dz*boothCos))-.9*CONTACT_BOOTH.scale);
        const progress = gripApproachFraction+(i/32)*(1-2*gripApproachFraction);
        crossing.y = arcHeight(from.anchor.y,to.anchor.y,jump.apex,progress);
        for (const rock of rockBounds) {
          clearance = Math.min(clearance,Math.max(horizontalClearance(crossing,rock),
            1.12+crossing.y-rock.max.y-.10));
        }
      }
      if (clearance > best) { best = clearance; bestOffset = offset; }
      if (clearance >= 1.12) break;
    }
    jump.offset = bestOffset;
    return jump;
  });
  const distance = walk.getLength();
  // Finish the walk at phase zero, which is also the mount clip's first pose.
  const cycles = Math.round(distance / cycleDistance);
  const bounds = new Box3().setFromPoints([...walk.getPoints(32), ...posts.map(post => post.anchor)]);
  for (const [index,jump] of jumps.entries()) {
    for (let i = 0; i <= 32; i++) bounds.expandByPoint(sampleCrossing(jump,i/32,crossing));
    bounds.max.y = Math.max(bounds.max.y,Math.max(posts[index].anchor.y,posts[index+1].anchor.y)+jump.apex);
  }
  bounds.expandByVector(new Vector3(1.6, 0, 1.6));
  bounds.min.y -= .15;
  bounds.max.y += 1.75;

  const pose = { phase: 'walk', position: new Vector3(), yaw: 0, clipTime: 0, target: 0, hold: null, returning: false };
  const direction = new Vector3();
  let elapsed = 0;
  let phase = 'walk';
  let index = 0;
  let step = 1;
  let duration = distance/speed;
  const currentJump = () => jumps[step > 0 ? index : index-1];
  function enter(next) {
    phase = next;
    elapsed = 0;
    if (next === 'mount') duration = 1.30;
    if (next === 'grip') duration = 2 + 5*MathUtils.clamp(random(),0,1);
    if (next === 'leap') duration = currentJump().duration;
  }
  function sample() {
    const t = MathUtils.clamp(elapsed/duration,0,1);
    const from = posts[index];
    pose.target = phase === 'leap' ? index+step : index;
    const to = posts[pose.target];
    pose.phase = phase;
    pose.clipTime = t;
    pose.hold = phase === 'grip' ? duration : null;
    pose.returning = step < 0;
    if (phase === 'walk') {
      walk.getPointAt(t,pose.position);
      pose.position.y = groundAt(pose.position.x,pose.position.z) ?? pose.position.y;
      walk.getTangentAt(t,direction);
      pose.yaw = blendYaw(forwardYaw(direction),posts[0].yaw,ease((t-.88)/.12));
      pose.clipTime = (t*cycles)%1;
    } else if (phase === 'grip') {
      pose.position.copy(from.anchor);
      pose.yaw = from.yaw;
    } else {
      const mount = phase === 'mount';
      const start = mount ? points.at(-1) : from.anchor;
      const delay = mount ? .18 : .16;
      const progress = MathUtils.clamp((t-delay)/(1-delay),0,1);
      const jump = currentJump();
      const apex = mount ? .43 : jump.apex;
      if (mount) pose.position.lerpVectors(start,to.anchor,progress);
      else if (progress < gripApproachFraction) {
        pose.position.lerpVectors(start,step > 0 ? jump.exit : jump.entry,progress/gripApproachFraction);
      } else if (progress > 1-gripApproachFraction) {
        pose.position.lerpVectors(step > 0 ? jump.entry : jump.exit,to.anchor,(progress-1+gripApproachFraction)/gripApproachFraction);
      } else {
        const t = (progress-gripApproachFraction)/(1-2*gripApproachFraction);
        sampleCrossing(jump,step > 0 ? t : 1-t,pose.position);
      }
      pose.position.y = arcHeight(start.y,to.anchor.y,apex,progress);
      const heading = (jump?.heading ?? 0) + (step < 0 ? Math.PI : 0);
      pose.yaw = mount ? to.yaw : t < .49
        ? blendYaw(from.yaw,heading,ease((t-.25)/.23))
        : blendYaw(heading,to.yaw,ease((t-.55)/.25));
    }
    return pose;
  }
  return {
    posts, bounds, sample,
    update(dt) {
      let remaining = Math.max(0,dt);
      while (remaining >= duration-elapsed) {
        remaining -= duration-elapsed;
        if (phase === 'walk') enter('mount');
        else if (phase === 'mount') enter('grip');
        else if (phase === 'grip') {
          if (index === posts.length-1 || index === 0) step = index === 0 ? 1 : -1;
          enter('leap');
        }
        else {
          index += step;
          enter('grip');
        }
      }
      elapsed += remaining;
      return sample();
    },
  };
}
