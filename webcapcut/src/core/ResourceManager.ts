/**
 * ResourceManager - Tracks and manages memory allocations
 * Prevents memory leaks by tracking VideoFrames, AudioBuffers, GPUTextures
 */

export interface ResourceStats {
    videoFrames: number;
    audioBuffers: number;
    gpuTextures: number;
    estimatedMemoryMB: number;
}

interface TrackedResource {
    id: string;
    type: 'videoFrame' | 'audioBuffer' | 'gpuTexture';
    sizeBytes: number;
    createdAt: number;
    closed: boolean;
}

class ResourceManager {
    private resources = new Map<string, TrackedResource>();
    private nextId = 0;
    private memoryThresholdMB = 500; // Trigger cleanup at 500MB
    private listeners: ((stats: ResourceStats) => void)[] = [];

    /**
     * Track a VideoFrame - MUST call when creating VideoFrame
     */
    trackVideoFrame(frame: VideoFrame): string {
        const id = `vf_${this.nextId++}`;
        const sizeBytes = (frame.displayWidth * frame.displayHeight * 4); // Approximate RGBA

        this.resources.set(id, {
            id,
            type: 'videoFrame',
            sizeBytes,
            createdAt: performance.now(),
            closed: false
        });

        this.checkMemoryThreshold();
        return id;
    }

    /**
     * Track an AudioBuffer
     */
    trackAudioBuffer(buffer: AudioBuffer): string {
        const id = `ab_${this.nextId++}`;
        const sizeBytes = buffer.length * buffer.numberOfChannels * 4; // Float32

        this.resources.set(id, {
            id,
            type: 'audioBuffer',
            sizeBytes,
            createdAt: performance.now(),
            closed: false
        });

        this.checkMemoryThreshold();
        return id;
    }

    /**
     * Track a GPUTexture
     */
    trackGPUTexture(_texture: GPUTexture, width: number, height: number): string {
        const id = `gt_${this.nextId++}`;
        const sizeBytes = width * height * 4; // Approximate RGBA

        this.resources.set(id, {
            id,
            type: 'gpuTexture',
            sizeBytes,
            createdAt: performance.now(),
            closed: false
        });

        this.checkMemoryThreshold();
        return id;
    }

    /**
     * Mark resource as released
     */
    release(id: string): void {
        const resource = this.resources.get(id);
        if (resource) {
            resource.closed = true;
            this.resources.delete(id);
            this.notifyListeners();
        }
    }

    /**
     * Get current resource statistics
     */
    getStats(): ResourceStats {
        let videoFrames = 0;
        let audioBuffers = 0;
        let gpuTextures = 0;
        let totalBytes = 0;

        this.resources.forEach(resource => {
            if (!resource.closed) {
                totalBytes += resource.sizeBytes;
                switch (resource.type) {
                    case 'videoFrame': videoFrames++; break;
                    case 'audioBuffer': audioBuffers++; break;
                    case 'gpuTexture': gpuTextures++; break;
                }
            }
        });

        return {
            videoFrames,
            audioBuffers,
            gpuTextures,
            estimatedMemoryMB: Math.round(totalBytes / (1024 * 1024))
        };
    }

    /**
     * Check if memory exceeds threshold and warn
     */
    private checkMemoryThreshold(): void {
        const stats = this.getStats();
        if (stats.estimatedMemoryMB > this.memoryThresholdMB) {
            console.warn(`[ResourceManager] ⚠️ High memory usage: ${stats.estimatedMemoryMB}MB`);
            console.warn(`[ResourceManager] Resources: ${stats.videoFrames} frames, ${stats.audioBuffers} audio, ${stats.gpuTextures} textures`);

            // Find and log old resources (>5 seconds)
            const now = performance.now();
            let oldResources = 0;
            this.resources.forEach(r => {
                if (!r.closed && (now - r.createdAt) > 5000) {
                    oldResources++;
                }
            });
            if (oldResources > 0) {
                console.warn(`[ResourceManager] ${oldResources} resources older than 5s - possible leak!`);
            }
        }
        this.notifyListeners();
    }

    /**
     * Subscribe to stats updates
     */
    subscribe(listener: (stats: ResourceStats) => void): () => void {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    private notifyListeners(): void {
        const stats = this.getStats();
        this.listeners.forEach(l => l(stats));
    }

    /**
     * Force cleanup of all tracked resources (for testing/reset)
     */
    cleanup(): void {
        console.log(`[ResourceManager] Cleaning up ${this.resources.size} tracked resources`);
        this.resources.clear();
        this.notifyListeners();
    }

    /**
     * Set memory threshold for warnings
     */
    setThreshold(mb: number): void {
        this.memoryThresholdMB = mb;
    }
}

// Singleton instance
export const resourceManager = new ResourceManager();
