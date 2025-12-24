'use client';

import { useMemory } from "@/data/memoryStore";
import { useEffect, useState } from "react";

export default function SearchBar({
  onResults,
}: {
  onResults: (ids: string[] | null) => void;
}) {
  const { items } = useMemory();
  const [mode, setMode] = useState<"text" | "emotion" | "image">("text");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [imageKeywords, setImageKeywords] = useState<string[]>([]);

  const emotions = ["Positive", "Informative", "Analytical", "Excited", "Neutral", "Personal"];
  
  // --- Text search logic (Local) ---
  useEffect(() => {
    if (mode !== 'text') return;
    
    const handler = setTimeout(() => {
        const trimmedQuery = query.trim().toLowerCase();
        if (trimmedQuery === "") {
            onResults(null);
            return;
        }
        
        // Simple client-side search
        const matched = items.filter(item => {
            const title = (item.title || "").toLowerCase();
            const summary = (item.summary || "").toLowerCase();
            const keywords = (item.keywords || []).map(k => k.toLowerCase()).join(" ");
            
            return title.includes(trimmedQuery) || summary.includes(trimmedQuery) || keywords.includes(trimmedQuery);
        });
        
        onResults(matched.map(i => i.id));
    }, 300);

    return () => clearTimeout(handler);
  }, [query, mode, onResults, items]);

  
  async function handleEmotion(emotion: string) {
    setLoading(true);
    // Local filter by emotion
    const target = emotion.toLowerCase();
    const matched = items.filter(item => (item.emotion || "").toLowerCase().includes(target));
    onResults(matched.map(m => m.id));
    setLoading(false);
  }

  async function handleImage(file?: File | null) {
    if (!file) return;
    setLoading(true);
    setImageKeywords([]);
    onResults(null);
    try {
      const formData = new FormData();
      formData.append('image', file);
      // Keep using backend for Image -> Keywords
      const response = await fetch('http://localhost:3001/searchByImage', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }
      const result = await response.json();
      const keywords = (result.keywords || []) as string[];
      setImageKeywords(keywords);

      if (keywords.length === 0) {
        onResults([]);
        return;
      }

      // Local filter using keywords
      const matched = items.filter(item => {
          const itemText = `${item.title || ''} ${item.summary || ''} ${(item.keywords || []).join(' ')}`.toLowerCase();
          // Match if ANY keyword exists in text
          return keywords.some(k => itemText.includes(k.toLowerCase()));
      });
      
      onResults(matched.map(m => m.id));

    } catch (error) {
      console.error("Error during image search:", error);
      onResults([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex gap-1 rounded-lg bg-card p-1 border border-border">
          <button
            onClick={() => { setMode("text"); setQuery(""); setImageKeywords([]); onResults(null); }}
            className={`rounded px-3 py-1 text-xs font-medium transition ${mode === "text" ? "bg-muted text-cyan-400" : "text-muted-foreground hover:text-foreground"}`}
          >
            Text
          </button>
          <button
            onClick={() => { setMode("emotion"); setQuery(""); setImageKeywords([]); onResults(null); }}
            className={`rounded px-3 py-1 text-xs font-medium transition ${mode === "emotion" ? "bg-muted text-cyan-400" : "text-muted-foreground hover:text-foreground"}`}
          >
            Emotion
          </button>
          <button
            onClick={() => { setMode("image"); setQuery(""); setImageKeywords([]); onResults(null); }}
            className={`rounded px-3 py-1 text-xs font-medium transition ${mode === "image" ? "bg-muted text-cyan-400" : "text-muted-foreground hover:text-foreground"}`}
          >
            Image
          </button>
        </div>

        {mode === "text" && (
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search..."
            className="h-9 flex-1 rounded-lg border border-border bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-ring transition-colors"
          />
        )}

        {mode === "image" && (
          <label className="flex h-9 flex-1 cursor-pointer items-center justify-center rounded-lg border border-border bg-card text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            {loading ? "Processing..." : "Upload"}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImage(e.target.files?.[0])} />
          </label>
        )}
      </div>

      {mode === "emotion" && (
        <div className="flex flex-wrap gap-1.5">
          {emotions.map((e) => (
            <button
              key={e}
              onClick={() => handleEmotion(e)}
              className="rounded-md bg-card border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-cyan-400 transition-colors"
            >
              {e}
            </button>
          ))}
        </div>
      )}

      {imageKeywords.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {imageKeywords.map(k => (
            <span key={k} className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">{k}</span>
          ))}
        </div>
      )}
    </div>
  );
}
