/**
 * useTransformDrag - Hook for handling drag interactions on transform overlay
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import type { ClipTransform } from '../types/timeline';
import { DEFAULT_CLIP_TRANSFORM } from '../types/timeline';

export type DragMode = 'move' | 'resize-nw' | 'resize-ne' | 'resize-sw' | 'resize-se' | 'rotate' | null;

interface DragState {
    mode: DragMode;
    startX: number;
    startY: number;
    startTransform: ClipTransform;
}

interface UseTransformDragOptions {
    transform: ClipTransform | undefined;
    onTransformChange: (transform: Partial<ClipTransform>) => void;
    canvasWidth: number;
    canvasHeight: number;
}

export function useTransformDrag({
    transform,
    onTransformChange,
    canvasWidth,
    canvasHeight
}: UseTransformDragOptions) {
    const [isDragging, setIsDragging] = useState(false);
    const dragStateRef = useRef<DragState | null>(null);

    const startDrag = useCallback((e: React.MouseEvent, mode: DragMode) => {
        e.preventDefault();
        e.stopPropagation();

        const currentTransform = transform || DEFAULT_CLIP_TRANSFORM;

        dragStateRef.current = {
            mode,
            startX: e.clientX,
            startY: e.clientY,
            startTransform: { ...currentTransform }
        };

        setIsDragging(true);
    }, [transform]);

    useEffect(() => {
        if (!isDragging) return;

        const handleMouseMove = (e: MouseEvent) => {
            const dragState = dragStateRef.current;
            if (!dragState || !dragState.mode) return;

            const deltaX = e.clientX - dragState.startX;
            const deltaY = e.clientY - dragState.startY;

            // Convert pixel delta to normalized coordinates
            const normalizedDeltaX = (deltaX / canvasWidth) * 2;
            const normalizedDeltaY = (deltaY / canvasHeight) * 2;

            switch (dragState.mode) {
                case 'move': {
                    onTransformChange({
                        x: dragState.startTransform.x + normalizedDeltaX,
                        y: dragState.startTransform.y + normalizedDeltaY
                    });
                    break;
                }
                case 'resize-se': {
                    // Scale from bottom-right corner
                    const scaleDelta = 1 + (deltaX + deltaY) / 200;
                    onTransformChange({
                        scaleX: Math.max(0.1, dragState.startTransform.scaleX * scaleDelta),
                        scaleY: Math.max(0.1, dragState.startTransform.scaleY * scaleDelta)
                    });
                    break;
                }
                case 'resize-nw': {
                    const scaleDelta = 1 - (deltaX + deltaY) / 200;
                    onTransformChange({
                        scaleX: Math.max(0.1, dragState.startTransform.scaleX * scaleDelta),
                        scaleY: Math.max(0.1, dragState.startTransform.scaleY * scaleDelta)
                    });
                    break;
                }
                case 'resize-ne': {
                    const scaleDelta = 1 + (deltaX - deltaY) / 200;
                    onTransformChange({
                        scaleX: Math.max(0.1, dragState.startTransform.scaleX * scaleDelta),
                        scaleY: Math.max(0.1, dragState.startTransform.scaleY * scaleDelta)
                    });
                    break;
                }
                case 'resize-sw': {
                    const scaleDelta = 1 + (-deltaX + deltaY) / 200;
                    onTransformChange({
                        scaleX: Math.max(0.1, dragState.startTransform.scaleX * scaleDelta),
                        scaleY: Math.max(0.1, dragState.startTransform.scaleY * scaleDelta)
                    });
                    break;
                }
                case 'rotate': {
                    // Calculate rotation from horizontal drag
                    const rotationDelta = deltaX / 2; // 2 pixels = 1 degree
                    onTransformChange({
                        rotation: (dragState.startTransform.rotation + rotationDelta) % 360
                    });
                    break;
                }
            }
        };

        const handleMouseUp = () => {
            setIsDragging(false);
            dragStateRef.current = null;
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, canvasWidth, canvasHeight, onTransformChange]);

    return {
        isDragging,
        startDrag
    };
}
