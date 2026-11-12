import './arrivalFlight.css';

const PALETTE = ['#fb2477', '#ffd532', '#26d6ed', '#bbef4c', '#9c65fb', '#ff733d'];
const INK = '#200b36';
const TAU = Math.PI * 2;
const smooth = (from, to, x) => {
  const t = Math.max(0, Math.min(1, (x - from) / (to - from)));
  return t * t * (3 - 2 * t);
};
const windowAt = (t, start, inEnd, outStart, end) =>
  smooth(start, inEnd, t) * (1 - smooth(outStart, end, t));

function star(ctx, x, y, size, color, tilt) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const angle = i * TAU / 8;
    const radius = i % 2 ? size * .3 : size;
    ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = size * .15;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.restore();
}

function ribbon(ctx, angle, t, edge, color) {
  const inner = .19 + .08 * Math.sin(t * 8);
  const point = (step, side) => {
    const r = inner + (edge * 1.28 - inner) * step;
    const bend = .48 * Math.sin(step * 3.35 - t * 8 + angle) + step * .38;
    const a = angle + bend + side * (.014 + .098 * step);
    ctx.lineTo(r * Math.cos(a), r * Math.sin(a));
  };
  ctx.beginPath();
  for (let i = 0; i <= 16; i++) point(i / 16, -1);
  for (let i = 16; i >= 0; i--) point(i / 16, 1);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = .007;
  ctx.strokeStyle = INK;
  ctx.stroke();
}

function tunnel(ctx, t, edge) {
  const energy = (.72 + .28 * smooth(0, .15, t)) * (1 - smooth(.72, .98, t));
  if (energy <= 0) return;
  ctx.save();
  ctx.globalAlpha = energy * .58;
  ctx.rotate(t * 3.4);
  for (let i = 0; i < 10; i++) ribbon(ctx, i * TAU / 10, t, edge, PALETTE[i % PALETTE.length]);
  for (let i = 0; i < 4; i++) {
    const f = (t * 3.8 + i * .25) % 1;
    const radius = .17 + edge * f * f;
    ctx.globalAlpha = energy * Math.sin(f * Math.PI) * .58;
    ctx.beginPath();
    ctx.ellipse(0, 0, radius, radius * (.88 + .11 * Math.cos(t * 13 + i)), t * 3, 0, TAU);
    ctx.strokeStyle = PALETTE[(i + 1) % PALETTE.length];
    ctx.lineWidth = .007 + f * .015;
    ctx.stroke();
  }
  ctx.restore();
}

function planet(ctx, x, y, r, index) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(index * 1.4);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fillStyle = PALETTE[index % PALETTE.length];
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = r * .16;
  ctx.stroke();
  ctx.clip();
  for (let stripe = -2; stripe <= 2; stripe++) {
    const h = stripe * r * .5;
    ctx.beginPath();
    ctx.moveTo(-r, h);
    ctx.bezierCurveTo(-r * .46, h + r * .44, r * .56, h - r * .46, r, h + r * .12);
    ctx.strokeStyle = PALETTE[(index + 7 + stripe) % PALETTE.length];
    ctx.lineWidth = r * .22;
    ctx.stroke();
  }
  ctx.restore();
}

function confetti(ctx, t, edge) {
  const energy = windowAt(t, .10, .25, .76, .99);
  if (energy <= 0) return;
  for (let i = 0; i < 36; i++) {
    const angle = i * 2.399963 + t * .82;
    const phase = (i * .618034 + t * (1.18 + i % 4 * .22)) % 1;
    const radius = .12 + edge * phase ** 1.75;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    const size = (.009 + (i % 5) * .004) * (1 + phase * 1.7);
    ctx.globalAlpha = energy * smooth(0, .16, phase) * (1 - smooth(.82, 1, phase));
    if (i % 7 === 0) planet(ctx, x, y, size * 1.65, i);
    else star(ctx, x, y, size, i % 5 === 0 ? '#fff4c8' : PALETTE[i % 6], angle);
  }
  ctx.globalAlpha = 1;
}

export function createArrivalFlight() {
  let canvas;
  let ctx;
  let lastFrame = -Infinity;
  let viewWidth = 0;
  let viewHeight = 0;
  return {
    start() {
      canvas = document.createElement('canvas');
      canvas.className = 'arrival-flight';
      canvas.setAttribute('aria-hidden', 'true');
      ctx = canvas.getContext('2d');
      if (ctx) document.body.append(canvas);
    },
    update(now, progress) {
      if (!ctx || now - lastFrame < 1000 / 30 - 1) return;
      lastFrame = now;
      if (viewWidth !== innerWidth || viewHeight !== innerHeight) {
        viewWidth = innerWidth;
        viewHeight = innerHeight;
        const scale = Math.min(devicePixelRatio || 1, Math.sqrt(1_100_000 / (viewWidth * viewHeight)));
        canvas.width = Math.max(1, Math.round(viewWidth * scale));
        canvas.height = Math.max(1, Math.round(viewHeight * scale));
      }
      const { width, height } = canvas;
      const unit = Math.min(width, height);
      const edge = Math.hypot(width, height) / (2 * unit);
      ctx.clearRect(0, 0, width, height);
      ctx.save();
      ctx.translate(width * .5, height * .47);
      ctx.scale(unit, unit);
      tunnel(ctx, progress, edge);
      confetti(ctx, progress, edge);
      ctx.restore();
    },
    stop() {
      if (!canvas) return;
      canvas.remove();
      canvas.width = canvas.height = 1;
      canvas = ctx = undefined;
    },
  };
}
