// ═══════════════════════════════════════════════
// GAMEZONE — CANVAS PARTICLE SYSTEM
// Cyberpunk floating particles background
// ═══════════════════════════════════════════════

// ── Particle config ───────────────────────────
const PARTICLE_COUNT = 50;
const COLORS = [
  'rgba(106,13,173,',   // CyberPurple
  'rgba(0,229,255,',    // NeonCyan
  'rgba(147,51,234,',   // ElectricViolet
  'rgba(245,245,255,',  // White
  'rgba(217,70,239,'    // MagentaPink
];
const ALPHA_RANGE = { min: 0.06, max: 0.16 };
const SPEED_RANGE  = { min: 0.3,  max: 1.2  };
const SIZE_RANGE   = { min: 1.5,  max: 4.0  };
const DRIFT_RANGE  = { min: -0.4, max: 0.4  };

// ── Particle class ────────────────────────────
class Particle {
  constructor(canvas) {
    this.canvas = canvas;
    this.reset(true);
  }

  reset(initial = false) {
    const c = this.canvas;
    this.x = Math.random() * c.width;
    this.y = initial
      ? Math.random() * c.height
      : c.height + 10;
    this.size =
      SIZE_RANGE.min +
      Math.random() *
      (SIZE_RANGE.max - SIZE_RANGE.min);
    this.speedY =
      -(SPEED_RANGE.min +
        Math.random() *
        (SPEED_RANGE.max - SPEED_RANGE.min));
    this.driftX =
      DRIFT_RANGE.min +
      Math.random() *
      (DRIFT_RANGE.max - DRIFT_RANGE.min);
    this.alpha =
      ALPHA_RANGE.min +
      Math.random() *
      (ALPHA_RANGE.max - ALPHA_RANGE.min);
    this.colorBase =
      COLORS[Math.floor(
        Math.random() * COLORS.length)];
    this.sineOffset =
      Math.random() * Math.PI * 2;
    this.sineSpeed =
      0.01 + Math.random() * 0.02;
    this.sineAmplitude =
      20 + Math.random() * 30;
    this.frame = 0;
  }

  update() {
    this.frame++;
    this.y += this.speedY;
    this.x +=
      this.driftX +
      Math.sin(
        this.sineOffset +
        this.frame * this.sineSpeed
      ) * 0.3;

    // Fade in/out
    const progress =
      1 - (this.y / this.canvas.height);
    if (progress < 0.1) {
      this.alpha =
        ALPHA_RANGE.max * (progress / 0.1);
    } else if (progress > 0.85) {
      this.alpha =
        ALPHA_RANGE.max *
        ((1 - progress) / 0.15);
    }

    // Reset when off screen
    if (this.y < -10) this.reset();
  }

  draw(ctx) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(
      this.x, this.y,
      this.size, 0, Math.PI * 2);
    ctx.fillStyle =
      `${this.colorBase}${this.alpha})`;
    ctx.fill();
    ctx.restore();
  }
}

// ════════════════════════════════════════════
// PARTICLE SYSTEM
// ════════════════════════════════════════════

let _canvas = null;
let _ctx = null;
let _particles = [];
let _animFrame = null;
let _running = false;

/**
 * Initialize particle system
 * @param {string} canvasId
 */
export function initParticles(
  canvasId = 'particle-canvas'
) {
  _canvas = document.getElementById(canvasId);
  if (!_canvas) {
    _canvas = document.createElement('canvas');
    _canvas.id = canvasId;
    _canvas.style.cssText = `
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 0;
    `;
    document.body.appendChild(_canvas);
  }

  _ctx = _canvas.getContext('2d');
  resizeCanvas();

  // Create particles
  _particles = Array.from(
    { length: PARTICLE_COUNT },
    () => new Particle(_canvas)
  );

  // Handle resize
  window.addEventListener(
    'resize', resizeCanvas);

  // Start loop
  startLoop();

  return stopParticles;
}

function resizeCanvas() {
  if (!_canvas) return;
  _canvas.width = window.innerWidth;
  _canvas.height = window.innerHeight;
}

function startLoop() {
  if (_running) return;
  _running = true;
  loop();
}

function loop() {
  if (!_running) return;
  _ctx.clearRect(
    0, 0,
    _canvas.width,
    _canvas.height
  );
  _particles.forEach(p => {
    p.update();
    p.draw(_ctx);
  });
  _animFrame = requestAnimationFrame(loop);
}

/**
 * Stop particle system
 */
export function stopParticles() {
  _running = false;
  if (_animFrame) {
    cancelAnimationFrame(_animFrame);
    _animFrame = null;
  }
  window.removeEventListener(
    'resize', resizeCanvas);
}

/**
 * Pause particles (page hidden)
 */
export function pauseParticles() {
  _running = false;
  if (_animFrame) {
    cancelAnimationFrame(_animFrame);
    _animFrame = null;
  }
}

/**
 * Resume particles
 */
export function resumeParticles() {
  if (!_running) {
    _running = true;
    loop();
  }
}

// Auto pause when page hidden
document.addEventListener(
  'visibilitychange', () => {
    if (document.hidden) {
      pauseParticles();
    } else {
      resumeParticles();
    }
  }
);