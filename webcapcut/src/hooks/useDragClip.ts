import { useState, useCallback, useRef, useEffect } from 'react';
import { useTimelineStore } from '../store/timelineStore';
import type { ClipSegment } from '../types/timeline';

interface DragState {
    segmentId: string;
    clipId: string;
    fromTrackId: string;
    initialMouseX: number;
    segmentInitialStart: number;
    segmentDuration: number;
    currentX: number;
    toTrackId: string;
}

export function useDragClip(zoom: number, scrollX: number, snapInterval: number = 100_000) {
    const [dragState, setDragState] = useState<DragState | null>(null);
    const moveClip = useTimelineStore(state => state.moveClip);
    const dragPreviewRef = useRef<HTMLDivElement | null>(null);

    const startDrag = useCallback((
        e: React.MouseEvent,
        segment: ClipSegment,
        trackId: string
    ) => {
        e.preventDefault();
        e.stopPropagation();

        setDragState({
            segmentId: segment.id,
            clipId: segment.clipId,
            fromTrackId: trackId,
            initialMouseX: e.clientX,
            segmentInitialStart: segment.start,
            segmentDuration: segment.duration,
            currentX: e.clientX,
            toTrackId: trackId,
        });

        console.log('[DragClip] Start drag:', segment.id);
    }, []);

    const updateDrag = useCallback((e: MouseEvent) => {
        if (!dragState) return;

        const deltaX = e.clientX - dragState.initialMouseX;
        const deltaTime = (deltaX / zoom) * 1_000_000;

        // Snap to grid
        const newTime = Math.max(0,
            Math.round((dragState.segmentInitialStart + deltaTime) / snapInterval) * snapInterval
        );

        // Update preview position
        if (dragPreviewRef.current) {
            const previewLeft = (newTime / 1_000_000) * zoom - scrollX;
            dragPreviewRef.current.style.left = `${previewLeft}px`;
        }

        setDragState(prev => prev ? { ...prev, currentX: e.clientX } : null);
    }, [dragState, zoom, scrollX, snapInterval]);

    const endDrag = useCallback((targetTrackId?: string) => {
        if (!dragState) return;

        const deltaX = dragState.currentX - dragState.initialMouseX;
        const deltaTime = (deltaX / zoom) * 1_000_000;
        const newTime = Math.max(0,
            Math.round((dragState.segmentInitialStart + deltaTime) / snapInterval) * snapInterval
        );

        const toTrack = targetTrackId || dragState.toTrackId;

        const success = moveClip(dragState.fromTrackId, toTrack, dragState.segmentId, newTime);
        console.log('[DragClip] End drag:', success ? 'success' : 'failed');

        setDragState(null);
    }, [dragState, zoom, snapInterval, moveClip]);

    const cancelDrag = useCallback(() => {
        setDragState(null);
    }, []);

    // Calculate drag delta for current position
    const getDragDelta = useCallback(() => {
        if (!dragState) return 0;

        const deltaX = dragState.currentX - dragState.initialMouseX;
        const deltaTime = (deltaX / zoom) * 1_000_000;
        return Math.round((dragState.segmentInitialStart + deltaTime) / snapInterval) * snapInterval - dragState.segmentInitialStart;
    }, [dragState, zoom, snapInterval]);

    // Global mouse event listeners
    useEffect(() => {
        if (!dragState) return;

        const handleMouseMove = (e: MouseEvent) => updateDrag(e);
        const handleMouseUp = () => endDrag();
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') cancelDrag();
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [dragState, updateDrag, endDrag, cancelDrag]);

    return {
        isDragging: dragState !== null,
        dragState,
        startDrag,
        endDrag,
        cancelDrag,
        getDragDelta,
        dragPreviewRef,
    };
}
