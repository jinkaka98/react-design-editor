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

export interface ExportPreset {
    name: string;
    label: string;
    options: ExportOptions;
}

export const EXPORT_PRESETS: ExportPreset[] = [
    {
        name: '720p',
        label: '720p HD (1280x720)',
        options: {
            width: 1280,
            height: 720,
            frameRate: 30,
            videoBitrate: 5_000_000,
            audioBitrate: 128_000,
            audioSampleRate: 48000
        }
    },
    {
        name: '1080p',
        label: '1080p Full HD (1920x1080)',
        options: {
            width: 1920,
            height: 1080,
            frameRate: 30,
            videoBitrate: 10_000_000,
            audioBitrate: 192_000,
            audioSampleRate: 48000
        }
    },
    {
        name: '1080p-vertical',
        label: '1080p Vertical (1080x1920)',
        options: {
            width: 1080,
            height: 1920,
            frameRate: 30,
            videoBitrate: 10_000_000,
            audioBitrate: 192_000,
            audioSampleRate: 48000
        }
    }
];
