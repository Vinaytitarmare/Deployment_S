// ... imports ...
import { useEffect, useState } from "react";
// import { supabase } from "@/lib/supabaseClient"; // REMOVED
import Timeline from "@/components/memory/Timeline";
import { useMemory } from "@/data/memoryStore";
import { getMoodBoostContent } from "@/lib/moodBoost"; // Use new function
import { detectSadMood } from "@/lib/moodDetection";
import { MemoryItem } from "@/types/memory";
import { ArrowLeft, Heart, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

export default function TodaysMood() {
  const { items, update, remove } = useMemory(); // Use memory hooks
  const [boostItems, setBoostItems] = useState<MemoryItem[]>([]);
  // const [loading, setLoading] = useState(true); // managed implicitly
  const [isSadToday, setIsSadToday] = useState(false);
  const [sadCount, setSadCount] = useState(0);

  useEffect(() => {
    async function analyzeMood() {
        if (items.length > 0) {
            // Check if user has 4+ sad items today
            const sad = detectSadMood(items);
            setIsSadToday(sad);
            
            // Count sad items today
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const sadEmotions = ['sad', 'depressed', 'down', 'unhappy', 'melancholy', 'gloomy'];
            const sadItemsCount = items.filter(item => {
                const itemDate = new Date(item.timestamp);
                itemDate.setHours(0, 0, 0, 0);
                const isToday = itemDate.getTime() === today.getTime();
                const emotionLower = (item.emotion || '').toLowerCase().trim();
                const isSad = emotionLower && sadEmotions.some(sad => emotionLower.includes(sad));
                return isToday && isSad;
            }).length;
            
            setSadCount(sadItemsCount);
            
            // Get mood-boosting content locally
            const content = await getMoodBoostContent(items);
            setBoostItems(content);
        }
    }
    analyzeMood();
  }, [items]);

  const toggleFavorite = async (id: string) => {
    const item = items.find(i => i.id === id);
    if(item) {
        update(id, { favorite: !item.favorite });
    }
  };

  const handleDelete = async (id: string) => {
    remove(id);
  };

  return (
    <div className="min-h-screen bg-zinc-950 p-6">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Header Section */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Link
                to="/"
                className="flex items-center gap-2 rounded-full bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Dashboard</span>
              </Link>
            </div>
            <h1 className="text-3xl font-bold text-zinc-100 flex items-center gap-3">
              <Heart className="h-8 w-8 text-pink-500" />
              Your Today's Mood
            </h1>
          </div>
        </div>

        {/* Mood Message */}
        {isSadToday && (
          <div className="rounded-2xl border border-pink-700/50 bg-gradient-to-br from-pink-500/10 to-pink-500/10 p-6 shadow-lg">
            <div className="flex items-start gap-4">
              <Heart className="h-6 w-6 text-pink-500 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-zinc-100 mb-2">
                  We noticed you might be feeling down today
                </h2>
                <p className="text-zinc-300 mb-3">
                  You've saved <span className="font-semibold text-pink-400">{sadCount} items</span> with sad emotions today. 
                  That's okay! Here's some content you've saved that might help brighten your mood.
                </p>
                <p className="text-sm text-zinc-400">
                  Remember: It's okay to feel down sometimes. Take care of yourself! 💙
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Content Section */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-5 w-5 text-cyan-400" />
            <h2 className="text-lg font-semibold text-zinc-300">
              Mood-Boosting Content
            </h2>
          </div>
          
          {boostItems.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-12 text-center">
              <Heart className="h-12 w-12 text-zinc-600 mx-auto mb-4" />
              <p className="text-zinc-400 text-lg mb-2">
                No mood-boosting content found at the moment
              </p>
              <p className="text-zinc-500 text-sm">
                Try saving some happy, inspiring, motivational, or funny content!
              </p>
            </div>
          ) : (
            <Timeline
              items={boostItems}
              onToggleFav={toggleFavorite}
              onDelete={handleDelete}
            />
          )}
        </section>
      </div>
    </div>
  );
}


