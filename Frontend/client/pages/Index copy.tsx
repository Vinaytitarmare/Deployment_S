'use client';

import Analytics from "@/components/memory/Analytics";
import MemoryCard from "@/components/memory/MemoryCard";
import QuickAdd from "@/components/memory/QuickAdd";
import SearchBar from "@/components/memory/SearchBar";
import Timeline from "@/components/memory/Timeline";
import { supabase } from "@/lib/supabaseClient";
import { MemoryItem } from "@/types/memory";
import { useEffect, useMemo, useState } from "react";

// --- NEW: Import the Tooltip components ---
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"; // Adjust path if needed

// --- Data Transformation Helper ---
function transformDbItemToMemoryItem(dbItem) {
    const meta = dbItem.metadata;

    function deriveTypeFromUrl(url) {
        if (!url) return 'text';
        if (url.includes('youtube.com')) return 'youtube';
        if (url.includes('linkedin.com')) return 'linkedin';
        if (url.includes('x.com')) return 'twitter';
        if (url.includes('reddit.com')) return 'reddit'; // Added
        if (url.includes('quora.com')) return 'quora'; // Added
        if (url.includes('instagram.com')) return 'instagram'; 
        if (url.includes('github.com')) return 'github'; // Added
        if (url.endsWith('.pdf')) return 'pdf';
        return 'article';
    }

    return {
        id: String(dbItem.id),
        title: meta.title,
        summary: meta.summary,
        keywords: meta.keywords,
        emotion: meta.emotions ? meta.emotions[0] : undefined,
        timestamp: meta.timestamp,
        url: meta.source_url,
        type: deriveTypeFromUrl(meta.source_url),
        favorite: dbItem.favorite,
        imageDataUrl: null, // This is still null as per previous code
    };
}

// --- Main Page Component ---
export default function Index() {
    const [items, setItems] = useState<MemoryItem[]>([]);
    const [filteredIds, setFilteredIds] = useState<string[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [preferences, setPreferences] = useState({ localOnly: true, excludedKeywords: [] });
    const [showQuickAdd, setShowQuickAdd] = useState(false);

    // Fetch data and set up realtime listener
    useEffect(() => {
        async function fetchData() {
            setLoading(true);
            const { data, error } = await supabase
                .from('content_documents')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error("Error fetching data:", error);
            } else if (data) {
                const transformedItems = data.map(transformDbItemToMemoryItem);
                setItems(transformedItems);
            }
            setLoading(false);
        }
        fetchData();

        // Realtime subscription
        const channel = supabase
            .channel('content_documents_changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'content_documents' },
                (payload) => {
                    console.log('Realtime change received!', payload);
                    fetchData();
                }
            )
            .subscribe();

        // Cleanup
        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // Handle toggling favorites
    const toggleFavorite = async (id: string) => {
        const currentItem = items.find(item => item.id === id);
        if (!currentItem) return;
        const newFavoriteStatus = !currentItem.favorite;

        setItems(items.map(item =>
            item.id === id ? { ...item, favorite: newFavoriteStatus } : item
        ));

        const { error } = await supabase
            .from('content_documents')
            .update({ favorite: newFavoriteStatus })
            .eq('id', id);

        if (error) {
            console.error("Error updating favorite:", error);
            setItems(items.map(item =>
                item.id === id ? { ...item, favorite: !newFavoriteStatus } : item
            ));
        }
    };

    // Handle deleting items
    const handleDelete = async (id: string) => {
        console.log("Deleting item with ID:", id);
        setItems(currentItems => currentItems.filter(item => item.id !== id));

        const { error } = await supabase
            .from('content_documents')
            .delete()
            .eq('id', id);

        if (error) {
            console.error("Error deleting item:", error);
            // Consider re-fetching or reverting state
        } else {
            console.log("Item deleted successfully from database.");
        }
    };

    // Calculate filtered items
    const filteredItems = useMemo(() => {
        if (filteredIds === null) return items;
        const searchIdSet = new Set(filteredIds);
        return items.filter((item) => searchIdSet.has(item.id));
    }, [items, filteredIds]);

    // Calculate recent items
    const recent = useMemo(
        () => [...items]
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, 6),
        [items],
    );

    // Calculate favorite items
    const favorites = useMemo(
        () => items.filter((m) => m.favorite).slice(0, 6),
        [items],
    );
    
    // Handler for search results
    const handleSearchResults = (ids: string[] | null) => setFilteredIds(ids);

    if (loading) {
        return <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-300">Loading your memories...</div>
    }

    // --- JSX Rendering ---
    return (
        // 1. Wrap the entire component in TooltipProvider
        <TooltipProvider>
            <div className="min-h-screen bg-zinc-950 p-6">
                <div className="mx-auto max-w-7xl space-y-8">
                    <section className="rounded-2xl border border-zinc-700/60 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 p-6 shadow-lg">
                        <SearchBar onResults={handleSearchResults} />
                    </section>

                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                        <div className="space-y-6 lg:col-span-2">
                            <section>
                                <h2 className="text-sm font-semibold mb-3 text-zinc-300">
                                    {filteredIds ? "Search Results" : "Recent"}
                                </h2>
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    {(filteredIds ? filteredItems : recent).map((m) => (
                                        <MemoryCard key={m.id} item={m} onToggleFav={toggleFavorite} onDelete={handleDelete} />
                                    ))}
                                </div>
                            </section>

                            <section>
                                <h2 className="text-sm font-semibold mb-3 text-zinc-300">Timeline</h2>
                                <Timeline
                                    items={filteredItems}
                                    onToggleFav={toggleFavorite}
                                    onDelete={handleDelete}
                                />
                            </section>
                        </div>

                        {/* --- THIS IS THE UPDATED SIDEBAR --- */}
                        <div className="space-y-6 relative z-10 mt-[-20px]">
                            
                            {/* 2. Button is wrapped in Tooltip components */}
                            <div className="flex justify-end">
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            onClick={() => setShowQuickAdd(!showQuickAdd)}
                                            className="inline-flex h-9 w-9 mb-[-10px] items-center justify-center rounded-full bg-gradient-to-br from-cyan-500/80 to-blue-500/80 text-white shadow-md transition hover:opacity-90"
                                            aria-label={showQuickAdd ? "Close Quick Add form" : "Open Quick Add form"}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <line x1="12" y1="5" x2="12" y2="19"></line>
                                                <line x1="5" y1="12" x2="19" y2="12"></line>
                                            </svg>
                                        </button>
                                    </TooltipTrigger>
                                    {/* 3. This is the styled tooltip content */}
                                    <TooltipContent side="top" align="center" className="bg-zinc-800 text-zinc-200 border-zinc-700">
                                        <p>{showQuickAdd ? "Close Quick Add" : "Quick Add New Memory"}</p>
                                    </TooltipContent>
                                </Tooltip>
                            </div>

                            {showQuickAdd && <QuickAdd onClose={() => setShowQuickAdd(false)} />}
                            
                            <section className="rounded-xl border border-zinc-700/60 bg-zinc-900 p-4 shadow-sm">
                                <h3 className="mb-2 text-sm font-semibold text-zinc-300">Favorites</h3>
                                {favorites.length === 0 && (
                                    <p className="text-sm text-zinc-500">No favorites yet.</p>
                                )}
                                <div className="grid grid-cols-1 gap-3">
                                    {favorites.map((m) => (
                                        <MemoryCard key={m.id} item={m} onToggleFav={toggleFavorite} onDelete={handleDelete} />
                                    ))}
                                </div>
                            </section>
                             {/* Optional: Your privacy controls JSX */}
                        </div>
                    </div>

                    <Analytics items={items} />
                </div>
            </div>
        </TooltipProvider>
    );
}