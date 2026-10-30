/**
 * Sample Motion Generator for FormLens
 * Generates an animated biomechanical video/canvas stream for instant testing
 * without needing webcam access or local video files.
 */

export function createSampleMotionStream(
  exercise: 'squat' | 'pushup',
  canvas: HTMLCanvasElement,
  fps = 30
): { stop: () => void; getStream: () => MediaStream | null } {
  const ctx = canvas.getContext('2d');
  if (!ctx) return { stop: () => {}, getStream: () => null };

  let animationFrameId: number;
  let startTime = performance.now();
  let running = true;

  canvas.width = 640;
  canvas.height = 480;

  function render(now: number) {
    if (!running || !ctx) return;
    const elapsed = (now - startTime) / 1000;

    // Background gym environment
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Floor line
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(40, 420);
    ctx.lineTo(600, 420);
    ctx.stroke();

    // Studio grid
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.25)';
    ctx.lineWidth = 1;
    for (let x = 60; x < 600; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, 100);
      ctx.lineTo(x, 420);
      ctx.stroke();
    }

    if (exercise === 'squat') {
      // Squat cycle: 3 seconds per rep
      const cycle = (elapsed % 3.2) / 3.2; // 0 to 1
      // Sine wave for smooth down-up motion
      // 0 = standing upright, 1 = deep bottom squat
      const depthFactor = (1 - Math.cos(cycle * 2 * Math.PI)) / 2;

      // Base athlete positions (Lateral View, facing right)
      const ankleX = 300;
      const ankleY = 410;

      // Knee tracks slightly forward and down
      const kneeX = 300 + depthFactor * 45;
      const kneeY = 320 + depthFactor * 40;

      // Hip sinks down and back
      const hipX = 300 - depthFactor * 55;
      const hipY = 230 + depthFactor * 95;

      // Torso leans slightly forward
      const shoulderX = hipX + 15 + depthFactor * 40;
      const shoulderY = hipY - 95 + depthFactor * 10;

      // Head
      const headX = shoulderX + 15;
      const headY = shoulderY - 35;

      // Arms reaching forward for balance
      const elbowX = shoulderX + 45;
      const elbowY = shoulderY + 20;
      const wristX = shoulderX + 85;
      const wristY = shoulderY + 15;

      drawAthleteBody(ctx, {
        head: [headX, headY],
        shoulder: [shoulderX, shoulderY],
        elbow: [elbowX, elbowY],
        wrist: [wristX, wristY],
        hip: [hipX, hipY],
        knee: [kneeX, kneeY],
        ankle: [ankleX, ankleY],
        facing: 'right',
      });
    } else {
      // Pushup cycle: 2.8 seconds per rep
      const cycle = (elapsed % 2.8) / 2.8;
      const depthFactor = (1 - Math.cos(cycle * 2 * Math.PI)) / 2;

      const feetX = 140;
      const feetY = 380;

      // Hand planted on ground
      const handX = 460;
      const handY = 380;

      // Shoulder descends towards ground as depth increases
      const shoulderX = 450 - depthFactor * 10;
      const shoulderY = 270 + depthFactor * 80;

      // Elbow bends backwards
      const elbowX = (handX + shoulderX) / 2 - depthFactor * 35;
      const elbowY = (handY + shoulderY) / 2 - 25 + depthFactor * 15;

      // Hip stays in line (or slight variation)
      const hipX = feetX + (shoulderX - feetX) * 0.6;
      const hipY = feetY + (shoulderY - feetY) * 0.6;

      const headX = shoulderX + 35;
      const headY = shoulderY - 15;

      drawAthleteBody(ctx, {
        head: [headX, headY],
        shoulder: [shoulderX, shoulderY],
        elbow: [elbowX, elbowY],
        wrist: [handX, handY],
        hip: [hipX, hipY],
        knee: [(feetX + hipX) / 2, (feetY + hipY) / 2],
        ankle: [feetX, feetY],
        facing: 'right',
      });
    }

    // Watermark overlay
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = '12px "JetBrains Mono", monospace';
    ctx.fillText(`Sample Stream: ${exercise.toUpperCase()} (${fps} FPS)`, 20, 30);

    animationFrameId = requestAnimationFrame(render);
  }

  animationFrameId = requestAnimationFrame(render);

  let stream: MediaStream | null = null;
  if ('captureStream' in canvas) {
    try {
      stream = (canvas as HTMLCanvasElement & { captureStream: (fps: number) => MediaStream }).captureStream(fps);
    } catch (e) {
      console.warn('captureStream error:', e);
    }
  }

  return {
    stop: () => {
      running = false;
      cancelAnimationFrame(animationFrameId);
    },
    getStream: () => stream,
  };
}

function drawAthleteBody(
  ctx: CanvasRenderingContext2D,
  pts: {
    head: [number, number];
    shoulder: [number, number];
    elbow: [number, number];
    wrist: [number, number];
    hip: [number, number];
    knee: [number, number];
    ankle: [number, number];
    facing: 'left' | 'right';
  }
) {
  // Draw silhouette figure with realistic athletic proportions
  ctx.strokeStyle = '#94a3b8';
  ctx.fillStyle = '#64748b';
  ctx.lineWidth = 14;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Torso
  ctx.beginPath();
  ctx.moveTo(pts.shoulder[0], pts.shoulder[1]);
  ctx.lineTo(pts.hip[0], pts.hip[1]);
  ctx.stroke();

  // Upper leg & lower leg
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 13;
  ctx.beginPath();
  ctx.moveTo(pts.hip[0], pts.hip[1]);
  ctx.lineTo(pts.knee[0], pts.knee[1]);
  ctx.lineTo(pts.ankle[0], pts.ankle[1]);
  ctx.stroke();

  // Arm
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(pts.shoulder[0], pts.shoulder[1]);
  ctx.lineTo(pts.elbow[0], pts.elbow[1]);
  ctx.lineTo(pts.wrist[0], pts.wrist[1]);
  ctx.stroke();

  // Head
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.arc(pts.head[0], pts.head[1], 18, 0, Math.PI * 2);
  ctx.fill();
}
