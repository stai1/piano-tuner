import { useEffect, useRef } from 'react';
import type { SpectrumBands } from '../audio/messages';
import type { Measurement } from '../dsp/analyzer';

const RANGE_DB = 70;

function cssVar(el: Element, name: string): string {
  return getComputedStyle(el).getPropertyValue(name).trim();
}

// Live spectrum on a log frequency axis, with the measured partials marked.
export function Spectrum({
  bands,
  measurement,
  selected,
}: {
  bands: SpectrumBands | null;
  measurement: Measurement | null;
  selected: number | null;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const dpr = window.devicePixelRatio || 1;
    const w = el.clientWidth;
    const h = el.clientHeight;
    if (el.width !== Math.round(w * dpr)) el.width = Math.round(w * dpr);
    if (el.height !== Math.round(h * dpr)) el.height = Math.round(h * dpr);
    const ctx = el.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const muted = cssVar(el, '--muted');
    ctx.font = '10px system-ui, sans-serif';
    ctx.fillStyle = muted;
    if (!bands) {
      ctx.fillText('Listening…', 8, 16);
      return;
    }
    const fx = (f: number) => (Math.log(f / bands.minHz) / Math.log(bands.maxHz / bands.minHz)) * w;
    for (const f of [50, 100, 200, 500, 1000, 2000, 5000]) {
      const px = fx(f);
      ctx.fillRect(px, 0, 1, h - 14);
      ctx.fillText(f >= 1000 ? `${f / 1000}k` : String(f), px + 2, h - 3);
    }
    const db = bands.db;
    const top = Math.max(...db);
    const fy = (d: number) => (h - 14) * Math.min(1, Math.max(0, (top - d) / RANGE_DB));
    ctx.beginPath();
    for (let i = 0; i < db.length; i++) {
      const px = (i / (db.length - 1)) * w;
      if (i === 0) ctx.moveTo(px, fy(db[i]));
      else ctx.lineTo(px, fy(db[i]));
    }
    ctx.strokeStyle = cssVar(el, '--accent');
    ctx.lineWidth = 1.5;
    ctx.stroke();
    if (measurement) {
      for (const p of measurement.partials) {
        const px = fx(p.freq);
        ctx.fillStyle = p.n === selected ? cssVar(el, '--warn') : cssVar(el, '--ok');
        ctx.fillRect(px - 1, 0, 2, h - 14);
        ctx.fillText(String(p.n), px + 3, 11);
      }
    }
  }, [bands, measurement, selected]);

  return <canvas ref={canvas} className="spectrum" aria-label="Live spectrum with measured overtones marked" role="img" />;
}
