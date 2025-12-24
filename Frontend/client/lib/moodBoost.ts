import { MemoryItem } from "@/types/memory";

/**
 * Transforms database item to MemoryItem
 */
function transformDbItemToMemoryItem(dbItem: any): MemoryItem {
  const meta = dbItem.metadata;

  function deriveTypeFromUrl(url: string | null) {
    if (!url) return 'text';
    if (url.includes('youtube.com')) return 'youtube';
    if (url.includes('linkedin.com')) return 'linkedin';
    if (url.includes('x.com')) return 'twitter';
    if (url.includes('reddit.com')) return 'reddit';
    if (url.includes('quora.com')) return 'quora';
    if (url.includes('instagram.com')) return 'instagram';
    if (url.includes('github.com')) return 'github';
    if (url.endsWith('.pdf')) return 'pdf';
    return 'article';
  }

  return {
    id: String(dbItem.id),
    title: meta.title,
    summary: meta.summary,
    keywords: meta.keywords || [],
    emotion: meta.emotions ? meta.emotions[0] : 'neutral',
    timestamp: meta.timestamp || dbItem.created_at, // Use created_at as fallback
    url: meta.source_url,
    type: deriveTypeFromUrl(meta.source_url),
    favorite: dbItem.favorite,
    imageDataUrl: null,
  };
}


/**
 * Filters mood-boosting content from existing items
 * Searches for items with positive keywords: happy, motivational, inspiring, funny
 * @param items Array of available MemoryItems
 * @returns Array of MemoryItems that can boost mood
 */
export async function getMoodBoostContent(items: MemoryItem[]): Promise<MemoryItem[]> {
  try {
    // Define positive emotions (case variations)
    const positiveEmotions = ['Happy', 'Funny', 'Inspiring', 'Motivational', 'Positive', 'Excited', 'Joyful', 
                              'happy', 'funny', 'inspiring', 'motivational', 'positive', 'excited', 'joyful',
                              'HAPPY', 'FUNNY', 'INSPIRING'];
    const positiveKeywords = ['happy', 'motivational', 'inspiring', 'funny', 'uplifting', 'positive', 'joy', 'encouraging', 'motivate', 'laugh', 'smile'];

    console.log('Filtering mood boost content from local items...');
    
    // Filter client-side
    const allResults: MemoryItem[] = [];
    const seenIds = new Set<string>();

    items.forEach(item => {
        if (seenIds.has(item.id)) return;
        
        const emotion = (item.emotion || '').toLowerCase();
        const keywords = item.keywords || [];
        const title = (item.title || '').toLowerCase();
        const summary = (item.summary || '').toLowerCase();
        
        // Check if item has positive emotion
        const hasPositiveEmotion = positiveEmotions.some(pe => emotion.includes(pe.toLowerCase()));
        
        // Check if title/summary has positive keywords
        const textContent = `${title} ${summary} ${keywords.join(' ')}`.toLowerCase();
        const hasPositiveKeyword = positiveKeywords.some(kw => textContent.includes(kw));
        
        // Filter out explicitly negative stuff even if it has a positive keyword somehow (e.g. "not happy")
         const sadEmotions = ['sad', 'angry', 'depressed', 'negative', 'down', 'unhappy', 'melancholy'];
         const isNegative = sadEmotions.some(sad => emotion.includes(sad));

        if ((hasPositiveEmotion || hasPositiveKeyword) && !isNegative) {
          seenIds.add(item.id);
          allResults.push(item);
        }
      });

    console.log(`Total unique positive items found: ${allResults.length}`);

    // Sort by relevance (prefer items with multiple positive signals)
    const scored = allResults.map(item => {
      let score = 0;
      const emotionLower = (item.emotion || '').toLowerCase().trim();
      const keywordsLower = (item.keywords || []).join(' ').toLowerCase();
      const titleLower = (item.title || '').toLowerCase();
      const summaryLower = (item.summary || '').toLowerCase();
      const allText = `${titleLower} ${summaryLower} ${keywordsLower}`;

      // Check emotion
      const positiveEmotionMatches = ['happy', 'funny', 'inspiring', 'motivational', 'positive', 'excited', 'joyful'];
      if (positiveEmotionMatches.some(pe => emotionLower.includes(pe))) {
        score += 5; // Higher weight for emotion match
      }

      // Check keywords in content
      positiveKeywords.forEach(keyword => {
        if (allText.includes(keyword)) {
          score += 2;
        }
      });

      return { item, score };
    });

    // Sort by score and return top items
    const final = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map(x => x.item);

    return final;

  } catch (error) {
    console.error('Error in getMoodBoostContent:', error);
    return [];
  }
}

// Deprecated alias for backward compatibility until refactor complete, 
// but now just returns empty if called without args (which shouldn't happen if we fix callers)
// or we can make it throw to find bugs.
export async function fetchMoodBoostContent(): Promise<MemoryItem[]> {
    console.warn("fetchMoodBoostContent is deprecated. Use getMoodBoostContent(items) instead.");
    return []; 
}


