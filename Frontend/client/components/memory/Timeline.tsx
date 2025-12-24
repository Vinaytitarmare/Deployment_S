import { groupByDate } from "@/lib/search"; // Make sure path is correct
import { MemoryItem } from "@/types/memory"; // Make sure path is correct
import MemoryCard from "./MemoryCard";

// This version now correctly accepts `items` and `onToggleFav` as props.
export default function Timeline({
  items,
  onToggleFav,
  onDelete,
}: {
  items: MemoryItem[];
  onToggleFav?: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  // This is your original, correct rendering logic.
  const groups = groupByDate(items);
  const keys = Object.keys(groups)
    .map((k) => new Date(k))
    .sort((a, b) => b.getTime() - a.getTime())
    .map((d) => d.toDateString());
    
  return (
    <div className="space-y-6">
      {keys.map((k) => (
        <section key={k}>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {k}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {groups[k].map((m) => (
              <MemoryCard key={m.id} item={m} onToggleFav={onToggleFav} onDelete={onDelete} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}