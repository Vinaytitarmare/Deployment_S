'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { MemoryItem } from "@/types/memory";
import { Heart, Sparkles, Smile, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface MoodBoostPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boostItems: MemoryItem[];
}

export function MoodBoostPopup({ open, onOpenChange, boostItems }: MoodBoostPopupProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-zinc-800 bg-zinc-900 text-zinc-200 shadow-2xl sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center text-zinc-100 flex items-center justify-center gap-2">
            <Heart className="h-6 w-6 text-pink-500" />
            We noticed you might be feeling down today
          </DialogTitle>
          <DialogDescription className="text-center text-zinc-400 pt-2">
            Here's some content you've saved that might brighten your mood! 🌟
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {boostItems.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-zinc-400">We couldn't find any mood-boosting content at the moment.</p>
              <p className="text-zinc-500 text-sm mt-2">Try saving some happy, inspiring, or funny content!</p>
            </div>
          ) : (
            <>
              <div className="grid gap-3">
                {boostItems.slice(0, 5).map((item) => (
                  <Card key={item.id} className="border-zinc-700 bg-zinc-800/50 hover:bg-zinc-800 transition-colors">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base text-zinc-100 line-clamp-2">
                          {item.title}
                        </CardTitle>
                        {item.type === 'youtube' && <TrendingUp className="h-4 w-4 text-red-500 flex-shrink-0 mt-1" />}
                        {(item.emotion === 'funny' || item.emotion === 'Funny') && <Smile className="h-4 w-4 text-yellow-500 flex-shrink-0 mt-1" />}
                        {(item.emotion === 'inspiring' || item.emotion === 'Inspiring') && <Sparkles className="h-4 w-4 text-cyan-500 flex-shrink-0 mt-1" />}
                      </div>
                    </CardHeader>
                    {item.summary && (
                      <CardContent className="pt-0">
                        <CardDescription className="text-zinc-400 text-sm line-clamp-2">
                          {item.summary}
                        </CardDescription>
                        {item.url && (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-cyan-400 hover:text-cyan-300 mt-2 inline-block"
                          >
                            View original →
                          </a>
                        )}
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
              
              <div className="pt-4 border-t border-zinc-800">
                <div className="flex items-center gap-2 text-sm text-zinc-400 mb-2">
                  <Heart className="h-4 w-4 text-pink-500" />
                  <span>Remember: It's okay to feel down sometimes. Take care of yourself!</span>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button
            onClick={() => onOpenChange(false)}
            variant="outline"
            className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
          >
            Thanks, I'll check these out
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

