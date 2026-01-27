import React, { useRef, useEffect } from 'react';
import { AudioVisualizerProps } from '../types';

const Visualizer: React.FC<AudioVisualizerProps> = ({ isPlaying, audioData }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;

    const draw = () => {
      const width = canvas.width;
      const height = canvas.height;

      // Fade effect
      ctx.fillStyle = 'rgba(10, 10, 10, 0.2)';
      ctx.fillRect(0, 0, width, height);

      if (!isPlaying) {
        // Draw flat line if not playing
        ctx.beginPath();
        ctx.strokeStyle = '#333';
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();
        return;
      }

      ctx.beginPath();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#00ff9d';
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#00ff9d';

      const sliceWidth = width * 1.0 / audioData.length;
      let x = 0;

      for (let i = 0; i < audioData.length; i++) {
        const v = audioData[i] / 128.0; // Normalized 0-2 (1 is center)
        const y = (v * height) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
      
      // Reset shadow for next frame performance
      ctx.shadowBlur = 0;

      animationId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [audioData, isPlaying]);

  return (
    <div className="w-full h-48 bg-cyber-dark rounded-xl border border-cyber-gray overflow-hidden relative">
        <div className="absolute top-2 left-4 text-xs font-mono text-cyber-primary opacity-50">
            SIGNAL VISUALIZATION // PCM_S16LE
        </div>
      <canvas
        ref={canvasRef}
        width={800}
        height={200}
        className="w-full h-full"
      />
    </div>
  );
};

export default Visualizer;
