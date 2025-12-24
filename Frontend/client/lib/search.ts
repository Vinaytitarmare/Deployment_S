import type { Emotion, MemoryItem } from "@/types/memory";
import { cosineSim, imageToAvgColorEmbedding } from "@/lib/ai";

export function searchByText(items: MemoryItem[], query: string): MemoryItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const qWords = new Set(q.split(/\s+/));
  return [...items]
    .map((m) => {
      const hay = [m.title, m.content, m.summary, (m.keywords || []).join(" ")]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      let score = 0;
      for (const w of qWords) if (hay.includes(w)) score += 1;
      if (m.embedding && m.embedding.length >= 3) {
        // quick semantic boost: compare with query hash embedding as bag-of-words avg
        const qEmbed = new Array(m.embedding.length)
          .fill(0)
          .map((_, i) => (q.charCodeAt(i % q.length) % 13) / 13);
        const sim = cosineSim(m.embedding, qEmbed);
        score += sim;
      }
      return { m, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.m);
}

export function searchByEmotion(
  items: MemoryItem[],
  emotion: Emotion,
): MemoryItem[] {
  if (!emotion || emotion === "neutral") return items;
  return items.filter(
    (m) => m.emotion === emotion || (m.tags || []).includes(emotion),
  );
}

export async function searchByImage(
  items: MemoryItem[],
  file: File,
): Promise<MemoryItem[]> {
  const dataUrl = await fileToDataUrl(file);
  const probe = await imageToAvgColorEmbedding(dataUrl);
  if (!probe) return [];
  return [...items]
    .map((m) => {
      const sim = m.embedding ? cosineSim(m.embedding, probe) : 0;
      return { m, sim };
    })
    .filter((x) => x.sim > 0.5)
    .sort((a, b) => b.sim - a.sim)
    .map((x) => x.m);
}

export function groupByDate(items: MemoryItem[]): Record<string, MemoryItem[]> {
  const groups: Record<string, MemoryItem[]> = {};
  for (const it of items) {
    const d = new Date(it.timestamp);
    const key = d.toDateString();
    (groups[key] ||= []).push(it);
  }
  return groups;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}
