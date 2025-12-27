import { useEffect, useRef, useState, useMemo } from 'react';
import { WebGPUContext } from '../core/WebGPUContext';
import { CanvasRenderer } from '../core/CanvasRenderer';
import { usePlaybackStore } from '../store/playbackStore';
import { useTimelineStore } from '../store/timelineStore';
import { useProjectStore } from '../store/projectStore';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { PlaybackControls } from './controls/PlaybackControls';
import videoShaderCode from '../core/shaders/video.wgsl?raw';
import { audioSystem } from '../core/AudioSystem';

export function VideoPlayer() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [status, setStatus] = useState<string>('Ready');
    const [error, setError] = useState<string | null>(null);
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
    const setDuration = usePlaybackStore(state => state.setDuration);
    const rendererRef = useRef<CanvasRenderer | null>(null);
    const gpuRef = useRef<WebGPUContext | null>(null);

    // Get active clips from timeline
    const getActiveClips = useTimelineStore(state => state.getActiveClips);
    const timelineDuration = useTimelineStore(state => state.duration);

    // Get project resolution
    const projectWidth = useProjectStore(state => state.settings.width);
    const projectHeight = useProjectStore(state => state.settings.height);

    // Current active video element
    const activeVideoRef = useRef<HTMLVideoElement | null>(null);

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

    // Calculate display size that fits within container while maintaining aspect ratio
    const displaySize = useMemo(() => {
        // Add padding for visual breathing room
        const padding = 32;
        const availableWidth = Math.max(100, containerSize.width - padding);
        const availableHeight = Math.max(100, containerSize.height - padding);

        if (!availableWidth || !availableHeight) {
            return { width: projectWidth, height: projectHeight };
        }

        const containerAR = availableWidth / availableHeight;
        const projectAR = projectWidth / projectHeight;

        let displayWidth: number, displayHeight: number;

        if (projectAR > containerAR) {
            // Project is wider - fit to container width
            displayWidth = availableWidth;
            displayHeight = availableWidth / projectAR;
        } else {
            // Project is taller - fit to container height
            displayHeight = availableHeight;
            displayWidth = availableHeight * projectAR;
        }

        return {
            width: Math.floor(displayWidth),
            height: Math.floor(displayHeight)
        };
    }, [containerSize, projectWidth, projectHeight]);

    // Enable keyboard shortcuts
    useKeyboardShortcuts();

    // Sync playback with timeline clips
    useEffect(() => {
        const unsubscribe = usePlaybackStore.subscribe((state) => {
            const activeClips = getActiveClips(state.currentTime);

            // Get first video clip's video element (for preview rendering)
            const firstVideoClip = activeClips.find(c => c.track.type === 'video');

            if (firstVideoClip && firstVideoClip.asset.videoElement) {
                const video = firstVideoClip.asset.videoElement;
                activeVideoRef.current = video;

                // Calculate time within clip (local time in source video)
                const clipLocalTime = (state.currentTime - firstVideoClip.segment.start + firstVideoClip.clip.srcStart) / 1_000_000;

                // Sync video time
                if (Math.abs(video.currentTime - clipLocalTime) > 0.1) {
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
            } else {
                // No active clip - pause any playing video
                if (activeVideoRef.current && !activeVideoRef.current.paused) {
                    activeVideoRef.current.pause();
                }
                activeVideoRef.current = null;
            }

            // Multi-track audio: collect ALL active clips with audio
            const audioClipData = activeClips
                .filter(c => audioSystem.hasAudioForAsset(c.asset.id))
                .map(c => ({
                    assetId: c.asset.id,
                    localTime: (state.currentTime - c.segment.start + c.clip.srcStart) / 1_000_000
                }));

            if (state.isPlaying) {
                if (!audioSystem.isPlaying()) {
                    audioSystem.play();
                }
                // Update all active audio sources
                audioSystem.updateActiveClips(audioClipData);
            } else {
                if (audioSystem.isPlaying()) {
                    audioSystem.stop();
                }
            }
        });
        return unsubscribe;
    }, [getActiveClips]);

    // Update duration from timeline
    useEffect(() => {
        if (timelineDuration > 0) {
            setDuration(timelineDuration);
        }
    }, [timelineDuration, setDuration]);

    // Reset transform when resolution changes
    useEffect(() => {
        if (rendererRef.current) {
            rendererRef.current.resetTransformCache();
        }
    }, [projectWidth, projectHeight]);

    // Initialize WebGPU and renderer
    useEffect(() => {
        let mounted = true;

        async function init() {
            try {
                const canvas = canvasRef.current;
                if (!canvas) return;

                setStatus('Initializing WebGPU...');
                const gpu = await WebGPUContext.init(canvas);
                gpuRef.current = gpu;

                const renderer = new CanvasRenderer();
                await renderer.init(gpu, videoShaderCode);
                rendererRef.current = renderer;

                // Start render loop - get video from active clip
                renderer.startRenderLoop(gpu, () => activeVideoRef.current);

                if (mounted) {
                    setStatus('');
                    console.log('[VideoPlayer] ✅ Initialized');
                }
            } catch (err) {
                if (mounted) {
                    const errorMessage = err instanceof Error ? err.message : String(err);
                    console.error('[VideoPlayer] Error:', errorMessage);
                    setError(errorMessage);
                    setStatus('Error');
                }
            }
        }

        init();

        return () => {
            mounted = false;
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

            {/* Video canvas container - tracks available space */}
            <div
                ref={containerRef}
                className="flex-1 flex items-center justify-center bg-black overflow-hidden"
            >
                <canvas
                    ref={canvasRef}
                    // Internal resolution for GPU rendering quality
                    width={projectWidth}
                    height={projectHeight}
                    className="shadow-2xl"
                    style={{
                        // Display size - fits within container
                        width: `${displaySize.width}px`,
                        height: `${displaySize.height}px`,
                        // Border to show aspect ratio boundaries
                        border: '1px solid #444',
                    }}
                />
            </div>

            {/* Mini controls */}
            <PlaybackControls />
        </div>
    );
}
