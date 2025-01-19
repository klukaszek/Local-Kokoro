import { Voice, CachedAudio } from "./types.ts";

export class AudioManager {
    private audioCache: Map<string, CachedAudio>;
    private voices: Map<string, Voice>;
    private currentVoice: Voice | null;
    private webAudioContext: AudioContext | null;
    private readonly SAMPLE_RATE = 24000;  // Sample rate from your model
    private listeners: Map<string, (voices: Map<string, Voice>) => void> = new Map();

    constructor(voices: Map<string, Voice>) {
        this.audioCache = new Map();
        this.voices = voices;
        this.currentVoice = voices.get("Default")!;
        this.webAudioContext = null;
    }

    private getAudioContext(): AudioContext {
        if (!this.webAudioContext) {
            this.webAudioContext = new (globalThis.AudioContext || globalThis.webkitAudioContext)({
                sampleRate: this.SAMPLE_RATE  // Match the model's sample rate
            });
        }
        return this.webAudioContext;
    }

    getCachedAudio(tokens: number[]): CachedAudio | undefined {
        let cacheKey = tokens.join(',');
        if (this.currentVoice) {
            cacheKey += `_${this.currentVoice.name}`;
        }
        return this.audioCache.get(cacheKey);
    }

    clearCache() {
        this.audioCache.clear();
    }
    
    getVoices() {
        return this.voices;
    }

    getCurrentVoice() {
        return this.currentVoice;
    }

    changeVoice(voiceName: string) {
        this.currentVoice = this.voices.get(voiceName) || this.voices.get("Default")!;
    }

    // Method to store audio data from model inference
    cacheAudioData(tokens: number[], audioData: Float32Array) {
        let cacheKey = tokens.join(',');

        // add current voice to cache key
        // this is to ensure that the same audio data is not used for different voices
        if (this.currentVoice) {
            cacheKey += `_${this.currentVoice.name}`;
        }

        this.audioCache.set(cacheKey, {
            data: audioData,
            timestamp: Date.now()
        });
    }

    playAudio(
        tokens: number[],
        callback?: (name: string, loaded: number, total: number) => void
    ): Promise<void> {
        const cacheKey = tokens.join(',');
        
        // Check if audio data is in cache
        const cachedAudio = this.getCachedAudio(tokens);
        if (!cachedAudio) {
            console.warn('Audio not found in cache for tokens:', tokens);
            return Promise.reject(new Error('Audio not found in cache'));
        }
        console.log(cachedAudio);

        try {
            const ctx = this.getAudioContext();
            const data = new Float32Array(cachedAudio.data);
            
            // Create an AudioBuffer with the same number of channels as your model output
            // Assuming mono output (1 channel) from the model
            const audioBuffer = ctx.createBuffer(1, data.length, this.SAMPLE_RATE);
            
            // Copy the Float32Array data directly into the AudioBuffer
            audioBuffer.copyToChannel(data, 0);
            
            // Create and configure source
            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(ctx.destination);
            
            // Optional: Notify about playback start
            if (callback) {
                callback(cacheKey, 0, audioBuffer.duration);
            }
            
            // Start playback
            source.start(0);
            
            // Set up progress tracking if callback provided
            if (callback) {
                const updateInterval = 100; // Update every 100ms
                const startTime = ctx.currentTime;
                
                const progressUpdate = setInterval(() => {
                    const elapsed = ctx.currentTime - startTime;
                    if (elapsed >= audioBuffer.duration) {
                        clearInterval(progressUpdate);
                        callback(cacheKey, audioBuffer.duration, audioBuffer.duration);
                    } else {
                        callback(cacheKey, elapsed, audioBuffer.duration);
                    }
                }, updateInterval);
                
                // Clean up interval when playback ends
                source.onended = () => {
                    clearInterval(progressUpdate);
                    callback(cacheKey, audioBuffer.duration, audioBuffer.duration);
                };
            }

            // Return a promise that resolves when the audio finishes playing
            return new Promise((resolve) => {
                source.onended = () => resolve();
            });
        } catch (error) {
            console.error('Error playing audio:', error);
            throw error;
        }
    }
}
