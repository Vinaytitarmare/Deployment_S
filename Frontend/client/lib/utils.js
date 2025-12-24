import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

// NEW: This is the missing 'cn' function your components need.
// It merges multiple class names together intelligently.
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}


// This is your existing function to group items by date.
export function groupByDate(items) {
  return items.reduce((groups, item) => {
    // Use the item's timestamp to group by date
    const date = new Date(item.timestamp).toDateString();
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(item);
    return groups;
  }, {});
}