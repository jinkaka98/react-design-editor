import { useRef, useCallback, useState, useEffect } from 'react';
import { useTimelineStore } from '../../store/timelineStore';
import type { ClipSegment } from '../../types/timeline';
import { TimelineTrack } from './TimelineTrack';
import { TimelineRuler } from './TimelineRuler';
import { useDragClip } from '../../hooks/useDragClip';

export function Timeline() {
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState(800);
    const tracks = useTimelineStore(state => state.tracks);
    const zoom = useTimelineStore(state => state.zoom);
    const scrollX = useTimelineStore(state => state.scrollX);
    const setZoom = useTimelineStore(state => state.setZoom);
    const setScrollX = useTimelineStore(state => state.setScrollX);
    const addTrack = useTimelineStore(state => state.addTrack);
    const getAsset = useTimelineStore(state => state.getAsset);
    const getClipById = useTimelineStore(state => state.getClipById);

    // Track container width via ResizeObserver
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const observer = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (entry) {
                setContainerWidth(entry.contentRect.width);
            }
        });

        observer.observe(container);
        return () => observer.disconnect();
    }, []);

    // Use drag clip hook
    const { isDragging, dragState, startDrag, endDrag, getDragDelta } = useDragClip(zoom, scrollX);

    // Handle clip drag start
    const handleClipDragStart = useCallback((e: React.MouseEvent, segment: ClipSegment, trackId: string) => {
        startDrag(e, segment, trackId);
    }, [startDrag]);

    // Handle drop on track
    const handleDropClip = useCallback((trackId: string) => {
        endDrag(trackId);
    }, [endDrag]);

    // Handle zoom with wheel
    const handleWheel = useCallback((e: React.WheelEvent) => {
        if (e.ctrlKey || e.metaKey) {
            // Note: preventDefault may not work with passive listeners
            // but zooming will still work
            const delta = e.deltaY > 0 ? -10 : 10;
            setZoom(zoom + delta);
        } else if (e.deltaX !== 0) {
            // Horizontal scroll (trackpad)
            setScrollX(scrollX + e.deltaX);
        }
    }, [zoom, scrollX, setZoom, setScrollX]);

    // Get dragged segment info for preview
    const getDraggedSegmentInfo = () => {
        if (!dragState) return null;

        for (const track of tracks) {
            const segment = track.segments.find(s => s.id === dragState.segmentId);
            if (segment && segment.type === 'clip') {
                const clip = getClipById(segment.clipId);
                const asset = clip ? getAsset(clip.assetId) : undefined;
                return { segment, track, clip, asset };
            }
        }
        return null;
    };

    const draggedInfo = getDraggedSegmentInfo();

    return (
        <div
            ref={containerRef}
            className="flex flex-col bg-gray-900 border-t border-gray-700 h-full select-none"
            onWheel={handleWheel}
        >
            {/* Toolbar */}
            <div className="flex items-center gap-2 px-2 py-1 bg-gray-800 border-b border-gray-700 flex-shrink-0">
                <button
                    className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 rounded"
                    onClick={() => addTrack('video')}
                >
                    + Video Track
                </button>
                <button
                    className="px-2 py-1 text-xs bg-green-600 hover:bg-green-500 rounded"
                    onClick={() => addTrack('audio')}
                >
                    + Audio Track
                </button>

                <div className="flex-1" />

                {/* Zoom controls */}
                <span className="text-xs text-gray-400">Zoom:</span>
                <button
                    className="w-6 h-6 text-xs bg-gray-700 hover:bg-gray-600 rounded"
                    onClick={() => setZoom(zoom - 20)}
                >
                    -
                </button>
                <span className="text-xs text-white w-12 text-center">{zoom}px/s</span>
                <button
                    className="w-6 h-6 text-xs bg-gray-700 hover:bg-gray-600 rounded"
                    onClick={() => setZoom(zoom + 20)}
                >
                    +
                </button>
            </div>

            {/* Ruler */}
            <div className="flex flex-shrink-0">
                <div className="w-20 flex-shrink-0 bg-gray-800 border-r border-gray-700" />
                <div className="flex-1">
                    <TimelineRuler width={containerWidth} />
                </div>
            </div>

            {/* Tracks */}
            <div className="flex-1 overflow-auto relative">
                {tracks.map(track => (
                    <TimelineTrack
                        key={track.id}
                        track={track}
                        zoom={zoom}
                        scrollX={scrollX}
                        onClipDragStart={handleClipDragStart}
                        onDropClip={handleDropClip}
                        isDragOver={isDragging && dragState?.toTrackId === track.id}
                        dragDelta={dragState?.fromTrackId === track.id ? getDragDelta() : 0}
                        draggingSegmentId={dragState?.segmentId || null}
                    />
                ))}

                {/* Empty state */}
                {tracks.length === 0 && (
                    <div className="flex items-center justify-center h-32 text-gray-500">
                        No tracks. Add a track to get started.
                    </div>
                )}

                {/* Drag preview overlay */}
                {isDragging && draggedInfo && dragState && (
                    <div
                        className="absolute pointer-events-none bg-blue-500/50 border-2 border-blue-400 rounded"
                        style={{
                            left: ((dragState.segmentInitialStart + getDragDelta()) / 1_000_000) * zoom - scrollX + 80,
                            width: (dragState.segmentDuration / 1_000_000) * zoom,
                            height: 52,
                            top: tracks.findIndex(t => t.id === dragState.fromTrackId) * 60 + 4,
                        }}
                    >
                        <div className="px-2 py-1 text-xs text-white truncate">
                            {draggedInfo.asset?.name}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
