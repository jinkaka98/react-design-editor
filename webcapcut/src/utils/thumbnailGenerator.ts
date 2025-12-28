/**
 * thumbnailGenerator - Generate video thumbnails for media panel
 */

export async function generateVideoThumbnail(
    videoElement: HTMLVideoElement,
    width: number = 160,
    height: number = 90
): Promise<string> {
    return new Promise((resolve, reject) => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
        }

        // Calculate aspect ratio fit
        const videoAspect = videoElement.videoWidth / videoElement.videoHeight;
        const canvasAspect = width / height;

        let drawWidth = width;
        let drawHeight = height;
        let offsetX = 0;
        let offsetY = 0;

        if (videoAspect > canvasAspect) {
            // Video is wider - fit to width
            drawHeight = width / videoAspect;
            offsetY = (height - drawHeight) / 2;
        } else {
            // Video is taller - fit to height
            drawWidth = height * videoAspect;
            offsetX = (width - drawWidth) / 2;
        }

        // Fill background
        ctx.fillStyle = '#1f2937';
        ctx.fillRect(0, 0, width, height);

        // Draw video frame
        ctx.drawImage(videoElement, offsetX, offsetY, drawWidth, drawHeight);

        // Return as data URL
        resolve(canvas.toDataURL('image/jpeg', 0.8));
    });
}

export function formatDuration(microseconds: number): string {
    const seconds = Math.floor(microseconds / 1_000_000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}
