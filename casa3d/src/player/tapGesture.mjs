// Pointer-up is the sole scene activation path: synthesized touch clicks cannot
// repeat a pickup, and a drag that returns to its start is still a drag.
export function createTapGesture({ maxDistance = 8 } = {}) {
  let pending = null;
  return {
    start(event, { blocked = false, otherPointers = 0 } = {}) {
      if (blocked || otherPointers || event.isPrimary === false || event.button !== 0 || pending) {
        pending = null; return;
      }
      pending = { id: event.pointerId, x: event.clientX, y: event.clientY, dragged: false };
    },
    move(event) {
      if (pending?.id === event.pointerId && Math.hypot(event.clientX - pending.x, event.clientY - pending.y) > maxDistance) pending.dragged = true;
    },
    end(event, { blocked = false } = {}) {
      if (!pending || pending.id !== event.pointerId) return null;
      const tap = pending; pending = null;
      if (blocked || tap.dragged || Math.hypot(event.clientX - tap.x, event.clientY - tap.y) > maxDistance) return null;
      return { x: event.clientX, y: event.clientY };
    },
    cancel() { pending = null; },
  };
}
