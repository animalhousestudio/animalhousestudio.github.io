// Handles keyboard and pointerlock events. Exposes setupInput to wire PointerLockControls and Player.

// Pixel art feet icon inline SVG
const feetIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
  <g id="left-foot">
    <rect x="6" y="22" width="10" height="18" fill="#ffffff"/>
    <rect x="6" y="20" width="3" height="2" fill="#ffffff"/>
    <rect x="10" y="19" width="3" height="3" fill="#ffffff"/>
    <rect x="14" y="20" width="2" height="2" fill="#ffffff"/>
    <rect x="8" y="24" width="2" height="2" fill="#cccccc" opacity="0.6"/>
    <rect x="12" y="32" width="2" height="2" fill="#cccccc" opacity="0.6"/>
  </g>
  <g id="right-foot">
    <rect x="32" y="22" width="10" height="18" fill="#ffffff"/>
    <rect x="32" y="20" width="2" height="2" fill="#ffffff"/>
    <rect x="35" y="19" width="3" height="3" fill="#ffffff"/>
    <rect x="39" y="20" width="3" height="2" fill="#ffffff"/>
    <rect x="34" y="24" width="2" height="2" fill="#cccccc" opacity="0.6"/>
    <rect x="38" y="32" width="2" height="2" fill="#cccccc" opacity="0.6"/>
  </g>
  <style>
    svg { image-rendering: pixelated; image-rendering: -moz-crisp-edges; image-rendering: crisp-edges; }
  </style>
</svg>`;

export function setupInput(domElement, pointerControls, player){
  // if PointerLockControls provided (not used for third-person), wire events
  if (pointerControls && pointerControls.addEventListener){
    pointerControls.addEventListener('lock', ()=>{ player.enableControls(true); });
    pointerControls.addEventListener('unlock', ()=>{ player.enableControls(false); });
  }

  // keyboard
  const keyMap = {};
  function onKeyDown(e){ keyMap[e.code]=true; apply(); }
  function onKeyUp(e){ keyMap[e.code]=false; apply(); }
  function apply(){
    // if global input blocked (UI open), ignore movement
    const blocked = window.__APP && window.__APP.inputBlocked;
    player.setMoveState({
      // SPACE = thrust forward in look direction; no WASD anymore
      forward: blocked ? false : (keyMap['Space'] || false),
      back: false,
      left: false,
      right: false,
      run: false,
      jump: false
    });
  }
  window.addEventListener('keydown', onKeyDown); 
  window.addEventListener('keyup', onKeyUp);

  // disable automatic pointer lock on click; implement RMB-hold look
  domElement.addEventListener('contextmenu', (e)=> e.preventDefault());

  let mouseLook = false;
  let prevX = 0, prevY = 0;
  function onMouseDown(e){
    if (window.__APP && window.__APP.inputBlocked) return;
    // right button (2) starts look mode
    if (e.button === 2){ 
      mouseLook = true; 
      prevX = e.clientX; 
      prevY = e.clientY; 
      domElement.style.cursor = 'none'; 
    }
    // left button remains for interactions; do not lock pointer
  }
  function onMouseUp(e){ 
    if (e.button === 2){ 
      mouseLook = false; 
      domElement.style.cursor = 'default'; 
    } 
  }
  function onMouseMove(e){ 
    if (!mouseLook || (window.__APP && window.__APP.inputBlocked)) return; 
    const dx = e.movementX || (e.clientX - prevX); 
    const dy = e.movementY || (e.clientY - prevY); 
    prevX = e.clientX; 
    prevY = e.clientY;
    // rotate camera around player
    if (player && typeof player.rotateView === 'function') player.rotateView(dx, dy);
  }
  domElement.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('mousemove', onMouseMove);

  // Mobile controls: dedicated camera joystick (right) + thrust button (left).
  const uiRoot = document.getElementById('ui-root');
  
  // Mobile controls container
  const mobileDiv = document.createElement('div'); 
  mobileDiv.className='mobile-controls'; 
  mobileDiv.style.pointerEvents='auto';
  
  // THRUST button with feet icon (left side)
  const thrustBtn = document.createElement('button'); 
  thrustBtn.className='thrust-btn'; 
  thrustBtn.innerHTML = feetIconSvg; // Use SVG icon instead of text
  thrustBtn.style.cssText = `
    position: fixed;
    bottom: 30px;
    left: 30px;
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: rgba(30, 30, 40, 0.7);
    border: 3px solid rgba(255, 255, 255, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    pointer-events: auto;
    touch-action: none;
    z-index: 1000;
  `;
  
  // Visual feedback on touch
  thrustBtn.addEventListener('touchstart', (ev)=>{ 
    ev.preventDefault(); 
    keyMap['Space']=true; 
    apply();
    thrustBtn.style.background = 'rgba(50, 50, 60, 0.9)';
    thrustBtn.style.transform = 'scale(0.95)';
  });
  thrustBtn.addEventListener('touchend', (ev)=>{ 
    ev.preventDefault(); 
    keyMap['Space']=false; 
    apply();
    thrustBtn.style.background = 'rgba(30, 30, 40, 0.7)';
    thrustBtn.style.transform = 'scale(1)';
  });
  
  mobileDiv.appendChild(thrustBtn);
  uiRoot.appendChild(mobileDiv);
  
  // PUBG-style touch look: drag anywhere on the right side of the game view
  // while the left-side THRUST control remains unchanged.
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if (isTouchDevice) {
    domElement.style.touchAction = 'none';
    document.body.style.touchAction = 'none';
    document.documentElement.style.touchAction = 'none';
    let lookTouchId = null;
    let lookX = 0;
    let lookY = 0;

    const cameraJoystick = document.createElement('div');
    cameraJoystick.className = 'camera-joystick';
    cameraJoystick.setAttribute('aria-label', 'Controllo visuale');
    cameraJoystick.style.cssText = `
      position: fixed;
      right: 30px;
      bottom: 30px;
      width: 112px;
      height: 112px;
      border-radius: 50%;
      background: rgba(20, 32, 55, 0.56);
      border: 3px solid rgba(196, 225, 255, 0.48);
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.42), inset 0 0 18px rgba(82, 175, 255, 0.18);
      pointer-events: auto;
      touch-action: none;
      z-index: 1000;
    `;
    const cameraThumb = document.createElement('div');
    cameraThumb.style.cssText = `
      position: absolute;
      left: 50%;
      top: 50%;
      width: 46px;
      height: 46px;
      margin: -23px;
      border-radius: 50%;
      background: rgba(202, 232, 255, 0.74);
      border: 2px solid rgba(255, 255, 255, 0.82);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.36);
      pointer-events: none;
    `;
    cameraJoystick.appendChild(cameraThumb);
    mobileDiv.appendChild(cameraJoystick);

    let joystickPointerId = null;
    let joystickActive = false;
    let joystickDeflectionX = 0;
    let joystickDeflectionY = 0;
    let lastJoystickFrame = performance.now();
    const joystickRadius = 33;

    function resetCameraJoystick() {
      joystickPointerId = null;
      joystickActive = false;
      joystickDeflectionX = 0;
      joystickDeflectionY = 0;
      cameraThumb.style.transform = 'translate(0, 0)';
    }

    function setCameraJoystickPosition(clientX, clientY) {
      const bounds = cameraJoystick.getBoundingClientRect();
      const offsetX = Math.max(-joystickRadius, Math.min(joystickRadius, clientX - (bounds.left + bounds.width / 2)));
      const offsetY = Math.max(-joystickRadius, Math.min(joystickRadius, clientY - (bounds.top + bounds.height / 2)));
      const magnitude = Math.hypot(offsetX, offsetY);
      const deadZone = 5;
      joystickDeflectionX = magnitude > deadZone ? offsetX / joystickRadius : 0;
      joystickDeflectionY = magnitude > deadZone ? offsetY / joystickRadius : 0;
      cameraThumb.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
    }

    function driveHeldJoystick(now) {
      const dt = Math.min((now - lastJoystickFrame) / 1000, 0.05);
      lastJoystickFrame = now;
      if (joystickActive && !(window.__APP && window.__APP.inputBlocked)) {
        const lookSpeed = 220;
        player.rotateView(joystickDeflectionX * lookSpeed * dt, joystickDeflectionY * lookSpeed * dt);
      }
      requestAnimationFrame(driveHeldJoystick);
    }
    requestAnimationFrame(driveHeldJoystick);

    cameraJoystick.addEventListener('pointerdown', (event) => {
      if (window.__APP && window.__APP.inputBlocked) return;
      joystickPointerId = event.pointerId;
      joystickActive = true;
      setCameraJoystickPosition(event.clientX, event.clientY);
      cameraJoystick.setPointerCapture(event.pointerId);
      event.preventDefault();
    });
    cameraJoystick.addEventListener('pointermove', (event) => {
      if (event.pointerId !== joystickPointerId) return;
      setCameraJoystickPosition(event.clientX, event.clientY);
      event.preventDefault();
    });
    cameraJoystick.addEventListener('pointerup', (event) => {
      if (event.pointerId === joystickPointerId) resetCameraJoystick();
    });
    cameraJoystick.addEventListener('pointercancel', (event) => {
      if (event.pointerId === joystickPointerId) resetCameraJoystick();
    });

    // Older Safari releases do not expose Pointer Events. Keep the same
    // explicit control working there without falling back to canvas gestures.
    if (!window.PointerEvent) {
      let joystickTouchId = null;
      const findJoystickTouch = (touches) => {
        for (const touch of touches) {
          if (touch.identifier === joystickTouchId) return touch;
        }
        return null;
      };
      cameraJoystick.addEventListener('touchstart', (event) => {
        if (window.__APP && window.__APP.inputBlocked) return;
        const touch = event.changedTouches[0];
        if (!touch || joystickTouchId !== null) return;
        joystickTouchId = touch.identifier;
        joystickActive = true;
        setCameraJoystickPosition(touch.clientX, touch.clientY);
        event.preventDefault();
      }, { passive: false });
      cameraJoystick.addEventListener('touchmove', (event) => {
        const touch = findJoystickTouch(event.changedTouches);
        if (!touch) return;
        setCameraJoystickPosition(touch.clientX, touch.clientY);
        event.preventDefault();
      }, { passive: false });
      const endJoystickTouch = (event) => {
        if (findJoystickTouch(event.changedTouches)) {
          joystickTouchId = null;
          resetCameraJoystick();
        }
      };
      cameraJoystick.addEventListener('touchend', endJoystickTouch);
      cameraJoystick.addEventListener('touchcancel', endJoystickTouch);
    }

    function findLookTouch(touches) {
      for (const touch of touches) {
        if (touch.identifier === lookTouchId) return touch;
      }
      return null;
    }

    function findLookStartTouch(touches) {
      for (const touch of touches) {
        if (touch.clientX >= window.innerWidth * 0.35) return touch;
      }
      return null;
    }

    function touchesMobileControl(target) {
      return target instanceof Element && Boolean(target.closest('.mobile-controls'));
    }

    // Capture at window level because overlay UI can sit above the canvas on
    // mobile Safari. The left-side thrust button remains excluded explicitly.
    window.addEventListener('touchstart', (event) => {
      if (window.__APP && window.__APP.inputBlocked) return;
      if (touchesMobileControl(event.target) || lookTouchId !== null) return;
      const touch = findLookStartTouch(event.changedTouches);
      if (!touch) return;
      lookTouchId = touch.identifier;
      lookX = touch.clientX;
      lookY = touch.clientY;
      event.preventDefault();
    }, { passive: false, capture: true });

    window.addEventListener('touchmove', (event) => {
      if (lookTouchId === null) return;
      const touch = findLookTouch(event.changedTouches);
      if (!touch) return;
      player.rotateView((touch.clientX - lookX) * 0.85, (touch.clientY - lookY) * 0.85);
      lookX = touch.clientX;
      lookY = touch.clientY;
      event.preventDefault();
    }, { passive: false, capture: true });

    function endTouchLook(event) {
      if (lookTouchId !== null && findLookTouch(event.changedTouches)) {
        lookTouchId = null;
      }
    }
    window.addEventListener('touchend', endTouchLook);
    window.addEventListener('touchcancel', endTouchLook);
  }
}
