import { Vector3 } from 'three';
import { Capsule } from 'three/addons/math/Capsule.js';
import { Player } from '../player/movement.js';
import { BODY_HEIGHT, BODY_RADIUS, EYE_HEIGHT, SPAWN_FEET } from './house.mjs';

export class GreyboxPlayer extends Player {
  constructor(camera, octree) {
    super(camera, null, { speed: 2.2, runMultiplier: 1.6, gravity: -9.81 });
    this.octree = octree;
    this.colliderRadius = BODY_RADIUS;
    this.capsule = new Capsule(new Vector3(), new Vector3(), BODY_RADIUS);
    this.grounded = false;
    this.motion = new Vector3();
    this.reset();
  }

  setFeet(feet) {
    this.capsule.start.copy(feet).add(new Vector3(0, BODY_RADIUS, 0));
    this.capsule.end.copy(feet).add(new Vector3(0, BODY_HEIGHT - BODY_RADIUS, 0));
    this.velocity.set(0, 0, 0);
    this.syncCamera();
  }

  setPosition(eye) { this.setFeet(eye.clone().add(new Vector3(0, -EYE_HEIGHT, 0))); }
  getFeet() { return this.capsule.start.clone().add(new Vector3(0, -BODY_RADIUS, 0)); }
  syncCamera() {
    this.camera.position.copy(this.capsule.start);
    this.camera.position.y += EYE_HEIGHT - BODY_RADIUS;
    this.colliderSphere.center.copy(this.camera.position);
  }

  reset() {
    this.setFeet(SPAWN_FEET);
    this.yaw = Math.PI;
    this.pitch = 0;
    this.setMoveState({ forward: false, back: false, left: false, right: false, run: false });
    this.updateCamera();
  }

  update(dt) {
    // Small bounded steps prevent tunnelling through the 10-12cm partitions,
    // even when running or returning to a tab after a long frame.
    const duration = Math.min(Math.max(dt, 0), 0.1);
    const steps = Math.max(1, Math.ceil(duration / (1 / 120)));
    const step = duration / steps;
    const m = this.moveState;
    const f = Number(m.forward) - Number(m.back), r = Number(m.right) - Number(m.left);
    const speed = this.speed * (m.run ? this.runMult : 1);
    const wish = new Vector3(Math.sin(this.yaw) * f - Math.cos(this.yaw) * r, 0,
      Math.cos(this.yaw) * f + Math.sin(this.yaw) * r).normalize().multiplyScalar(speed);
    for (let i = 0; i < steps; i++) {
      this.velocity.x = wish.x;
      this.velocity.z = wish.z;
      this.velocity.y += this.gravity * step;
      this.motion.copy(this.velocity).multiplyScalar(step);
      this.capsule.translate(this.motion);
      this.grounded = false;
      for (let pass = 0; pass < 4; pass++) {
        const hit = this.octree.capsuleIntersect(this.capsule);
        if (!hit || hit.depth < 1e-7) break;
        if (hit.normal.y > 0.65) this.grounded = true;
        this.capsule.translate(hit.normal.clone().multiplyScalar(hit.depth + 1e-5));
        const into = this.velocity.dot(hit.normal);
        if (into < 0) this.velocity.addScaledVector(hit.normal, -into);
      }
      if (this.grounded) this.velocity.y = 0;
    }
    this.syncCamera();
    if (this.getFeet().y < -8) this.reset();
  }
}
