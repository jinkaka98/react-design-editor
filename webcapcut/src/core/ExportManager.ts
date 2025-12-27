/**
 * ExportManager - Handles video export using WebCodecs VideoEncoder and mp4-muxer
 */
import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import { ExportOptions } from '../types/video';
import { useTimelineStore } from '../store/timelineStore';
import { audioSystem } from './AudioSystem';

export interface ExportProgress {
    percent: number;
    currentFrame: number;
    totalFrames: number;
    stage: 'preparing' | 'encoding' | 'muxing' | 'complete' | 'error';
    error?: string;
}

export type ProgressCallback = (progress: ExportProgress) => void;

export class ExportManager {
    private videoEncoder: VideoEncoder | null = null;
    private audioEncoder: AudioEncoder | null = null;
    private muxer: Muxer<ArrayBufferTarget> | null = null;
    private cancelled = false;
    private onProgress: ProgressCallback | null = null;

    /**
     * Export timeline to MP4 blob
     */
    async export(options: ExportOptions, onProgress?: ProgressCallback): Promise<Blob> {
        this.cancelled = false;
        this.onProgress = onProgress || null;

        console.log('[ExportManager] Starting export...', options);
        this.reportProgress({ percent: 0, currentFrame: 0, totalFrames: 0, stage: 'preparing' });

        try {
            // Get timeline data
            const timelineState = useTimelineStore.getState();
            const durationUs = timelineState.duration; // microseconds
            const durationSec = durationUs / 1_000_000;
            const totalFrames = Math.ceil(durationSec * options.frameRate);

            console.log(`[ExportManager] Duration: ${durationSec.toFixed(2)}s, Frames: ${totalFrames}`);

            // Create muxer
            this.muxer = new Muxer({
                target: new ArrayBufferTarget(),
                video: {
                    codec: 'avc',
                    width: options.width,
                    height: options.height
                },
                audio: {
                    codec: 'aac',
                    numberOfChannels: 2,
                    sampleRate: options.audioSampleRate
                },
                fastStart: 'in-memory'
            });

            // Create video encoder
            this.videoEncoder = new VideoEncoder({
                output: (chunk, meta) => {
                    if (this.muxer && !this.cancelled) {
                        this.muxer.addVideoChunk(chunk, meta);
                    }
                },
                error: (e) => {
                    console.error('[ExportManager] Video encoder error:', e);
                    this.reportProgress({ percent: 0, currentFrame: 0, totalFrames, stage: 'error', error: e.message });
                }
            });

            // Select AVC level based on resolution
            // Level 3.1 (0x1f) = max 1280x720
            // Level 4.0 (0x28) = max 1920x1080
            // Level 4.1 (0x29) = max 2048x1024 or 1920x1088
            // Level 5.1 (0x33) = max 4096x2160
            const codecLevel = this.getAvcLevel(options.width, options.height);
            console.log(`[ExportManager] Using codec: ${codecLevel}`);

            await this.videoEncoder.configure({
                codec: codecLevel,
                width: options.width,
                height: options.height,
                bitrate: options.videoBitrate,
                framerate: options.frameRate
            });

            // Create audio encoder
            this.audioEncoder = new AudioEncoder({
                output: (chunk, meta) => {
                    if (this.muxer && !this.cancelled) {
                        this.muxer.addAudioChunk(chunk, meta);
                    }
                },
                error: (e) => {
                    console.error('[ExportManager] Audio encoder error:', e);
                }
            });

            await this.audioEncoder.configure({
                codec: 'mp4a.40.2', // AAC-LC
                numberOfChannels: 2,
                sampleRate: options.audioSampleRate,
                bitrate: options.audioBitrate
            });

            this.reportProgress({ percent: 5, currentFrame: 0, totalFrames, stage: 'encoding' });

            // Create offscreen canvas for rendering
            const offscreen = new OffscreenCanvas(options.width, options.height);
            const ctx = offscreen.getContext('2d')!;

            // Encode video frames
            for (let frameNum = 0; frameNum < totalFrames; frameNum++) {
                if (this.cancelled) {
                    throw new Error('Export cancelled');
                }

                const timeUs = (frameNum / options.frameRate) * 1_000_000;

                // Get active clips at this time
                const activeClips = timelineState.getActiveClips(timeUs);
                const videoClip = activeClips.find(c => c.track.type === 'video');

                // Render frame
                ctx.fillStyle = '#000000';
                ctx.fillRect(0, 0, options.width, options.height);

                if (videoClip && videoClip.asset.videoElement) {
                    const video = videoClip.asset.videoElement;
                    const localTime = (timeUs - videoClip.segment.start + videoClip.clip.srcStart) / 1_000_000;

                    // Seek video to correct time
                    video.currentTime = Math.max(0, Math.min(localTime, video.duration));

                    // Wait for video to seek
                    await this.waitForVideoSeek(video);

                    // Draw video to canvas with aspect ratio fit
                    this.drawVideoFit(ctx, video, options.width, options.height);
                }

                // Create VideoFrame and encode
                const videoFrame = new VideoFrame(offscreen, {
                    timestamp: timeUs,
                    duration: (1 / options.frameRate) * 1_000_000
                });

                const keyFrame = frameNum % 30 === 0; // Keyframe every 30 frames
                this.videoEncoder.encode(videoFrame, { keyFrame });
                videoFrame.close();

                // Report progress
                const percent = Math.round(5 + (frameNum / totalFrames) * 85);
                this.reportProgress({ percent, currentFrame: frameNum + 1, totalFrames, stage: 'encoding' });
            }

            // Flush video encoder
            await this.videoEncoder.flush();

            // Encode audio
            await this.encodeAudio(options, durationSec);

            // Flush audio encoder
            await this.audioEncoder.flush();

            this.reportProgress({ percent: 95, currentFrame: totalFrames, totalFrames, stage: 'muxing' });

            // Finalize muxer
            this.muxer.finalize();

            // Get buffer and create blob
            const buffer = this.muxer.target.buffer;
            const blob = new Blob([buffer], { type: 'video/mp4' });

            console.log(`[ExportManager] Export complete! Size: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);
            this.reportProgress({ percent: 100, currentFrame: totalFrames, totalFrames, stage: 'complete' });

            this.cleanup();
            return blob;

        } catch (error) {
            console.error('[ExportManager] Export failed:', error);
            this.cleanup();
            throw error;
        }
    }

    private async encodeAudio(options: ExportOptions, durationSec: number): Promise<void> {
        if (!this.audioEncoder) return;

        const timelineState = useTimelineStore.getState();
        const sampleRate = options.audioSampleRate;
        const totalSamples = Math.ceil(durationSec * sampleRate);
        const numberOfChannels = 2;

        // Create separate channel buffers for planar format
        const leftChannel = new Float32Array(totalSamples);
        const rightChannel = new Float32Array(totalSamples);

        // For each clip with audio, add to mix
        for (const track of timelineState.tracks) {
            for (const segment of track.segments) {
                if (segment.type !== 'clip') continue;

                const clip = timelineState.clips.get(segment.clipId);
                if (!clip) continue;

                const asset = timelineState.assets.get(clip.assetId);
                if (!asset) continue;

                const audioBuffer = audioSystem.getBufferForAsset(asset.id);
                if (!audioBuffer) continue;

                // Calculate sample positions
                const clipStartSec = segment.start / 1_000_000;
                const clipDurSec = segment.duration / 1_000_000;
                const srcStartSec = clip.srcStart / 1_000_000;

                const destStartSample = Math.floor(clipStartSec * sampleRate);
                const numSamples = Math.floor(clipDurSec * sampleRate);
                const srcStartSample = Math.floor(srcStartSec * audioBuffer.sampleRate);

                // Copy audio data to separate channel buffers
                for (let i = 0; i < numSamples; i++) {
                    const destIdx = destStartSample + i;
                    const srcIdx = srcStartSample + i;

                    if (destIdx < totalSamples && srcIdx < audioBuffer.getChannelData(0).length) {
                        leftChannel[destIdx] += audioBuffer.getChannelData(0)[srcIdx];
                        if (audioBuffer.numberOfChannels > 1) {
                            rightChannel[destIdx] += audioBuffer.getChannelData(1)[srcIdx];
                        } else {
                            rightChannel[destIdx] += audioBuffer.getChannelData(0)[srcIdx];
                        }
                    }
                }
            }
        }

        // Normalize (clip to -1..1)
        for (let i = 0; i < totalSamples; i++) {
            leftChannel[i] = Math.max(-1, Math.min(1, leftChannel[i]));
            rightChannel[i] = Math.max(-1, Math.min(1, rightChannel[i]));
        }

        // Encode audio in chunks - using planar format properly
        const samplesPerChunk = sampleRate; // 1 second chunks
        const chunksTotal = Math.ceil(totalSamples / samplesPerChunk);

        for (let chunkIdx = 0; chunkIdx < chunksTotal; chunkIdx++) {
            if (this.cancelled) break;

            const startSample = chunkIdx * samplesPerChunk;
            const endSample = Math.min(startSample + samplesPerChunk, totalSamples);
            const chunkSamples = endSample - startSample;

            // Create planar data: [all left samples][all right samples]
            const chunkData = new Float32Array(chunkSamples * numberOfChannels);

            // Copy left channel
            for (let i = 0; i < chunkSamples; i++) {
                chunkData[i] = leftChannel[startSample + i];
            }
            // Copy right channel
            for (let i = 0; i < chunkSamples; i++) {
                chunkData[chunkSamples + i] = rightChannel[startSample + i];
            }

            const audioData = new AudioData({
                format: 'f32-planar',
                sampleRate: sampleRate,
                numberOfFrames: chunkSamples,
                numberOfChannels: numberOfChannels,
                timestamp: (startSample / sampleRate) * 1_000_000,
                data: chunkData
            });

            this.audioEncoder.encode(audioData);
            audioData.close();
        }
    }

    private drawVideoFit(ctx: OffscreenCanvasRenderingContext2D, video: HTMLVideoElement, canvasW: number, canvasH: number): void {
        const videoW = video.videoWidth;
        const videoH = video.videoHeight;

        if (!videoW || !videoH) return;

        const videoAR = videoW / videoH;
        const canvasAR = canvasW / canvasH;

        let drawW: number, drawH: number, drawX: number, drawY: number;

        if (videoAR > canvasAR) {
            // Video is wider - fit to width
            drawW = canvasW;
            drawH = canvasW / videoAR;
            drawX = 0;
            drawY = (canvasH - drawH) / 2;
        } else {
            // Video is taller - fit to height
            drawH = canvasH;
            drawW = canvasH * videoAR;
            drawX = (canvasW - drawW) / 2;
            drawY = 0;
        }

        ctx.drawImage(video, drawX, drawY, drawW, drawH);
    }

    private waitForVideoSeek(video: HTMLVideoElement): Promise<void> {
        return new Promise((resolve) => {
            if (video.readyState >= 2) {
                resolve();
                return;
            }

            const onSeeked = () => {
                video.removeEventListener('seeked', onSeeked);
                resolve();
            };
            video.addEventListener('seeked', onSeeked);

            // Timeout fallback
            setTimeout(resolve, 100);
        });
    }

    private reportProgress(progress: ExportProgress): void {
        if (this.onProgress) {
            this.onProgress(progress);
        }
    }

    cancel(): void {
        console.log('[ExportManager] Export cancelled');
        this.cancelled = true;
    }

    private cleanup(): void {
        if (this.videoEncoder) {
            try { this.videoEncoder.close(); } catch { }
            this.videoEncoder = null;
        }
        if (this.audioEncoder) {
            try { this.audioEncoder.close(); } catch { }
            this.audioEncoder = null;
        }
        this.muxer = null;
    }

    /**
     * Get appropriate AVC codec string based on resolution
     * Format: avc1.PPCCLL where PP=profile, CC=constraints, LL=level
     * Using High Profile (64) for best quality
     */
    private getAvcLevel(width: number, height: number): string {
        const pixels = width * height;

        // AVC Level reference (High Profile):
        // Level 3.1 (1f): max 921,600 pixels (1280x720)
        // Level 4.0 (28): max 2,097,152 pixels (1920x1080)
        // Level 4.1 (29): max 2,097,152 pixels (for higher framerates)
        // Level 5.0 (32): max 8,912,896 pixels (4096x2048)
        // Level 5.1 (33): max 8,912,896 pixels (4096x2160)

        if (pixels <= 921600) {
            // 720p and below
            return 'avc1.64001f'; // High Profile, Level 3.1
        } else if (pixels <= 2097152) {
            // 1080p
            return 'avc1.640029'; // High Profile, Level 4.1
        } else {
            // 4K
            return 'avc1.640033'; // High Profile, Level 5.1
        }
    }
}

export const exportManager = new ExportManager();
