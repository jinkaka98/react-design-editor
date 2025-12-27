import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

interface PlaybackState {
    // State
    isPlaying: boolean;
    currentTime: number; // in microseconds
    duration: number;
    playbackRate: number;

    // Actions
    play: () => void;
    pause: () => void;
    togglePlayPause: () => void;
    seek: (time: number) => void;
    setDuration: (duration: number) => void;
    setPlaybackRate: (rate: number) => void;

    // Transient update (no re-render for most subscribers)
    updateCurrentTime: (time: number) => void;
}

export const usePlaybackStore = create<PlaybackState>()(
    subscribeWithSelector((set, get) => ({
        // Initial state
        isPlaying: false,
        currentTime: 0,
        duration: 0,
        playbackRate: 1.0,

        // Actions
        play: () => {
            console.log('[PlaybackStore] Play');
            set({ isPlaying: true });
        },

        pause: () => {
            console.log('[PlaybackStore] Pause');
            set({ isPlaying: false });
        },

        togglePlayPause: () => {
            const { isPlaying } = get();
            console.log('[PlaybackStore] Toggle:', !isPlaying);
            set({ isPlaying: !isPlaying });
        },

        seek: (time: number) => {
            const { duration } = get();
            const clampedTime = Math.max(0, Math.min(duration, time));
            console.log('[PlaybackStore] Seek to:', clampedTime / 1_000_000, 's');
            set({ currentTime: clampedTime });
        },

        setDuration: (duration: number) => {
            console.log('[PlaybackStore] Set duration:', duration / 1_000_000, 's');
            set({ duration });
        },

        setPlaybackRate: (rate: number) => {
            console.log('[PlaybackStore] Set playback rate:', rate);
            set({ playbackRate: rate });
        },

        // Update current time (called frequently during playback)
        updateCurrentTime: (time: number) => {
            set({ currentTime: time });
        },
    }))
);
