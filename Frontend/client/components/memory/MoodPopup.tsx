'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

// List of moods. You can customize these!
// Using simple strings. You can add emojis too.
const moods = [
  "Inspiring",
  "Calm",
  "Sad",
  "Neutral",
  "Anger",
  "Positive",
  "Congratulations",
  "Enthusiasm",
  "Urgent",
  "Informative"
];

interface MoodPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectMood: (mood: string | null) => void;
}

export function MoodPopup({ open, onOpenChange, onSelectMood }: MoodPopupProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-zinc-800 bg-zinc-900 text-zinc-200 shadow-2xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center text-zinc-100">
            How are you feeling right now?
          </DialogTitle>
          <DialogDescription className="text-center text-zinc-400 pt-2">
            Select a mood to get a personalized feed of your memories.
          </DialogDescription>
        </DialogHeader>
        
        {/* Grid for mood buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 py-4">
          {moods.map((mood) => (
            <button
              key={mood}
              onClick={() => onSelectMood(mood)}
              className="rounded-lg border border-zinc-700 bg-zinc-800 p-4 text-center font-medium text-zinc-200
                         transition-all duration-200
                         hover:bg-cyan-500/20 hover:text-cyan-300 hover:border-cyan-700
                         focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-zinc-900"
            >
              {mood}
            </button>
          ))}
        </div>
        
        <div className="text-center">
          <button
            onClick={() => onSelectMood(null)}
            className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Or, just show me everything
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}