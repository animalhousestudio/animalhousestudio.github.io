// Handles keyboard and pointerlock events. Exposes setupInput to wire PointerLockControls and Player.
import { MobileJoystick } from '../ui/mobileJoystick.js';

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
    if (!mouseLook) return; 
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

  // Mobile controls: Camera joystick (right) + Thrust button (left)
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
  
  // Camera joystick (right side) - only create on touch devices
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if (isTouchDevice) {
    // Sensitivity for camera rotation (pixels per frame)
    const cameraSensitivity = 3.0;
    let animationFrame = null;
    let currentJoystickX = 0;
    let currentJoystickY = 0;
    
    const cameraJoystick = new MobileJoystick(uiRoot, {
      size: 120,
      deadzone: 0.15,
      onMove: (normalizedX, normalizedY) => {
        // Store normalized values for continuous rotation in animation loop
        currentJoystickX = normalizedX;
        currentJoystickY = normalizedY;
        
        // Start animation loop if not already running
        if (!animationFrame) {
          const rotateLoop = () => {
            if (Math.abs(currentJoystickX) > 0.01 || Math.abs(currentJoystickY) > 0.01) {
              // Convert normalized joystick to pixel deltas for camera rotation
              const dx = currentJoystickX * cameraSensitivity;
              const dy = currentJoystickY * cameraSensitivity;
              player.rotateView(dx, dy);
              animationFrame = requestAnimationFrame(rotateLoop);
            } else {
              animationFrame = null;
            }
          };
          animationFrame = requestAnimationFrame(rotateLoop);
        }
      },
      onEnd: () => {
        // Reset joystick values
        currentJoystickX = 0;
        currentJoystickY = 0;
        if (animationFrame) {
          cancelAnimationFrame(animationFrame);
          animationFrame = null;
        }
      }
    });
  }
}

