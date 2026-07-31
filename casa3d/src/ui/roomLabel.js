// Simple DOM overlay for showing room names in the center with fade
export class RoomLabel {
  constructor(container){
    this.container = container || document.body;
    this.el = document.createElement('div'); this.el.className='room-label';
    this.container.appendChild(this.el);
    this._timeout = null;
  }
  show(text, ms=2000){
    this.el.textContent = text.toUpperCase();
    this.el.style.opacity = '1';
    if (this._timeout) clearTimeout(this._timeout);
    this._timeout = setTimeout(()=>{ this.el.style.opacity='0'; }, ms);
  }
}
