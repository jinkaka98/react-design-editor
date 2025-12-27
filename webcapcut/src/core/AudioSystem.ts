/**
 * AudioSystem - Multi-track audio playback
 * Supports playing multiple audio sources simultaneously (for overlapping clips)
 */
export class AudioSystem {
    private audioContext: AudioContext;
    private masterGain: GainNode;
    private isPlayingState: boolean = false;

    // Multi-buffer support
    private audioBuffers: Map<string, AudioBuffer> = new Map(); // assetId -> buffer

    // Multi-track: multiple sources can play simultaneously
    private activeSources: Map<string, { source: AudioBufferSourceNode; startedAt: number; offset: number }> = new Map();

    constructor() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        this.audioContext = new AudioContextClass();
        this.masterGain = this.audioContext.createGain();
        this.masterGain.connect(this.audioContext.destination);
    }

    async initialize(): Promise<void> {
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
    }

    /**
     * Add an audio buffer for a specific asset
     */
    addAudioBuffer(assetId: string, buffer: AudioBuffer): void {
        this.audioBuffers.set(assetId, buffer);
        console.log(`[AudioSystem] Added buffer for asset: ${assetId}, duration: ${buffer.duration.toFixed(2)}s`);
    }

    /**
     * Get buffer for a specific asset
     */
    getBufferForAsset(assetId: string): AudioBuffer | null {
        return this.audioBuffers.get(assetId) || null;
    }

    /**
     * Play/update audio for multiple active clips
     * @param activeClips Array of { assetId, localTime } for all clips that should be playing
     */
    updateActiveClips(activeClips: { assetId: string; localTime: number }[]): void {
        if (!this.isPlayingState) return;

        const activeAssetIds = new Set(activeClips.map(c => c.assetId));

        // Stop sources that are no longer active
        for (const [assetId, _sourceInfo] of this.activeSources) {
            if (!activeAssetIds.has(assetId)) {
                this.stopSource(assetId);
            }
        }

        // Start or sync active clips
        for (const clip of activeClips) {
            const buffer = this.audioBuffers.get(clip.assetId);
            if (!buffer) continue;

            if (!this.activeSources.has(clip.assetId)) {
                // Start new source
                this.startSource(clip.assetId, clip.localTime);
            } else {
                // Check if we need to re-sync (large time difference)
                const sourceInfo = this.activeSources.get(clip.assetId)!;
                const elapsed = this.audioContext.currentTime - sourceInfo.startedAt;
                const expectedTime = sourceInfo.offset + elapsed;

                if (Math.abs(expectedTime - clip.localTime) > 0.15) {
                    // Re-sync needed
                    this.stopSource(clip.assetId);
                    this.startSource(clip.assetId, clip.localTime);
                }
            }
        }
    }

    private startSource(assetId: string, offset: number): void {
        const buffer = this.audioBuffers.get(assetId);
        if (!buffer) return;

        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(this.masterGain);

        const clampedOffset = Math.max(0, Math.min(offset, buffer.duration));
        source.start(0, clampedOffset);

        this.activeSources.set(assetId, {
            source,
            startedAt: this.audioContext.currentTime,
            offset: clampedOffset
        });

        console.log(`[AudioSystem] Started: ${assetId} at ${clampedOffset.toFixed(2)}s`);
    }

    private stopSource(assetId: string): void {
        const sourceInfo = this.activeSources.get(assetId);
        if (sourceInfo) {
            try {
                sourceInfo.source.stop();
                sourceInfo.source.disconnect();
            } catch {
                // Ignore errors if already stopped
            }
            this.activeSources.delete(assetId);
        }
    }

    /**
     * Legacy: Set single active asset (for backward compatibility)
     */
    setActiveAsset(assetId: string, localTime: number = 0): boolean {
        if (!this.audioBuffers.has(assetId)) {
            this.stopAllSources();
            return false;
        }

        // Use multi-track update with single clip
        this.updateActiveClips([{ assetId, localTime }]);
        return true;
    }

    /**
     * Get current active buffer (for waveform - returns first active or first available)
     */
    getCurrentBuffer(): AudioBuffer | null {
        // Return first active source's buffer
        for (const [assetId] of this.activeSources) {
            const buf = this.audioBuffers.get(assetId);
            if (buf) return buf;
        }
        // Fallback to any buffer
        for (const buf of this.audioBuffers.values()) {
            return buf;
        }
        return null;
    }

    // Legacy method for compatibility
    setMasterBuffer(buffer: AudioBuffer): void {
        this.addAudioBuffer('default', buffer);
    }

    play(_offset: number = 0): void {
        this.isPlayingState = true;
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
    }

    stopAllSources(): void {
        for (const assetId of this.activeSources.keys()) {
            this.stopSource(assetId);
        }
    }

    stop(): void {
        this.stopAllSources();
        this.isPlayingState = false;
    }

    pause(): void {
        if (this.isPlayingState) {
            this.audioContext.suspend();
            this.isPlayingState = false;
        }
    }

    resume(): void {
        if (!this.isPlayingState && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
            this.isPlayingState = true;
        }
    }

    seek(_time: number): void {
        // Seek will be handled by updateActiveClips from VideoPlayer
    }

    getCurrentTime(): number {
        // Return 0 since we no longer track global audio time
        return 0;
    }

    getAudioContext(): AudioContext {
        return this.audioContext;
    }

    hasAudio(): boolean {
        return this.audioBuffers.size > 0;
    }

    hasAudioForAsset(assetId: string): boolean {
        return this.audioBuffers.has(assetId);
    }

    isPlaying(): boolean {
        return this.isPlayingState;
    }

    getBufferCount(): number {
        return this.audioBuffers.size;
    }

    getActiveSourceCount(): number {
        return this.activeSources.size;
    }

    removeBuffer(assetId: string): void {
        this.stopSource(assetId);
        this.audioBuffers.delete(assetId);
    }
}

export const audioSystem = new AudioSystem();
