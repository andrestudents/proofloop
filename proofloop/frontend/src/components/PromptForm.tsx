import { useState } from "react";

const SUGGESTIONS = [
  "Add email validation to the signup form — reject invalid emails with a visible error message",
  "Require the password to be at least 8 characters, show an error when it is shorter",
  "Make the Name field required and show an error message when it is left empty",
];

export default function PromptForm({
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
    <div className="rounded-xl border border-[#232d42] bg-[#131a2a] p-4">
      <label htmlFor="prompt" className="mb-2 block text-sm font-semibold text-slate-200">
        Feature request
      </label>
      <textarea
        id="prompt"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submit(value);
        }}
        rows={3}
        placeholder='e.g. "add email validation to the signup form"'
        className="w-full resize-none rounded-lg border border-[#2a3448] bg-[#0e1424] px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-sky-500/60 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => submit(value)}
          disabled={busy || !value.trim()}
          className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500"
        >
          {busy ? "Run in progress…" : "Generate ▸"}
        </button>
        <span className="text-[11px] text-slate-500">Ctrl+Enter to start</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => setValue(s)}
            disabled={busy}
            className="rounded-full border border-[#2a3448] px-2.5 py-1 text-[11px] text-slate-400 transition hover:border-sky-500/50 hover:text-sky-300 disabled:opacity-40"
          >
            {s.split("—")[0].trim().toLowerCase()}
          </button>
        ))}
      </div>
    </div>
  );
}
