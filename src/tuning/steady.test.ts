import { describe, expect, it } from 'vitest';
import { ReadingHistory } from './steady';

describe('ReadingHistory', () => {
  it('settles once readings hold still', () => {
    const h = new ReadingHistory(48);
    [3, 2.6, 2.4, 2.5, 2.3, 2.5].forEach((c, i) => h.add({ time: i * 100, cents: c, b: 4e-4 }));
    expect(h.steady()).toBe(true);
    expect(h.value()).toBeCloseTo(2.5);
    expect(h.inharmonicity()).toBeCloseTo(4e-4);
  });

  it('is not steady while the pitch moves', () => {
    const h = new ReadingHistory(48);
    [0, 1, 2, 3, 4, 5].forEach((c, i) => h.add({ time: i * 100, cents: c, b: null }));
    expect(h.steady()).toBe(false);
    expect(h.inharmonicity()).toBeNull();
  });

  it('only considers the last moment', () => {
    const h = new ReadingHistory(48);
    [20, 20, 1, 1.2, 1.1, 1, 1.1, 1.2, 1.1].forEach((c, i) => h.add({ time: i * 150, cents: c, b: null }));
    expect(h.steady()).toBe(true);
  });
});
