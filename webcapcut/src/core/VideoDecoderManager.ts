/**
 * Simple video playback using HTMLVideoElement
 * More reliable than WebCodecs VideoDecoder
 */
export class VideoDecoderManager {
    private videoElement: HTMLVideoElement | null = null;
    private isReady = false;
    private lastLogTime = 0;

    async init(): Promise<void> {
        console.log('[VideoDecoder] ═══════════════════════════════════════');
        console.log('[VideoDecoder] Using HTMLVideoElement playback');
    }

    /**
     * Load video from file and return the video element
     */
    async loadVideo(file: File): Promise<HTMLVideoElement> {
        console.log('[VideoDecoder] Loading video from file:', file.name);

        return new Promise((resolve, reject) => {
            const video = document.createElement('video');
            video.muted = true; // Required for autoplay in browsers
            video.playsInline = true;
            video.preload = 'auto';
            video.loop = false;

            const url = URL.createObjectURL(file);
            video.src = url;

            video.onloadeddata = () => {
                console.log('[VideoDecoder] ✅ Video loaded!');
                console.log('[VideoDecoder] Duration:', video.duration.toFixed(2), 's');
                console.log('[VideoDecoder] Size:', video.videoWidth, 'x', video.videoHeight);
                this.videoElement = video;
                this.isReady = true;
                resolve(video);
            };

            video.onerror = () => {
                console.error('[VideoDecoder] ❌ Video load error');
                URL.revokeObjectURL(url);
                reject(new Error('Failed to load video: ' + (video.error?.message || 'Unknown error')));
            };

            video.load();
        });
    }

    /**
     * Get video element for rendering
     */
    getVideoElement(): HTMLVideoElement | null {
        const now = performance.now();
        if (now - this.lastLogTime > 1000) {
            if (this.videoElement) {
                console.log(`[VideoDecoder] Status: time=${this.videoElement.currentTime.toFixed(2)}s, playing=${!this.videoElement.paused}`);
            }
            this.lastLogTime = now;
        }
        return this.videoElement;
    }

    /**
     * Sync video playback with external state
     */
    syncPlayback(isPlaying: boolean, targetTime: number, playbackRate: number = 1): void {
        if (!this.videoElement) return;

        // Sync playback rate
        if (this.videoElement.playbackRate !== playbackRate) {
            this.videoElement.playbackRate = playbackRate;
            console.log('[VideoDecoder] Set playbackRate:', playbackRate);
        }

        // Convert from microseconds to seconds
        const targetSeconds = targetTime / 1_000_000;

        // Sync time if difference is significant
        const timeDiff = Math.abs(this.videoElement.currentTime - targetSeconds);
        if (timeDiff > 0.1) {
            this.videoElement.currentTime = targetSeconds;
        }

        // Sync play state
        if (isPlaying && this.videoElement.paused) {
            this.videoElement.play().catch(e => {
                console.warn('[VideoDecoder] Play failed:', e.message);
            });
        } else if (!isPlaying && !this.videoElement.paused) {
            this.videoElement.pause();
        }
    }

    /**
     * Get current time in microseconds
     */
    getCurrentTimeMicros(): number {
        if (this.videoElement) {
            return this.videoElement.currentTime * 1_000_000;
        }
        return 0;
    }

    getBufferSize(): number {
        return this.isReady ? 1 : 0;
    }

    destroy(): void {
        console.log('[VideoDecoder] Destroying...');
        if (this.videoElement) {
            this.videoElement.pause();
            if (this.videoElement.src) {
                URL.revokeObjectURL(this.videoElement.src);
            }
            this.videoElement = null;
        }
        this.isReady = false;
    }
}
