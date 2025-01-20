import { CachedAudio, Voice } from "./types.ts";

export class AudioManager {
  private audioCache: Map<string, CachedAudio>;
  private voices: Map<string, Voice>;
  private currentVoice: Voice | null;
  private webAudioContext: AudioContext | null;
  private readonly SAMPLE_RATE = 24000; // Sample rate from your model
  private voiceStr: string = "Default";
  private updateListener: Set<() => void> = new Set();

  constructor(voices: Map<string, Voice>) {
    this.audioCache = new Map();
    this.voices = voices;
    this.currentVoice = voices.get(this.voiceStr)!;
    this.webAudioContext = null;
  }

  private getAudioContext(): AudioContext {
    if (!this.webAudioContext) {
      this.webAudioContext =
        new (globalThis.AudioContext || globalThis.webkitAudioContext)({
          sampleRate: this.SAMPLE_RATE, // Match the model's sample rate
        });
    }
    return this.webAudioContext;
  }

  getCache(): Map<string, CachedAudio> {
    return this.audioCache;
  }

  getCachedAudio(tokens: number[]): CachedAudio | undefined {
    let cacheKey = tokens.join(",");
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
    this.currentVoice = this.voices.get(voiceName) ||
      this.voices.get("Default")!;
    this.voiceStr = voiceName;
  }

  addUpdateListener(listener: () => void) {
    this.updateListener.add(listener);
  }

  removeUpdateListener(listener: () => void) {
    this.updateListener.delete(listener);
  }

  // Method to store audio data from model inference
  cacheAudioData(
    tokens: number[],
    audioData: Float32Array,
    voice: string,
    message: string,
  ) {
    let cacheKey = tokens.join(",");

    // add current voice to cache key
    // this is to ensure that the same audio data is not used for different voices
    if (this.currentVoice) {
      cacheKey += `_${this.currentVoice.name}`;
    }

    this.audioCache.set(cacheKey, {
      data: audioData,
      timestamp: Date.now(),
      voice: voice,
      message: message,
    });

    // Notify listeners of cache update
    this.updateListener.forEach((listener) => listener());
  }
}

// Utility class to convert raw audio data to WAV format blobs for download or playback
export class WavConverter {
  private static SAMPLE_RATE = 24000;
  private static NUM_CHANNELS = 1;
  private static BITS_PER_SAMPLE = 16;

  /**
   * Converts raw audio data to a WAV file blob
   * @param audioData The cached audio data to convert
   * @returns Blob containing WAV file data
   */
  static convertToWav(audioData: CachedAudio): Blob {
    const samples = new Float32Array(audioData.data);
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    // Write WAV header
    // "RIFF" chunk descriptor
    this.writeString(view, 0, "RIFF");
    view.setUint32(4, 32 + samples.length * 2, true);
    this.writeString(view, 8, "WAVE");

    // "fmt " sub-chunk
    this.writeString(view, 12, "fmt ");
    view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
    view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
    view.setUint16(22, this.NUM_CHANNELS, true); // NumChannels
    view.setUint32(24, this.SAMPLE_RATE, true); // SampleRate
    view.setUint32(28, this.SAMPLE_RATE * this.NUM_CHANNELS * 2, true); // ByteRate
    view.setUint16(32, this.NUM_CHANNELS * 2, true); // BlockAlign
    view.setUint16(34, this.BITS_PER_SAMPLE, true); // BitsPerSample

    // "data" sub-chunk
    this.writeString(view, 36, "data");
    view.setUint32(40, samples.length * 2, true);

    // Write audio data
    const volume = 0.8; // Adjust volume to prevent clipping
    let offset = 44;
    for (let i = 0; i < samples.length; i++) {
      const sample = Math.max(-1, Math.min(1, samples[i])) * volume;
      const int16Sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, int16Sample, true);
      offset += 2;
    }

    return new Blob([buffer], { type: "audio/wav" });
  }

  /**
   * Creates a downloadable WAV file from the audio data
   * @param audioData The cached audio data to convert
   * @param filename The name of the file to download (without extension)
   */
  static downloadWav(audioData: CachedAudio, filename: string): void {
    const blob = this.convertToWav(audioData);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.wav`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Creates an object URL for the WAV file that can be used in an audio element
   * @param audioData The cached audio data to convert
   * @returns URL that can be used as the src for an audio element
   */
  static createWavUrl(audioData: CachedAudio): string {
    const blob = this.convertToWav(audioData);
    return URL.createObjectURL(blob);
  }

  /**
   * Writes a string to the DataView at the specified offset
   * @param view The DataView to write tokens to
   * @param offset The offset to start writing at
   * @param string The string to write
   */
  private static writeString(
    view: DataView,
    offset: number,
    string: string,
  ): void {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }
}
