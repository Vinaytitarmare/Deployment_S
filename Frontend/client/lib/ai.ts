import type { Emotion, MemoryItem } from "@/types/memory";

const EMOTION_LEXICON: Record<Emotion, string[]> = {
  funny: ["funny", "humor", "laugh", "joke", "hilarious", "comedy"],
  inspiring: [
    "inspire",
    "motivation",
    "hope",
    "dream",
    "vision",
    "goal",
    "leadership",
  ],
  sad: ["sad", "tragic", "loss", "cry", "depress", "grief"],
  angry: ["angry", "rage", "furious", "injustice", "outrage"],
  calm: ["calm", "peace", "relax", "breathe", "meditat", "soothing"],
  awe: ["awe", "wonder", "majestic", "stunning", "breathtaking"],
  neutral: [],
};

function tokenize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function topKeywords(text: string, k = 8) {
  const stop = new Set(
    "the of and a to in is you that it he was for on are as with his they I at be this have from or one had by word but what some we can out other were all there when up use your how said an each she".split(
      /\s+/,
    ),
  );
  const freq = new Map<string, number>();
  for (const t of tokenize(text)) {
    if (stop.has(t)) continue;
    freq.set(t, (freq.get(t) || 0) + 1);
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map(([w]) => w);
}

function detectEmotion(text: string): Emotion {
  const t = text.toLowerCase();
  let best: { e: Emotion; score: number } = { e: "neutral", score: 0 };
  for (const [e, words] of Object.entries(EMOTION_LEXICON) as [
    Emotion,
    string[],
  ][]) {
    const score = words.reduce((acc, w) => acc + (t.includes(w) ? 1 : 0), 0);
    if (score > best.score) best = { e, score };
  }
  return best.e;
}

function hashToUnitVector(text: string, dims = 16): number[] {
  const vec = new Array(dims).fill(0);
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    const idx = code % dims;
    vec[idx] += (code % 13) / 13;
  }
  const norm = Math.sqrt(vec.reduce((s, x) => s + x * x, 0)) || 1;
  return vec.map((x) => x / norm);
}

export async function imageToAvgColorEmbedding(
  dataUrl?: string,
): Promise<number[] | undefined> {
  if (!dataUrl) return undefined;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const size = 16;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, size, size);
      const imgData = ctx.getImageData(0, 0, size, size).data;
      let r = 0,
        g = 0,
        b = 0;
      const total = size * size;
      for (let i = 0; i < imgData.length; i += 4) {
        r += imgData[i];
        g += imgData[i + 1];
        b += imgData[i + 2];
      }
      resolve([r / (255 * total), g / (255 * total), b / (255 * total)]);
    };
    img.src = dataUrl;
  });
}

export async function analyzeMemory(input: MemoryItem): Promise<MemoryItem> {
  const text = [input.title, input.content].filter(Boolean).join(" ");
  const summary = text.length > 140 ? text.slice(0, 140) + "…" : text;
  const keywords = topKeywords(text);
  const emotion = detectEmotion(text);
  const embedding =
    input.type === "image"
      ? await imageToAvgColorEmbedding(input.imageDataUrl)
      : hashToUnitVector(text);
  return { ...input, summary, keywords, emotion, embedding };
}

export function cosineSim(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let dot = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

export function emotionList(): Emotion[] {
  return ["funny", "inspiring", "calm", "awe", "sad", "angry", "neutral"];
}
