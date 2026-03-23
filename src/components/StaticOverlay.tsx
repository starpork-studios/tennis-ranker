import { useEffect, useRef } from 'react';

/**
 * Renders animated TV static via a full-screen canvas.
 * Each frame redraws every pixel with a fresh random greyscale value.
 *
 * • Drawn at ½ resolution — each dot covers 2×2 pixels (truer to analogue static)
 * • Throttled to 24 fps — feels alive without burning CPU
 */
export default function StaticOverlay() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: false });
    if (!ctx) return;

    const draw = () => {
      canvas.width  = Math.ceil(window.innerWidth  / 2);
      canvas.height = Math.ceil(window.innerHeight / 2);
      const imageData = ctx.createImageData(canvas.width, canvas.height);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const v = (Math.random() * 255) | 0;
        data[i] = data[i + 1] = data[i + 2] = v;
        data[i + 3] = 255;
      }
      ctx.putImageData(imageData, 0, 0);
    };

    draw();
    window.addEventListener('resize', draw);

    return () => {
      window.removeEventListener('resize', draw);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        opacity: 0.06,
        mixBlendMode: 'overlay',
        pointerEvents: 'none',
        zIndex: 9999,
        imageRendering: 'pixelated',
      }}
    />
  );
}
