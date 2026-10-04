// Runs on the audio thread. Posts one RMS value per ~20 ms frame, stamped
// with the audio clock, so silence timing does not depend on the main thread
// (PDF renders, React work, background-tab timer throttling).
// VAD decisions stay in lib/stt/vad.ts; this file only measures.
class VadMeterProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const frameMs = options?.processorOptions?.frameMs ?? 20;
    this.size = Math.max(128, Math.round((sampleRate * frameMs) / 1000));
    this.buffer = new Float32Array(this.size);
    this.filled = 0;
  }

  process(inputs) {
    const channel = inputs[0]?.[0];
    if (!channel) return true;
    for (let i = 0; i < channel.length; i += 1) {
      this.buffer[this.filled] = channel[i];
      this.filled += 1;
      if (this.filled === this.size) {
        this.emit(currentFrame + i + 1);
        this.filled = 0;
      }
    }
    return true;
  }

  emit(frameEnd) {
    let mean = 0;
    for (let i = 0; i < this.size; i += 1) mean += this.buffer[i];
    mean /= this.size;
    let sum = 0;
    for (let i = 0; i < this.size; i += 1) {
      const centered = this.buffer[i] - mean;
      sum += centered * centered;
    }
    this.port.postMessage({
      rms: Math.sqrt(sum / this.size),
      t: (frameEnd / sampleRate) * 1000,
    });
  }
}

registerProcessor("vad-meter", VadMeterProcessor);
