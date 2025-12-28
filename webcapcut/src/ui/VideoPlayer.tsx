/**
 * VideoPlayer - Multi-track video playback with 2D compositing
 * Now supports rendering multiple video layers simultaneously
 */
import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { CompositeRenderer, VideoLayer, getCompositeRenderer } from '../core/CompositeRenderer';
import { usePlaybackStore } from '../store/playbackStore';
import { useTimelineStore } from '../store/timelineStore';
import { useProjectStore } from '../store/projectStore';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { PlaybackControls } from './controls/PlaybackControls';
import { TransformOverlay } from './preview/TransformOverlay';
import { TransformPreview } from './preview/TransformPreview';
import { CanvasGuides } from './preview/CanvasGuides';
import { FrameBoundary } from './preview/FrameBoundary';
import { audioSystem } from '../core/AudioSystem';
import { perfMonitor } from '../utils/PerformanceMonitor';

export function VideoPlayer() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [status, setStatus] = useState<string>('Ready');
    const [error, setError] = useState<string | null>(null);
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
    const setDuration = usePlaybackStore(state => state.setDuration);
    const rendererRef = useRef<CompositeRenderer | null>(null);

    // Store refs for active layers - updated by sync effect
    const activeLayersRef = useRef<VideoLayer[]>([]);

    // Get active clips from timeline
    const getActiveClips = useTimelineStore(state => state.getActiveClips);
    const timelineDuration = useTimelineStore(state => state.duration);
    const tracks = useTimelineStore(state => state.tracks);

    // Get project resolution
    const projectWidth = useProjectStore(state => state.settings.width);
    const projectHeight = useProjectStore(state => state.settings.height);

    // Track container size with ResizeObserver
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const observer = new ResizeObserver(entries => {
            const { width, height } = entries[0].contentRect;
            setContainerSize({ width, height });
        });

        observer.observe(container);
        return () => observer.disconnect();
    }, []);

    // Calculate display size maintaining aspect ratio
    const displaySize = useMemo(() => {
        if (containerSize.width === 0 || containerSize.height === 0) {
            return { width: 640, height: 360 };
        }

        const containerAspect = containerSize.width / containerSize.height;
        const projectAspect = projectWidth / projectHeight;

        let displayWidth: number, displayHeight: number;

        if (containerAspect > projectAspect) {
            displayHeight = Math.min(containerSize.height * 0.95, projectHeight);
            displayWidth = displayHeight * projectAspect;
        } else {
            displayWidth = Math.min(containerSize.width * 0.95, projectWidth);
            displayHeight = displayWidth / projectAspect;
        }

        return {
            width: Math.floor(displayWidth),
            height: Math.floor(displayHeight)
        };
    }, [containerSize, projectWidth, projectHeight]);

    // Enable keyboard shortcuts
    useKeyboardShortcuts();

    // Build video layers from active clips - memoized for efficiency
    const buildVideoLayers = useCallback((currentTime: number): VideoLayer[] => {
        const activeClips = getActiveClips(currentTime);

        // Debug: Log active clips from store
        console.log(`[VideoPlayer] 🔍 getActiveClips returned ${activeClips.length} clips at time ${(currentTime / 1_000_000).toFixed(2)}s`);
        activeClips.forEach((c, i) => {
            console.log(`  Clip ${i}: track=${c.track.id}, asset=${c.asset.id}, type=${c.track.type}, hasVideo=${!!c.asset.videoElement}`);
        });

        if (activeClips.length === 0) {
            return [];
        }

        // Build layer array with debug validation
        const layers: VideoLayer[] = [];

        for (const clipData of activeClips) {
            const { track, asset, clip } = clipData;

            // Validate video element
            if (!asset.videoElement) {
                console.warn(`[VideoPlayer] ⚠️ No videoElement for asset: ${asset.id}`);
                continue;
            }

            // Get track index (for layer ordering)
            const trackIndex = tracks.findIndex(t => t.id === track.id);
            if (trackIndex === -1) {
                console.warn(`[VideoPlayer] ⚠️ Track not found: ${track.id}`);
                continue;
            }

            // Only include video tracks
            if (track.type !== 'video') {
                console.log(`[VideoPlayer] ⏭️ Skipping non-video track: ${track.id} (type=${track.type})`);
                continue;
            }

            const layer: VideoLayer = {
                video: asset.videoElement,
                trackIndex,
                transform: clip.transform,
                assetId: asset.id,
                clipId: clip.id
            };

            layers.push(layer);
            console.log(`[VideoPlayer] ✅ Added layer: trackIndex=${trackIndex}, asset=${asset.id}`);
        }

        console.log(`[VideoPlayer] 📊 Final layer count: ${layers.length}`);
        return layers;
    }, [getActiveClips, tracks]);

    // Sync playback with timeline - updates all active videos
    useEffect(() => {
        let lastAudioUpdate = 0;

        const unsubscribe = usePlaybackStore.subscribe((state) => {
            const syncStart = performance.now();

            // Build layers for current time
            const layers = buildVideoLayers(state.currentTime);
            activeLayersRef.current = layers;

            // Sync each video element
            for (const layer of layers) {
                const video = layer.video;

                // Get clip data for time calculation
                const activeClips = getActiveClips(state.currentTime);
                const clipData = activeClips.find(c => c.asset.id === layer.assetId);

                if (!clipData) continue;

                // Calculate local time in source video
                const clipLocalTime = (state.currentTime - clipData.segment.start + clipData.clip.srcStart) / 1_000_000;

                // Sync video time (threshold 0.3s)
                const timeDiff = Math.abs(video.currentTime - clipLocalTime);
                if (timeDiff > 0.3) {
                    video.currentTime = Math.max(0, Math.min(clipLocalTime, video.duration || Infinity));
                }

                // Sync play state
                if (state.isPlaying && video.paused) {
                    video.playbackRate = state.playbackRate;
                    video.play().catch(() => { });
                } else if (!state.isPlaying && !video.paused) {
                    video.pause();
                }

                // Sync playback rate
                if (video.playbackRate !== state.playbackRate) {
                    video.playbackRate = state.playbackRate;
                }
            }

            // Multi-track audio update (throttled)
            const now = performance.now();
            if (state.isPlaying && now - lastAudioUpdate > 100) {
                lastAudioUpdate = now;

                const activeClips = getActiveClips(state.currentTime);
                const audioClipData = activeClips
                    .filter(c => audioSystem.hasAudioForAsset(c.asset.id))
                    .map(c => ({
                        assetId: c.asset.id,
                        localTime: (state.currentTime - c.segment.start + c.clip.srcStart) / 1_000_000
                    }));

                if (!audioSystem.isPlaying()) {
                    audioSystem.play();
                }
                audioSystem.updateActiveClips(audioClipData);
            } else if (!state.isPlaying && audioSystem.isPlaying()) {
                audioSystem.stop();
            }

            const syncTime = performance.now() - syncStart;
            if (syncTime > 10) {
                perfMonitor.recordMetric('VideoPlayer', 'syncLoop', syncTime, { layers: layers.length });
            }
        });

        return unsubscribe;
    }, [buildVideoLayers, getActiveClips]);

    // Update duration from timeline
    useEffect(() => {
        if (timelineDuration > 0) {
            setDuration(timelineDuration);
        }
    }, [timelineDuration, setDuration]);

    // Initialize CompositeRenderer
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        try {
            setStatus('Initializing...');

            const renderer = getCompositeRenderer();
            renderer.init(canvas);
            rendererRef.current = renderer;

            // Start render loop - pass layer getter function
            renderer.startRenderLoop(() => activeLayersRef.current);

            setStatus('');
            console.log('[VideoPlayer] ✅ CompositeRenderer initialized');
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            console.error('[VideoPlayer] ❌ Init error:', errorMessage);
            setError(errorMessage);
            setStatus('Error');
        }

        return () => {
            rendererRef.current?.stop();
        };
    }, []);

    return (
        <div className="flex flex-col w-full h-full">
            {/* Status/Error bar */}
            {(status || error) && (
                <div className={`px-4 py-1 text-xs ${error ? 'bg-red-600' : 'bg-gray-800'} text-white`}>
                    {error ? `Error: ${error}` : status}
                </div>
            )}

            {/* Video canvas container */}
            <div
                ref={containerRef}
                className="flex-1 flex items-center justify-center bg-black overflow-hidden"
            >
                {/* Wrapper for canvas + overlays */}
                <div className="relative">
                    <canvas
                        ref={canvasRef}
                        width={projectWidth}
                        height={projectHeight}
                        className="shadow-2xl"
                        style={{
                            width: `${displaySize.width}px`,
                            height: `${displaySize.height}px`,
                            border: '1px solid #444',
                        }}
                    />
                    {/* Frame boundary - ALWAYS visible */}
                    <FrameBoundary
                        displayWidth={displaySize.width}
                        displayHeight={displaySize.height}
                    />
                    {/* Canvas guides (only when clip selected) */}
                    <CanvasGuides
                        displayWidth={displaySize.width}
                        displayHeight={displaySize.height}
                    />
                    {/* Transform preview (for selected clip) */}
                    <TransformPreview
                        canvasWidth={projectWidth}
                        canvasHeight={projectHeight}
                        displayWidth={displaySize.width}
                        displayHeight={displaySize.height}
                    />
                    {/* Transform overlay (handles) */}
                    <TransformOverlay
                        canvasWidth={projectWidth}
                        canvasHeight={projectHeight}
                        displayScale={displaySize.width / projectWidth}
                    />
                </div>
            </div>

            {/* Playback controls */}
            <PlaybackControls />
        </div>
    );
}
