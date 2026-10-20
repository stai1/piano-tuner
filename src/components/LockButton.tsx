// Toggle that holds the tuner on the current note.
export function LockButton({ locked, disabled, onToggle }: { locked: boolean; disabled?: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className={`icon lock${locked ? ' active' : ''}`}
      aria-label={locked ? 'Holding this note. Follow what I play instead' : 'Hold this note'}
      aria-pressed={locked}
      title={locked ? 'Holding this note' : 'Hold this note'}
      disabled={disabled}
      onClick={onToggle}
    >
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <rect x="5" y="11" width="14" height="10" rx="2" fill="currentColor" />
        <path
          d={locked ? 'M8 11V8a4 4 0 0 1 8 0v3' : 'M8 11V8a4 4 0 0 1 7.5-2'}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}
