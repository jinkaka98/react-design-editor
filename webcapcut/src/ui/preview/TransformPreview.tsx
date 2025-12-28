/**
 * TransformPreview - 2D canvas overlay for transformed video preview
 * Shows the video with transform applied (move, scale, rotate) in REAL-TIME
 */
import { useEffect, useRef, useCallback } from 'react';
import { useTimelineStore } from '../../store/timelineStore';
import { usePlaybackStore } from '../../store/playbackStore';
import { drawWithTransform } from '../../utils/clipTransform';

interface TransformPreviewProps {
    canvasWidth: number;
    canvasHeight: number;
    displayWidth: number;
    displayHeight: number;
}

export function TransformPreview({
    canvasWidth,
    canvasHeight,
    displayWidth,
    displayHeight
}: TransformPreviewProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number | null>(null);

    const selectedClipId = useTimelineStore(state => state.selectedClipId);
    const getAsset = useTimelineStore(state => state.getAsset);
    const currentTime = usePlaybackStore(state => state.currentTime);

    // Get transform values directly with individual selectors for proper reactivity
    const clipTransformX = useTimelineStore(state => {
        const clip = selectedClipId ? state.clips.get(selectedClipId) : undefined;
        return clip?.transform?.x ?? 0;
    });
    const clipTransformY = useTimelineStore(state => {
        const clip = selectedClipId ? state.clips.get(selectedClipId) : undefined;
        return clip?.transform?.y ?? 0;
    });
    const clipTransformScaleX = useTimelineStore(state => {
        const clip = selectedClipId ? state.clips.get(selectedClipId) : undefined;
        return clip?.transform?.scaleX ?? 1;
    });
    const clipTransformScaleY = useTimelineStore(state => {
        const clip = selectedClipId ? state.clips.get(selectedClipId) : undefined;
        return clip?.transform?.scaleY ?? 1;
    });
    const clipTransformRotation = useTimelineStore(state => {
        const clip = selectedClipId ? state.clips.get(selectedClipId) : undefined;
        return clip?.transform?.rotation ?? 0;
    });

    // Get asset for video element
    const clipAssetId = useTimelineStore(state => {
        const clip = selectedClipId ? state.clips.get(selectedClipId) : undefined;
        return clip?.assetId;
    });
    const asset = clipAssetId ? getAsset(clipAssetId) : undefined;
    const videoElement = asset?.videoElement;

    // Build transform object
    const transform = {
        x: clipTransformX,
        y: clipTransformY,
        scaleX: clipTransformScaleX,
        scaleY: clipTransformScaleY,
        rotation: clipTransformRotation
    };

    // Check if transform is different from default
    const hasTransform = clipTransformX !== 0 || clipTransformY !== 0 ||
        clipTransformScaleX !== 1 || clipTransformScaleY !== 1 || clipTransformRotation !== 0;

    // Render function
    const render = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas || !videoElement) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear with black background
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        // Draw video with transform
        if (videoElement.readyState >= 2 && videoElement.videoWidth > 0) {
            drawWithTransform(
                ctx,
                videoElement,
                canvasWidth,
                canvasHeight,
                videoElement.videoWidth,
                videoElement.videoHeight,
                transform
            );
        }
    }, [videoElement, canvasWidth, canvasHeight, transform.x, transform.y,
        transform.scaleX, transform.scaleY, transform.rotation]);

    // Continuous render loop when transform is active
    useEffect(() => {
        if (!hasTransform || !videoElement) {
            return;
        }

        const renderLoop = () => {
            render();
            animationRef.current = requestAnimationFrame(renderLoop);
        };

        // Start loop
        renderLoop();

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
                animationRef.current = null;
            }
        };
    }, [hasTransform, videoElement, render, currentTime]);

    // Don't render if no clip selected or no transform applied
    if (!selectedClipId || !hasTransform) {
        return null;
    }

    return (
        <canvas
            ref={canvasRef}
            width={canvasWidth}
            height={canvasHeight}
            className="absolute inset-0"
            style={{
                width: displayWidth,
                height: displayHeight,
                zIndex: 5,
                pointerEvents: 'none',
            }}
        />
    );
}
