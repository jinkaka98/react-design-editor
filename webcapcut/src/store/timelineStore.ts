import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type {
    Track,
    ClipData,
    Asset,
    TimelineState,
    ClipSegment,
    ClipTransform
} from '../types/timeline';
import {
    generateId,
    getTrackDuration,
    getSegmentEnd,
    insertClipAtTime,
    removeClipSegment,
    rippleDeleteClipSegment,
    moveClipSegment,
    getClipDuration,
} from '../types/timeline';

interface TimelineActions {
    // Track actions
    addTrack: (type: 'video' | 'audio') => void;
    removeTrack: (trackId: string) => void;
    setTrackMuted: (trackId: string, muted: boolean) => void;
    setTrackSolo: (trackId: string, solo: boolean) => void;
    setTrackLocked: (trackId: string, locked: boolean) => void;
    setTrackVolume: (trackId: string, volume: number) => void;

    // Clip actions
    addClip: (trackId: string, clip: Omit<ClipData, 'id'>) => string;
    removeClip: (trackId: string, segmentId: string) => void;
    rippleDeleteClip: (trackId: string, segmentId: string) => void;
    moveClip: (fromTrackId: string, toTrackId: string, segmentId: string, newTimelineStart: number) => boolean;
    setClipTransform: (clipId: string, transform: Partial<ClipTransform>) => void;
    selectClip: (clipId: string | null) => void;

    // Asset actions
    addAsset: (asset: Asset) => void;
    removeAsset: (assetId: string) => void;
    getAsset: (assetId: string) => Asset | undefined;

    // Selection
    selectSegment: (segmentId: string | null) => void;
    selectTrack: (trackId: string | null) => void;

    // Timeline navigation
    setZoom: (zoom: number) => void;
    setScrollX: (scrollX: number) => void;
    setScrollY: (scrollY: number) => void;

    // Computed
    getActiveClips: (currentTime: number) => { clip: ClipData; track: Track; asset: Asset; segment: ClipSegment }[];
    updateDuration: () => void;
    getClipById: (clipId: string) => ClipData | undefined;
}

type TimelineStore = TimelineState & TimelineActions;

const DEFAULT_TRACK_HEIGHT = 80;

export const useTimelineStore = create<TimelineStore>()(
    subscribeWithSelector((set, get) => ({
        // Initial state
        tracks: [
            {
                id: 'v1',
                type: 'video',
                name: 'V1',
                segments: [], // Empty track with no segments
                muted: false,
                solo: false,
                locked: false,
                height: DEFAULT_TRACK_HEIGHT,
                volume: 1.0
            },
        ],
        assets: new Map(),
        clips: new Map(),
        selectedSegmentId: null,
        selectedTrackId: null,
        selectedClipId: null as string | null, // For transform overlay
        duration: 0,
        zoom: 100, // 100 pixels per second
        scrollX: 0,
        scrollY: 0,

        // Track actions
        addTrack: (type) => {
            const tracks = get().tracks;
            const typeCount = tracks.filter(t => t.type === type).length;
            const prefix = type === 'video' ? 'V' : 'A';

            set({
                tracks: [...tracks, {
                    id: generateId(),
                    type,
                    name: `${prefix}${typeCount + 1} `,
                    segments: [],
                    muted: false,
                    solo: false,
                    locked: false,
                    height: DEFAULT_TRACK_HEIGHT,
                    volume: 1.0
                }]
            });
        },

        removeTrack: (trackId) => {
            set({
                tracks: get().tracks.filter(t => t.id !== trackId)
            });
        },

        setTrackMuted: (trackId, muted) => {
            set({
                tracks: get().tracks.map(t =>
                    t.id === trackId ? { ...t, muted } : t
                )
            });
        },

        setTrackSolo: (trackId, solo) => {
            set({
                tracks: get().tracks.map(t =>
                    t.id === trackId ? { ...t, solo } : t
                )
            });
        },

        setTrackLocked: (trackId, locked) => {
            set({
                tracks: get().tracks.map(t =>
                    t.id === trackId ? { ...t, locked } : t
                )
            });
        },

        setTrackVolume: (trackId, volume) => {
            const clampedVolume = Math.max(0, Math.min(1, volume));
            set({
                tracks: get().tracks.map(t =>
                    t.id === trackId ? { ...t, volume: clampedVolume } : t
                )
            });
        },

        // Clip actions
        addClip: (trackId, clipData) => {
            const clipId = generateId();
            const newClip: ClipData = { ...clipData, id: clipId };
            const duration = getClipDuration(newClip);

            // Get timelineStart - for backwards compatibility, check if it exists
            // @ts-expect-error - timelineStart from old API
            const timelineStart = clipData.timelineStart ?? 0;

            // Add clip to clips registry
            const clips = new Map(get().clips);
            clips.set(clipId, newClip);

            // Insert clip segment into track
            set({
                clips,
                tracks: get().tracks.map(t => {
                    if (t.id !== trackId) return t;

                    const newSegments = insertClipAtTime(
                        t.segments,
                        clipId,
                        timelineStart,
                        duration
                    );

                    return { ...t, segments: newSegments };
                })
            });

            get().updateDuration();
            console.log('[Timeline] Added clip:', clipId);
            return clipId;
        },

        removeClip: (trackId, segmentId) => {
            set({
                tracks: get().tracks.map(t =>
                    t.id === trackId
                        ? { ...t, segments: removeClipSegment(t.segments, segmentId) }
                        : t
                ),
                selectedSegmentId: get().selectedSegmentId === segmentId ? null : get().selectedSegmentId
            });
            get().updateDuration();
            console.log('[Timeline] Removed clip (replaced with gap):', segmentId);
        },

        rippleDeleteClip: (trackId, segmentId) => {
            set({
                tracks: get().tracks.map(t =>
                    t.id === trackId
                        ? { ...t, segments: rippleDeleteClipSegment(t.segments, segmentId) }
                        : t
                ),
                selectedSegmentId: get().selectedSegmentId === segmentId ? null : get().selectedSegmentId
            });
            get().updateDuration();
            console.log('[Timeline] Ripple deleted clip:', segmentId);
        },

        moveClip: (fromTrackId, toTrackId, segmentId, newTimelineStart) => {
            const state = get();
            const fromTrack = state.tracks.find(t => t.id === fromTrackId);
            const segment = fromTrack?.segments.find(s => s.id === segmentId);

            if (!segment || segment.type !== 'clip') {
                console.warn('[Timeline] Cannot move: segment not found');
                return false;
            }

            if (fromTrackId === toTrackId) {
                // Move within same track
                set({
                    tracks: state.tracks.map(t => {
                        if (t.id !== fromTrackId) return t;
                        return {
                            ...t,
                            segments: moveClipSegment(t.segments, segmentId, Math.max(0, newTimelineStart))
                        };
                    })
                });
            } else {
                // Move between tracks
                const clip = state.clips.get(segment.clipId);
                if (!clip) return false;

                // Remove from source track
                const fromSegments = removeClipSegment(fromTrack!.segments, segmentId);

                // Get target track
                const toTrack = state.tracks.find(t => t.id === toTrackId);
                if (!toTrack) return false;

                // Insert into target track
                const toSegments = insertClipAtTime(
                    toTrack.segments,
                    segment.clipId,
                    Math.max(0, newTimelineStart),
                    segment.duration
                );

                set({
                    tracks: state.tracks.map(t => {
                        if (t.id === fromTrackId) return { ...t, segments: fromSegments };
                        if (t.id === toTrackId) return { ...t, segments: toSegments };
                        return t;
                    })
                });
            }

            get().updateDuration();
            console.log('[Timeline] Moved clip:', segmentId, 'to', newTimelineStart / 1_000_000, 's');
            return true;
        },

        setClipTransform: (clipId, transform) => {
            const clips = new Map(get().clips);
            const clip = clips.get(clipId);
            if (clip) {
                const currentTransform = clip.transform || { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 };
                clips.set(clipId, {
                    ...clip,
                    transform: { ...currentTransform, ...transform }
                });
                set({ clips });
                console.log('[Timeline] Updated clip transform:', clipId, transform);
            }
        },

        selectClip: (clipId) => {
            console.log('[Timeline] selectClip called with:', clipId);
            set({ selectedClipId: clipId });
        },

        // Asset actions
        addAsset: (asset) => {
            const assets = new Map(get().assets);
            assets.set(asset.id, asset);
            set({ assets });
            console.log('[Timeline] Added asset:', asset.id, asset.name);
        },

        removeAsset: (assetId) => {
            const assets = new Map(get().assets);
            assets.delete(assetId);
            set({ assets });
        },

        getAsset: (assetId) => {
            return get().assets.get(assetId);
        },

        getClipById: (clipId) => {
            return get().clips.get(clipId);
        },

        // Selection
        selectSegment: (segmentId) => set({ selectedSegmentId: segmentId }),
        selectTrack: (trackId) => set({ selectedTrackId: trackId }),

        // Timeline navigation
        setZoom: (zoom) => set({ zoom: Math.max(10, Math.min(500, zoom)) }),
        setScrollX: (scrollX) => set({ scrollX: Math.max(0, scrollX) }),
        setScrollY: (scrollY) => set({ scrollY: Math.max(0, scrollY) }),

        // Computed
        getActiveClips: (currentTime) => {
            const state = get();
            const activeClips: { clip: ClipData; track: Track; asset: Asset; segment: ClipSegment }[] = [];

            for (const track of state.tracks) {
                if (track.muted) continue;

                for (const segment of track.segments) {
                    if (segment.type !== 'clip') continue;

                    const segEnd = getSegmentEnd(segment);

                    if (currentTime >= segment.start && currentTime < segEnd) {
                        const clip = state.clips.get(segment.clipId);
                        const asset = clip ? state.assets.get(clip.assetId) : undefined;

                        if (clip && asset) {
                            activeClips.push({ clip, track, asset, segment });
                        }
                    }
                }
            }

            return activeClips;
        },

        updateDuration: () => {
            const state = get();
            let maxEnd = 0;

            for (const track of state.tracks) {
                const trackEnd = getTrackDuration(track);
                if (trackEnd > maxEnd) {
                    maxEnd = trackEnd;
                }
            }

            if (maxEnd !== state.duration) {
                set({ duration: maxEnd });
                console.log('[Timeline] Duration updated:', maxEnd / 1_000_000, 's');
            }
        },
    }))
);
