import { useApp } from '../app/context';

export function Learn() {
  const { settings, updateSettings, navigate } = useApp();
  const firstRun = !settings.primerSeen;

  const done = () => {
    updateSettings({ primerSeen: true });
    navigate('home');
  };

  return (
    <div className="stack">
      {firstRun ? (
        <section className="card">
          <h1>Welcome</h1>
          <p style={{ margin: 0 }}>
            This app helps you check your piano and tune it yourself. A few minutes here will help you get good results and
            avoid damage.
          </p>
        </section>
      ) : null}

      <section className="card">
        <h2>What you need</h2>
        <ul style={{ margin: 0, paddingLeft: '1.2em' }}>
          <li>
            <strong>Nothing</strong>, to check your piano: just this app and a quiet room.
          </li>
          <li>
            <strong>A tuning lever</strong> (tuning hammer) that fits your piano's pins (most use a #2 star tip).
          </li>
          <li>
            <strong>Mutes</strong>: rubber wedges or a felt strip, to silence the other strings of a note while you tune one.
          </li>
        </ul>
      </section>

      <section className="card">
        <h2>Using the lever</h2>
        <ul style={{ margin: 0, paddingLeft: '1.2em' }}>
          <li>Seat the lever fully on the pin, with the handle pointing roughly up (around 12 o'clock).</li>
          <li>Clockwise raises the pitch; counter-clockwise lowers it.</li>
          <li>Use tiny, gentle movements. The pin should twist very slightly, not bend.</li>
          <li>Approach the target from below and finish by tightening, so the pin stays set.</li>
          <li>Play the note firmly after every movement and watch the needle.</li>
        </ul>
      </section>

      <section className="card">
        <h2>Risks</h2>
        <ul style={{ margin: 0, paddingLeft: '1.2em' }}>
          <li>Strings can break, especially old or rusty ones, and especially when raising pitch a lot.</li>
          <li>Forcing the lever sideways can loosen tuning pins.</li>
          <li>Always check you are on the right pin for the string you are playing before turning.</li>
          <li>Large pitch changes drift back within weeks. Several passes, and a re-check later, give a stable result.</li>
        </ul>
      </section>

      <section className="card">
        <h2>What the numbers mean</h2>
        <details className="info" open={!firstRun}>
          <summary>Cents</summary>
          <p>
            A cent is 1/100 of a semitone. Most people hear a difference of about 5 cents between two notes played one after
            the other. The app aims for within ±1 cent.
          </p>
        </details>
        <details className="info">
          <summary>Why targets aren't exact multiples of 440</summary>
          <p>
            Piano strings are stiff, so their overtones sound slightly sharp. To keep octaves sounding clean, tuners stretch
            the scale: the treble ends up a little sharp and the bass a little flat. The app measures your piano's strings in
            the check and computes a stretched target for every key.
          </p>
        </details>
        <details className="info">
          <summary>Unisons</summary>
          <p>
            Most notes have two or three strings. When they disagree you hear a slow wobble (beating). Mute all but one
            string, tune it to the needle, then do the same for each of the others.
          </p>
        </details>
        <details className="info">
          <summary>Touch-up or pitch raise?</summary>
          <p>
            A touch-up keeps the piano at its current pitch and fixes notes that stand out. A pitch raise moves the whole
            piano back to A440, in one or more passes. On the rough passes the app aims a little past pitch (overpull),
            because tightening later strings pulls the earlier ones flat again.
          </p>
        </details>
      </section>

      {firstRun ? (
        <button className="primary block" onClick={done}>
          Get started
        </button>
      ) : null}
    </div>
  );
}
