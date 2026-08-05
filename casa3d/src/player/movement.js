import * as THREE from 'three';

// First-person player controller
export class Player {
  constructor(camera, body, opts = {}){
    this.camera = camera;
    this.body = body; // Not used in first-person, kept for compatibility
    this.velocity = new THREE.Vector3();
    this.speed = opts.speed || 4;
    this.runMult = opts.runMultiplier || 1.8;
    this.gravity = opts.gravity || -9.8;
    this.controlsEnabled = false;
    this.colliderRadius = 0.35;
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
  update(dt, colliders){
    // Horizontal desktop/mobile movement from the camera yaw.
    const forwardVec = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const rightVec = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
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

    // Collision: sphere against colliders
    this.colliderSphere.center.copy(nextPos);
    let grounded = false;
    for (const box of colliders){
      const landsOnTop = this.velocity.y <= 0
        && this.camera.position.y - this.colliderRadius >= box.max.y - 0.02
        && nextPos.y - this.colliderRadius <= box.max.y
        && nextPos.x >= box.min.x - this.colliderRadius
        && nextPos.x <= box.max.x + this.colliderRadius
        && nextPos.z >= box.min.z - this.colliderRadius
        && nextPos.z <= box.max.z + this.colliderRadius;
      if (landsOnTop) {
        nextPos.y = box.max.y + this.colliderRadius;
        this.colliderSphere.center.copy(nextPos);
        grounded = true;
        continue;
      }
      if (box.intersectsSphere(this.colliderSphere)){
        const closest = box.clampPoint(this.colliderSphere.center, new THREE.Vector3());
        const pen = new THREE.Vector3().subVectors(this.colliderSphere.center, closest);
        const penLen = pen.length();
        if (penLen > 0){
          const push = pen.clone().setLength(this.colliderRadius - penLen + 0.001);
          nextPos.add(push);
          if (push.y > 0.001) grounded = true;
        }
      }
    }

    if (grounded){ this.velocity.y = Math.max(0, this.velocity.y); }

    // Apply position
    this.camera.position.copy(nextPos);
    this.colliderSphere.center.copy(this.camera.position);

    // Out-of-bounds safety
    if (this.camera.position.y < -40) {
      this.camera.position.set(0, 0.5, 10);
      this.velocity.set(0, 0, 0);
    }
  }
}
