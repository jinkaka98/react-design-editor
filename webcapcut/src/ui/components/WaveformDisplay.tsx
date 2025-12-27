import { useEffect, useRef } from 'react';
import { audioSystem } from '../../core/AudioSystem';

interface WaveformDisplayProps {
    width: number;
    height: number;
    color?: string;
    buffer?: AudioBuffer | null;
    start?: number; // Start time in seconds
    duration?: number; // Duration to render in seconds
}

export function WaveformDisplay({
    width,
    height,
    color = '#4ade80', // green-400
    buffer,
    start = 0,
    duration
}: WaveformDisplayProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        const dataBuffer = buffer || audioSystem.getCurrentBuffer(); // Use prop or fallback to master active
        if (!dataBuffer) return;

        // Draw waveform
        const data = dataBuffer.getChannelData(0); // Use first channel

        // Calculate range
        const totalDuration = dataBuffer.duration;
        const renderDuration = duration || totalDuration;

        const sampleRate = dataBuffer.sampleRate;
        const startSample = Math.floor(start * sampleRate);
        const endSample = Math.min(data.length, Math.floor((start + renderDuration) * sampleRate));
        const sampleCount = endSample - startSample;

        // If sampleCount <= 0, nothing to draw
        if (sampleCount <= 0) return;

        const step = Math.ceil(sampleCount / width);
        const amp = height / 2;

        ctx.fillStyle = color;
        ctx.beginPath();

        for (let i = 0; i < width; i++) {
            let min = 1.0;
            let max = -1.0;

            // Downsample chunk to find min/max
            const chunkStart = startSample + (i * step);

            for (let j = 0; j < step; j++) {
                if (chunkStart + j >= data.length) break;

                const datum = data[chunkStart + j];
                if (datum < min) min = datum;
                if (datum > max) max = datum;
            }

            // Optimize: for very zoomed out, just draw rect
            // Draw line from min to max
            // Default to center line if no data in chunk (shouldn't happen with correct step)
            if (min > max) { // No data found (e.g. step=0, shouldn't occur)
                min = 0; max = 0;
            } else {
                // Amplify silence visual slightly if needed, but usually 0 is 0.
            }

            ctx.fillRect(i, (1 + min) * amp, 1, Math.max(1, (max - min) * amp));
        }
    }, [width, height, color, buffer, start, duration]);

    return (
        <canvas
            ref={canvasRef}
            width={width}
            height={height}
            className="w-full h-full opacity-60 pointer-events-none"
        />
    );
}
