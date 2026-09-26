import * as THREE from 'three';
import { EYE_HEIGHT } from '../rooms/layout.mjs';
import { CollisionWorld } from './collisionWorld.mjs';

// First-person player controller
export class Player {
  constructor(camera, body, opts = {}){
    this.camera = camera;
    this.body = body; // Not used in first-person, kept for compatibility
    this.velocity = new THREE.Vector3();
    this.speed = opts.speed || 4;
    this.runMult = opts.runMultiplier || 1.8;
    this.gravity = opts.gravity || -9.8;
    this.groundHeightAt = opts.groundHeightAt || (() => null);
    this.horizontalBlocked = opts.horizontalBlocked || (() => false);
    this.respawnPosition = opts.respawnPosition || new THREE.Vector3(0,EYE_HEIGHT,14);
    this.controlsEnabled = false;
    this.colliderRadius = 0.35;
    this.headClearance = 0.16;
    this.grounded = false;
    this.colliderSphere = new THREE.Sphere(this.camera.position.clone(), this.colliderRadius);
    this.moveState = { forward:false, back:false, left:false, right:false, up:false, down:false, run:false };
    this.jetpackEnabled = false;

    // View angles (yaw for left/right, pitch for up/down)
    this.yaw = 0; 
    this.pitch = 0;
  }

  setPosition(v){ this.camera.position.copy(v); this.colliderSphere.center.copy(v); }
  getPosition(){ return this.camera.position.clone(); }

  enableControls(en){ this.controlsEnabled = !!en; }
  enableJetpack(){ this.jetpackEnabled = true; }
  disableJetpack(){
    this.jetpackEnabled = false;
    this.jetpackThrusting = false;
    this.velocity.set(0, 0, 0);
    this.moveState = { forward:false, back:false, left:false, right:false, up:false, down:false, run:false };
  }
  setMoveState(state){ Object.assign(this.moveState, state); }

  rotateView(dx, dy){
    // dx,dy in pixels - rotate camera around yaw/pitch
    const sensitivity = 0.0032;
    this.yaw -= dx * sensitivity;
    this.pitch -= dy * sensitivity;
    this.pitch = Math.max(-Math.PI/3, Math.min(Math.PI/3, this.pitch));
    
    // Update camera look direction
    this.updateCamera();
  }

  updateCamera(){
    // Calculate forward direction from yaw/pitch
    const forward = new THREE.Vector3(
      Math.sin(this.yaw),
      Math.sin(this.pitch),
      Math.cos(this.yaw)
    );
    this.camera.lookAt(this.camera.position.clone().add(forward));
  }

  // dt in seconds
  update(dt, colliders = []){
    // Older callers can still supply floor boxes; they use the same full-body
    // solver and only rebuild their index when the supplied boxes change.
    if (Array.isArray(colliders)) {
      if (!this.boxColliders || colliders.length !== this.boxColliders.length
        || colliders.some((box, index) => box !== this.boxColliders[index])) {
        this.boxColliders = colliders.slice();
        this.boxCollisionWorld = CollisionWorld.fromBoxes(colliders);
      }
      colliders = this.boxCollisionWorld;
    }
    // Horizontal desktop/mobile movement from the camera yaw.
    const forwardVec = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const rightVec = new THREE.Vector3(-Math.cos(this.yaw), 0, Math.sin(this.yaw));
    const moveDirection = new THREE.Vector3()
      .addScaledVector(forwardVec, (this.moveState.forward ? 1 : 0) - (this.moveState.back ? 1 : 0))
      .addScaledVector(rightVec, (this.moveState.right ? 1 : 0) - (this.moveState.left ? 1 : 0));
    if (moveDirection.lengthSq() > 0) moveDirection.normalize();

    const targetSpeed = this.speed * (this.moveState.run? this.runMult:1);

    this.velocity.x = moveDirection.x * targetSpeed;
    this.velocity.z = moveDirection.z * targetSpeed;

    if (this.jetpackEnabled) {
      const verticalInput = (this.moveState.up ? 1 : 0) - (this.moveState.down ? 1 : 0);
      const flightSpeed = 7.5 * (this.moveState.run ? 1.45 : 1);
      const response = verticalInput === 0 ? 6 : 13;
      this.velocity.y = THREE.MathUtils.damp(
        this.velocity.y,
        verticalInput * flightSpeed,
        response,
        dt,
      );
      this.jetpackThrusting = verticalInput !== 0;
    } else {
      this.velocity.y += this.gravity * dt;
      this.jetpackThrusting = false;
    }

    // Integrate proposed position
    const nextPos = this.camera.position.clone().addScaledVector(this.velocity, dt);
    if(this.horizontalBlocked(this.camera.position,nextPos,this.colliderRadius)){
      nextPos.x=this.camera.position.x;nextPos.z=this.camera.position.z;
    }

    // Ground profiles cover the terrain and human-height stairs. Apply their
    // rise before the capsule sweep, so real treads do not act like walls.
    const feetY = this.camera.position.y - EYE_HEIGHT;
    const groundY = this.groundHeightAt(nextPos.x, nextPos.z, feetY);
    const previousGround = this.groundHeightAt(this.camera.position.x, this.camera.position.z, feetY);
    const followsSlope = previousGround !== null && Math.abs(feetY - previousGround) < .08
      && groundY !== null && Math.abs(groundY - previousGround) <= .55;
    let grounded = false;
    if (groundY !== null && this.velocity.y <= 0
        && feetY >= groundY - 0.55
        && (nextPos.y - EYE_HEIGHT <= groundY || followsSlope)) {
      nextPos.y = groundY + EYE_HEIGHT;
      grounded = true;
    }

    if (typeof colliders.move === 'function') {
      const options = { radius: this.colliderRadius, eyeHeight: EYE_HEIGHT, headClearance: this.headClearance };
      const requested = nextPos.clone().sub(this.camera.position);
      let collision = colliders.move(this.camera.position, requested, { ...options, velocity: this.velocity });
      const horizontalLoss = Math.hypot(nextPos.x - collision.position.x, nextPos.z - collision.position.z);
      if (!this.jetpackEnabled && (this.grounded || grounded || collision.grounded)
        && requested.x ** 2 + requested.z ** 2 > 1e-8 && horizontalLoss > .005) {
        // Small thresholds can be climbed while a low cabinet or a wall still
        // blocks the whole body. Every part of the step checks head clearance.
        const raised = colliders.move(this.camera.position, new THREE.Vector3(0, .4, 0), options);
        const across = colliders.move(raised.position, new THREE.Vector3(requested.x, 0, requested.z), options);
        const down = colliders.move(across.position, new THREE.Vector3(0, -.42, 0), options);
        const steppedLoss = Math.hypot(nextPos.x - down.position.x, nextPos.z - down.position.z);
        if (down.grounded && steppedLoss < horizontalLoss - .001
          && down.position.y <= this.camera.position.y + .401) collision = down;
      }
      nextPos.copy(collision.position);
      grounded ||= collision.grounded;
    }
    if (grounded){ this.velocity.y = Math.max(0, this.velocity.y); }
    this.grounded = grounded;

    // Apply position
    this.camera.position.copy(nextPos);
    this.colliderSphere.center.copy(this.camera.position);

    // Out-of-bounds safety
    if (this.camera.position.y < -40) {
      this.camera.position.copy(this.respawnPosition);
      this.velocity.set(0, 0, 0);
    }
  }
}
