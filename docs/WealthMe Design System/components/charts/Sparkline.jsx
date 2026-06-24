import React from "react";

/**
 * WealthMe Sparkline — smoothed area sparkline on a <canvas>, edge-to-edge.
 * Ported from the app's renderSparkline(). White stroke by default (for the
 * indigo hero card); pass stroke/fill for light surfaces.
 */
export function Sparkline({
  points = [],
  height = 60,
  stroke = "rgba(255,255,255,0.75)",
  fill = "rgba(255,255,255,0.22)",
  style,
}) {
  const canvasRef = React.useRef(null);
  const wrapRef = React.useRef(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap || points.length < 2) return;

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const W = wrap.offsetWidth || 300;
      const H = height;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = W + "px";
      canvas.style.height = H + "px";
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, W, H);

      const min = Math.min(...points) - 5;
      const max = Math.max(...points) + 5;
      const xStep = W / (points.length - 1);
      const toX = (i) => i * xStep;
      const toY = (v) => H - ((v - min) / (max - min || 1)) * (H - 8) - 4;

      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, fill);
      grad.addColorStop(1, "rgba(255,255,255,0.01)");

      ctx.beginPath();
      ctx.moveTo(toX(0), toY(points[0]));
      for (let i = 1; i < points.length; i++) {
        const cpx = (toX(i - 1) + toX(i)) / 2;
        ctx.bezierCurveTo(
          cpx,
          toY(points[i - 1]),
          cpx,
          toY(points[i]),
          toX(i),
          toY(points[i]),
        );
      }
      ctx.lineTo(toX(points.length - 1), H);
      ctx.lineTo(0, H);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(toX(0), toY(points[0]));
      for (let i = 1; i < points.length; i++) {
        const cpx = (toX(i - 1) + toX(i)) / 2;
        ctx.bezierCurveTo(
          cpx,
          toY(points[i - 1]),
          cpx,
          toY(points[i]),
          toX(i),
          toY(points[i]),
        );
      }
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      ctx.stroke();

      const lx = toX(points.length - 1);
      const ly = toY(points[points.length - 1]);
      ctx.beginPath();
      ctx.arc(lx, ly, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [points, height, stroke, fill]);

  return (
    <div
      ref={wrapRef}
      style={{ width: "100%", position: "relative", ...style }}
    >
      <canvas ref={canvasRef} style={{ display: "block" }} />
    </div>
  );
}
