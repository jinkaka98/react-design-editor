/**
 * CodecChecker - Detects codec support before decoding
 * Prevents crashes from unsupported video/audio formats
 */

export interface CodecSupportResult {
    supported: boolean;
    codec: string;
    hardwareAcceleration?: boolean;
    reason?: string;
}

export interface VideoCodecInfo {
    codec: string;
    width: number;
    height: number;
    framerate?: number;
}

export interface AudioCodecInfo {
    codec: string;
    sampleRate: number;
    numberOfChannels: number;
}

/**
 * Common video codecs to check
 */
export const COMMON_VIDEO_CODECS = [
    'avc1.42E01E', // H.264 Baseline
    'avc1.4D401E', // H.264 Main
    'avc1.64001E', // H.264 High
    'vp8',         // VP8
    'vp09.00.10.08', // VP9
    'hev1.1.6.L93.B0', // HEVC/H.265
    'av01.0.01M.08', // AV1
];

/**
 * Common audio codecs
 */
export const COMMON_AUDIO_CODECS = [
    'mp4a.40.2',   // AAC-LC
    'mp4a.40.5',   // HE-AAC
    'opus',        // Opus
    'vorbis',      // Vorbis
    'mp3',         // MP3
    'flac',        // FLAC
];

class CodecChecker {
    private videoCodecCache = new Map<string, CodecSupportResult>();
    private audioCodecCache = new Map<string, CodecSupportResult>();

    /**
     * Check if video codec is supported
     */
    async checkVideoCodec(info: VideoCodecInfo): Promise<CodecSupportResult> {
        const cacheKey = `${info.codec}_${info.width}x${info.height}`;

        if (this.videoCodecCache.has(cacheKey)) {
            return this.videoCodecCache.get(cacheKey)!;
        }

        try {
            const config: VideoDecoderConfig = {
                codec: info.codec,
                codedWidth: info.width,
                codedHeight: info.height,
            };

            const support = await VideoDecoder.isConfigSupported(config);

            const result: CodecSupportResult = {
                supported: support.supported ?? false,
                codec: info.codec,
                hardwareAcceleration: (support.config as any)?.hardwareAcceleration === 'prefer-hardware',
            };

            if (!result.supported) {
                result.reason = `Video codec ${info.codec} not supported at ${info.width}x${info.height}`;
            }

            this.videoCodecCache.set(cacheKey, result);
            return result;
        } catch (error) {
            const result: CodecSupportResult = {
                supported: false,
                codec: info.codec,
                reason: `Error checking codec: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
            this.videoCodecCache.set(cacheKey, result);
            return result;
        }
    }

    /**
     * Check if audio codec is supported
     */
    async checkAudioCodec(info: AudioCodecInfo): Promise<CodecSupportResult> {
        const cacheKey = `${info.codec}_${info.sampleRate}_${info.numberOfChannels}`;

        if (this.audioCodecCache.has(cacheKey)) {
            return this.audioCodecCache.get(cacheKey)!;
        }

        try {
            const config: AudioDecoderConfig = {
                codec: info.codec,
                sampleRate: info.sampleRate,
                numberOfChannels: info.numberOfChannels,
            };

            const support = await AudioDecoder.isConfigSupported(config);

            const result: CodecSupportResult = {
                supported: support.supported ?? false,
                codec: info.codec,
            };

            if (!result.supported) {
                result.reason = `Audio codec ${info.codec} not supported`;
            }

            this.audioCodecCache.set(cacheKey, result);
            return result;
        } catch (error) {
            const result: CodecSupportResult = {
                supported: false,
                codec: info.codec,
                reason: `Error checking codec: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
            this.audioCodecCache.set(cacheKey, result);
            return result;
        }
    }

    /**
     * Get user-friendly message for unsupported codec
     */
    getUnsupportedMessage(result: CodecSupportResult): string {
        const codec = result.codec.split('.')[0].toUpperCase();

        if (result.codec.startsWith('hev1') || result.codec.startsWith('hvc1')) {
            return `Video menggunakan HEVC/H.265 yang tidak didukung browser ini. Coba konversi ke H.264.`;
        }
        if (result.codec.startsWith('av01')) {
            return `Video menggunakan AV1 yang mungkin tidak didukung. Coba konversi ke H.264 atau VP9.`;
        }

        return `Codec ${codec} tidak didukung. Gunakan H.264 (MP4) atau VP9 (WebM) untuk kompatibilitas terbaik.`;
    }

    /**
     * Get list of supported video codecs (for UI display)
     */
    async getSupportedVideoCodecs(): Promise<string[]> {
        const supported: string[] = [];

        for (const codec of COMMON_VIDEO_CODECS) {
            const result = await this.checkVideoCodec({
                codec,
                width: 1920,
                height: 1080
            });
            if (result.supported) {
                supported.push(codec);
            }
        }

        return supported;
    }

    /**
     * Clear codec cache
     */
    clearCache(): void {
        this.videoCodecCache.clear();
        this.audioCodecCache.clear();
    }
}

// Singleton instance
export const codecChecker = new CodecChecker();
