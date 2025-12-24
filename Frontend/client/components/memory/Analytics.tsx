import { useMemo } from "react";
import { MemoryItem } from "@/types/memory";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export default function Analytics({ items }: { items: MemoryItem[] }) {
  const byDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of items) {
      const k = new Date(m.timestamp).toISOString().slice(0, 10);
      map.set(k, (map.get(k) || 0) + 1);
    }
    return [...map.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, count]) => ({ date, count }));
  }, [items]);

  const topTags = useMemo(() => {
    const freq = new Map<string, number>();
    for (const m of items)
      for (const t of m.keywords || []) freq.set(t, (freq.get(t) || 0) + 1);
    return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [items]);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
      <div className="col-span-3 rounded-xl border border-zinc-400 bg-zinc-900 p-4 shadow-sm">
        <h3 className="mb-2 text-sm font-semibold text-zinc-300">Memories over time</h3>
        <div className="h-36">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={byDay} margin={{ left: 0, right: 0 }}>
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="hsl(var(--brand-start))"
                    stopOpacity={0.6}
                  />
                  <stop
                    offset="95%"
                    stopColor="hsl(var(--brand-end))"
                    stopOpacity={0.1}
                  />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" hide />
              <YAxis hide />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="count"
                stroke="hsl(var(--brand-end))"
                fillOpacity={1}
                fill="url(#g1)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="col-span-2 rounded-xl border border-zinc-400 bg-zinc-900 p-4 shadow-sm">
        <h3 className="mb-2 text-sm font-semibold text-zinc-300">Trending keywords</h3>
        <div className="flex flex-wrap gap-2">
          {topTags.length === 0 && (
            <span className="text-sm text-muted-foreground bg-zinc-700 text-zinc-200">No data yet</span>
          )}
          {topTags.map(([tag, count]) => (
            <span
              key={tag}
              className="rounded-full bg-secondary px-3 py-1 text-xs  bg-zinc-700 text-zinc-200"
            >
              {tag} <span className="text-muted-foreground text-zinc-400">×{count}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
