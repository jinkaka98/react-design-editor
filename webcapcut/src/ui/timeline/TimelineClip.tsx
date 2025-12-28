import { useTimelineStore } from '../../store/timelineStore';
import type { ClipSegment } from '../../types/timeline';
import { WaveformDisplay } from '../components/WaveformDisplay';

interface TimelineClipProps {
    segment: ClipSegment;
    trackId: string;
    zoom: number;
    scrollX: number;
    onDragStart: (e: React.MouseEvent, segment: ClipSegment, trackId: string) => void;
    isDragging: boolean;
    dragDelta: number;
}

export function TimelineClip({
    segment,
    trackId,
    zoom,
    scrollX,
    onDragStart,
    isDragging,
    dragDelta,
}: TimelineClipProps) {
    const selectedSegmentId = useTimelineStore(state => state.selectedSegmentId);
    const selectSegment = useTimelineStore(state => state.selectSegment);
    const selectClip = useTimelineStore(state => state.selectClip);
    const getAsset = useTimelineStore(state => state.getAsset);
    const getClipById = useTimelineStore(state => state.getClipById);

    const clip = getClipById(segment.clipId);
    const asset = clip ? getAsset(clip.assetId) : undefined;

    // Calculate position with drag offset
    const baseLeft = (segment.start / 1_000_000) * zoom - scrollX;
    const dragOffset = (dragDelta / 1_000_000) * zoom;
    const left = baseLeft + (isDragging ? dragOffset : 0);
    const width = (segment.duration / 1_000_000) * zoom;

    const isSelected = selectedSegmentId === segment.id;

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        console.warn('%c[TimelineClip] CLICK - selecting clip: ' + segment.clipId, 'background: red; color: white; font-size: 16px');
        selectSegment(segment.id);
        // Also select the clip for transform overlay
        selectClip(segment.clipId);
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button === 0) {
            // Select clip immediately on mousedown for transform overlay
            console.warn('%c[TimelineClip] MOUSEDOWN - selecting clip: ' + segment.clipId, 'background: blue; color: white; font-size: 16px');
            selectClip(segment.clipId);
            onDragStart(e, segment, trackId);
        }
    };

    // Don't render if off-screen
    if (left + width < 0 || left > window.innerWidth) {
        return null;
    }

    // Format duration
    const durationSec = segment.duration / 1_000_000;
    const durationLabel = durationSec >= 60
        ? `${Math.floor(durationSec / 60)}:${(durationSec % 60).toFixed(1).padStart(4, '0')}`
        : `${durationSec.toFixed(1)}s`;

    return (
        <div
            className={`absolute top-1 bottom-1 rounded cursor-move overflow-hidden transition-shadow
                ${isDragging
                    ? 'opacity-50 ring-2 ring-yellow-400'
                    : isSelected
                        ? 'ring-2 ring-blue-500 bg-gradient-to-b from-blue-500 to-blue-700'
                        : 'bg-gradient-to-b from-blue-600 to-blue-800 hover:from-blue-500 hover:to-blue-700'
                }`}
            style={{
                left,
                width: Math.max(width, 30), // Minimum visible width
            }}
            onClick={handleClick}
            onMouseDown={handleMouseDown}
        >
            {/* Waveform Visualization */}
            {(asset?.type === 'audio' || asset?.type === 'video') && (
                <div className="absolute inset-0 z-0">
                    <WaveformDisplay
                        width={Math.max(width, 10)}
                        height={52}
                        start={(clip?.srcStart || 0) / 1_000_000}
                        duration={segment.duration / 1_000_000}
                        color={asset?.type === 'audio' ? '#4ade80' : 'rgba(255, 255, 255, 0.2)'}
                    />
                </div>
            )}

            {/* Clip content */}
            <div className="flex items-center h-full px-2 gap-2 relative z-10">
                {/* Video icon */}
                <svg className="w-4 h-4 text-white/70 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                </svg>

                {/* Clip info */}
                <div className="flex-1 min-w-0">
                    <div className="text-xs text-white font-medium truncate">
                        {asset?.name || 'Unknown'}
                    </div>
                    <div className="text-[10px] text-white/60">
                        {durationLabel}
                    </div>
                </div>
            </div>

            {/* Left trim handle */}
            <div
                className="absolute left-0 top-0 bottom-0 w-1.5 bg-white/20 hover:bg-white/50 cursor-ew-resize"
                onMouseDown={(e) => e.stopPropagation()}
            />

            {/* Right trim handle */}
            <div
                className="absolute right-0 top-0 bottom-0 w-1.5 bg-white/20 hover:bg-white/50 cursor-ew-resize"
                onMouseDown={(e) => e.stopPropagation()}
            />
        </div>
    );
}
