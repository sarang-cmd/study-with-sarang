import { useEffect, useRef } from 'react';
import { useSound } from '../context/SoundContext';

/** Live spectrum of the actual output. Draws a calm resting line while paused. */
export function Visualizer({ height = 72, bars = 44, className = '' }: { height?: number; bars?: number; className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const { analyser, playing } = useSound();
  const analyserRef = useRef(analyser); analyserRef.current = analyser;
  const playingRef = useRef(playing); playingRef.current = playing;

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const context = element.getContext('2d');
    if (!context) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0, level = 0;
    const heights = new Array<number>(bars).fill(0);
    let data: Uint8Array | null = null;
    const resize = () => {
      const ratio = window.devicePixelRatio || 1, box = element.getBoundingClientRect();
      element.width = Math.max(1, Math.round(box.width * ratio)); element.height = Math.max(1, Math.round(box.height * ratio));
    };
    resize();
    const observer = new ResizeObserver(resize); observer.observe(element);
    const draw = (time: number) => {
      frame = requestAnimationFrame(draw);
      if (document.hidden) return;
      const { width, height: h } = element;
      context.clearRect(0, 0, width, h);
      context.fillStyle = getComputedStyle(element).color;
      const node = analyserRef.current();
      if (node && !data) data = new Uint8Array(node.frequencyBinCount);
      const live = !!node && playingRef.current && !!data;
      if (live) node!.getByteFrequencyData(data as Uint8Array<ArrayBuffer>);
      level += ((live ? 1 : 0) - level) * .06;
      const gap = Math.max(2, width / bars * .38), barWidth = (width - gap * (bars - 1)) / bars;
      for (let i = 0; i < bars; i++) {
        let target: number;
        if (live && data) {
          // Soft sounds keep most energy low, so map the useful range (to about 8 kHz),
          // tilt it upward and lift quiet signals so every bar can move.
          const bin = Math.min(data.length - 1, Math.floor(1 + (i / bars) ** 1.4 * data.length * .36));
          target = Math.min(1, (data[bin] / 255) ** .75 * (.85 + 1.5 * i / bars));
        } else target = reduce ? .16 : .13 + .09 * (1 + Math.sin(time / 900 + i * .45 + Math.sin(i * .7) * 2)) / 2;
        heights[i] += (target - heights[i]) * (live ? .35 : .08);
        const barHeight = Math.max(3, heights[i] * h * (.55 + .45 * level));
        const radius = Math.min(barWidth / 2, 3);
        context.globalAlpha = live ? .55 + .45 * heights[i] : .4;
        context.beginPath();
        context.roundRect(i * (barWidth + gap), h - barHeight, barWidth, barHeight, radius);
        context.fill();
      }
      context.globalAlpha = 1;
    };
    frame = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [bars]);

  return <canvas ref={canvas} role="img" aria-label={playing ? 'Live sound visualizer' : 'Sound visualizer, paused'} className={`block w-full ${className}`} style={{ height }} />;
}
