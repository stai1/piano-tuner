import { KEY_COUNT, isBlackKey, keyName } from '../dsp/notes';

interface Props {
  current?: number | null;
  done?: ReadonlySet<number>;
  marked?: ReadonlySet<number>;
  onSelect?: (key: number) => void;
}

// All 88 keys in a row, colored by state. Tapping a key selects it.
export function KeyboardStrip({ current, done, marked, onSelect }: Props) {
  return (
    <div>
      <div className="keys" role="group" aria-label="Piano keyboard">
        {Array.from({ length: KEY_COUNT }, (_, k) => {
          const cls = [
            'key',
            isBlackKey(k) ? 'black' : '',
            done?.has(k) ? 'done' : marked?.has(k) ? 'mark' : '',
            current === k ? 'current' : '',
          ].join(' ');
          return (
            <button
              key={k}
              type="button"
              className={cls}
              aria-label={keyName(k)}
              aria-pressed={current === k}
              onClick={onSelect ? () => onSelect(k) : undefined}
              tabIndex={onSelect ? 0 : -1}
            />
          );
        })}
      </div>
      <div className="keys-labels" aria-hidden="true">
        <span>A0</span>
        <span>C4</span>
        <span>C8</span>
      </div>
    </div>
  );
}
