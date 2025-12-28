/**
 * Clip Transform Utilities
 * Shared calculations for preview and export rendering
 */

import type { ClipTransform } from '../types/timeline';
import { DEFAULT_CLIP_TRANSFORM } from '../types/timeline';

/**
 * Calculated draw rectangle with transform applied
 */
export interface TransformedRect {
    x: number;      // Draw position X (pixels)
    y: number;      // Draw position Y (pixels)
    width: number;  // Draw width (pixels)
    height: number; // Draw height (pixels)
    rotation: number; // Rotation in radians
    centerX: number;  // Center X for rotation pivot
    centerY: number;  // Center Y for rotation pivot
}

/**
 * Calculate the base fit-to-frame rectangle (letterbox/pillarbox)
 */
export function calculateFitRect(
    canvasW: number,
    canvasH: number,
    videoW: number,
    videoH: number
): { x: number; y: number; width: number; height: number } {
    const canvasAR = canvasW / canvasH;
    const videoAR = videoW / videoH;

    let displayW: number;
    let displayH: number;

    if (videoAR > canvasAR) {
        // Video is wider - fit to width, letterbox
        displayW = canvasW;
        displayH = canvasW / videoAR;
    } else {
        // Video is taller - fit to height, pillarbox
        displayH = canvasH;
        displayW = canvasH * videoAR;
    }

    const x = (canvasW - displayW) / 2;
    const y = (canvasH - displayH) / 2;

    return { x, y, width: displayW, height: displayH };
}

/**
 * Apply user transform to base rectangle
 * Returns final draw coordinates
 */
export function applyClipTransform(
    canvasW: number,
    canvasH: number,
    videoW: number,
    videoH: number,
    transform: ClipTransform | undefined
): TransformedRect {
    // Get base fit rectangle
    const base = calculateFitRect(canvasW, canvasH, videoW, videoH);

    // Use default if no transform
    const t = transform || DEFAULT_CLIP_TRANSFORM;

    // Apply scale
    const scaledW = base.width * t.scaleX;
    const scaledH = base.height * t.scaleY;

    // Calculate center with position offset
    // Position offset is normalized (-1 to 1) where 0 = center
    const offsetX = t.x * (canvasW / 2);
    const offsetY = t.y * (canvasH / 2);

    const centerX = canvasW / 2 + offsetX;
    const centerY = canvasH / 2 + offsetY;

    // Final draw position (top-left corner)
    const drawX = centerX - scaledW / 2;
    const drawY = centerY - scaledH / 2;

    return {
        x: drawX,
        y: drawY,
        width: scaledW,
        height: scaledH,
        rotation: t.rotation * Math.PI / 180, // Convert to radians
        centerX,
        centerY
    };
}

/**
 * Apply transform to 2D canvas context before drawing
 * Call ctx.save() before and ctx.restore() after
 */
export function applyTransformToContext(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    rect: TransformedRect
): void {
    // Move origin to center of video
    ctx.translate(rect.centerX, rect.centerY);

    // Apply rotation
    if (rect.rotation !== 0) {
        ctx.rotate(rect.rotation);
    }
}

/**
 * Draw image with transform applied
 * Handles the full save/translate/rotate/draw/restore flow
 */
export function drawWithTransform(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    image: CanvasImageSource,
    canvasW: number,
    canvasH: number,
    videoW: number,
    videoH: number,
    transform: ClipTransform | undefined
): void {
    const rect = applyClipTransform(canvasW, canvasH, videoW, videoH, transform);

    ctx.save();

    // Move to center, rotate, then draw offset from center
    ctx.translate(rect.centerX, rect.centerY);

    if (rect.rotation !== 0) {
        ctx.rotate(rect.rotation);
    }

    // Draw centered at origin (since we translated to center)
    ctx.drawImage(
        image,
        -rect.width / 2,
        -rect.height / 2,
        rect.width,
        rect.height
    );

    ctx.restore();
}

/**
 * Convert screen coordinates to normalized transform coordinates
 * Used for drag interactions
 */
export function screenToNormalized(
    screenDeltaX: number,
    screenDeltaY: number,
    canvasW: number,
    canvasH: number
): { x: number; y: number } {
    return {
        x: (screenDeltaX / canvasW) * 2,
        y: (screenDeltaY / canvasH) * 2
    };
}

/**
 * Get bounding box for transform overlay (screen coordinates)
 */
export function getTransformBounds(
    canvasW: number,
    canvasH: number,
    videoW: number,
    videoH: number,
    transform: ClipTransform | undefined
): { x: number; y: number; width: number; height: number } {
    const rect = applyClipTransform(canvasW, canvasH, videoW, videoH, transform);

    // For rotation, we return the axis-aligned bounding box
    // This is simplified - a full implementation would handle rotated corners
    return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height
    };
}
