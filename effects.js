// PC側の斬撃、火花、衝撃波エフェクトを生成する関数群
//
// angle と speed に基づいて、斬撃の長さ、太さ、残像、および光の波動を表現します。

function computeScreenEdgeSegment(angleRad, width, height) {
  const cx = width / 2;
  const cy = height / 2;
  const dx = Math.cos(angleRad);
  const dy = Math.sin(angleRad);
  const candidates = [];

  if (Math.abs(dx) > 0.001) {
    const tLeft = (0 - cx) / dx;
    const yLeft = cy + dy * tLeft;
    if (yLeft >= 0 && yLeft <= height) candidates.push({ t: tLeft, x: 0, y: yLeft });

    const tRight = (width - cx) / dx;
    const yRight = cy + dy * tRight;
    if (yRight >= 0 && yRight <= height) candidates.push({ t: tRight, x: width, y: yRight });
  }

  if (Math.abs(dy) > 0.001) {
    const tTop = (0 - cy) / dy;
    const xTop = cx + dx * tTop;
    if (xTop >= 0 && xTop <= width) candidates.push({ t: tTop, x: xTop, y: 0 });

    const tBottom = (height - cy) / dy;
    const xBottom = cx + dx * tBottom;
    if (xBottom >= 0 && xBottom <= width) candidates.push({ t: tBottom, x: xBottom, y: height });
  }

  if (candidates.length < 2) {
    return { x1: 0, y1: cy, x2: width, y2: cy };
  }

  candidates.sort((a, b) => a.t - b.t);
  return {
    x1: candidates[0].x,
    y1: candidates[0].y,
    x2: candidates[candidates.length - 1].x,
    y2: candidates[candidates.length - 1].y,
  };
}

function createSlash(angle, speed, width, height) {
  const randomizedAngle = angle + (Math.random() - 0.5) * 40;
  const rad = (randomizedAngle * Math.PI) / 180;
  const thickness = 24 + speed * 28;
  const fadeDuration = 680 + speed * 220;
  const endpoints = computeScreenEdgeSegment(rad, width, height);
  let progress = 0;

  return {
    isFinished: false,
    update(deltaMs) {
      progress += deltaMs / fadeDuration;
      if (progress >= 1) {
        this.isFinished = true;
      }
    },
    draw(ctx) {
      if (this.isFinished) {
        return;
      }

      const alpha = Math.max(0, 1 - progress);
      const startX = endpoints.x1;
      const startY = endpoints.y1;
      const endX = endpoints.x2;
      const endY = endpoints.y2;

      const gradient = ctx.createLinearGradient(startX, startY, endX, endY);
      gradient.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.98})`);
      gradient.addColorStop(0.4, `rgba(175, 255, 255, ${alpha * 0.86})`);
      gradient.addColorStop(1, `rgba(62, 210, 252, ${alpha * 0.12})`);

      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineWidth = thickness * (0.75 + progress * 0.5);
      ctx.strokeStyle = gradient;
      ctx.shadowColor = 'rgba(142, 252, 255, 0.6)';
      ctx.shadowBlur = 28;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
      ctx.restore();

      drawSlashAfterglow(ctx, startX, startY, endX, endY, thickness, alpha);
    },
  };
}

function drawSlashAfterglow(ctx, x1, y1, x2, y2, thickness, alpha) {
  ctx.save();
  ctx.strokeStyle = `rgba(167, 242, 255, ${alpha * 0.18})`;
  ctx.lineWidth = thickness * 1.4;
  ctx.shadowBlur = 36;
  ctx.shadowColor = 'rgba(176, 255, 255, 0.25)';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

function createSpark(centerX, centerY, speed) {
  const angle = Math.random() * Math.PI * 2;
  const velocity = 240 + Math.random() * 140 + speed * 280;
  const life = 420 + Math.random() * 240;
  const radius = 2 + Math.random() * 1.7 + speed * 1.2;
  let elapsed = 0;

  return {
    isFinished: false,
    x: centerX,
    y: centerY,
    update(deltaMs) {
      elapsed += deltaMs;
      if (elapsed >= life) {
        this.isFinished = true;
        return;
      }
      const progress = elapsed / life;
      this.x = centerX + Math.cos(angle) * velocity * progress;
      this.y = centerY + Math.sin(angle) * velocity * progress;
    },
    draw(ctx) {
      if (this.isFinished) {
        return;
      }
      const progress = elapsed / life;
      const alpha = Math.max(0, 1 - progress);
      const glow = 10 + (1 - progress) * 16;

      ctx.save();
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.shadowColor = `rgba(164, 244, 255, ${alpha * 0.9})`;
      ctx.shadowBlur = glow;
      ctx.beginPath();
      ctx.arc(this.x, this.y, radius * (1 + progress * 0.4), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },
  };
}

function createShockWave(centerX, centerY, speed) {
  const maxRadius = Math.max(window.innerWidth, window.innerHeight) * (0.5 + speed * 0.6);
  const duration = 720 + speed * 180;
  let elapsed = 0;

  return {
    isFinished: false,
    update(deltaMs) {
      elapsed += deltaMs;
      if (elapsed >= duration) {
        this.isFinished = true;
      }
    },
    draw(ctx) {
      if (this.isFinished) {
        return;
      }

      const progress = elapsed / duration;
      const radius = maxRadius * progress;
      const alpha = Math.max(0, 0.35 * (1 - progress));
      const width = 2 + speed * 1.6;

      ctx.save();
      ctx.strokeStyle = `rgba(186, 252, 255, ${alpha})`;
      ctx.lineWidth = width;
      ctx.shadowBlur = 32;
      ctx.shadowColor = `rgba(111, 226, 255, ${alpha * 0.8})`;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    },
  };
}
