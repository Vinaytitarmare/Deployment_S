import { MemoryItem } from "@/types/memory";

/**
 * Checks if user has saved 4+ sad items today
 * @param items Array of memory items
 * @returns true if user has 4+ sad items saved today
 */
export function detectSadMood(items: MemoryItem[]): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Match various forms of sad emotions (case-insensitive)
  const sadEmotions = ['sad', 'depressed', 'down', 'unhappy', 'melancholy', 'gloomy'];
  
  const sadItemsToday = items.filter(item => {
    // Check if item was created today (based on timestamp)
    // Try to parse the timestamp (could be from metadata.timestamp or created_at)
    let itemDate: Date;
    try {
      if (!item.timestamp) return false;
      itemDate = new Date(item.timestamp);
      
      // Check if date is valid
      if (isNaN(itemDate.getTime())) {
        return false;
      }
      
      itemDate.setHours(0, 0, 0, 0);
    } catch (e) {
      // If timestamp is invalid, skip this item
      return false;
    }
    
    const isToday = itemDate.getTime() === today.getTime();
    if (!isToday) return false;

    // Check if emotion is sad (case-insensitive comparison)
    const emotionLower = (item.emotion || '').toLowerCase().trim();
    const isSad = emotionLower && sadEmotions.some(sad => emotionLower.includes(sad));

    return isSad;
  });

  console.log(`Found ${sadItemsToday.length} sad items today (threshold: 4)`);
  return sadItemsToday.length >= 4;
}

/**
 * Gets the date string for today in ISO format (YYYY-MM-DD)
 */
export function getTodayDateString(): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.toISOString().split('T')[0];
}

