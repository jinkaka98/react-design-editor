import { useRef, useState, useEffect, useCallback } from 'react';
import { usePlaybackStore } from '../../store/playbackStore';

export function TimelineScrubber() {
    const { currentTime, duration, seek, isPlaying, pause } = usePlaybackStore();
    const [isDragging, setIsDragging] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const playheadRef = useRef<HTMLDivElement>(null);

    const updateTimeFromMouse = useCallback((e: MouseEvent | React.MouseEvent<HTMLDivElement>) => {
        if (!containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const x = (e as MouseEvent).clientX || (e as React.MouseEvent).clientX;
        const relativeX = x - rect.left;
        const percent = Math.max(0, Math.min(1, relativeX / rect.width));
        const newTime = Math.round(percent * duration);

        seek(newTime);
    }, [duration, seek]);

    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        setIsDragging(true);
        if (isPlaying) pause();
        updateTimeFromMouse(e);
    };

    useEffect(() => {
        if (!isDragging) return;

        const handleMouseMove = (e: MouseEvent) => {
            updateTimeFromMouse(e);
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, updateTimeFromMouse]);

    // Imperative DOM update for playhead position (performance)
    useEffect(() => {
        if (!playheadRef.current || duration === 0) return;

        const unsubscribe = usePlaybackStore.subscribe(
            (state) => state.currentTime,
            (time) => {
                if (playheadRef.current) {
                    const percent = (time / duration) * 100;
                    playheadRef.current.style.left = `${percent}%`;
                }
            }
        );

        return unsubscribe;
    }, [duration]);

    return (
        <div className="relative h-12 bg-gray-800">
            {/* Timeline Ruler */}
            <div
                ref={containerRef}
                className="absolute inset-0 cursor-pointer"
                onMouseDown={handleMouseDown}
            >
                {/* Progress bar */}
                <div
                    className="absolute top-1/2 left-0 h-1 bg-blue-500 -translate-y-1/2"
                    style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                />

                {/* Timeline background */}
                <div className="absolute top-1/2 left-0 right-0 h-1 bg-gray-600 -translate-y-1/2" />

                {/* Playhead */}
                <div
                    ref={playheadRef}
                    className="absolute top-0 w-0.5 h-full bg-red-500 pointer-events-none"
                    style={{ left: '0%' }}
                >
                    {/* Playhead handle */}
                    <div className="absolute top-1/2 left-1/2 w-3 h-3 bg-red-500 rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-auto" />
                </div>
            </div>
        </div>
    );
}
