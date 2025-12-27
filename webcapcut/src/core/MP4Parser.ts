import * as MP4Box from 'mp4box';
import type { VideoConfig, AudioConfig, MP4Sample } from '../types/video';

/**
 * Custom error classes for MP4 parsing
 */
export class InvalidMP4FileError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'InvalidMP4FileError';
    }
}

export class MP4ParseError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'MP4ParseError';
    }
}

export class UnsupportedCodecError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'UnsupportedCodecError';
    }
}

export class MP4Parser {
    // File size limits
    private static readonly MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB
    private static readonly MIN_FILE_SIZE = 1024; // 1KB

    // Supported codecs
    private static readonly SUPPORTED_VIDEO_CODECS = [
        'avc1', 'avc3', // H.264
        'hev1', 'hvc1', // H.265 (if browser supports)
    ];

    private static readonly SUPPORTED_AUDIO_CODECS = [
        'mp4a', // AAC
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private mp4box: any;
    private videoConfig: VideoConfig | null = null;
    private audioConfig: AudioConfig | null = null;
    private videoTrackId: number = 0;
    private audioTrackId: number = 0;
    private fileArrayBuffer: ArrayBuffer | null = null;

    constructor() {
        this.mp4box = MP4Box.createFile();
    }

    /**
     * Validate file before parsing
     */
    private static validateFile(file: File): void {
        // Check file exists
        if (!file) {
            throw new InvalidMP4FileError('No file provided');
        }

        // Check file type
        const validTypes = ['video/mp4', 'video/quicktime', 'application/octet-stream'];
        if (!validTypes.includes(file.type) && !file.name.toLowerCase().endsWith('.mp4')) {
            throw new InvalidMP4FileError(
                `Invalid file type: "${file.type}". ` +
                'Only MP4 video files are supported. ' +
                `File extension: ${file.name.split('.').pop()}`
            );
        }

        // Check file size
        if (file.size < MP4Parser.MIN_FILE_SIZE) {
            throw new InvalidMP4FileError(
                `File too small (${file.size} bytes). ` +
                'This does not appear to be a valid video file.'
            );
        }

        if (file.size > MP4Parser.MAX_FILE_SIZE) {
            const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
            const maxSizeMB = (MP4Parser.MAX_FILE_SIZE / (1024 * 1024)).toFixed(0);
            throw new InvalidMP4FileError(
                `File too large (${sizeMB} MB). ` +
                `Maximum supported size is ${maxSizeMB} MB. ` +
                'Please use a smaller video file or compress it.'
            );
        }

        console.log('[MP4Parser] ✅ File validation passed');
        console.log('[MP4Parser] File name:', file.name);
        console.log('[MP4Parser] File size:', (file.size / (1024 * 1024)).toFixed(2), 'MB');
        console.log('[MP4Parser] File type:', file.type);
    }

    async parse(file: File): Promise<{ video: VideoConfig, audio: AudioConfig | null }> {
        // Validate file first
        MP4Parser.validateFile(file);

        return new Promise((resolve, reject) => {
            console.log('[MP4Parser] Starting parse...');

            // Timeout after 30 seconds
            const timeout = setTimeout(() => {
                reject(new MP4ParseError(
                    'MP4 parsing timed out after 30 seconds. ' +
                    'The file may be corrupted or too large to process.'
                ));
            }, 30000);

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            this.mp4box.onReady = (info: any) => {
                clearTimeout(timeout);

                try {
                    console.log('[MP4Parser] ✅ onReady triggered');
                    console.log('[MP4Parser] MP4 Info:', {
                        duration: info.duration,
                        timescale: info.timescale,
                        brands: info.brands,
                        created: new Date(info.created),
                        modified: new Date(info.modified),
                    });
                    console.log('[MP4Parser] Video tracks:', info.videoTracks.length);
                    console.log('[MP4Parser] Audio tracks:', info.audioTracks.length);

                    // --- VIDEO TRACK PROCESSING ---
                    if (!info.videoTracks || info.videoTracks.length === 0) {
                        throw new InvalidMP4FileError(
                            'No video track found in this file. ' +
                            'The file may be audio-only or corrupted. ' +
                            'Please select a file with video content.'
                        );
                    }

                    const videoTrack = info.videoTracks[0];
                    this.videoTrackId = videoTrack.id;

                    // Validate video properties
                    if (!videoTrack.codec) {
                        throw new InvalidMP4FileError('Video codec information missing from file');
                    }
                    if (!videoTrack.track_width || !videoTrack.track_height) {
                        throw new InvalidMP4FileError('Video dimensions missing from file');
                    }
                    if (!videoTrack.nb_samples || videoTrack.nb_samples === 0) {
                        throw new InvalidMP4FileError('No video frames found in file');
                    }

                    // Check video codec support
                    const videoCodecPrefix = videoTrack.codec.substring(0, 4);
                    if (!MP4Parser.SUPPORTED_VIDEO_CODECS.includes(videoCodecPrefix)) {
                        throw new UnsupportedCodecError(
                            `Video Codec "${videoTrack.codec}" is not supported. ` +
                            `Supported codecs: ${MP4Parser.SUPPORTED_VIDEO_CODECS.join(', ')}. ` +
                            'Please re-encode your video to H.264 format.'
                        );
                    }

                    console.log('[MP4Parser] Video track ID:', this.videoTrackId);
                    console.log('[MP4Parser] Video Codec:', videoTrack.codec);
                    console.log('[MP4Parser] Dimensions:', videoTrack.track_width, 'x', videoTrack.track_height);

                    // Extract avcC (H.264 configuration) for description
                    let description: Uint8Array | undefined;
                    try {
                        const trak = this.mp4box.getTrackById(this.videoTrackId);
                        if (trak?.mdia?.minf?.stbl?.stsd?.entries?.[0]?.avcC) {
                            const avcC = trak.mdia.minf.stbl.stsd.entries[0].avcC;
                            const stream = new MP4Box.DataStream();
                            avcC.write(stream);
                            description = new Uint8Array(stream.buffer, 8);
                            console.log('[MP4Parser] ✅ Extracted avcC description:', description.length, 'bytes');
                        }
                    } catch (e) {
                        console.error('[MP4Parser] ❌ Failed to extract avcC:', e);
                    }

                    this.videoConfig = {
                        codec: videoTrack.codec,
                        codedWidth: videoTrack.track_width,
                        codedHeight: videoTrack.track_height,
                        description,
                        duration: Math.round((info.duration / info.timescale) * 1_000_000),
                        timescale: videoTrack.timescale,
                    };

                    // --- AUDIO TRACK PROCESSING ---
                    if (info.audioTracks && info.audioTracks.length > 0) {
                        const audioTrack = info.audioTracks[0];
                        this.audioTrackId = audioTrack.id;
                        console.log('[MP4Parser] Found Audio track ID:', this.audioTrackId);
                        console.log('[MP4Parser] Audio Codec:', audioTrack.codec);

                        // Check audio codec support
                        const audioCodecPrefix = audioTrack.codec.substring(0, 4);

                        if (MP4Parser.SUPPORTED_AUDIO_CODECS.includes(audioCodecPrefix)) {
                            this.audioConfig = {
                                codec: audioTrack.codec,
                                numberOfChannels: audioTrack.audio.channel_count,
                                sampleRate: audioTrack.audio.sample_rate,
                                duration: Math.round((info.duration / info.timescale) * 1_000_000),
                                timescale: audioTrack.timescale,
                            };
                            console.log('[MP4Parser] Audio Config:', this.audioConfig);
                        } else {
                            console.warn('[MP4Parser] Unsupported audio codec:', audioTrack.codec);
                        }
                    } else {
                        console.log('[MP4Parser] No audio track found.');
                    }

                    resolve({ video: this.videoConfig, audio: this.audioConfig });
                } catch (error) {
                    clearTimeout(timeout);
                    reject(error);
                }
            };

            this.mp4box.onError = (e: string) => {
                console.error('[MP4Parser] ❌ MP4Box error:', e);
                reject(new Error(`MP4Box error: ${e}`));
            };

            // Read file
            const reader = new FileReader();
            reader.onload = (e) => {
                const arrayBuffer = e.target!.result as ArrayBuffer;
                this.fileArrayBuffer = arrayBuffer;

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const mp4ArrayBuffer: any = arrayBuffer;
                mp4ArrayBuffer.fileStart = 0;

                console.log('[MP4Parser] File loaded, size:', arrayBuffer.byteLength, 'bytes');
                this.mp4box.appendBuffer(mp4ArrayBuffer);
                this.mp4box.flush();
            };

            reader.onerror = () => {
                reject(new Error('Failed to read file'));
            };

            reader.readAsArrayBuffer(file);
        });
    }

    private extractSamples(trackId: number, onComplete: (samples: MP4Sample[]) => void, type: 'video' | 'audio'): void {
        console.log(`[MP4Parser] Starting ${type} extraction for track ${trackId}...`);

        if (!this.fileArrayBuffer) {
            console.error('[MP4Parser] ❌ No file buffer available');
            return;
        }

        // Create a NEW mp4box instance for extraction to avoid conflicts/state issues
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const extractionBox: any = MP4Box.createFile();
        const allSamples: MP4Sample[] = [];

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        extractionBox.onReady = (info: any) => {
            const tracks = type === 'video' ? info.videoTracks : info.audioTracks;
            // Find specific track by ID to be safe, though usually first one
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const track = tracks.find((t: any) => t.id === trackId);

            if (!track) {
                console.error(`[MP4Parser] Could not find ${type} track with ID ${trackId}`);
                return;
            }

            console.log(`[MP4Parser] Extracting ${track.nb_samples} samples for ${type} track ${trackId}`);
            extractionBox.setExtractionOptions(trackId, null, {
                nbSamples: track.nb_samples,
            });
            extractionBox.start();
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        extractionBox.onSamples = (_trackId: number, _user: any, samples: any[]) => {
            if (samples.length > 0) {
                samples.forEach((sample) => {
                    allSamples.push({
                        is_sync: sample.is_sync,
                        cts: sample.cts,
                        duration: sample.duration,
                        data: sample.data,
                    });
                });
            }

            // MP4Box might call onSamples multiple times or just once. 
            // setExtractionOptions with nbSamples usually delivers all at once or in chunks.
            // For simplicity in this implementation, we assume we want to collect them all.
            // But timing is tricky - flush() is synchronous after appendBuffer.
        };

        // We need to know when it's DONE. MP4Box doesn't have a clean "onComplete".
        // However, since we are reading from ArrayBuffer in memory, it happens synchronously-ish 
        // after we appendBuffer and flush.

        extractionBox.onError = (e: string) => {
            console.error(`[MP4Parser] ❌ ${type} extraction error:`, e);
        };

        // Append and Flush
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mp4ArrayBuffer: any = this.fileArrayBuffer;
        mp4ArrayBuffer.fileStart = 0;
        extractionBox.appendBuffer(mp4ArrayBuffer);
        extractionBox.flush();

        console.log(`[MP4Parser] ${type} extraction complete. Collected ${allSamples.length} samples.`);
        onComplete(allSamples);
    }

    startExtraction(onComplete: (samples: MP4Sample[]) => void): void {
        if (!this.videoConfig) {
            console.error('[MP4Parser] ❌ No video config');
            return;
        }
        this.extractSamples(this.videoTrackId, onComplete, 'video');
    }

    startAudioExtraction(onComplete: (samples: MP4Sample[]) => void): void {
        if (!this.audioConfig) {
            console.error('[MP4Parser] ❌ No audio config');
            return;
        }
        this.extractSamples(this.audioTrackId, onComplete, 'audio');
    }
}
