import { useTimelineStore } from '../../store/timelineStore';
import type { Track, ClipSegment } from '../../types/timeline';
import { TimelineClip } from './TimelineClip';
import { TimelineGap } from './TimelineGap';

interface TimelineTrackProps {
    track: Track;
    zoom: number;
    scrollX: number;
    onClipDragStart: (e: React.MouseEvent, segment: ClipSegment, trackId: string) => void;
    onDropClip: (trackId: string) => void;
    isDragOver: boolean;
    dragDelta: number;
    draggingSegmentId: string | null;
}

export function TimelineTrack({
    track,
    zoom,
    scrollX,
    onClipDragStart,
    onDropClip,
    isDragOver,
    dragDelta,
    draggingSegmentId,
}: TimelineTrackProps) {
    const selectTrack = useTimelineStore(state => state.selectTrack);
    const selectedTrackId = useTimelineStore(state => state.selectedTrackId);
    const setTrackMuted = useTimelineStore(state => state.setTrackMuted);
    const setTrackLocked = useTimelineStore(state => state.setTrackLocked);

    const isSelected = selectedTrackId === track.id;

    return (
        <div
            className={`flex border-b border-gray-700 ${isDragOver ? 'bg-blue-900/30' : ''}`}
            style={{ height: track.height }}
            onMouseUp={() => onDropClip(track.id)}
        >
            {/* Track header */}
            <div
                className={`w-20 flex-shrink-0 flex flex-col justify-center items-center px-2 border-r border-gray-700
                    ${isSelected ? 'bg-gray-700' : 'bg-gray-800'}`}
                onClick={() => selectTrack(track.id)}
            >
                <span className="text-xs font-bold text-white">{track.name}</span>
                <div className="flex gap-1 mt-1">
                    {/* Mute button */}
                    <button
                        className={`w-5 h-5 text-[10px] font-bold rounded ${track.muted ? 'bg-red-600' : 'bg-gray-600 hover:bg-gray-500'}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            setTrackMuted(track.id, !track.muted);
                        }}
                        title={track.muted ? 'Unmute' : 'Mute'}
                    >
                        M
                    </button>
                    {/* Lock button */}
                    <button
                        className={`w-5 h-5 text-[10px] font-bold rounded ${track.locked ? 'bg-yellow-600' : 'bg-gray-600 hover:bg-gray-500'}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            setTrackLocked(track.id, !track.locked);
                        }}
                        title={track.locked ? 'Unlock' : 'Lock'}
                    >
                        L
                    </button>
                </div>
            </div>

            {/* Segments container */}
            <div className="flex-1 relative bg-gray-900/50">
                {/* Grid lines */}
                <div className="absolute inset-0 opacity-20">
                    {Array.from({ length: 20 }).map((_, i) => (
                        <div
                            key={i}
                            className="absolute top-0 bottom-0 w-px bg-gray-600"
                            style={{ left: i * zoom - (scrollX % zoom) }}
                        />
                    ))}
                </div>

                {/* Render all segments (clips and gaps) */}
                {track.segments.map(segment => {
                    if (segment.type === 'clip') {
                        return (
                            <TimelineClip
                                key={segment.id}
                                segment={segment}
                                trackId={track.id}
                                zoom={zoom}
                                scrollX={scrollX}
                                onDragStart={onClipDragStart}
                                isDragging={draggingSegmentId === segment.id}
                                dragDelta={draggingSegmentId === segment.id ? dragDelta : 0}
                            />
                        );
                    } else {
                        return (
                            <TimelineGap
                                key={segment.id}
                                gap={segment}
                                trackId={track.id}
                                zoom={zoom}
                                scrollX={scrollX}
                            />
                        );
                    }
                })}
            </div>
        </div>
    );
}
