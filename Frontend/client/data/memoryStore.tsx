import { analyzeMemory } from "@/lib/ai";
import type { MemoryItem, Preferences } from "@/types/memory";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const STORAGE_KEY = "mnemo.memories.v1";
const PREFS_KEY = "mnemo.prefs.v1";

interface MemoryContextValue {
  items: MemoryItem[];
  add: (
    item: Omit<
      MemoryItem,
      "id" | "summary" | "keywords" | "emotion" | "embedding"
    >,
  ) => Promise<void>;
  update: (id: string, patch: Partial<MemoryItem>) => void;
  remove: (id: string) => void;
  toggleFavorite: (id: string) => void;
  preferences: Preferences;
  setPreferences: (p: Preferences) => void;
  seed: () => void;
}

const MemoryContext = createContext<MemoryContextValue | null>(null);


import { db } from "@/lib/firebaseConfig";
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, updateDoc } from "firebase/firestore";

export function MemoryProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<MemoryItem[]>([]);
  const [preferences, setPreferences] = useState<Preferences>(() => {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw
      ? (JSON.parse(raw) as Preferences)
      : { localOnly: true, excludedKeywords: [] };
  });

  // Subscribe to Firebase
  useEffect(() => {
    const q = query(collection(db, "memories"), orderBy("created_at", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetched = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as MemoryItem[];
        setItems(fetched);
    }, (err) => {
        console.error("Failed to subscribe to memories", err);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    localStorage.setItem(PREFS_KEY, JSON.stringify(preferences));
  }, [preferences]);

  const add: MemoryContextValue["add"] = useCallback(async (item) => {
    // Analyze first? Backend does analysis usually, but if manually added:
    // We'll trust the input or re-analyze if needed.
    // For now, let's just add it. The backend service does the heavy lifting for captured items.
    // Use analyzeMemory locally if user adds manually.
    const analyzed = await analyzeMemory({ ...item, id: 'temp' });
    // Remove ID before sending to FB (auto-gen)
    const { id, ...rest } = analyzed; 
    await addDoc(collection(db, "memories"), { 
        ...rest, 
        created_at: new Date().toISOString() 
    });
  }, []);

  const update: MemoryContextValue["update"] = useCallback(async (id, patch) => {
    // Optimistic update?
    // setItems((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
    await updateDoc(doc(db, "memories", id), patch);
  }, []);

  const remove: MemoryContextValue["remove"] = useCallback(async (id) => {
     await deleteDoc(doc(db, "memories", id));
  }, []);

  const toggleFavorite = useCallback(async (id: string) => {
    const item = items.find(i => i.id === id);
    if(item) {
        await updateDoc(doc(db, "memories", id), { favorite: !item.favorite });
    }
  }, [items]);

  const seed = useCallback(() => {
    // Seeding might be manual or skipped for Firebase to avoid spam.
    console.log("Seeding disabled for Firebase to prevent duplication.");
  }, []);

  const value = useMemo<MemoryContextValue>(
    () => ({
      items,
      add,
      update,
      remove,
      toggleFavorite,
      preferences,
      setPreferences,
      seed,
    }),
    [items, add, update, remove, toggleFavorite, preferences],
  );

  return (
    <MemoryContext.Provider value={value}>{children}</MemoryContext.Provider>
  );
}


export function useMemory() {
  const ctx = useContext(MemoryContext);
  if (!ctx) throw new Error("useMemory must be used within MemoryProvider");
  return ctx;
}
