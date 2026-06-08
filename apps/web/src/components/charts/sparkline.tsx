"use client";

import { useEffect, useRef } from "react";

type SparklineProps = {
  points: number[];
  height?: number;
  /** Stroke + dot color (defaults to white for the indigo hero card). */
  stroke?: string;
  /** Top color of the gradient fill (bottom fades to transparent). */
  fill?: string;
  className?: string;
};

/**
 * Edge-to-edge smoothed area sparkline rendered on a <canvas>, ported from the
 * WealthMe demo's renderSparkline(). Re-renders responsively on container resize.
 */
export function Sparkline({
  points,
  height = 60,
  stroke = "rgba(255,255,255,0.75)",
  fill = "rgba(255,255,255,0.22)",
  className,
}: SparklineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

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
      const toX = (i: number) => i * xStep;
      const toY = (v: number) => H - ((v - min) / (max - min)) * (H - 8) - 4;

      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, fill);
      grad.addColorStop(1, "rgba(255,255,255,0.01)");

      // filled area
      ctx.beginPath();
      ctx.moveTo(toX(0), toY(points[0]));
      for (let i = 1; i < points.length; i++) {
        const cpx = (toX(i - 1) + toX(i)) / 2;
        ctx.bezierCurveTo(cpx, toY(points[i - 1]), cpx, toY(points[i]), toX(i), toY(points[i]));
      }
      ctx.lineTo(toX(points.length - 1), H);
      ctx.lineTo(0, H);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // line
      ctx.beginPath();
      ctx.moveTo(toX(0), toY(points[0]));
      for (let i = 1; i < points.length; i++) {
        const cpx = (toX(i - 1) + toX(i)) / 2;
        ctx.bezierCurveTo(cpx, toY(points[i - 1]), cpx, toY(points[i]), toX(i), toY(points[i]));
      }
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      ctx.stroke();

      // end dot
      const lx = toX(points.length - 1);
      const ly = toY(points[points.length - 1]);
      ctx.beginPath();
      ctx.arc(lx, ly, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = "white";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(lx, ly, 4.5, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 2;
      ctx.stroke();
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [points, height, stroke, fill]);

  return (
    <div ref={wrapRef} className={className} style={{ width: "100%", position: "relative" }}>
      <canvas ref={canvasRef} style={{ display: "block" }} />
    </div>
  );
}
