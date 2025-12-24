import React, { useState } from "react";

type Props = {
  onClose: () => void;
  onResults?: (payload: { source: string; message?: string | null; recommendations: any[] }) => void;
};

export default function MoodModal({ onClose, onResults }: Props) {
  const [moodText, setMoodText] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Array<any> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const PRESET_MOODS = [
    'Inspiring',
    'Calm',
    'Sad',
    'Neutral',
    'Anger',
    'Positive',
    'Congratulations',
    'Enthusiasm',
    'Urgent',
    'Informative',
  ];

  async function handleSubmit(e?: React.FormEvent, moodParam?: string) {
    if (e) e.preventDefault();
    const mood = (moodParam ?? moodText ?? "").toString();
    if (!mood || mood.trim().length < 1) {
      setError("Please describe how you're feeling.");
      return;
    }
    setError(null);
    setLoading(true);
    setResults(null);

    try {
      // NOTE: backend runs on port 3001 by default. Change if needed.
      const res = await fetch("http://localhost:3001/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mood }),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Server error");
      }

      const json = await res.json();
      setMessage(json.message || null);
      let mapped: any[] = [];
      if (json.source === 'supabase' && Array.isArray(json.recommendations)) {
        mapped = json.recommendations.map((r: any) => ({
          id: r.id,
          title: r.metadata?.title || r.title,
          body: r.metadata?.summary || r.metadata?.summary_plain || r.description || '',
          raw: r
        }));
      } else {
        mapped = (json.recommendations || []).map((s: any) => ({ title: s.title, body: s.body }));
      }
      setResults(mapped);
      if (onResults) onResults({ source: json.source || 'ai', message: json.message || null, recommendations: mapped });
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to get recommendations.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit}>
        {/* Preset mood buttons — shown above the input */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 py-2">
          {PRESET_MOODS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => void handleSubmit(undefined, m)}
              className="rounded-lg border border-zinc-700 bg-zinc-800 p-3 text-center text-sm font-medium text-zinc-200 transition-all duration-200 hover:bg-cyan-500/20 hover:text-cyan-300 hover:border-cyan-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-zinc-900"
            >
              {m}
            </button>
          ))}
        </div>

        {/* One-line search/input for quick mood sentences (only input shown) */}
        <input
          value={moodText}
          onChange={(e) => setMoodText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void handleSubmit(undefined);
            }
          }}
          placeholder={`How are you feeling today?`}
          className="w-full rounded-md border border-zinc-800 bg-zinc-900 p-2 px-3 text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
        />

        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-cyan-500 px-4 py-2 text-sm font-semibold text-zinc-900 shadow hover:bg-cyan-400 disabled:opacity-60"
            >
              {loading ? "Thinking..." : "Get Recommendations"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-3 py-2 text-sm text-zinc-300 hover:text-zinc-100"
            >
              Close
            </button>
          </div>
        </div>
      </form>

      {error && <div className="text-sm text-rose-400">{error}</div>}

      {message && (
        <div className="text-sm text-zinc-300">{message}</div>
      )}

      {results && (
        <div className="mt-4 space-y-3">
          <h3 className="text-sm font-semibold text-zinc-200">Recommendations</h3>
          <div className="grid gap-3">
            {results.length === 0 && (
              <div className="rounded-md border border-zinc-800 bg-zinc-900 p-3 text-sm text-zinc-400">
                No content found — showing AI suggestions when available.
              </div>
            )}

            {results.map((r: any, idx: number) => (
              <div key={idx} className="rounded-lg border border-zinc-800 bg-gradient-to-br from-zinc-900/30 to-zinc-900/10 p-4">
                <h4 className="text-sm font-bold text-zinc-100">{r.title || `Suggestion ${idx + 1}`}</h4>
                <p className="mt-1 text-sm text-zinc-300">{r.body}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
