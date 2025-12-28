/**
 * TransformOverlay - Visual overlay for transform controls
 * Shows bounding box and drag handles when a clip is selected
 */
import { useCallback } from 'react';
import { useTimelineStore } from '../../store/timelineStore';
import { useTransformDrag, DragMode } from '../../hooks/useTransformDrag';
import { getTransformBounds } from '../../utils/clipTransform';

interface TransformOverlayProps {
    canvasWidth: number;
    canvasHeight: number;
    displayScale: number; // Ratio of display size to canvas size
}

export function TransformOverlay({
    canvasWidth,
    canvasHeight,
    displayScale
}: TransformOverlayProps) {
    const selectedClipId = useTimelineStore(state => state.selectedClipId);
    const getClipById = useTimelineStore(state => state.getClipById);
    const getAsset = useTimelineStore(state => state.getAsset);
    const setClipTransform = useTimelineStore(state => state.setClipTransform);

    const selectedClip = selectedClipId ? getClipById(selectedClipId) : undefined;
    const transform = selectedClip?.transform;

    // Get video dimensions from the clip's asset
    const asset = selectedClip ? getAsset(selectedClip.assetId) : undefined;
    const videoElement = asset?.videoElement;
    const videoWidth = videoElement?.videoWidth || 1920; // Default fallback
    const videoHeight = videoElement?.videoHeight || 1080;

    const handleTransformChange = useCallback((newTransform: Parameters<typeof setClipTransform>[1]) => {
        if (selectedClipId) {
            setClipTransform(selectedClipId, newTransform);
            console.log('[TransformOverlay] Transform updated:', newTransform);
        }
    }, [selectedClipId, setClipTransform]);

    const { isDragging, startDrag } = useTransformDrag({
        transform,
        onTransformChange: handleTransformChange,
        canvasWidth,
        canvasHeight
    });

    // Debug log always
    console.log('[TransformOverlay] State:', {
        selectedClipId,
        hasSelectedClip: !!selectedClip,
        hasAsset: !!asset,
        videoWidth,
        videoHeight
    });

    // Don't render if no clip selected
    if (!selectedClipId || !selectedClip) {
        return null;
    }

    console.log('[TransformOverlay] Rendering overlay for clip:', selectedClipId);

    // Get bounding box in canvas coordinates
    const bounds = getTransformBounds(canvasWidth, canvasHeight, videoWidth, videoHeight, transform);

    // Scale to display size
    const displayBounds = {
        x: bounds.x * displayScale,
        y: bounds.y * displayScale,
        width: bounds.width * displayScale,
        height: bounds.height * displayScale
    };

    const handleSize = 10;
    const handleStyle = (cursor: string): React.CSSProperties => ({
        width: handleSize,
        height: handleSize,
        backgroundColor: '#3b82f6',
        border: '2px solid white',
        borderRadius: 2,
        cursor,
        position: 'absolute',
        zIndex: 10
    });

    const handleMouseDown = (e: React.MouseEvent, mode: DragMode) => {
        startDrag(e, mode);
    };

    return (
        <div
            className="absolute pointer-events-none"
            style={{
                left: displayBounds.x,
                top: displayBounds.y,
                width: displayBounds.width,
                height: displayBounds.height,
            }}
        >
            {/* Bounding box */}
            <div
                className={`absolute inset-0 border-2 ${isDragging ? 'border-blue-400' : 'border-blue-500'}`}
                style={{ pointerEvents: 'auto', cursor: 'move' }}
                onMouseDown={(e) => handleMouseDown(e, 'move')}
            />

            {/* Corner handles */}
            {/* Top-left */}
            <div
                style={{
                    ...handleStyle('nw-resize'),
                    left: -handleSize / 2,
                    top: -handleSize / 2
                }}
                className="pointer-events-auto"
                onMouseDown={(e) => handleMouseDown(e, 'resize-nw')}
            />
            {/* Top-right */}
            <div
                style={{
                    ...handleStyle('ne-resize'),
                    right: -handleSize / 2,
                    top: -handleSize / 2
                }}
                className="pointer-events-auto"
                onMouseDown={(e) => handleMouseDown(e, 'resize-ne')}
            />
            {/* Bottom-left */}
            <div
                style={{
                    ...handleStyle('sw-resize'),
                    left: -handleSize / 2,
                    bottom: -handleSize / 2
                }}
                className="pointer-events-auto"
                onMouseDown={(e) => handleMouseDown(e, 'resize-sw')}
            />
            {/* Bottom-right */}
            <div
                style={{
                    ...handleStyle('se-resize'),
                    right: -handleSize / 2,
                    bottom: -handleSize / 2
                }}
                className="pointer-events-auto"
                onMouseDown={(e) => handleMouseDown(e, 'resize-se')}
            />

            {/* Rotation handle (top center) */}
            <div
                style={{
                    position: 'absolute',
                    left: '50%',
                    top: -30,
                    transform: 'translateX(-50%)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    pointerEvents: 'auto'
                }}
            >
                {/* Line connecting to box */}
                <div
                    style={{
                        width: 2,
                        height: 20,
                        backgroundColor: '#3b82f6'
                    }}
                />
                {/* Rotation handle circle */}
                <div
                    style={{
                        width: 12,
                        height: 12,
                        backgroundColor: '#10b981',
                        border: '2px solid white',
                        borderRadius: '50%',
                        cursor: 'grab'
                    }}
                    onMouseDown={(e) => handleMouseDown(e, 'rotate')}
                />
            </div>

            {/* Transform info */}
            {isDragging && transform && (
                <div
                    className="absolute -bottom-6 left-0 text-xs bg-black/70 text-white px-2 py-0.5 rounded whitespace-nowrap"
                >
                    {`X:${(transform.x * 100).toFixed(0)}% Y:${(transform.y * 100).toFixed(0)}% Scale:${(transform.scaleX * 100).toFixed(0)}% Rot:${transform.rotation.toFixed(0)}°`}
                </div>
            )}
        </div>
    );
}
