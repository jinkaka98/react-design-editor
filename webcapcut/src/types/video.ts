export interface AudioConfig {
    codec: string;
    numberOfChannels: number;
    sampleRate: number;
    duration: number; // in microseconds
    timescale: number;
    description?: Uint8Array;
}

export interface VideoConfig {
    codec: string;
    codedWidth: number;
    codedHeight: number;
    description?: Uint8Array;
    duration?: number; // in microseconds
    timescale: number; // track timescale for timestamp conversion
}

export interface MP4Sample {
    is_sync: boolean;
    cts: number;      // in timescale units
    duration: number; // in timescale units
    data: ArrayBuffer;
}

// Export types
export interface ExportOptions {
    width: number;
    height: number;
    frameRate: number;
    videoBitrate: number;  // bits per second
    audioBitrate: number;  // bits per second
    audioSampleRate: number;
}

// Categories for preset organization
export type PresetCategory =
    | 'landscape'    // Horizontal 16:9
    | 'portrait'     // Vertical 9:16
    | 'square'       // 1:1
    | 'mobile'       // Optimized for mobile
    | 'youtube'      // YouTube standard
    | 'youtube-shorts' // YouTube Shorts
    | 'tiktok'       // TikTok
    | 'reels'        // Instagram Reels
    | 'instagram'    // Instagram Feed/Post
    | 'twitter'      // Twitter/X
    | 'linkedin';    // LinkedIn

export interface ExportPreset {
    name: string;
    label: string;
    category: PresetCategory;
    platform?: string;  // Platform icon/name for UI
    options: ExportOptions;
}

export const EXPORT_PRESETS: ExportPreset[] = [
    // ═══════════════════════════════════════════════════════════
    // 📺 LANDSCAPE (16:9)
    // ═══════════════════════════════════════════════════════════
    {
        name: '360p', label: '360p SD', category: 'landscape',
        options: { width: 640, height: 360, frameRate: 30, videoBitrate: 1_000_000, audioBitrate: 96_000, audioSampleRate: 44100 }
    },
    {
        name: '480p', label: '480p SD', category: 'landscape',
        options: { width: 854, height: 480, frameRate: 30, videoBitrate: 2_500_000, audioBitrate: 128_000, audioSampleRate: 44100 }
    },
    {
        name: '720p', label: '720p HD', category: 'landscape',
        options: { width: 1280, height: 720, frameRate: 30, videoBitrate: 5_000_000, audioBitrate: 128_000, audioSampleRate: 48000 }
    },
    {
        name: '1080p', label: '1080p Full HD', category: 'landscape',
        options: { width: 1920, height: 1080, frameRate: 30, videoBitrate: 10_000_000, audioBitrate: 192_000, audioSampleRate: 48000 }
    },
    {
        name: '1440p', label: '1440p 2K QHD', category: 'landscape',
        options: { width: 2560, height: 1440, frameRate: 30, videoBitrate: 25_000_000, audioBitrate: 256_000, audioSampleRate: 48000 }
    },

    // 📱 PORTRAIT (9:16)
    {
        name: '720p-portrait', label: '720p Vertical', category: 'portrait',
        options: { width: 720, height: 1280, frameRate: 30, videoBitrate: 5_000_000, audioBitrate: 128_000, audioSampleRate: 48000 }
    },
    {
        name: '1080p-portrait', label: '1080p Vertical', category: 'portrait',
        options: { width: 1080, height: 1920, frameRate: 30, videoBitrate: 10_000_000, audioBitrate: 192_000, audioSampleRate: 48000 }
    },

    // 🎵 TIKTOK
    {
        name: 'tiktok-720p', label: 'TikTok 720p', category: 'tiktok', platform: 'TikTok',
        options: { width: 720, height: 1280, frameRate: 30, videoBitrate: 6_000_000, audioBitrate: 128_000, audioSampleRate: 44100 }
    },
    {
        name: 'tiktok-1080p', label: 'TikTok 1080p HD', category: 'tiktok', platform: 'TikTok',
        options: { width: 1080, height: 1920, frameRate: 30, videoBitrate: 12_000_000, audioBitrate: 192_000, audioSampleRate: 48000 }
    },

    // 🎬 YOUTUBE
    {
        name: 'youtube-720p', label: 'YouTube 720p', category: 'youtube', platform: 'YouTube',
        options: { width: 1280, height: 720, frameRate: 30, videoBitrate: 8_000_000, audioBitrate: 192_000, audioSampleRate: 48000 }
    },
    {
        name: 'youtube-1080p', label: 'YouTube 1080p', category: 'youtube', platform: 'YouTube',
        options: { width: 1920, height: 1080, frameRate: 30, videoBitrate: 15_000_000, audioBitrate: 256_000, audioSampleRate: 48000 }
    },
    {
        name: 'youtube-1440p', label: 'YouTube 1440p 2K', category: 'youtube', platform: 'YouTube',
        options: { width: 2560, height: 1440, frameRate: 30, videoBitrate: 30_000_000, audioBitrate: 320_000, audioSampleRate: 48000 }
    },

    // ⚡ YOUTUBE SHORTS
    {
        name: 'shorts-720p', label: 'YouTube Shorts 720p', category: 'youtube-shorts', platform: 'Shorts',
        options: { width: 720, height: 1280, frameRate: 30, videoBitrate: 6_000_000, audioBitrate: 128_000, audioSampleRate: 48000 }
    },
    {
        name: 'shorts-1080p', label: 'YouTube Shorts 1080p', category: 'youtube-shorts', platform: 'Shorts',
        options: { width: 1080, height: 1920, frameRate: 30, videoBitrate: 12_000_000, audioBitrate: 192_000, audioSampleRate: 48000 }
    },

    // 📸 INSTAGRAM REELS
    {
        name: 'reels-720p', label: 'Instagram Reels 720p', category: 'reels', platform: 'Reels',
        options: { width: 720, height: 1280, frameRate: 30, videoBitrate: 5_000_000, audioBitrate: 128_000, audioSampleRate: 44100 }
    },
    {
        name: 'reels-1080p', label: 'Instagram Reels 1080p', category: 'reels', platform: 'Reels',
        options: { width: 1080, height: 1920, frameRate: 30, videoBitrate: 10_000_000, audioBitrate: 192_000, audioSampleRate: 48000 }
    },

    // 🟦 INSTAGRAM FEED
    {
        name: 'instagram-square', label: 'Instagram Square (1:1)', category: 'instagram', platform: 'Instagram',
        options: { width: 1080, height: 1080, frameRate: 30, videoBitrate: 8_000_000, audioBitrate: 128_000, audioSampleRate: 44100 }
    },
    {
        name: 'instagram-portrait', label: 'Instagram Portrait (4:5)', category: 'instagram', platform: 'Instagram',
        options: { width: 1080, height: 1350, frameRate: 30, videoBitrate: 10_000_000, audioBitrate: 128_000, audioSampleRate: 44100 }
    },

    // 🐦 TWITTER/X
    {
        name: 'twitter-landscape', label: 'Twitter Landscape', category: 'twitter', platform: 'Twitter',
        options: { width: 1280, height: 720, frameRate: 30, videoBitrate: 5_000_000, audioBitrate: 128_000, audioSampleRate: 44100 }
    },
    {
        name: 'twitter-square', label: 'Twitter Square', category: 'twitter', platform: 'Twitter',
        options: { width: 720, height: 720, frameRate: 30, videoBitrate: 4_000_000, audioBitrate: 128_000, audioSampleRate: 44100 }
    },

    // 💼 LINKEDIN
    {
        name: 'linkedin-landscape', label: 'LinkedIn Landscape', category: 'linkedin', platform: 'LinkedIn',
        options: { width: 1920, height: 1080, frameRate: 30, videoBitrate: 10_000_000, audioBitrate: 192_000, audioSampleRate: 48000 }
    },
    {
        name: 'linkedin-square', label: 'LinkedIn Square', category: 'linkedin', platform: 'LinkedIn',
        options: { width: 1080, height: 1080, frameRate: 30, videoBitrate: 8_000_000, audioBitrate: 192_000, audioSampleRate: 48000 }
    },

    // 📲 MOBILE OPTIMIZED
    {
        name: 'mobile-low', label: 'Mobile Low (360p)', category: 'mobile',
        options: { width: 640, height: 360, frameRate: 24, videoBitrate: 800_000, audioBitrate: 64_000, audioSampleRate: 44100 }
    },
    {
        name: 'mobile-medium', label: 'Mobile Medium (480p)', category: 'mobile',
        options: { width: 854, height: 480, frameRate: 30, videoBitrate: 1_500_000, audioBitrate: 96_000, audioSampleRate: 44100 }
    },
    {
        name: 'mobile-hd', label: 'Mobile HD (720p)', category: 'mobile',
        options: { width: 1280, height: 720, frameRate: 30, videoBitrate: 3_000_000, audioBitrate: 128_000, audioSampleRate: 44100 }
    }
];

// Helper functions for UI
export function getPresetsByCategory(category: PresetCategory): ExportPreset[] {
    return EXPORT_PRESETS.filter(p => p.category === category);
}

export function getAllCategories(): PresetCategory[] {
    return [...new Set(EXPORT_PRESETS.map(p => p.category))];
}

export const CATEGORY_LABELS: Record<PresetCategory, string> = {
    'landscape': '📺 Landscape (16:9)',
    'portrait': '📱 Portrait (9:16)',
    'square': '⬜ Square (1:1)',
    'mobile': '📲 Mobile Optimized',
    'youtube': '🎬 YouTube',
    'youtube-shorts': '⚡ YouTube Shorts',
    'tiktok': '🎵 TikTok',
    'reels': '📸 Instagram Reels',
    'instagram': '🟦 Instagram Feed',
    'twitter': '🐦 Twitter/X',
    'linkedin': '💼 LinkedIn'
};
