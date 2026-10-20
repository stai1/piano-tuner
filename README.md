# Piano Tuner

A browser app that helps piano owners check and tune their own piano. It runs entirely on the device (no backend), works offline, and installs as a PWA.

- **Check my piano**: play 9 notes (every A plus C8). The app measures how far the piano is from pitch and how stiff its strings are (inharmonicity), then gives a verdict: in tune, touch-up, pitch raise, or large pitch raise.
- **Touch-up tuning**: tune notes and unisons to a stretched equal-temperament curve computed for this piano, centered on its current pitch.
- **Pitch raise**: bring the piano to A440 (or a custom A4) in one or more passes. Rough passes aim past pitch (overpull). Large raises show visual warnings but are never blocked.
- **Pianos & backup**: several pianos are stored in IndexedDB, with JSON export/import of one piano or all of them.
- **Settings** (per piano): reference pitch (A4, 400–480 Hz) and an editable tuning curve. The curve has a draggable handle for the octave type at A0, F♯2, the A3–A4 temperament octave, C7 and C8, plus Narrow/Standard/Wide presets, and is always computed from the piano's measured strings.
- **Tuning screen**: a linear cents meter, a lock button to hold the current note, a choice of which overtone the needle reads, and a live spectrum that can be turned on or off.

## Development

Requires Node 22 (`nvm use`).

```sh
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (DSP, curve, tuning rules, storage)
npm run build      # type-check and production build into dist/
npm run preview    # serve the production build
```

The microphone needs a secure context: `localhost` works in development, and GitHub Pages serves over HTTPS.

### Testing against real piano recordings

`npm run samples` converts Salamander Grand Piano samples into short WAV files in `test-samples/` (not committed). It uses the copy in `../chord-reading-trainer-container/src/assets/piano` if present, and otherwise downloads them from the [upstream repository](https://github.com/sfzinstruments/SalamanderGrandPiano). It needs `ffmpeg`. The Salamander tests are skipped when the files are missing.

The Salamander Grand Piano samples are by Alexander Holm, licensed under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/).

### Dev audio input (development only)

With the dev server running and samples prepared, two extra sound sources feed the analysis as if they came from the microphone. They also play through the speakers, and the microphone is muted while they sound so the speakers don't feed back into the analysis. Neither the code nor the samples are included in production builds.

- **Keyboard:** once the app is listening, the keys `a w s e d f t g y h u j k o l p ; '` play a chromatic run starting from C, laid out like a piano over the home row. Digits `0`–`9` set the octave of the C on `a` (default C4). `-` and `=` (or `+`) retune the last played key down or up by 0.5 cents, like turning its pin; the change applies at once if the note is still sounding and lasts for later strikes.
- **Simulation:** add `?simulate=` to the URL to strike samples in turn, one every 4 seconds, instead of using the microphone. `detune` shifts them by a number of cents:

  ```
  http://localhost:5173/?simulate=A0,A1,A2,A3,A4,A5,A6,A7,C8&detune=-40
  ```

## Deploying to GitHub Pages

The build uses a relative base path, so it works from any Pages URL. To publish:

1. Create a GitHub repository and add it as the `origin` remote.
2. Run `npm run deploy`, which builds and pushes `dist/` to the `gh-pages` branch.
3. In the repository settings, set Pages to deploy from the `gh-pages` branch.

To regenerate the app icons from `public/icon.svg`, run `npm run icons -- --override`.

## Project layout

| Path | Contents |
| --- | --- |
| `src/dsp/` | FFT, note detection and partial measurement, inharmonicity, tuning curve, unison beat tracking |
| `src/audio/` | AudioWorklet capture, analysis Web Worker, and the engine that connects them |
| `src/tuning/` | Thresholds, check verdicts, pitch-raise rules (passes, overpull), reading stabilization |
| `src/storage/` | IndexedDB access, the versioned file format, import/export |
| `src/screens/`, `src/components/` | React UI |
| `scripts/prepare-samples.sh` | Converts Salamander samples for the tests |

All thresholds are in `src/tuning/thresholds.ts`.
