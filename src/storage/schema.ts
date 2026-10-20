import { z } from 'zod';
import { MAX_OCTAVE_TYPE, MIN_OCTAVE_TYPE, STRETCH_PRESETS, type OctaveTypes } from '../dsp/curve';
import { KEY_COUNT } from '../dsp/notes';

export const SCHEMA_VERSION = 1;
export const FILE_FORMAT = 'piano-tuner';

const key = z.number().int().min(0).max(KEY_COUNT - 1);
const isoDate = z.string().datetime();
const octaveType = z.number().min(MIN_OCTAVE_TYPE).max(MAX_OCTAVE_TYPE);

const inharmonicitySchema = z.object({
  key,
  b: z.number().positive().max(0.1),
  measuredAt: isoDate,
});

const checkNoteSchema = z.object({
  key,
  cents: z.number().nullable(),
  beatHz: z.number().nullable().optional(),
  depthDb: z.number().optional(),
});

const checkSchema = z.object({
  id: z.string().min(1),
  date: isoDate,
  // Offsets (average and per note) are in cents against this reference A4.
  referenceA4Hz: z.number().min(400).max(480),
  // The piano's measured pitch, as the A4 its average offset corresponds to.
  measuredA4Hz: z.number().positive(),
  averageCents: z.number(),
  verdict: z.enum(['in-tune', 'touch-up', 'pitch-raise', 'large-pitch-raise']),
  notes: z.array(checkNoteSchema),
});

const sessionSchema = z.object({
  id: z.string().min(1),
  startedAt: isoDate,
  mode: z.enum(['touch-up', 'pitch-raise']),
  // Offset of the target curve from the piano's reference-pitch curve.
  targetOffsetCents: z.number(),
  // Planned change of pitch, for warnings (0 for a touch-up).
  raiseCents: z.number(),
  passes: z.number().int().min(1).max(5),
  pass: z.number().int().min(1).max(5),
  // Offset from the final target when each note was first heard this pass.
  startOffsets: z.array(z.object({ key, cents: z.number() })),
  tuned: z.array(key),
});

export const pianoSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  notes: z.string().max(2000),
  createdAt: isoDate,
  updatedAt: isoDate,
  a4Hz: z.number().min(400).max(480),
  // Octave type at each curve handle (see dsp/curve.ts).
  octaveTypes: z.tuple([octaveType, octaveType, octaveType, octaveType, octaveType]),
  inharmonicity: z.array(inharmonicitySchema),
  checks: z.array(checkSchema),
  session: sessionSchema.nullable(),
});

export const backupSchema = z.object({
  format: z.literal(FILE_FORMAT),
  schemaVersion: z.literal(SCHEMA_VERSION),
  exportedAt: isoDate,
  pianos: z.array(pianoSchema),
});

export type Piano = z.infer<typeof pianoSchema>;
export type Check = z.infer<typeof checkSchema>;
export type TuningSession = z.infer<typeof sessionSchema>;
export type InharmonicityReading = z.infer<typeof inharmonicitySchema>;
export type Backup = z.infer<typeof backupSchema>;

export function newPiano(name: string, now = new Date()): Piano {
  const stamp = now.toISOString();
  return {
    id: crypto.randomUUID(),
    name,
    notes: '',
    createdAt: stamp,
    updatedAt: stamp,
    a4Hz: 440,
    octaveTypes: STRETCH_PRESETS.standard.slice() as OctaveTypes,
    inharmonicity: [],
    checks: [],
    session: null,
  };
}
