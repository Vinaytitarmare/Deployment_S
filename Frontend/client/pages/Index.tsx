'use client';

import QuickAdd from "@/components/memory/QuickAdd";
import SearchBar from "@/components/memory/SearchBar";
import Timeline from "@/components/memory/Timeline";
import { cn } from "@/lib/utils";
import { MemoryItem } from "@/types/memory";
import { useCallback, useEffect, useMemo, useState } from "react";

// --- 1. Import Dialog components and Plus icon ---
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Plus, X } from "lucide-react"; // Import X icon

// --- 2. Import your new MoodPopup component ---
import { MoodPopup } from "@/components/memory/MoodPopup";
// --- 3. Import mood detection and boost components ---
import { MoodBoostPopup } from "@/components/memory/MoodBoostPopup";
import { fetchMoodBoostContent } from "@/lib/moodBoost";
import { detectSadMood } from "@/lib/moodDetection";


// ... (imports remain)
import { useMemory } from "@/data/memoryStore"; // Import hook

// --- Main Page Component ---
export default function Index() {
  const { items, remove, update } = useMemory(); // Use the hook
  const [filteredIds, setFilteredIds] = useState<string[] | null>(null);
  // const [loading, setLoading] = useState(true); // managed by context implicitly or ignored for now
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [filterMode, setFilterMode] = useState<'all' | 'recent' | 'favorites'>('all');

  const [showMoodPopup, setShowMoodPopup] = useState(false);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  
  // Mood boost popup state
  const [showMoodBoostPopup, setShowMoodBoostPopup] = useState(false);
  const [moodBoostItems, setMoodBoostItems] = useState<MemoryItem[]>([]);
  const [checkedMoodToday, setCheckedMoodToday] = useState(false);

  // Function to check mood and show boost popup if needed
  const checkMoodAndBoost = useCallback(async (currentItems: MemoryItem[]) => {
    // Only check once per day
    const todayKey = `moodChecked_${new Date().toDateString()}`;
    if (sessionStorage.getItem(todayKey)) {
      return;
    }

    // Check if user has 4+ sad items today
    const isSad = detectSadMood(currentItems);
    
    if (isSad) {
      console.log('Sad mood detected - fetching mood boost content...');
      const boostContent = await fetchMoodBoostContent();
      setMoodBoostItems(boostContent);
      setShowMoodBoostPopup(true);
      sessionStorage.setItem(todayKey, 'true');
    }
  }, []);

  useEffect(() => {
     // Check mood when items change and we haven't checked yet
     if (!checkedMoodToday && items.length > 0) {
        checkMoodAndBoost(items);
        setCheckedMoodToday(true);
     }
  }, [items, checkMoodAndBoost, checkedMoodToday]);

  useEffect(() => {
    if (!sessionStorage.getItem('moodPopupShown')) {
      setShowMoodPopup(true);
      sessionStorage.setItem('moodPopupShown', 'true');
    }
  }, []);

  const toggleFavorite = async (id: string) => {
      // Use context update
      const item = items.find(i => i.id === id);
      if(item) {
          update(id, { favorite: !item.favorite });
      }
  };

  const handleDelete = async (id: string) => {
    remove(id);
  };

  const baseList = useMemo(() => {
    if (filterMode === 'recent') {
      // Sort by timestamp if available
      return [...items].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
    if (filterMode === 'favorites') {
      return items.filter((m) => m.favorite);
    }
    return items;
  }, [items, filterMode]);

  const searchedList = useMemo(() => {
    if (filteredIds === null) return baseList;
    const searchIdSet = new Set(filteredIds);
    return baseList.filter((item) => searchIdSet.has(item.id));
  }, [baseList, filteredIds]);
  
  const itemsToDisplay = useMemo(() => {
    if (selectedMood === null) return searchedList;
    return searchedList.filter(item => 
      (item.emotion || 'neutral').toLowerCase() === selectedMood.toLowerCase()
    );
  }, [searchedList, selectedMood]);

  const handleSearchResults = useCallback((ids: string[] | null) => {
    setFilteredIds(ids);
  }, []);

  const handleMoodSelect = (mood: string | null) => {
    setSelectedMood(mood);
    setShowMoodPopup(false);
  };



  // --- JSX Rendering ---
  return (
    <TooltipProvider>
      <MoodPopup 
        open={showMoodPopup}
        onOpenChange={setShowMoodPopup}
        onSelectMood={handleMoodSelect}
      />
      
      {/* Mood Boost Popup - Shows when user has 4+ sad items today */}
      <MoodBoostPopup
        open={showMoodBoostPopup}
        onOpenChange={setShowMoodBoostPopup}
        boostItems={moodBoostItems}
      />

      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-7xl ">
          <section className="rounded-3xl border border-border bg-card p-3 shadow-lg">
            <SearchBar onResults={handleSearchResults} />
          </section>
          
          <div className="space-y-6">
            
            {/* Filter Buttons */}
            <div className="flex items-center justify-center gap-3 py-4">
              <button
                onClick={() => setFilterMode('all')}
                className={cn(
                  'rounded-full px-5 py-2 text-sm font-semibold transition-all duration-200',
                  filterMode === 'all'
                    ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/50 hover:bg-cyan-400'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
              >
                All
              </button>
              <button
                onClick={() => setFilterMode('recent')}
                className={cn(
                  'rounded-full px-5 py-2 text-sm font-semibold transition-all duration-200',
                  filterMode === 'recent'
                    ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/50 hover:bg-cyan-400'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
              >
                Recent
              </button>
              <button
                onClick={() => setFilterMode('favorites')}
                className={cn(
                  'rounded-full px-5 py-2 text-sm font-semibold transition-all duration-200',
                  filterMode === 'favorites'
                    ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/50 hover:bg-cyan-400'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
              >
                Favorites
              </button>

              {/* Clear Mood Button */}
              {selectedMood && (
                <button
                  onClick={() => setSelectedMood(null)}
                  className="flex items-center gap-1.5 rounded-full bg-muted px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted/80"
                >
                  <span>{selectedMood}</span>
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Main Timeline Section */}
            <section>
              <h2 className="text-sm font-semibold mb-3 text-muted-foreground">
                {selectedMood ? `"${selectedMood}" Memories` 
                  : filteredIds ? "Search Results" 
                  : filterMode.charAt(0).toUpperCase() + filterMode.slice(1)
                }
              </h2>
              <Timeline
                items={itemsToDisplay}
                onToggleFav={toggleFavorite}
                onDelete={handleDelete}
              />
            </section>
          </div>
          {/* The empty sidebar div has been removed */}

          {/* <Analytics items={items} /> */}
        </div>

        {/* --- Floating Quick Add Button --- */}
        <Dialog open={showQuickAdd} onOpenChange={setShowQuickAdd}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setShowQuickAdd(true)}
                className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 text-white shadow-lg transition-transform hover:scale-110 animate-pulse-blue"
                aria-label="Quick Add New Memory"
              >
                <Plus className="h-7 w-7" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="left" align="center" className="bg-popover text-popover-foreground border-border">
              <p>Quick Add New Memory</p>
            </TooltipContent>
          </Tooltip>
          
          <DialogContent className="border-border bg-card text-card-foreground shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl text-foreground">
                Quick Add Memory
              </DialogTitle>
            </DialogHeader>
            <QuickAdd onClose={() => setShowQuickAdd(false)} />
          </DialogContent>
        </Dialog>

      </div>
    </TooltipProvider>
  );
}