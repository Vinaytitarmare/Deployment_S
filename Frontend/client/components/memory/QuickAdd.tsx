'use client';

import { cn } from "@/lib/utils";
import { useState } from "react";

// 1. Add onClose prop to be called when the form is submitted
export default function QuickAdd({ onClose }: { onClose: () => void }) {
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function onAdd() {
        // 2. Clear previous errors and set loading
        setError(null);
        if (!title.trim() && !content.trim()) {
            setError("Please enter a title or some content.");
            return;
        }
        setLoading(true);
        
        try {
            // 3. Construct JSON payload
            let inputUrl: string | null = null;
            let inputText = "";

            const trimmedContent = content.trim();
            // Simple check for URL
            if (trimmedContent.startsWith('http://') || trimmedContent.startsWith('https://')) {
                inputUrl = trimmedContent;
            } else {
                inputText = trimmedContent;
            }

            const payload = {
                title: title.trim(),
                url: inputUrl,
                text: inputText
            };

            const response = await fetch('http://localhost:3001/receive_data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`Server responded with status: ${response.status}`);
            }

            const result = await response.json();
            console.log("Successfully added and processed by backend:", result);
            
            // 4. Clear fields and close modal
            setTitle("");
            setContent("");
            onClose(); // <-- Call the close function

        } catch (err) {
            console.error("Failed to add memory:", err);
            setError(err instanceof Error ? err.message : "An unknown error occurred.");
        } finally {
            setLoading(false);
        }
    }

    // 5. This is the new JSX matching your screenshot
    return (
        <div className="grid gap-4 py-4">
            <div className="grid gap-2">
                <label htmlFor="title" className="text-sm font-medium text-zinc-400">
                    Title
                </label>
                <input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="What's this about?"
                    className="h-10 rounded-md border border-zinc-700 bg-zinc-800 px-3 text-sm text-zinc-200 placeholder:text-zinc-500 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                />
            </div>
            <div className="grid gap-2">
                <label htmlFor="content" className="text-sm font-medium text-zinc-400">
                    Content or URL
                </label>
                <textarea
                    id="content"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Paste a URL, or write a quick note..."
                    rows={4}
                    className="w-full resize-none rounded-md border border-zinc-700 bg-zinc-800 p-3 text-sm text-zinc-200 placeholder:text-zinc-500 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                />
            </div>
            
            {/* AI Auto-generate info box */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
                <p className="mb-3 text-sm font-medium text-zinc-300">
                    AI will auto-generate:
                </p>
                <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-cyan-500/20 px-3 py-1 text-xs text-cyan-300">
                        Keywords
                    </span>
                    <span className="rounded-full bg-purple-500/20 px-3 py-1 text-xs text-purple-300">
                        Emotions
                    </span>
                    <span className="rounded-full bg-pink-500/20 px-3 py-1 text-xs text-pink-300">
                        Summary
                    </span>
                </div>
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            {/* 6. New buttons from your screenshot */}
            <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                    onClick={onClose}
                    className={cn(
                        "rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-300 transition-colors hover:bg-zinc-700",
                        loading && "opacity-50"
                    )}
                    disabled={loading}
                >
                    Cancel
                </button>
                <button
                    onClick={onAdd}
                    className={cn(
                        "rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-md transition-opacity hover:opacity-90",
                        loading && "opacity-50 animate-pulse"
                    )}
                    disabled={loading}
                >
                    {loading ? "Saving..." : "Save Memory"}
                </button>
            </div>
        </div>
    );
}