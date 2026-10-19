import { readFileSync } from 'node:fs';

// Minimal reader for 16-bit PCM mono WAV files.
export function readWav(path: string): { sampleRate: number; samples: Float32Array } {
  const buf = readFileSync(path);
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error(`${path} is not a WAV file`);
  }
  let offset = 12;
  let sampleRate = 0;
  let channels = 0;
  while (offset + 8 <= buf.length) {
    const id = buf.toString('ascii', offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (id === 'fmt ') {
      channels = buf.readUInt16LE(body + 2);
      sampleRate = buf.readUInt32LE(body + 4);
      if (buf.readUInt16LE(body + 14) !== 16) throw new Error(`${path}: only 16-bit PCM is supported`);
    } else if (id === 'data') {
      const frames = size / 2 / channels;
      const samples = new Float32Array(frames);
      for (let i = 0; i < frames; i++) samples[i] = buf.readInt16LE(body + i * 2 * channels) / 32768;
      return { sampleRate, samples };
    }
    offset = body + size + (size % 2);
  }
  throw new Error(`${path}: no data chunk`);
}
