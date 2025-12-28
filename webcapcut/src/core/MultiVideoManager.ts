/**
 * MultiVideoManager - Manages multiple video sources for timeline playback
 * Handles loading, caching, and switching between video elements
 */

export class MultiVideoManager {
    private videos: Map<string, HTMLVideoElement> = new Map();
    private currentAssetId: string | null = null;
    private static instance: MultiVideoManager | null = null;

    static getInstance(): MultiVideoManager {
        if (!MultiVideoManager.instance) {
            MultiVideoManager.instance = new MultiVideoManager();
        }
        return MultiVideoManager.instance;
    }

    /**
     * Load a video file and store it by asset ID
     */
    async loadVideo(assetId: string, file: File): Promise<HTMLVideoElement> {
        // Check if already loaded
        if (this.videos.has(assetId)) {
            console.log(`[MultiVideoManager] Video already loaded: ${assetId}`);
            return this.videos.get(assetId)!;
        }

        console.log(`[MultiVideoManager] Loading video: ${assetId} (${file.name})`);

        return new Promise((resolve, reject) => {
            const video = document.createElement('video');
            video.muted = true; // Required for autoplay in browsers
            video.playsInline = true;
            video.preload = 'auto';
            video.loop = false;

            const url = URL.createObjectURL(file);
            video.src = url;

            video.onloadeddata = () => {
                console.log(`[MultiVideoManager] ✅ Video loaded: ${assetId}`);
                console.log(`[MultiVideoManager] Duration: ${video.duration.toFixed(2)}s, Size: ${video.videoWidth}x${video.videoHeight}`);
                this.videos.set(assetId, video);
                resolve(video);
            };

            video.onerror = () => {
                console.error(`[MultiVideoManager] ❌ Failed to load: ${assetId}`);
                URL.revokeObjectURL(url);
                reject(new Error(`Failed to load video: ${file.name}`));
            };

            video.load();
        });
    }

    /**
     * Get video element for a specific asset
     */
    getVideoForAsset(assetId: string): HTMLVideoElement | null {
        return this.videos.get(assetId) || null;
    }

    /**
     * Register a pre-loaded video element by asset ID
     * Use this when you already have a loaded HTMLVideoElement
     */
    registerVideo(assetId: string, videoElement: HTMLVideoElement): void {
        if (this.videos.has(assetId)) {
            console.log(`[MultiVideoManager] Video already registered: ${assetId}`);
            return;
        }
        this.videos.set(assetId, videoElement);
        console.log(`[MultiVideoManager] ✅ Registered video: ${assetId}`);
    }

    /**
     * Set the currently active video (for render source)
     */
    setActiveVideo(assetId: string): boolean {
        if (!this.videos.has(assetId)) {
            console.warn(`[MultiVideoManager] Asset not found: ${assetId}`);
            return false;
        }

        if (this.currentAssetId !== assetId) {
            // Pause previous video
            if (this.currentAssetId) {
                const prevVideo = this.videos.get(this.currentAssetId);
                if (prevVideo && !prevVideo.paused) {
                    prevVideo.pause();
                }
            }

            this.currentAssetId = assetId;
            console.log(`[MultiVideoManager] Switched to: ${assetId}`);
        }

        return true;
    }

    /**
     * Get the currently active video element
     */
    getActiveVideo(): HTMLVideoElement | null {
        if (!this.currentAssetId) return null;
        return this.videos.get(this.currentAssetId) || null;
    }

    /**
     * Get current active asset ID
     */
    getActiveAssetId(): string | null {
        return this.currentAssetId;
    }

    /**
     * Sync the active video's playback with timeline
     */
    syncActiveVideo(targetTime: number, isPlaying: boolean, playbackRate: number = 1): void {
        const video = this.getActiveVideo();
        if (!video) return;

        // Set playback rate if changed
        if (video.playbackRate !== playbackRate) {
            video.playbackRate = playbackRate;
        }

        // Sync time if significantly different (threshold: 100ms)
        const timeDiff = Math.abs(video.currentTime - targetTime);
        if (timeDiff > 0.1) {
            video.currentTime = Math.max(0, Math.min(targetTime, video.duration || Infinity));
        }

        // Sync play state
        if (isPlaying && video.paused) {
            video.play().catch(e => {
                console.warn(`[MultiVideoManager] Play failed:`, e.message);
            });
        } else if (!isPlaying && !video.paused) {
            video.pause();
        }
    }

    /**
     * Check if a video is loaded for an asset
     */
    hasVideo(assetId: string): boolean {
        return this.videos.has(assetId);
    }

    /**
     * Get count of loaded videos
     */
    getVideoCount(): number {
        return this.videos.size;
    }

    /**
     * Remove a video (cleanup)
     */
    removeVideo(assetId: string): void {
        const video = this.videos.get(assetId);
        if (video) {
            video.pause();
            if (video.src) {
                URL.revokeObjectURL(video.src);
            }
            this.videos.delete(assetId);

            if (this.currentAssetId === assetId) {
                this.currentAssetId = null;
            }

            console.log(`[MultiVideoManager] Removed: ${assetId}`);
        }
    }

    /**
     * Cleanup all videos
     */
    destroy(): void {
        console.log(`[MultiVideoManager] Destroying ${this.videos.size} videos...`);
        for (const [assetId] of this.videos) {
            this.removeVideo(assetId);
        }
        this.videos.clear();
        this.currentAssetId = null;
    }
}

// Singleton export
export const multiVideoManager = MultiVideoManager.getInstance();
