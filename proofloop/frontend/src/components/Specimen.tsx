import { useState } from "react";

const TARGET_URL = "http://localhost:4000";

/**
 * The app under test, presented as a specimen: a browser frame with the
 * real URL, reloaded whenever a run finishes verifying. Served in demo mode
 * too — the committed target-app is the end state of the recorded run.
 */
export default function Specimen({ refreshKey }: { refreshKey: number }) {
  const [manualKey, setManualKey] = useState(0);

  return (
    <section className="panel">
      <div className="browser-bar">
        <div className="browser-dots">
          <span />
          <span />
          <span />
        </div>
        <span className="browser-url">localhost:4000 — signup form under test</span>
        <button onClick={() => setManualKey((k) => k + 1)} className="browser-refresh">
          reload ⟳
        </button>
      </div>
      <div className="specimen-body">
        <iframe
          key={`${refreshKey}-${manualKey}`}
          src={`${TARGET_URL}/?t=${refreshKey}-${manualKey}`}
          title="Target app under test"
        />
      </div>
    </section>
  );
}
