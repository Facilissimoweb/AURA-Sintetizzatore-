export const workletProcessorCode = `
class PitchProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'pitchFactor', defaultValue: 1.0, minValue: 0.5, maxValue: 2.0 },
      { name: 'delaySizeMs', defaultValue: 35.0, minValue: 10.0, maxValue: 100.0 }
    ];
  }

  constructor() {
    super();
    this.maxDelay = 48000; // Buffer for max 1 second
    this.buffer = new Float32Array(this.maxDelay);
    this.writePos = 0;
    this.phase0 = 0.0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || !input[0] || input[0].length === 0) return true;

    const inChannel = input[0];
    const outChannel = output[0];
    const len = inChannel.length;

    // Use default values if parameters array are not fully populated
    const pitchFactor = (parameters.pitchFactor && parameters.pitchFactor.length > 0) 
      ? parameters.pitchFactor[0] 
      : 1.0;
    const delaySizeMs = (parameters.delaySizeMs && parameters.delaySizeMs.length > 0) 
      ? parameters.delaySizeMs[0] 
      : 35.0;
    
    // Convert delay to samples
    const delaySamples = Math.floor((sampleRate * delaySizeMs) / 1000);
    
    // Sweep gradient formula
    // If pitchFactor = 1.0, there is no pitch shifting, the speed is 0
    const speed = (1.0 - pitchFactor) / delaySamples;

    for (let i = 0; i < len; i++) {
      // Save input sample to circular buffer
      this.buffer[this.writePos] = inChannel[i];

      // Calculate the two phases out-of-phase by 180 degrees (0.5 on a 0-1 scale)
      const phase0 = this.phase0;
      const phase1 = (this.phase0 + 0.5) % 1.0;

      // Determine the delay amount for each line
      const d0 = phase0 * delaySamples;
      const d1 = phase1 * delaySamples;

      // Calculate read positions
      let r0 = this.writePos - d0;
      if (r0 < 0) r0 += this.maxDelay;
      let r1 = this.writePos - d1;
      if (r1 < 0) r1 += this.maxDelay;

      // Linear interpolation to eliminate metallic clicks
      const i0_0 = Math.floor(r0);
      const i0_1 = (i0_0 + 1) % this.maxDelay;
      const frac0 = r0 - i0_0;
      const s0 = (1.0 - frac0) * this.buffer[i0_0] + frac0 * this.buffer[i0_1];

      const i1_0 = Math.floor(r1);
      const i1_1 = (i1_0 + 1) % this.maxDelay;
      const frac1 = r1 - i1_0;
      const s1 = (1.0 - frac1) * this.buffer[i1_0] + frac1 * this.buffer[i1_1];

      // High stability sinusoidal crossfading window (preserves overall energy)
      const w0 = Math.sin(Math.PI * phase0);
      const w1 = Math.sin(Math.PI * phase1);

      // Combine both streams
      outChannel[i] = (s0 * w0 + s1 * w1);

      // Increment indices
      this.writePos = (this.writePos + 1) % this.maxDelay;
      this.phase0 = (this.phase0 + speed) % 1.0;
      if (this.phase0 < 0) this.phase0 += 1.0;
    }

    return true;
  }
}
registerProcessor('pitch-processor', PitchProcessor);
`;
