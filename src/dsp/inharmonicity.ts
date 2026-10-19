import { KEY_COUNT } from './notes';

// Typical inharmonicity of a medium-size piano. Log B is roughly linear on each
// side of a minimum near the bass/tenor break (around key 20, F2).
export function defaultInharmonicity(key: number): number {
  const exponent = key >= 20 ? -3.9 + 0.03 * (key - 20) : -3.9 + 0.015 * (20 - key);
  return 10 ** exponent;
}

export function defaultInharmonicityCurve(): Float64Array {
  const b = new Float64Array(KEY_COUNT);
  for (let k = 0; k < KEY_COUNT; k++) b[k] = defaultInharmonicity(k);
  return b;
}

// Builds a full-keyboard B curve from sparse measurements. Interpolates log B
// linearly between measured keys and follows the default curve's shape beyond
// the outermost measurements.
export function interpolateInharmonicity(measured: ReadonlyMap<number, number>): Float64Array {
  const points = [...measured.entries()]
    .filter(([k, b]) => k >= 0 && k < KEY_COUNT && b > 0 && Number.isFinite(b))
    .sort((a, b) => a[0] - b[0]);
  const curve = defaultInharmonicityCurve();
  if (points.length === 0) return curve;

  const logDefault = (k: number) => Math.log(defaultInharmonicity(k));
  const [firstKey, firstB] = points[0];
  const [lastKey, lastB] = points[points.length - 1];
  for (let k = 0; k < KEY_COUNT; k++) {
    if (k <= firstKey) {
      curve[k] = Math.exp(Math.log(firstB) + logDefault(k) - logDefault(firstKey));
    } else if (k >= lastKey) {
      curve[k] = Math.exp(Math.log(lastB) + logDefault(k) - logDefault(lastKey));
    } else {
      let i = 0;
      while (points[i + 1][0] < k) i++;
      const [k0, b0] = points[i];
      const [k1, b1] = points[i + 1];
      const t = (k - k0) / (k1 - k0);
      curve[k] = Math.exp(Math.log(b0) * (1 - t) + Math.log(b1) * t);
    }
  }
  return curve;
}
