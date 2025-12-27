import { usePlaybackStore } from '../../store/playbackStore';
import { useTimelineStore } from '../../store/timelineStore';
import { useMemo } from 'react';
import { generateTimelineTicks, getTimeUnit } from '../../utils/timelineRuler';

interface TimelineRulerProps {
    width: number;
}

export function TimelineRuler({ width }: TimelineRulerProps) {
    const currentTime = usePlaybackStore(state => state.currentTime);
    const zoom = useTimelineStore(state => state.zoom);
    const scrollX = useTimelineStore(state => state.scrollX);
    const duration = useTimelineStore(state => state.duration);
    const seek = usePlaybackStore(state => state.seek);

    // Generate adaptive time ticks
    const ticks = useMemo(() => {
        const durationMicros = Math.max(duration, 60_000_000); // Min 1 minute ruler
        return generateTimelineTicks(durationMicros, zoom, scrollX, width);
    }, [width, zoom, scrollX, duration]);

    // Current time unit for display
    const timeUnit = useMemo(() => getTimeUnit(zoom), [zoom]);

    // Playhead position
    const playheadX = (currentTime / 1_000_000) * zoom - scrollX;

    const handleClick = (e: React.MouseEvent) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left + scrollX;
        const timeSeconds = x / zoom;
        seek(Math.max(0, timeSeconds * 1_000_000));
    };

    return (
        <div
            className="relative h-7 bg-gray-800 border-b border-gray-700 cursor-pointer select-none overflow-hidden"
            onClick={handleClick}
        >
            {/* Time unit indicator */}
            <div className="absolute left-1 top-0.5 text-[9px] text-gray-500 uppercase tracking-wider z-10">
                {timeUnit === 'frames' ? 'sec/frames' :
                    timeUnit === 'seconds' ? 'seconds' :
                        timeUnit === 'minutes' ? 'min:sec' : 'hours'}
            </div>

            {/* Tick marks and labels */}
            {ticks.map((tick, i) => (
                <div
                    key={i}
                    className="absolute top-0 h-full flex flex-col justify-end"
                    style={{ left: tick.position }}
                >
                    {/* Tick line */}
                    <div
                        className={`w-px ${tick.type === 'major'
                                ? 'h-3 bg-gray-500'
                                : 'h-1.5 bg-gray-600'
                            }`}
                    />

                    {/* Label (only for major ticks) */}
                    {tick.label && (
                        <span
                            className="absolute bottom-0 ml-1 text-[10px] text-gray-400 whitespace-nowrap"
                            style={{ transform: 'translateY(-2px)' }}
                        >
                            {tick.label}
                        </span>
                    )}
                </div>
            ))}

            {/* Playhead */}
            <div
                className="absolute top-0 w-0.5 h-full bg-red-500 z-20"
                style={{ left: playheadX }}
            >
                {/* Playhead head - triangle pointing down */}
                <div
                    className="absolute -top-0.5 -left-1 w-2.5 h-2.5 bg-red-500"
                    style={{
                        clipPath: 'polygon(50% 100%, 0% 0%, 100% 0%)',
                    }}
                />
            </div>

            {/* Current time display */}
            <div
                className="absolute right-1 top-0.5 text-[10px] text-gray-400 bg-gray-800/80 px-1 rounded z-10"
            >
                {formatCurrentTime(currentTime)}
            </div>
        </div>
    );
}

/**
 * Format current time for display in ruler
 */
function formatCurrentTime(timeMicros: number): string {
    const totalSeconds = timeMicros / 1_000_000;
    const mins = Math.floor(totalSeconds / 60);
    const secs = Math.floor(totalSeconds % 60);
    const ms = Math.floor((totalSeconds % 1) * 100);

    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}
