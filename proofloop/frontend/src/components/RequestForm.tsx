import { useState } from "react";

const SUGGESTIONS = [
  "Add email validation to the signup form",
  "Require passwords of at least 8 characters with one digit",
  "Make the name field required",
];

export default function RequestForm({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (prompt: string) => void;
}) {
  const [value, setValue] = useState("");

  const submit = (prompt: string) => {
    const trimmed = prompt.trim();
    if (!trimmed || busy) return;
    onSubmit(trimmed);
  };

  return (
    <section className="panel">
      <div className="stamp">
        <span className="stamp-word">REQUEST</span>
        <span className="stamp-note">plain English, one feature</span>
      </div>
      <div className="panel-pad">
        <label htmlFor="prompt" className="field-label">
          FEATURE REQUEST
        </label>
        <textarea
          id="prompt"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submit(value);
          }}
          rows={3}
          placeholder="Add email validation to the signup form — invalid emails show an error."
          className="request-textarea"
        />
        <div className="request-row">
          <button onClick={() => submit(value)} disabled={busy || !value.trim()} className="btn">
            {busy ? "Loop running…" : "Run the loop ▸"}
          </button>
          <kbd>Ctrl ⏎</kbd>
        </div>
        <div className="chips">
          <span className="chips-label">try:</span>
          {SUGGESTIONS.map((s) => (
            <button key={s} onClick={() => setValue(s)} disabled={busy} className="chip">
              {s}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
