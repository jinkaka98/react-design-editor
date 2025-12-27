/**
 * Encoding Worker - Handles video encoding and muxing in separate thread
 * Receives ImageBitmap frames from main thread, encodes and muxes to MP4
 */
import { Muxer, ArrayBufferTarget } from 'mp4-muxer';

interface InitMessage {
    type: 'init';
    width: number;
    height: number;
    frameRate: number;
    videoBitrate: number;
    totalFrames: number;
    audioSampleRate: number;
    audioBitrate: number;
}

interface FrameMessage {
    type: 'frame';
    bitmap: ImageBitmap;
    timestamp: number; // microseconds
    keyFrame: boolean;
}

interface AudioMessage {
    type: 'audio';
    leftChannel: Float32Array;
    rightChannel: Float32Array;
    sampleRate: number;
    totalSamples: number;
}

interface FinishMessage {
    type: 'finish';
}

type WorkerMessage = InitMessage | FrameMessage | AudioMessage | FinishMessage;

let videoEncoder: VideoEncoder | null = null;
let audioEncoder: AudioEncoder | null = null;
let muxer: Muxer<ArrayBufferTarget> | null = null;
let frameCount = 0;
let totalFrames = 0;

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
    const data = e.data;

    if (data.type === 'init') {
        await initEncoders(data);
    } else if (data.type === 'frame') {
        await encodeFrame(data);
    } else if (data.type === 'audio') {
        await encodeAudio(data);
    } else if (data.type === 'finish') {
        await finishExport();
    }
};

async function initEncoders(config: InitMessage): Promise<void> {
    frameCount = 0;
    totalFrames = config.totalFrames;

    // Get appropriate codec level
    const codecLevel = getAvcLevel(config.width, config.height);
    console.log('[Worker] Initializing with codec:', codecLevel);

    // Create muxer
    muxer = new Muxer({
        target: new ArrayBufferTarget(),
        video: {
            codec: 'avc',
            width: config.width,
            height: config.height
        },
        audio: {
            codec: 'aac',
            numberOfChannels: 2,
            sampleRate: config.audioSampleRate
        },
        fastStart: 'in-memory'
    });

    // Create video encoder
    videoEncoder = new VideoEncoder({
        output: (chunk, meta) => {
            if (muxer) {
                muxer.addVideoChunk(chunk, meta);
            }
        },
        error: (e) => {
            console.error('[Worker] Video encoder error:', e);
            self.postMessage({ type: 'error', error: e.message });
        }
    });

    await videoEncoder.configure({
        codec: codecLevel,
        width: config.width,
        height: config.height,
        bitrate: config.videoBitrate,
        framerate: config.frameRate
    });

    // Create audio encoder
    audioEncoder = new AudioEncoder({
        output: (chunk, meta) => {
            if (muxer) {
                muxer.addAudioChunk(chunk, meta);
            }
        },
        error: (e) => {
            console.error('[Worker] Audio encoder error:', e);
        }
    });

    await audioEncoder.configure({
        codec: 'mp4a.40.2',
        numberOfChannels: 2,
        sampleRate: config.audioSampleRate,
        bitrate: config.audioBitrate
    });

    self.postMessage({ type: 'ready' });
}

async function encodeFrame(data: FrameMessage): Promise<void> {
    if (!videoEncoder) return;

    try {
        const frame = new VideoFrame(data.bitmap, {
            timestamp: data.timestamp,
            duration: 33333 // ~30fps in microseconds
        });

        videoEncoder.encode(frame, { keyFrame: data.keyFrame });
        frame.close();
        data.bitmap.close();

        frameCount++;
        const percent = Math.round((frameCount / totalFrames) * 90); // 0-90% for video
        self.postMessage({ type: 'progress', percent, currentFrame: frameCount, totalFrames });
    } catch (err) {
        console.error('[Worker] Frame encode error:', err);
    }
}

async function encodeAudio(data: AudioMessage): Promise<void> {
    if (!audioEncoder) return;

    const { leftChannel, rightChannel, sampleRate, totalSamples } = data;
    const numberOfChannels = 2;

    // Encode audio in 1-second chunks
    const samplesPerChunk = sampleRate;
    const chunksTotal = Math.ceil(totalSamples / samplesPerChunk);

    for (let chunkIdx = 0; chunkIdx < chunksTotal; chunkIdx++) {
        const startSample = chunkIdx * samplesPerChunk;
        const endSample = Math.min(startSample + samplesPerChunk, totalSamples);
        const chunkSamples = endSample - startSample;

        // Create planar data: [all left][all right]
        const chunkData = new Float32Array(chunkSamples * numberOfChannels);

        for (let i = 0; i < chunkSamples; i++) {
            chunkData[i] = leftChannel[startSample + i] || 0;
            chunkData[chunkSamples + i] = rightChannel[startSample + i] || 0;
        }

        const audioData = new AudioData({
            format: 'f32-planar',
            sampleRate: sampleRate,
            numberOfFrames: chunkSamples,
            numberOfChannels: numberOfChannels,
            timestamp: (startSample / sampleRate) * 1_000_000,
            data: chunkData
        });

        audioEncoder.encode(audioData);
        audioData.close();
    }

    self.postMessage({ type: 'progress', percent: 95, currentFrame: totalFrames, totalFrames });
}

async function finishExport(): Promise<void> {
    try {
        if (videoEncoder) {
            await videoEncoder.flush();
            videoEncoder.close();
            videoEncoder = null;
        }

        if (audioEncoder) {
            await audioEncoder.flush();
            audioEncoder.close();
            audioEncoder = null;
        }

        if (muxer) {
            muxer.finalize();
            const buffer = muxer.target.buffer;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (self as any).postMessage({ type: 'complete', buffer }, [buffer]);
            muxer = null;
        }
    } catch (err) {
        console.error('[Worker] Finish error:', err);
        self.postMessage({ type: 'error', error: (err as Error).message });
    }
}

function getAvcLevel(width: number, height: number): string {
    const pixels = width * height;

    if (pixels <= 921600) {
        return 'avc1.64001f'; // Level 3.1 for 720p
    } else if (pixels <= 2097152) {
        return 'avc1.640029'; // Level 4.1 for 1080p
    } else {
        return 'avc1.640033'; // Level 5.1 for 4K
    }
}
