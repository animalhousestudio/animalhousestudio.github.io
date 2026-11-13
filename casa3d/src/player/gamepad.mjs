const DEAD_ZONE = .18;
const LOOK_SPEED_X = 480;
const LOOK_SPEED_Y = 390;
const LOOK_CURVE = 1.65;
const MAX_LOOK_STEP = 1 / 30;
const JETPACK_TOGGLE = 4;
const RUN = 5;
const DESCEND = 6;
const ASCEND = 7;

function stick(axes, index) {
  const x = axes[index] ?? 0, y = axes[index + 1] ?? 0;
  const length = Math.hypot(x, y);
  if (length <= DEAD_ZONE) return [0, 0];
  const scale = (Math.min(1, length) - DEAD_ZONE) / ((1 - DEAD_ZONE) * length);
  return [x * scale, y * scale];
}

export function createGamepadReader() {
  let index = null;
  let previousButtons = 0;
  let previousSelection = 0;
  let lookVelocityX = 0;
  let lookVelocityY = 0;

  function resetLook() {
    lookVelocityX = lookVelocityY = 0;
  }

  function read(pads, { dt, lookEnabled = true, jetpack = false, swimming = false, jetpackCollected = false }) {
    const pad = pads.find(pad => pad?.connected && pad.mapping === 'standard');
    if (!pad) {
      index = null;
      previousButtons = previousSelection = 0;
      resetLook();
      return null;
    }
    if (index !== pad.index) {
      index = pad.index;
      previousButtons = previousSelection = 0;
      resetLook();
    }

    let buttons = 0;
    for (let i = 0; i < Math.min(pad.buttons.length, 31); i++) {
      const button = pad.buttons[i];
      if (button.pressed || button.value >= .5) buttons |= 1 << i;
    }
    const newlyPressed = buttons & ~previousButtons;
    previousButtons = buttons;
    const vertical = jetpack || swimming;
    const reserved = (1 << RUN) | (jetpackCollected ? 1 << JETPACK_TOGGLE : 0)
      | (vertical ? (1 << DESCEND) | (1 << ASCEND) : 0);
    const [x, y] = stick(pad.axes, 0);
    const [lookX, lookY] = stick(pad.axes, 2);
    const lookAmount = Math.hypot(lookX, lookY);
    const gain = lookAmount ** (LOOK_CURVE - 1);
    const targetX = lookX * gain * LOOK_SPEED_X;
    const targetY = lookY * gain * LOOK_SPEED_Y;
    if (!lookEnabled) resetLook();
    const step = lookEnabled ? Math.min(Math.max(dt, 0), MAX_LOOK_STEP) : 0;
    const response = lookAmount === 0 ? 40 : 22;
    const blend = -Math.expm1(-response * step);
    // Integrate the eased velocity across the frame. The same deflection
    // produces the same turn at different refresh rates up to the step cap.
    const dx = targetX * step + (lookVelocityX - targetX) * blend / response;
    const dy = targetY * step + (lookVelocityY - targetY) * blend / response;
    lookVelocityX += (targetX - lookVelocityX) * blend;
    lookVelocityY += (targetY - lookVelocityY) * blend;
    if (!lookAmount && Math.hypot(lookVelocityX, lookVelocityY) < .5) resetLook();
    const menuAxis = Math.abs(x) > Math.abs(y) ? x : y;
    const selection = Math.abs(menuAxis) > .55 ? Math.sign(menuAxis) : 0;
    const select = selection !== previousSelection ? selection : 0;
    previousSelection = selection;

    return {
      action: Boolean(newlyPressed & ~reserved),
      toggleJetpack: jetpackCollected && Boolean(newlyPressed & (1 << JETPACK_TOGGLE)),
      select,
      lookX: dx,
      lookY: dy,
      move: {
        forward: Math.max(0, -y), back: Math.max(0, y),
        left: Math.max(0, -x), right: Math.max(0, x),
        run: Boolean(buttons & (1 << RUN)),
        up: vertical && Boolean(buttons & (1 << ASCEND)),
        down: vertical && Boolean(buttons & (1 << DESCEND)),
      },
    };
  }
  return { read, resetLook };
}
