// Fix: Implement manual base64 decoding and raw PCM processing as per GenAI guidelines
export class AudioService {
  private static instance: AudioService;
  private ctx: AudioContext | null = null;
  private outputNode: GainNode | null = null;

  private constructor() {
    try {
      // Fix: Follow guidelines for AudioContext initialization with specified sample rate.
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      this.outputNode = this.ctx.createGain();
      this.outputNode.connect(this.ctx.destination);
    } catch (e) {
      console.warn("AudioContext failed to init:", e);
    }
  }

  public static getInstance(): AudioService {
    if (!AudioService.instance) AudioService.instance = new AudioService();
    return AudioService.instance;
  }

  // Fix: Use manual base64 decode implementation following the example provided.
  private decodeBase64(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  // Fix: Manual raw PCM decoding logic to correctly transform 16-bit PCM bytes into AudioBuffer frames.
  private async decodeAudioData(data: Uint8Array): Promise<AudioBuffer> {
    if (!this.ctx) throw new Error("No context");
    // Gemini TTS returns raw 16-bit PCM data.
    const dataInt16 = new Int16Array(data.buffer);
    const numChannels = 1;
    const sampleRate = 24000;
    const frameCount = dataInt16.length / numChannels;
    const buffer = this.ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) {
        // Normalize 16-bit signed integers to [-1, 1] range for Web Audio.
        channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
      }
    }
    return buffer;
  }

  public async playPcm(base64Audio: string) {
    if (!this.ctx || !this.outputNode) return;
    try {
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      const bytes = this.decodeBase64(base64Audio);
      const buffer = await this.decodeAudioData(bytes);
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(this.outputNode);
      source.start();
    } catch (e) {
      console.error("Audio playback error:", e);
    }
  }
}
