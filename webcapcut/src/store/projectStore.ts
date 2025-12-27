/**
 * Project Settings Store
 * Manages project-level settings like resolution, frame rate, etc.
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

// Aspect ratio presets with common resolutions
export const ASPECT_RATIO_PRESETS = {
    '16:9': { width: 1920, height: 1080, label: 'Landscape (YouTube)' },
    '9:16': { width: 1080, height: 1920, label: 'Portrait (TikTok/Reels)' },
    '1:1': { width: 1080, height: 1080, label: 'Square (Instagram)' },
    '4:5': { width: 1080, height: 1350, label: 'Portrait 4:5 (Instagram)' },
    '4:3': { width: 1440, height: 1080, label: 'Classic 4:3' },
} as const;

export type AspectRatioKey = keyof typeof ASPECT_RATIO_PRESETS;

export interface ProjectSettings {
    name: string;
    fps: number;
    width: number;
    height: number;
    aspectRatio: AspectRatioKey | 'custom';
    backgroundColor: string;
}

interface ProjectState {
    settings: ProjectSettings;
}

interface ProjectActions {
    setResolution: (aspectRatio: AspectRatioKey | 'custom', width: number, height: number) => void;
    setFps: (fps: number) => void;
    setProjectName: (name: string) => void;
    setBackgroundColor: (color: string) => void;
    setCustomResolution: (width: number, height: number) => void;
}

const DEFAULT_SETTINGS: ProjectSettings = {
    name: 'Untitled Project',
    fps: 30,
    width: 1920,
    height: 1080,
    aspectRatio: '16:9',
    backgroundColor: '#000000',
};

export const useProjectStore = create<ProjectState & ProjectActions>()(
    subscribeWithSelector((set) => ({
        settings: { ...DEFAULT_SETTINGS },

        setResolution: (aspectRatio, width, height) => {
            set(state => ({
                settings: {
                    ...state.settings,
                    aspectRatio,
                    width,
                    height,
                },
            }));
            console.log(`[Project] Resolution changed: ${width}x${height} (${aspectRatio})`);
        },

        setFps: (fps) => {
            set(state => ({
                settings: { ...state.settings, fps },
            }));
            console.log(`[Project] FPS changed: ${fps}`);
        },

        setProjectName: (name) => {
            set(state => ({
                settings: { ...state.settings, name },
            }));
        },

        setBackgroundColor: (color) => {
            set(state => ({
                settings: { ...state.settings, backgroundColor: color },
            }));
        },

        setCustomResolution: (width, height) => {
            set(state => ({
                settings: {
                    ...state.settings,
                    aspectRatio: 'custom',
                    width,
                    height,
                },
            }));
            console.log(`[Project] Custom resolution: ${width}x${height}`);
        },
    }))
);

/**
 * Calculate aspect ratio from dimensions
 */
export function calculateAspectRatio(width: number, height: number): string {
    const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
    const divisor = gcd(width, height);
    return `${width / divisor}:${height / divisor}`;
}

/**
 * Get dimensions that fit within a container while maintaining aspect ratio
 */
export function getFitDimensions(
    containerWidth: number,
    containerHeight: number,
    contentWidth: number,
    contentHeight: number
): { width: number; height: number; x: number; y: number } {
    const containerRatio = containerWidth / containerHeight;
    const contentRatio = contentWidth / contentHeight;

    let width: number, height: number;

    if (contentRatio > containerRatio) {
        // Content is wider - fit to width
        width = containerWidth;
        height = containerWidth / contentRatio;
    } else {
        // Content is taller - fit to height
        height = containerHeight;
        width = containerHeight * contentRatio;
    }

    return {
        width,
        height,
        x: (containerWidth - width) / 2,
        y: (containerHeight - height) / 2,
    };
}
