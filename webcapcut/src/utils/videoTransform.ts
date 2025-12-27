/**
 * Video Transform Utilities
 * Calculate video rectangle for fit-to-frame with letterbox/pillarbox
 * 
 * Output: Float32Array [x, y, width, height] in normalized canvas space (0-1)
 */

/**
 * Calculate where video should appear in canvas (fit mode)
 * 
 * @param canvasWidth Canvas width in pixels
 * @param canvasHeight Canvas height in pixels  
 * @param videoWidth Source video width in pixels
 * @param videoHeight Source video height in pixels
 * @returns Float32Array [x, y, width, height] in normalized 0-1 canvas space
 */
export function calculateVideoTransform(
    canvasWidth: number,
    canvasHeight: number,
    videoWidth: number,
    videoHeight: number
): Float32Array {
    const canvasAR = canvasWidth / canvasHeight;
    const videoAR = videoWidth / videoHeight;

    let displayWidth: number;
    let displayHeight: number;

    if (videoAR > canvasAR) {
        // Video is WIDER than canvas
        // Fit to canvas width, letterbox on top/bottom
        displayWidth = canvasWidth;
        displayHeight = canvasWidth / videoAR;
    } else {
        // Video is TALLER than canvas
        // Fit to canvas height, pillarbox on left/right
        displayHeight = canvasHeight;
        displayWidth = canvasHeight * videoAR;
    }

    // Normalized dimensions (0-1)
    const normalizedW = displayWidth / canvasWidth;
    const normalizedH = displayHeight / canvasHeight;

    // Center in canvas
    const x = (1 - normalizedW) / 2;
    const y = (1 - normalizedH) / 2;

    console.log(`[VideoTransform] canvas=${canvasWidth}x${canvasHeight} video=${videoWidth}x${videoHeight}`);
    console.log(`[VideoTransform] display=${displayWidth.toFixed(0)}x${displayHeight.toFixed(0)}`);
    console.log(`[VideoTransform] rect: x=${x.toFixed(3)} y=${y.toFixed(3)} w=${normalizedW.toFixed(3)} h=${normalizedH.toFixed(3)}`);

    return new Float32Array([x, y, normalizedW, normalizedH]);
}

/**
 * Debug: print expected visual result
 */
export function debugTransformVisual(
    canvasWidth: number,
    canvasHeight: number,
    videoWidth: number,
    videoHeight: number
): string {
    const canvasAR = canvasWidth / canvasHeight;
    const videoAR = videoWidth / videoHeight;

    const transform = calculateVideoTransform(canvasWidth, canvasHeight, videoWidth, videoHeight);
    const [x, y, w, h] = transform;

    return `
Canvas: ${canvasWidth}x${canvasHeight} (AR=${canvasAR.toFixed(2)})
Video:  ${videoWidth}x${videoHeight} (AR=${videoAR.toFixed(2)})

Video Rectangle (normalized):
  x: ${x.toFixed(3)} (${(x * 100).toFixed(1)}% from left)
  y: ${y.toFixed(3)} (${(y * 100).toFixed(1)}% from top)
  w: ${w.toFixed(3)} (${(w * 100).toFixed(1)}% of width)
  h: ${h.toFixed(3)} (${(h * 100).toFixed(1)}% of height)

${videoAR > canvasAR ? 'Mode: Letterbox (black bars top/bottom)' : 'Mode: Pillarbox (black bars left/right)'}
`;
}
