// Mobile joystick for camera control (PUBG-style)
// Pure touch-based implementation without external libraries

export class MobileJoystick {
  constructor(container, opts = {}) {
    this.container = container;
    this.size = opts.size || 120;
    this.deadzone = opts.deadzone || 0.1; // 10% deadzone
    this.maxDistance = this.size / 2;
    this.active = false;
    this.touchId = null;
    
    // Callback for joystick movement (dx, dy in normalized -1 to 1 range)
    this.onMove = opts.onMove || (() => {});
    this.onEnd = opts.onEnd || (() => {});
    
    // Current position
    this.centerX = 0;
    this.centerY = 0;
    this.currentX = 0;
    this.currentY = 0;
    
    this.createElements();
    this.attachEvents();
  }
  
  createElements() {
    // Joystick container (fixed position, bottom-right)
    this.joystickContainer = document.createElement('div');
    this.joystickContainer.className = 'mobile-joystick';
    this.joystickContainer.style.cssText = `
      position: fixed;
      bottom: 30px;
      right: 30px;
      width: ${this.size}px;
      height: ${this.size}px;
      pointer-events: auto;
      z-index: 1000;
    `;
    
    // Outer ring (always visible)
    this.outerRing = document.createElement('div');
    this.outerRing.className = 'joystick-outer';
    this.outerRing.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      border-radius: 50%;
      background: rgba(30, 30, 40, 0.5);
      border: 3px solid rgba(255, 255, 255, 0.3);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    `;
    
    // Inner thumb (moves with touch)
    this.thumb = document.createElement('div');
    this.thumb.className = 'joystick-thumb';
    this.thumb.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      width: 50%;
      height: 50%;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.7);
      border: 2px solid rgba(255, 255, 255, 0.9);
      transform: translate(-50%, -50%);
      transition: background 0.1s;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    `;
    
    this.outerRing.appendChild(this.thumb);
    this.joystickContainer.appendChild(this.outerRing);
    this.container.appendChild(this.joystickContainer);
  }
  
  attachEvents() {
    this.joystickContainer.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
    window.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
    window.addEventListener('touchend', this.onTouchEnd.bind(this));
    window.addEventListener('touchcancel', this.onTouchEnd.bind(this));
  }
  
  onTouchStart(e) {
    e.preventDefault();
    if (this.active) return; // Already tracking a touch
    
    const touch = e.changedTouches[0];
    this.touchId = touch.identifier;
    this.active = true;
    
    // Get joystick center in screen coordinates
    const rect = this.joystickContainer.getBoundingClientRect();
    this.centerX = rect.left + rect.width / 2;
    this.centerY = rect.top + rect.height / 2;
    
    // Initial position
    this.currentX = touch.clientX;
    this.currentY = touch.clientY;
    
    // Visual feedback
    this.thumb.style.background = 'rgba(255, 255, 255, 0.9)';
    this.thumb.style.boxShadow = '0 0 20px rgba(255, 255, 255, 0.5)';
    
    this.updateThumbPosition();
  }
  
  onTouchMove(e) {
    if (!this.active) return;
    
    e.preventDefault();
    
    // Find the touch we're tracking
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === this.touchId) {
        this.currentX = touch.clientX;
        this.currentY = touch.clientY;
        this.updateThumbPosition();
        break;
      }
    }
  }
  
  onTouchEnd(e) {
    if (!this.active) return;
    
    // Check if our tracked touch ended
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === this.touchId) {
        this.reset();
        break;
      }
    }
  }
  
  updateThumbPosition() {
    // Calculate offset from center
    let dx = this.currentX - this.centerX;
    let dy = this.currentY - this.centerY;
    
    // Calculate distance and angle
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Clamp to max distance
    if (distance > this.maxDistance) {
      const angle = Math.atan2(dy, dx);
      dx = Math.cos(angle) * this.maxDistance;
      dy = Math.sin(angle) * this.maxDistance;
    }
    
    // Move thumb visually
    const thumbX = 50 + (dx / this.maxDistance) * 50; // 50% center + offset
    const thumbY = 50 + (dy / this.maxDistance) * 50;
    this.thumb.style.left = thumbX + '%';
    this.thumb.style.top = thumbY + '%';
    
    // Normalize to -1 to 1 range
    let normalizedX = dx / this.maxDistance;
    let normalizedY = dy / this.maxDistance;
    
    // Apply deadzone
    const normalizedDistance = Math.sqrt(normalizedX * normalizedX + normalizedY * normalizedY);
    if (normalizedDistance < this.deadzone) {
      normalizedX = 0;
      normalizedY = 0;
    }
    
    // Call movement callback with normalized values
    this.onMove(normalizedX, normalizedY);
  }
  
  reset() {
    this.active = false;
    this.touchId = null;
    
    // Reset thumb to center
    this.thumb.style.left = '50%';
    this.thumb.style.top = '50%';
    this.thumb.style.background = 'rgba(255, 255, 255, 0.7)';
    this.thumb.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.3)';
    
    // Call end callback
    this.onEnd();
  }
  
  destroy() {
    this.joystickContainer.remove();
  }
}
