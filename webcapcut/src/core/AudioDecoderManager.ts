import { AudioConfig, MP4Sample } from '../types/video';

export class AudioDecoderManager {
    private decoder: AudioDecoder | null = null;

    constructor() {
        if (!('AudioDecoder' in window)) {
            console.error('WebCodecs AudioDecoder API is not supported in this browser.');
        }
    }

    async decode(config: AudioConfig, samples: MP4Sample[]): Promise<AudioBuffer> {
        console.log('[AudioDecoderManager] Starting decode...', config);

        return new Promise((resolve, reject) => {
            const audioDataChunks: AudioData[] = [];

            this.decoder = new AudioDecoder({
                output: (data) => {
                    audioDataChunks.push(data);
                },
                error: (e) => {
                    console.error('[AudioDecoderManager] Decode error:', e);
                    reject(e);
                }
            });

            // Configure decoder
            this.decoder.configure({
                codec: config.codec,
                numberOfChannels: config.numberOfChannels,
                sampleRate: config.sampleRate,
                description: config.description
            });

            // Decode all samples
            console.log(`[AudioDecoderManager] Scheduling ${samples.length} samples for decoding...`);
            samples.forEach(sample => {
                const chunk = new EncodedAudioChunk({
                    type: sample.is_sync ? 'key' : 'delta',
                    timestamp: (sample.cts / config.timescale) * 1_000_000, // microseconds
                    duration: (sample.duration / config.timescale) * 1_000_000,
                    data: sample.data
                });
                this.decoder!.decode(chunk);
            });

            // Flush to ensure all data is output
            this.decoder.flush().then(async () => {
                console.log(`[AudioDecoderManager] Decoding complete. Got ${audioDataChunks.length} chunks.`);

                if (audioDataChunks.length === 0) {
                    // Create empty buffer if no audio
                    const emptyCtx = new AudioContext(); // temporary
                    const emptyBuf = emptyCtx.createBuffer(config.numberOfChannels, 1, config.sampleRate);
                    resolve(emptyBuf);
                    return;
                }

                // Convert AudioData[] to AudioBuffer
                const buffer = await this.audioDataToAudioBuffer(audioDataChunks, config);

                // Cleanup AudioData objects
                audioDataChunks.forEach(chunk => chunk.close());
                this.decoder?.close();
                this.decoder = null;

                resolve(buffer);
            }).catch(reject);
        });
    }

    private async audioDataToAudioBuffer(chunks: AudioData[], config: AudioConfig): Promise<AudioBuffer> {
        // Calculate total length in frames
        let totalFrames = 0;
        for (const chunk of chunks) {
            totalFrames += chunk.numberOfFrames;
        }

        console.log(`[AudioDecoderManager] Creating AudioBuffer: ${totalFrames} frames, ${config.numberOfChannels} channels, ${config.sampleRate} Hz`);

        // We need an AudioContext to create AudioBuffer (or OfflineAudioContext)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({
            sampleRate: config.sampleRate
        });

        const audioBuffer = ctx.createBuffer(
            config.numberOfChannels,
            totalFrames,
            config.sampleRate
        );

        // Check if data is planar or interleaved by checking number of planes
        const firstChunk = chunks[0];
        const isPlanar = firstChunk.format?.includes('planar') ?? false;

        console.log(`[AudioDecoderManager] Audio format: ${firstChunk.format}, isPlanar: ${isPlanar}`);

        if (isPlanar) {
            // Planar format: each channel is a separate plane
            for (let channel = 0; channel < config.numberOfChannels; channel++) {
                const channelData = audioBuffer.getChannelData(channel);
                let offset = 0;

                for (const chunk of chunks) {
                    const size = chunk.allocationSize({ planeIndex: channel, format: 'f32-planar' });
                    const tempBuf = new Float32Array(size / 4);

                    chunk.copyTo(tempBuf, {
                        planeIndex: channel,
                        format: 'f32-planar'
                    });

                    const copyLength = Math.min(tempBuf.length, channelData.length - offset);
                    if (copyLength > 0) {
                        channelData.set(tempBuf.subarray(0, copyLength), offset);
                        offset += copyLength;
                    }
                }
            }
        } else {
            // Interleaved format: all channels in one plane, interleaved
            // For stereo: L0, R0, L1, R1, L2, R2, ...
            const channelDataArrays = [];
            for (let c = 0; c < config.numberOfChannels; c++) {
                channelDataArrays.push(audioBuffer.getChannelData(c));
            }

            let frameOffset = 0;

            for (const chunk of chunks) {
                // Get interleaved data (all channels in plane 0)
                const size = chunk.allocationSize({ planeIndex: 0, format: 'f32' });
                const tempBuf = new Float32Array(size / 4);

                chunk.copyTo(tempBuf, {
                    planeIndex: 0,
                    format: 'f32'
                });

                // De-interleave into separate channels
                const framesInChunk = chunk.numberOfFrames;
                const numChannels = config.numberOfChannels;

                for (let frame = 0; frame < framesInChunk; frame++) {
                    const destFrame = frameOffset + frame;
                    if (destFrame >= totalFrames) break;

                    for (let ch = 0; ch < numChannels; ch++) {
                        const srcIdx = frame * numChannels + ch;
                        if (srcIdx < tempBuf.length) {
                            channelDataArrays[ch][destFrame] = tempBuf[srcIdx];
                        }
                    }
                }

                frameOffset += framesInChunk;
            }
        }

        ctx.close(); // Clean up temp context
        return audioBuffer;
    }
}
