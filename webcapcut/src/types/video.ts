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
