/**
 * ExportManager - Hybrid export using Web Worker for encoding
 * Renders frames on main thread, sends to worker for encoding/muxing
 * 
 * PERFORMANCE LOGGING ENABLED - Check console for diagnostics
 */
import { ExportOptions } from '../types/video';
import { useTimelineStore } from '../store/timelineStore';
import { audioSystem } from './AudioSystem';
import { perfMonitor } from '../utils/PerformanceMonitor';

export interface ExportProgress {
    percent: number;
    currentFrame: number;
    totalFrames: number;
    stage: 'preparing' | 'encoding' | 'muxing' | 'complete' | 'error';
    error?: string;
}

export type ProgressCallback = (progress: ExportProgress) => void;

// Performance tracking
interface PerformanceStats {
    frameRenderTimes: number[];
    frameSeekTimes: number[];
    bitmapCreateTimes: number[];
    totalStartTime: number;
    workerInitTime: number;
    videoRenderTime: number;
    audioProcessTime: number;
    slowFrames: number;
}

export class ExportManager {
    private worker: Worker | null = null;
    private cancelled = false;
    private onProgress: ProgressCallback | null = null;
    private stats: PerformanceStats | null = null;

    /**
     * Export timeline to MP4 blob using hybrid worker approach
     */
    async export(options: ExportOptions, onProgress?: ProgressCallback): Promise<Blob> {
        this.cancelled = false;
        this.onProgress = onProgress || null;

        // Initialize performance stats
        this.stats = {
            frameRenderTimes: [],
            frameSeekTimes: [],
            bitmapCreateTimes: [],
            totalStartTime: performance.now(),
            workerInitTime: 0,
            videoRenderTime: 0,
            audioProcessTime: 0,
            slowFrames: 0
        };

        console.log('╔════════════════════════════════════════════════════════════╗');
        console.log('║           EXPORT STARTED - PERFORMANCE DIAGNOSTICS          ║');
        console.log('╚════════════════════════════════════════════════════════════╝');
        console.log('[Export] Settings:', {
            resolution: `${options.width}x${options.height}`,
            frameRate: options.frameRate,
            videoBitrate: `${(options.videoBitrate / 1_000_000).toFixed(1)} Mbps`,
            audioBitrate: `${(options.audioBitrate / 1000)} kbps`
        });

        this.reportProgress({ percent: 0, currentFrame: 0, totalFrames: 0, stage: 'preparing' });

        return new Promise((resolve, reject) => {
            try {
                // Validate timeline data
                const timelineState = useTimelineStore.getState();
                const durationUs = timelineState.duration;
                const durationSec = durationUs / 1_000_000;
                const totalFrames = Math.ceil(durationSec * options.frameRate);

                // Validation checks
                if (durationSec <= 0) {
                    throw new Error('❌ Timeline duration is 0 - no clips to export');
                }
                if (totalFrames > 10000) {
                    console.warn('[Export] ⚠️ Large export:', totalFrames, 'frames. May take a while.');
                }

                console.log('[Export] Timeline info:', {
                    duration: `${durationSec.toFixed(2)}s`,
                    totalFrames,
                    tracks: timelineState.tracks.length,
                    clips: timelineState.clips.size,
                    assets: timelineState.assets.size
                });

                // Log video elements info
                timelineState.assets.forEach((asset, id) => {
                    if (asset.videoElement) {
                        const v = asset.videoElement;
                        console.log(`[Export] Asset ${id.substring(0, 8)}:`, {
                            size: `${v.videoWidth}x${v.videoHeight}`,
                            duration: `${v.duration.toFixed(2)}s`,
                            readyState: v.readyState,
                            hasAudio: audioSystem.hasAudioForAsset(id)
                        });
                    }
                });

                // CRITICAL: Preload all videos before export
                console.log('[Export] Preloading videos...');
                this.preloadVideos(timelineState).then(() => {
                    console.log('[Export] ✓ Videos preloaded');
                    this.startExportWorker(options, totalFrames, durationSec, timelineState, resolve, reject);
                }).catch(reject);

            } catch (error) {
                console.error('[Export] ❌ Export failed:', error);
                this.cleanup();
                reject(error);
            }
        });
    }

    /**
     * Start the export worker after preload is complete
     */
    private startExportWorker(
        options: ExportOptions,
        totalFrames: number,
        durationSec: number,
        timelineState: ReturnType<typeof useTimelineStore.getState>,
        resolve: (blob: Blob) => void,
        reject: (error: Error) => void
    ): void {
        // Create worker
        const workerStartTime = performance.now();
        this.worker = new Worker(
            new URL('../workers/encoding.worker.ts', import.meta.url),
            { type: 'module' }
        );

        // Handle worker messages
        this.worker.onmessage = async (e) => {
            const data = e.data;

            if (data.type === 'ready') {
                this.stats!.workerInitTime = performance.now() - workerStartTime;
                console.log(`[Export] ✓ Worker ready in ${this.stats!.workerInitTime.toFixed(0)}ms`);

                // Start sending frames
                const renderStart = performance.now();
                await this.renderAndSendFrames(options, totalFrames, durationSec, timelineState);
                this.stats!.videoRenderTime = performance.now() - renderStart;

            } else if (data.type === 'progress') {
                this.reportProgress({
                    percent: data.percent,
                    currentFrame: data.currentFrame,
                    totalFrames: data.totalFrames,
                    stage: 'encoding'
                });

                // Log every 30 frames
                if (data.currentFrame % 30 === 0) {
                    console.log(`[Export] Frame ${data.currentFrame}/${data.totalFrames} (${data.percent}%)`);
                }

            } else if (data.type === 'complete') {
                const blob = new Blob([data.buffer], { type: 'video/mp4' });

                // Print performance report
                this.printPerformanceReport(blob, totalFrames);

                this.reportProgress({ percent: 100, currentFrame: totalFrames, totalFrames, stage: 'complete' });
                this.cleanup();
                resolve(blob);

            } else if (data.type === 'error') {
                console.error('[Export] ❌ Worker error:', data.error);
                this.reportProgress({ percent: 0, currentFrame: 0, totalFrames, stage: 'error', error: data.error });
                this.cleanup();
                reject(new Error(data.error));
            }
        };

        this.worker.onerror = (e) => {
            console.error('[Export] ❌ Worker crashed:', e);
            this.cleanup();
            reject(new Error('Worker crashed: ' + e.message));
        };

        // Initialize worker
        this.worker.postMessage({
            type: 'init',
            width: options.width,
            height: options.height,
            frameRate: options.frameRate,
            videoBitrate: options.videoBitrate,
            totalFrames,
            audioSampleRate: options.audioSampleRate,
            audioBitrate: options.audioBitrate
        });
    }

    private async renderAndSendFrames(
        options: ExportOptions,
        totalFrames: number,
        durationSec: number,
        timelineState: ReturnType<typeof useTimelineStore.getState>
    ): Promise<void> {
        // Create offscreen canvas with high quality settings
        const offscreen = new OffscreenCanvas(options.width, options.height);
        const ctx = offscreen.getContext('2d', {
            alpha: false,               // No transparency needed, improves performance
            desynchronized: true,        // Allow async rendering
            willReadFrequently: false    // Optimize for drawing, not reading
        });

        if (!ctx) {
            throw new Error('❌ Failed to create 2D context for export');
        }

        // Enable high quality image smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        console.log('[Export] Starting frame rendering...');
        console.log('[Export] Canvas:', options.width, 'x', options.height);

        let frameNum = 0;
        let lastLogTime = performance.now();

        const renderNextFrame = async () => {
            if (this.cancelled || !this.worker) {
                console.log('[Export] ⚠️ Export cancelled at frame', frameNum);
                return;
            }

            if (frameNum >= totalFrames) {
                // Log final stats before audio
                const avgRenderTime = this.stats!.frameRenderTimes.length > 0
                    ? this.stats!.frameRenderTimes.reduce((a, b) => a + b, 0) / this.stats!.frameRenderTimes.length
                    : 0;
                console.log(`[Export] ✓ All ${totalFrames} frames rendered`);
                console.log(`[Export] Avg frame time: ${avgRenderTime.toFixed(2)}ms, Slow frames: ${this.stats!.slowFrames}`);

                // Send audio
                const audioStart = performance.now();
                await this.sendAudio(options, durationSec, timelineState);
                this.stats!.audioProcessTime = performance.now() - audioStart;
                console.log(`[Export] ✓ Audio processed in ${this.stats!.audioProcessTime.toFixed(0)}ms`);

                this.worker.postMessage({ type: 'finish' });
                return;
            }

            const frameStart = performance.now();
            const timeUs = (frameNum / options.frameRate) * 1_000_000;
            const activeClips = timelineState.getActiveClips(timeUs);
            const videoClip = activeClips.find(c => c.track.type === 'video');

            // Render frame
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, options.width, options.height);

            let seekTime = 0;
            if (videoClip && videoClip.asset.videoElement) {
                const video = videoClip.asset.videoElement;
                const localTime = (timeUs - videoClip.segment.start + videoClip.clip.srcStart) / 1_000_000;

                // ALWAYS seek to exact time for accurate frame capture
                const seekStart = performance.now();
                const targetTime = Math.max(0, Math.min(localTime, video.duration - 0.01));

                // Set video time and wait for seek to complete
                video.currentTime = targetTime;
                await this.waitForVideoSeekReliable(video, targetTime);

                seekTime = performance.now() - seekStart;
                this.stats!.frameSeekTimes.push(seekTime);

                // Only draw if video frame is ready
                if (video.readyState >= 2) {
                    this.drawVideoFit(ctx, video, options.width, options.height);
                } else {
                    console.warn(`[Export] ⚠️ Frame ${frameNum}: Skipped - video not ready`);
                }
            } else if (frameNum < 5) {
                console.log(`[Export] Frame ${frameNum}: No video clip at time ${(timeUs / 1000000).toFixed(2)}s`);
            }

            // Create bitmap and send to worker
            try {
                const bitmapStart = performance.now();
                const bitmap = await createImageBitmap(offscreen, {
                    resizeQuality: 'high',
                    imageOrientation: 'none'
                });
                const bitmapTime = performance.now() - bitmapStart;
                this.stats!.bitmapCreateTimes.push(bitmapTime);

                this.worker.postMessage({
                    type: 'frame',
                    bitmap,
                    timestamp: timeUs,
                    keyFrame: frameNum % 30 === 0
                }, [bitmap]);

            } catch (err) {
                console.error(`[Export] ❌ Frame ${frameNum} error:`, err);
            }

            const frameTime = performance.now() - frameStart;
            this.stats!.frameRenderTimes.push(frameTime);

            // Track slow frames (>50ms)
            if (frameTime > 50) {
                this.stats!.slowFrames++;
                if (this.stats!.slowFrames <= 5) {
                    console.warn(`[Export] ⚠️ Slow frame ${frameNum}: ${frameTime.toFixed(0)}ms (seek: ${seekTime.toFixed(0)}ms)`);
                }
                perfMonitor.recordMetric('Export', 'slowFrame', frameTime, {
                    frame: frameNum,
                    seekTime
                });
            }

            // Log every 60 frames or every 2 seconds
            const now = performance.now();
            if (frameNum % 60 === 0 || now - lastLogTime > 2000) {
                const fps = 60 / ((now - lastLogTime) / 1000);
                console.log(`[Export] Progress: ${frameNum}/${totalFrames} frames, ${fps.toFixed(1)} effective fps`);
                lastLogTime = now;
            }

            frameNum++;

            // Yield to event loop (adjustable delay)
            setTimeout(renderNextFrame, 0);
        };

        // Start
        renderNextFrame();
    }

    private async sendAudio(
        options: ExportOptions,
        durationSec: number,
        timelineState: ReturnType<typeof useTimelineStore.getState>
    ): Promise<void> {
        if (!this.worker) return;

        const sampleRate = options.audioSampleRate;
        const totalSamples = Math.ceil(durationSec * sampleRate);

        console.log('[Export] Processing audio:', {
            sampleRate,
            totalSamples,
            duration: `${durationSec.toFixed(2)}s`
        });

        // Create separate channel buffers
        const leftChannel = new Float32Array(totalSamples);
        const rightChannel = new Float32Array(totalSamples);

        let clipsWithAudio = 0;

        // Mix audio from all clips
        for (const track of timelineState.tracks) {
            for (const segment of track.segments) {
                if (segment.type !== 'clip') continue;

                const clip = timelineState.clips.get(segment.clipId);
                if (!clip) continue;

                const asset = timelineState.assets.get(clip.assetId);
                if (!asset) continue;

                const audioBuffer = audioSystem.getBufferForAsset(asset.id);
                if (!audioBuffer) continue;

                clipsWithAudio++;

                const clipStartSec = segment.start / 1_000_000;
                const clipDurSec = segment.duration / 1_000_000;
                const srcStartSec = clip.srcStart / 1_000_000;

                const destStartSample = Math.floor(clipStartSec * sampleRate);
                const numSamples = Math.floor(clipDurSec * sampleRate);
                const srcStartSample = Math.floor(srcStartSec * audioBuffer.sampleRate);

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

        console.log(`[Export] Mixed ${clipsWithAudio} clips with audio`);

        // Normalize
        let maxSample = 0;
        for (let i = 0; i < totalSamples; i++) {
            leftChannel[i] = Math.max(-1, Math.min(1, leftChannel[i]));
            rightChannel[i] = Math.max(-1, Math.min(1, rightChannel[i]));
            maxSample = Math.max(maxSample, Math.abs(leftChannel[i]), Math.abs(rightChannel[i]));
        }
        console.log(`[Export] Audio peak level: ${(maxSample * 100).toFixed(1)}%`);

        // Send to worker
        this.worker.postMessage({
            type: 'audio',
            leftChannel,
            rightChannel,
            sampleRate,
            totalSamples
        }, [leftChannel.buffer, rightChannel.buffer]);
    }

    private printPerformanceReport(blob: Blob, totalFrames: number): void {
        if (!this.stats) return;

        const totalTime = performance.now() - this.stats.totalStartTime;
        const avgFrameTime = this.stats.frameRenderTimes.length > 0
            ? this.stats.frameRenderTimes.reduce((a, b) => a + b, 0) / this.stats.frameRenderTimes.length
            : 0;
        const avgSeekTime = this.stats.frameSeekTimes.length > 0
            ? this.stats.frameSeekTimes.reduce((a, b) => a + b, 0) / this.stats.frameSeekTimes.length
            : 0;
        const avgBitmapTime = this.stats.bitmapCreateTimes.length > 0
            ? this.stats.bitmapCreateTimes.reduce((a, b) => a + b, 0) / this.stats.bitmapCreateTimes.length
            : 0;
        const maxFrameTime = Math.max(...this.stats.frameRenderTimes, 0);

        console.log('╔════════════════════════════════════════════════════════════╗');
        console.log('║              EXPORT COMPLETE - PERFORMANCE REPORT           ║');
        console.log('╠════════════════════════════════════════════════════════════╣');
        console.log(`║ Output size:     ${(blob.size / 1024 / 1024).toFixed(2)} MB`);
        console.log(`║ Total time:      ${(totalTime / 1000).toFixed(2)}s`);
        console.log(`║ Total frames:    ${totalFrames}`);
        console.log(`║ Effective FPS:   ${(totalFrames / (totalTime / 1000)).toFixed(1)}`);
        console.log('╠════════════════════════════════════════════════════════════╣');
        console.log(`║ Avg frame time:   ${avgFrameTime.toFixed(2)}ms`);
        console.log(`║ Avg seek time:    ${avgSeekTime.toFixed(2)}ms`);
        console.log(`║ Avg bitmap time:  ${avgBitmapTime.toFixed(2)}ms`);
        console.log(`║ Max frame time:   ${maxFrameTime.toFixed(2)}ms`);
        console.log(`║ Slow frames:      ${this.stats.slowFrames} (>${50}ms)`);
        console.log('╠════════════════════════════════════════════════════════════╣');
        console.log(`║ Worker init:      ${this.stats.workerInitTime.toFixed(0)}ms`);
        console.log(`║ Audio process:    ${this.stats.audioProcessTime.toFixed(0)}ms`);
        console.log('╠════════════════════════════════════════════════════════════╣');

        // Tuning recommendations
        console.log('║ TUNING RECOMMENDATIONS:');
        if (avgSeekTime > 30) {
            console.log('║ ⚠️ High seek time - video decoding is slow');
            console.log('║    → Consider using proxy videos (720p)');
        }
        if (this.stats.slowFrames > totalFrames * 0.1) {
            console.log('║ ⚠️ Many slow frames - CPU bottleneck');
            console.log('║    → Try lower resolution export');
        }
        if (avgBitmapTime > 10) {
            console.log('║ ⚠️ Bitmap creation slow');
            console.log('║    → GPU may be overloaded');
        }
        if (totalTime / 1000 > totalFrames / 30 * 3) {
            console.log('║ ⚠️ Export taking 3x longer than realtime');
            console.log('║    → Consider reducing quality settings');
        }
        console.log('╚════════════════════════════════════════════════════════════╝');
    }

    private drawVideoFit(ctx: OffscreenCanvasRenderingContext2D, video: HTMLVideoElement, canvasW: number, canvasH: number): void {
        const videoW = video.videoWidth;
        const videoH = video.videoHeight;
        if (!videoW || !videoH) return;

        const videoAR = videoW / videoH;
        const canvasAR = canvasW / canvasH;

        let drawW: number, drawH: number, drawX: number, drawY: number;

        if (videoAR > canvasAR) {
            drawW = canvasW;
            drawH = canvasW / videoAR;
            drawX = 0;
            drawY = (canvasH - drawH) / 2;
        } else {
            drawH = canvasH;
            drawW = canvasH * videoAR;
            drawX = (canvasW - drawW) / 2;
            drawY = 0;
        }

        ctx.drawImage(video, drawX, drawY, drawW, drawH);
    }

    /**
     * Reliable video seek - waits for both 'seeked' and frame ready
     * Longer timeout ensures frame is fully decoded before capture
     */
    private waitForVideoSeekReliable(video: HTMLVideoElement, _targetTime: number): Promise<void> {
        return new Promise((resolve) => {
            let resolved = false;

            const finish = () => {
                if (resolved) return;
                resolved = true;
                video.removeEventListener('seeked', onSeeked);
                video.removeEventListener('canplay', onCanPlay);
                resolve();
            };

            const onSeeked = () => {
                // After seek, check if frame is ready
                if (video.readyState >= 3) { // HAVE_FUTURE_DATA
                    finish();
                }
                // If not ready, wait for canplay
            };

            const onCanPlay = () => {
                finish();
            };

            video.addEventListener('seeked', onSeeked);
            video.addEventListener('canplay', onCanPlay);

            // If already ready, resolve immediately
            if (video.readyState >= 3) {
                finish();
                return;
            }

            // Longer timeout (500ms) to ensure proper decoding
            setTimeout(finish, 500);
        });
    }

    /**
     * Preload all videos to ensure they're fully buffered before export
     */
    private async preloadVideos(
        timelineState: ReturnType<typeof useTimelineStore.getState>
    ): Promise<void> {
        const videos: HTMLVideoElement[] = [];

        timelineState.assets.forEach((asset) => {
            if (asset.videoElement) {
                videos.push(asset.videoElement);
            }
        });

        console.log(`[Export] Preloading ${videos.length} video(s)...`);

        await Promise.all(videos.map(video => this.ensureVideoLoaded(video)));
    }

    /**
     * Ensure a single video is fully loaded and ready for random access
     */
    private ensureVideoLoaded(video: HTMLVideoElement): Promise<void> {
        return new Promise((resolve) => {
            // If already have enough data, resolve immediately
            if (video.readyState >= 4) { // HAVE_ENOUGH_DATA
                console.log(`[Export] Video already loaded: ${video.videoWidth}x${video.videoHeight}`);
                resolve();
                return;
            }

            // Force loading by playing briefly then pausing
            const wasPlaying = !video.paused;
            video.muted = true; // Prevent audio during preload

            const onCanPlay = () => {
                video.removeEventListener('canplaythrough', onCanPlay);
                video.pause();
                video.muted = false;
                console.log(`[Export] Video ready: ${video.videoWidth}x${video.videoHeight}, state=${video.readyState}`);
                resolve();
            };

            video.addEventListener('canplaythrough', onCanPlay);

            // Try to trigger loading
            video.currentTime = 0;
            video.play().catch(() => {
                // If autoplay is blocked, try just loading
                video.load();
            });

            // Timeout fallback
            setTimeout(() => {
                video.removeEventListener('canplaythrough', onCanPlay);
                if (!wasPlaying) video.pause();
                console.warn(`[Export] Video preload timeout, state=${video.readyState}`);
                resolve();
            }, 5000);
        });
    }

    private reportProgress(progress: ExportProgress): void {
        if (this.onProgress) {
            this.onProgress(progress);
        }
    }

    cancel(): void {
        console.log('[Export] ⚠️ Export cancelled by user');
        this.cancelled = true;
        this.cleanup();
    }

    private cleanup(): void {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
        this.stats = null;
    }
}

export const exportManager = new ExportManager();
