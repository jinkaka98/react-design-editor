import { useTimelineStore } from '../../store/timelineStore';
import type { GapSegment } from '../../types/timeline';

interface TimelineGapProps {
    gap: GapSegment;
    trackId: string;
    zoom: number;
    scrollX: number;
}

export function TimelineGap({ gap, zoom, scrollX }: TimelineGapProps) {
    const selectSegment = useTimelineStore(state => state.selectSegment);
    const selectedSegmentId = useTimelineStore(state => state.selectedSegmentId);

    // Calculate position and width
    const left = (gap.start / 1_000_000) * zoom - scrollX;
    const width = (gap.duration / 1_000_000) * zoom;

    // Don't render very small gaps
    if (width < 2) return null;

    // Don't render if off-screen
    if (left + width < 0) return null;

    const isSelected = selectedSegmentId === gap.id;
    const durationSeconds = (gap.duration / 1_000_000).toFixed(1);

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        selectSegment(gap.id);
    };

    return (
        <div
            className={`absolute top-1 bottom-1 rounded cursor-pointer overflow-hidden transition-all
                ${isSelected
                    ? 'ring-2 ring-yellow-500 bg-gray-600/50'
                    : 'bg-gray-700/30 hover:bg-gray-600/40'
                }
                border border-dashed border-gray-500/50`}
            style={{
                left: Math.max(0, left),
                width: Math.max(width, 4),
            }}
            onClick={handleClick}
            title={`Gap: ${durationSeconds}s`}
        >
            {/* Gap pattern - diagonal stripes */}
            <div
                className="absolute inset-0 opacity-20"
                style={{
                    backgroundImage: `repeating-linear-gradient(
                        45deg,
                        transparent,
                        transparent 4px,
                        currentColor 4px,
                        currentColor 5px
                    )`,
                }}
            />

            {/* Duration label (only show if gap is wide enough) */}
            {width > 50 && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs text-gray-400 bg-gray-800/50 px-1 rounded">
                        {durationSeconds}s
                    </span>
                </div>
            )}

            {/* Context menu indicator */}
            {isSelected && width > 60 && (
                <div className="absolute top-1 right-1 flex gap-1">
                    <button
                        className="text-xs bg-gray-700 hover:bg-gray-600 px-1 rounded"
                        title="Fill Gap"
                        onClick={(e) => {
                            e.stopPropagation();
                            // TODO: Fill gap functionality
                            console.log('[Gap] Fill gap:', gap.id);
                        }}
                    >
                        Fill
                    </button>
                </div>
            )}
        </div>
    );
}
