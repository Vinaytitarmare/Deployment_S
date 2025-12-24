export type MemoryType = "article" | "video" | "image" | "note";

export type Emotion =
  | "funny"
  | "inspiring"
  | "sad"
  | "angry"
  | "calm"
  | "awe"
  | "neutral";

export interface MemoryItem {
  id: string;
  title: string;
  summary?: string;
  keywords?: string[];
  emotion?: string;
  timestamp: string;
  url?: string;
  original_url?: string; // Legacy support
  type: string;
  favorite: boolean;
  imageDataUrl?: string | null;
  content?: string;
  embedding?: number[];
  tags?: string[];
  emotions?: string[];
  created_at?: string; // Backend sync
}

export interface Preferences {
  localOnly: boolean;
  excludedKeywords: string[];
}
