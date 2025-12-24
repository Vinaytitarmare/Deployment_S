import * as HoverCard from '@radix-ui/react-hover-card';
import 'highlight.js/styles/atom-one-dark.css';
import { Bot, Crop, Database, FileText, Globe, History, Loader2, Send, User, X } from 'lucide-react';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import { toast, Toaster } from 'sonner';
import { apiClient } from '../background/api';
import ErrorBoundary from './components/ErrorBoundary';
import LoadingSkeleton from './components/LoadingSkeleton';
import ShortcutsModal from './components/ShortcutsModal';
import './styles/design-tokens.css';

// Lazy load heavy components for better initial load
const SessionList = lazy(() => import('./components/SessionList'));

// Custom Markdown Components
const MarkdownComponents = {
  // Links: Open in new tab securely
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
      {children}
    </a>
  ),
  // Code Blocks: Styled
  code: ({ node, inline, className, children, ...props }) => {
    return inline ? (
      <code className="bg-slate-100 text-slate-800 px-1 py-0.5 rounded text-xs font-mono" {...props}>
        {children}
      </code>
    ) : (
      <code className="block bg-slate-800 text-white p-3 rounded-lg text-xs overflow-x-auto font-mono my-2" {...props}>
        {children}
      </code>
    );
  },
  // Tables: Bordered
  table: ({ children }) => (
    <div className="overflow-x-auto my-3 border border-slate-200 rounded-lg">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-slate-50">{children}</thead>,
  th: ({ children }) => <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{children}</th>,
  tbody: ({ children }) => <tbody className="bg-white divide-y divide-slate-200">{children}</tbody>,
  tr: ({ children }) => <tr className="hover:bg-slate-50">{children}</tr>,
  td: ({ children }) => <td className="px-3 py-2 whitespace-normal text-slate-700">{children}</td>,
  // Lists
  ul: ({ children }) => <ul className="list-disc pl-5 my-2 space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 my-2 space-y-1">{children}</ol>,
  // Paragraphs
  p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>
};




const CitationHoverCard = ({ citation, blocks }) => {
  // Find block content
  const block = blocks?.find(b => b.id === citation.blockId);
  const text = block ? block.text : "Content not available.";
  const preview = text.length > 200 ? text.substring(0, 200) + "..." : text;

  return (
    <HoverCard.Root openDelay={200} closeDelay={100}>
      <HoverCard.Trigger asChild>
        <button
          onClick={() => {
            console.log("Clicked citation:", citation.blockId);
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
              if (tabs[0]?.id) {
                chrome.tabs.sendMessage(tabs[0].id, {
                  type: 'HIGHLIGHT_CITATION',
                  blockId: citation.blockId
                });
              }
            });
          }}
          className="group flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-50/50 text-amber-700 hover:bg-amber-100 border border-amber-200/60 rounded-lg text-[11px] font-medium transition-all cursor-pointer"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 group-hover:bg-amber-500 transition-colors"></span>
          Source {citation.blockId.replace('bi-block-', '')}
        </button>
      </HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Content
          className="z-50 w-80 bg-white p-4 rounded-xl shadow-xl ring-1 ring-slate-200 animate-in fade-in zoom-in-95 duration-200"
          sideOffset={5}
          side="top"
          align="start"
        >
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <FileText className="w-3 h-3" />
              Source Context
            </div>
            <p className="text-xs leading-relaxed text-slate-700 font-medium">
              "{preview}"
            </p>
            <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-100">
              ID: {citation.blockId}
            </div>
          </div>
          <HoverCard.Arrow className="fill-white" />
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  );
};


const SiteList = ({ onContextSelect }) => {
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSites();
  }, []);

  const loadSites = async () => {
    setLoading(true);
    const data = await apiClient.getSites();
    setSites(data);
    setLoading(false);
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!confirm("Delete this site memory?")) return;
    await apiClient.deleteSite(id);
    loadSites(); // Refresh
    toast.success("Site memory deleted");
  };

  if (loading) return <LoadingSkeleton type="card" count={3} />;

  if (sites.length === 0) {
    return (
      <div className="text-center p-8 text-slate-500">
        <Database className="w-12 h-12 mx-auto mb-3 text-slate-300" />
        <h3 className="font-semibold text-slate-700">No Memories Yet</h3>
        <p className="text-xs">Index pages to build your knowledge base.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {sites.map(site => (
        <div
          key={site.id}
          onClick={async () => {
            chrome.tabs.create({ url: site.url });
            const newSessionId = `session-${Date.now()}`;
            const newSession = {
              id: newSessionId,
              title: site.title || site.url,
              messages: [{ id: '1', role: 'assistant', text: `Ready to answer questions about ${site.title || site.url}` }],
              createdAt: Date.now(),
              updatedAt: Date.now()
            };
            const result = await chrome.storage.local.get(['chatSessions']);
            const updatedSessions = [...(result.chatSessions || []), newSession];
            await chrome.storage.local.set({ chatSessions: updatedSessions, currentSessionId: newSessionId });
            setCurrentSessionId(newSessionId);
            setSessions(updatedSessions);
            setMessages(newSession.messages);
            setView('chat');
            toast.success(`Opened ${site.title || site.url}`);
          }}
          style={{
            background: 'var(--bg-primary)',
            padding: '20px',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-light)',
            transition: 'var(--transition-fast)',
            position: 'relative',
            cursor: 'pointer'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--primary-300)';
            e.currentTarget.style.boxShadow = 'var(--shadow-md)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-light)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          {/* Title */}
          <h3 style={{
            fontSize: 'var(--text-base)',
            fontWeight: 'var(--font-semibold)',
            color: 'var(--text-primary)',
            marginBottom: '6px',
            paddingRight: '24px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {site.title || new URL(site.url).hostname}
          </h3>

          {/* Domain */}
          <div style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--text-tertiary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {new URL(site.url).hostname}
          </div>



          {/* Delete Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(site.id, e);
            }}
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              width: '24px',
              height: '24px',
              padding: 0,
              background: 'transparent',
              border: 'none',
              borderRadius: '50%',
              cursor: 'pointer',
              color: 'var(--text-tertiary)',
              transition: 'var(--transition-fast)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--error)';
              e.currentTarget.style.color = 'white';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-tertiary)';
            }}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
};

function App() {
  const [view, setView] = useState('home'); // 'home' | 'chat' | 'history'
  const [mode, setMode] = useState('rag'); // 'rag' | 'visual'
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    { id: '1', role: 'assistant', text: 'Hello! Choose a mode to start analyzing this page.' }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [cropPreview, setCropPreview] = useState(null); // Data URL of crop
  const [contentBlocks, setContentBlocks] = useState([]); // Store blocks for hover lookups
  const [selectedSiteId, setSelectedSiteId] = useState(null); // Phase 3: Site Context
  const [sites, setSites] = useState([]); // Available sites for context switching
  const [currentSessionId, setCurrentSessionId] = useState(null); // Phase 5: Session management
  const [sessions, setSessions] = useState([]); // List of all sessions
  const [currentUrl, setCurrentUrl] = useState(''); // Current active tab URL
  const [isOffline, setIsOffline] = useState(false); // Offline detection
  const [lastFailedAction, setLastFailedAction] = useState(null);
  const [showCrawlModal, setShowCrawlModal] = useState(false);
  const [crawlSettings, setCrawlSettings] = useState({ maxPages: 10, maxDepth: 2 });
  const [showShortcuts, setShowShortcuts] = useState(false); // Keyboard shortcuts modal
  const [indexedUrls, setIndexedUrls] = useState(new Set()); // Track indexed pages for UX

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null); // For Ctrl+K focus

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // [NEW] Listen for Context Menu "Send to Chat"
  useEffect(() => {
    const handleMessage = (request, sender, sendResponse) => {
      if (request.type === 'SET_CHAT_QUERY' && request.text) {
        console.log("Received context menu text:", request.text);
        setInput(request.text);
        // Optional: Focus the input
        inputRef.current?.focus();
      }
    };
    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+K: Focus input
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }

      // Ctrl+Shift+I: Ingest page
      if (e.ctrlKey && e.shiftKey && e.key === 'I') {
        e.preventDefault();
        if (!isLoading) handleIngest();
      }

      // Ctrl+Shift+V: Visual scan
      if (e.ctrlKey && e.shiftKey && e.key === 'V') {
        e.preventDefault();
        if (!isLoading) handleRegionScan();
      }

      // Ctrl+/: Show shortcuts
      if (e.ctrlKey && e.key === '/') {
        e.preventDefault();
        setShowShortcuts(true);
      }

      // Esc: Close modals / Cancel
      if (e.key === 'Escape') {
        setShowShortcuts(false);
        // Could add more cancel logic here
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLoading]); // Re-bind when loading state changes

  // Offline detection
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      toast.success('Back online!');
    };
    const handleOffline = () => {
      setIsOffline(true);
      toast.error('No internet connection');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check initial state
    setIsOffline(!navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load current tab URL
  useEffect(() => {
    const updateCurrentUrl = async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.url) {
          setCurrentUrl(tab.url);
        }
      } catch (err) {
        console.error('Failed to get current URL:', err);
      }
    };

    updateCurrentUrl();

    // Update URL when tab changes
    const handleTabUpdate = () => updateCurrentUrl();
    chrome.tabs.onActivated?.addListener(handleTabUpdate);
    chrome.tabs.onUpdated?.addListener(handleTabUpdate);

    return () => {
      chrome.tabs.onActivated?.removeListener(handleTabUpdate);
      chrome.tabs.onUpdated?.removeListener(handleTabUpdate);
    };
  }, []);

  // Load sites on mount
  useEffect(() => {
    const loadSites = async () => {
      const data = await apiClient.getSites();
      setSites(data);
    };
    loadSites();
  }, []);

  // Load conversation history on mount
  useEffect(() => {
    const loadHistory = async () => {
      const result = await chrome.storage.local.get(['chatSessions', 'currentSessionId']);
      const savedSessions = result.chatSessions || [];
      const savedSessionId = result.currentSessionId;

      if (savedSessions.length > 0) {
        setSessions(savedSessions);

        // Load current session or create new one
        if (savedSessionId) {
          const session = savedSessions.find(s => s.id === savedSessionId);
          if (session) {
            setCurrentSessionId(savedSessionId);
            setMessages(session.messages || [{ id: '1', role: 'assistant', text: 'Hello! Choose a mode to start analyzing this page.' }]);
            return;
          }
        }
      }

      // Create first session if none exist
      createNewSession();
    };
    loadHistory();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+I: Index current page
      if (e.ctrlKey && e.key === 'i') {
        e.preventDefault();
        if (!isLoading && currentUrl) {
          handleIngest();
          toast.success('Indexing page... (Ctrl+I)');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLoading, currentUrl]);

  // Save messages to storage whenever they change
  useEffect(() => {
    if (currentSessionId && messages.length > 0) {
      const saveMessages = async () => {
        const result = await chrome.storage.local.get(['chatSessions']);
        const savedSessions = result.chatSessions || [];

        const updatedSessions = savedSessions.map(session =>
          session.id === currentSessionId
            ? { ...session, messages, updatedAt: Date.now() }
            : session
        );

        await chrome.storage.local.set({ chatSessions: updatedSessions });
        setSessions(updatedSessions);
      };
      saveMessages();
    }
  }, [messages, currentSessionId]);

  const createNewSession = async () => {
    const newSessionId = `session-${Date.now()}`;
    const newSession = {
      id: newSessionId,
      title: 'New Conversation',
      messages: [{ id: '1', role: 'assistant', text: 'Hello! Choose a mode to start analyzing this page.' }],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const result = await chrome.storage.local.get(['chatSessions']);
    const savedSessions = result.chatSessions || [];
    const updatedSessions = [...savedSessions, newSession];

    await chrome.storage.local.set({
      chatSessions: updatedSessions,
      currentSessionId: newSessionId
    });

    setCurrentSessionId(newSessionId);
    setSessions(updatedSessions);
    setMessages(newSession.messages);
  };

  const switchSession = async (sessionId) => {
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      setCurrentSessionId(sessionId);
      setMessages(session.messages);
      await chrome.storage.local.set({ currentSessionId: sessionId });
    }
  };

  const deleteSession = async (sessionId) => {
    const result = await chrome.storage.local.get(['chatSessions']);
    const savedSessions = result.chatSessions || [];
    const updatedSessions = savedSessions.filter(s => s.id !== sessionId);

    await chrome.storage.local.set({ chatSessions: updatedSessions });
    setSessions(updatedSessions);

    // If deleting current session, switch to another or create new
    if (sessionId === currentSessionId) {
      if (updatedSessions.length > 0) {
        switchSession(updatedSessions[0].id);
      } else {
        createNewSession();
      }
    }
  };

  const clearAllHistory = async () => {
    if (confirm('Clear all conversation history? This cannot be undone.')) {
      await chrome.storage.local.remove(['chatSessions', 'currentSessionId']);
      setSessions([]);
      createNewSession();
      toast.success('History cleared');
    }
  };


  useEffect(() => {
    scrollToBottom();
  }, [messages, view, cropPreview]);

  // [NEW] SnapMind Capture Logic
  const handleSmartCapture = async () => {
    // 1. Get URL
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) return toast.error("No URL found");

    const toastId = toast.loading("🧠 SnapMind Analyzing...");

    try {
        // 2. Extract Text (Fallback for Localhost/auth pages)
        let pageText = "";
        try {
            const extraction = await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_CONTENT' });
            if (extraction && extraction.data) {
                 // simplify blocks to text
                 pageText = extraction.data.blocks.map(b => b.text).join('\n\n');
            }
        } catch (e) {
            console.warn("Could not extract text from extension side:", e);
        }

        // 3. Send to Intelligence Service
        const res = await fetch('http://localhost:8000/receive_data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                url: tab.url,
                text: pageText // Send text to bypass Firecrawl if needed
            })
        });
        
        const data = await res.json();
        
        if (data.success) {
            toast.success("Memory Captured!", { id: toastId });
            // Optional: Add a message to chat?
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'assistant',
                text: `✅ **Memory Captured**: I've analyzed and saved this page to your dashboard.\n\n**Emotions detected**: ${data.memory.emotions?.join(', ') || 'None'}`
            }]);
        } else {
             toast.error("Capture failed: " + (data.error || "Unknown"), { id: toastId });
        }

    } catch (e) {
        console.error(e);
        toast.error("Failed to reach SnapMind Intelligence Service. Is it running?", { id: toastId });
    }
  };

  const handleIngest = async (mode = 'single') => {
    // Client-side validation
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) {
      toast.error('No active tab found');
      return;
    }

    // Validate URL
    try {
      const url = new URL(tab.url);
      if (!['http:', 'https:'].includes(url.protocol)) {
        toast.error('Can only index HTTP/HTTPS pages');
        return;
      }
      if (url.hostname === 'chrome' || url.protocol === 'chrome-extension:') {
        toast.error('Cannot index Chrome internal pages');
        return;
      }
    } catch (err) {
      toast.error('Invalid URL');
      return;
    }

    const isOffline = !navigator.onLine;

    // Check offline
    if (isOffline) {
      toast.error('Cannot index while offline');
      return;
    }
    
    // Close modal if open
    setShowCrawlModal(false);

    setIsLoading(true);
    const toastId = toast.loading(mode === 'multi' ? "🕸️ Crawling website..." : "📄 Scraping page content...");
    
    // Construct payload
    const payload = {
        type: 'INGEST_PAGE',
        url: tab.url,
        crawl: mode === 'multi',
        maxPages: mode === 'multi' ? crawlSettings.maxPages : undefined,
        maxDepth: mode === 'multi' ? crawlSettings.maxDepth : undefined
    };

    try {
      // Update toast to show embedding stage
      setTimeout(() => toast.loading("🧠 Creating embeddings...", { id: toastId }), 1000);

      setTimeout(() => toast.loading(mode === 'multi' ? "🧠 Embedding pages..." : "🧠 Creating embeddings...", { id: toastId }), 2000);

      const response = await chrome.runtime.sendMessage(payload);

      if (response.success) {
        // Update to show indexing stage
        toast.loading("💾 Storing in database...", { id: toastId });

        // Mark as indexed for UX
        setIndexedUrls(prev => new Set(prev).add(tab.url));

        setTimeout(() => {
          toast.success(`✅ Indexed ${response.chunks_count || 'page'} successfully`, { id: toastId });
        }, 500);

        // Phase 2: Heuristic Check
        if (response.isLowQuality) {
          setTimeout(() => {
            toast.warning("⚠️ Low content detected. Try Visual Scan mode.", { duration: 5000 });
          }, 1500);
        }

        // Clear any failed action
        setLastFailedAction(null);
      } else {
        // Store failed action for retry
        setLastFailedAction({ type: 'ingest', url: tab.url });
        toast.error(`❌ Indexing failed: ${response.error}`, {
          id: toastId,
          action: {
            label: 'Retry',
            onClick: () => handleIngest()
          }
        });
      }
    } catch (err) {
      console.error(err);
      setLastFailedAction({ type: 'ingest', url: tab.url });
      toast.error(`❌ Error: ${err.message}`, {
        id: toastId,
        action: {
          label: 'Retry',
          onClick: () => handleIngest()
        }
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVisualIngest = async () => {
    setIsLoading(true);
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'assistant',
      text: "📸 **Visual Indexing**: Capturing screenshot and extracting text..."
    }]);

    try {
      // 1. Capture Visible Tab
      const visibleTabQuery = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!visibleTabQuery[0]?.id) throw new Error("No active tab");
      const tab = visibleTabQuery[0];

      const captureResponse = await chrome.runtime.sendMessage({
        type: 'CAPTURE_VISIBLE_TAB',
        windowId: tab.windowId
      });

      if (!captureResponse.success) throw new Error("Screenshot failed");

      // 2. Extract Text via Backend VLM
      // We pass `imageData` to avoid re-capture in background (optimization)
      const analysisResponse = await chrome.runtime.sendMessage({
        type: 'PROCESS_QUERY',
        mode: 'visual',
        backendMode: 'extraction', // Triggers "Extraction Mode" in Backend
        text: 'Extract all text coverage',
        tabId: tab.id,
        windowId: tab.windowId,
        imageData: captureResponse.dataUrl
      });

      if (!analysisResponse.success) {
        throw new Error(analysisResponse.error || "Visual extraction failed");
      }

      // 3. Ingest Extracted Text
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        text: `📄 **Extraction Complete**: Found content. Indexing to database...`
      }]);

      const ingestResponse = await chrome.runtime.sendMessage({
        type: 'INGEST_PAGE', // We use same type but different payload signature handles it
        url: tab.url,
        text: analysisResponse.answer // Pass extracted text
      });

      if (ingestResponse.success) {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'assistant',
          text: "✅ **Visual Indexing Success**: Page content added to memory."
        }]);
      } else {
        throw new Error(ingestResponse.error || "Ingestion failed");
      }

    } catch (e) {
      console.error(e);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        text: `❌ **Visual Indexing Error**: ${e.message}`
      }]);
    }
    setIsLoading(false);
  };

  // -- region: Cropping Logic
  const performCrop = (dataUrl, rect, devicePixelRatio) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        // Scale rect by DPR because captureVisibleTab returns full resolution image
        // BUT rect comes from CSS pixels.
        // Usually, captureVisibleTab is 1x dpr of the screen resolution? 
        // Actually, in Chrome extensions, captureVisibleTab returns the image at device pixel resolution.
        // So on Retina (2x), the image is 2x larger than window.innerWidth.

        const scale = img.width / rect.windowWidth;

        const sourceX = rect.x * scale;
        const sourceY = rect.y * scale;
        const sourceW = rect.width * scale;
        const sourceH = rect.height * scale;

        canvas.width = sourceW;
        canvas.height = sourceH;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, sourceX, sourceY, sourceW, sourceH, 0, 0, sourceW, sourceH);
        resolve(canvas.toDataURL('image/jpeg'));
      };
      img.src = dataUrl;
    });
  };

  const handleRegionScan = async () => {
    setMode('visual'); // Switch context to visual
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return;

      // 1. Start UI Selection
      // Close sidepanel momentarily? No, Side Panel stays open. 
      // Note: Overlay inside content script works even with side panel open.
      const selResponse = await chrome.tabs.sendMessage(tab.id, { type: 'START_SELECTION' });

      if (selResponse && selResponse.success && selResponse.rect) {
        setIsLoading(true);
        // 2. Capture full screen
        const captureResponse = await chrome.runtime.sendMessage({
          type: 'CAPTURE_VISIBLE_TAB',
          windowId: tab.windowId
        });

        if (captureResponse.success) {
          // 3. Crop
          const croppedUrl = await performCrop(captureResponse.dataUrl, selResponse.rect);
          setCropPreview(croppedUrl); // Show preview to user
          // Focus input
          setTimeout(() => document.querySelector('input')?.focus(), 100);
        }
        setIsLoading(false);
      }
    } catch (err) {
      console.error("Region scan failed:", err);
      setIsLoading(false);
      // Inform user
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        text: "⚠️ **Region Scan Failed**: Could not connect to the page.\n\nPlease **REFRESH THE PAGE** and try again. (Content script needs to reload)."
      }]);
    }
  };
  // -- endregion

  const handleSend = async (overrideText = null, overrideMode = null) => {
    const textToSend = overrideText || input;
    const modeToUse = overrideMode || mode;

    if (!textToSend.trim()) return;

    // Create optimistic user message
    const userMsg = { id: Date.now().toString(), role: 'user', text: textToSend };
    const imagePayload = cropPreview;

    setMessages(prev => [...prev, userMsg]);

    if (!overrideText) {
      setInput('');
      setCropPreview(null);
    }
    setIsLoading(true);

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error("No active tab found");

      // STREAMING FLOW (RAG Only, No Image)
      if (modeToUse === 'rag' && !imagePayload) {
        let blocks = [];
        try {
          // 1. Extract Content directly
          const extResponse = await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_CONTENT' });
          if (extResponse && extResponse.data) {
            blocks = extResponse.data.blocks;
            setContentBlocks(blocks); // Update state for Hover Cards
          }
        } catch (e) {
          console.warn("Content extraction failed (could be restricted page)", e);
        }

        // 2. Prepare empty AI message
        const aiMsgId = (Date.now() + 1).toString();
        
        // [NEW] Prepare History
        // Exclude the very last user message (which is treated as 'Current Question' by backend logic usually, but here we passed it as query arg)
        // Also exclude initial greeting if needed, but keeping it is fine.
        // We only want completed messages.
        const history = messages
            .filter(m => m.text && !m.error) // valid messages
            .map(m => ({ 
                role: m.role, 
                content: m.text 
            }));

        setMessages(prev => [...prev, {
            id: aiMsgId,
            role: 'assistant',
            text: '',
            citations: []
        }]);

        let fullText = "";

        // 3. Stream Response via API Helper (filtered by current URL)
        await apiClient.streamQueryRag(blocks, userMsg.text, (token) => {
          fullText += token;
          setMessages(currentMessages =>
            currentMessages.map(m => m.id === aiMsgId ? { ...m, text: fullText } : m)
          );
        }, currentUrl, history); // Pass history here

        // 4. Extract Citations (Post-Stream)
        const citationRegex = /\[(bi-block-\d+)\]/g;
        const citations = [];
        let match;
        while ((match = citationRegex.exec(fullText)) !== null) {
          const blockId = match[1];
          if (!citations.find(c => c.blockId === blockId)) {
            citations.push({ blockId, snippet: `Ref ${blockId}` });
          }
        }

        if (citations.length > 0) {
          setMessages(currentMessages =>
            currentMessages.map(m => m.id === aiMsgId ? { ...m, citations } : m)
          );
        }

      } else {
        // LEGACY FLOW (Visual / Image RAG)
        const response = await chrome.runtime.sendMessage({
          type: 'PROCESS_QUERY',
          mode: modeToUse,
          text: userMsg.text,
          tabId: tab.id,
          windowId: tab.windowId,
          imageData: imagePayload
        });

        if (response && response.success) {
          const aiMsg = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            text: response.answer,
            citations: response.citations
          };
          setMessages(prev => [...prev, aiMsg]);
        } else {
          throw new Error(response?.error || 'Unknown error occurred');
        }
      }

    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        text: `Error: ${err.message || "Failed to communicate."}`
      }]);
    } finally {
      setIsLoading(false);
    }
  };



  if (view === 'home') {
    return (
      <div className="h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-slate-50 via-white to-cyan-50/30 text-center font-sans">
        <div className="mb-10 animate-in fade-in zoom-in duration-500">
           <div className="w-16 h-16 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-xl shadow-cyan-500/20 mb-5 mx-auto ring-4 ring-white">
             <Bot className="w-8 h-8 text-white" />
           </div>
           <h1 className="text-2xl font-bold text-slate-800 mb-2 tracking-tight">SnapMind</h1>
           <p className="text-slate-500 text-sm font-medium">Your intelligent memory assistant</p>
        </div>

        <div className="grid grid-cols-1 gap-4 w-full max-w-[280px]">
          {/* Card 1: Chat (Priority) */}
          <button
            onClick={() => { setView('chat'); setMode('rag'); }}
            className="group relative flex items-center gap-4 p-4 text-left bg-white border border-slate-200 hover:border-blue-400/50 rounded-2xl shadow-sm hover:shadow-lg hover:shadow-blue-500/5 transition-all duration-300"
          >
             <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-500 group-hover:scale-110 group-hover:bg-blue-500 group-hover:text-white transition-all duration-300">
               <Bot className="w-6 h-6" />
            </div>
            <div>
               <h3 className="font-semibold text-slate-800 text-[15px]">RAG Context Chat</h3>
               <p className="text-[11px] text-slate-500 mt-0.5 font-medium">Chat with your page</p>
            </div>
          </button>

          {/* Card 2: Save Page */}
          <button
            onClick={handleSmartCapture}
            className="group relative flex items-center gap-4 p-4 text-left bg-white border border-slate-200 hover:border-cyan-400/50 rounded-2xl shadow-sm hover:shadow-lg hover:shadow-cyan-500/5 transition-all duration-300"
          >
            <div className="w-12 h-12 bg-cyan-50 rounded-xl flex items-center justify-center text-cyan-500 group-hover:scale-110 group-hover:bg-cyan-500 group-hover:text-white transition-all duration-300">
               <Database className="w-6 h-6" />
            </div>
            <div>
               <h3 className="font-semibold text-slate-800 text-[15px]">Save to Memory</h3>
               <p className="text-[11px] text-slate-500 mt-0.5 font-medium">Capture insights for later</p>
            </div>
          </button>
        </div>

        {/* Footer Links */}
        <div className="mt-12 flex items-center justify-center gap-6 text-xs font-medium text-slate-400">
           <button onClick={() => setView('history')} className="hover:text-slate-600 transition-colors flex items-center gap-1.5">
             <History className="w-3.5 h-3.5" /> History
           </button>
           <div className="w-1 h-1 rounded-full bg-slate-300"></div>
           <button onClick={() => chrome.tabs.create({ url: 'http://localhost:8080' })} className="hover:text-slate-600 transition-colors flex items-center gap-1.5">
             <Database className="w-3.5 h-3.5" /> Dashboard
           </button>
        </div>
        <Toaster richColors position="top-center" />
      </div>
    );
  }

  if (view === 'history') {
    return (
      <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 via-white to-violet-50/50">
        <header className="px-5 py-4 bg-white/80 backdrop-blur-md border-b border-slate-200/60">
          <div className="flex items-center justify-between">
            <h1 className="text-slate-800 font-bold text-base">Conversation History</h1>
            <button
              onClick={() => setView('chat')}
              className="text-sm text-slate-600 hover:text-indigo-600 transition-colors"
            >
              ← Back to Chat
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-hidden">
          <Suspense fallback={<LoadingSkeleton type="card" count={3} />}>
            <SessionList
              sessions={sessions}
              currentSessionId={currentSessionId}
              onSessionSwitch={(id) => {
                switchSession(id);
                setView('chat');
              }}
              onSessionDelete={deleteSession}
              onNewSession={() => {
                createNewSession();
                setView('chat');
              }}
              onClearAll={clearAllHistory}
            />
          </Suspense>
        </div>
      </div>
    );
  }

  if (view === 'memory') {
    return (
      <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 via-white to-amber-50/50">
        <header className="px-5 py-4 bg-white/80 backdrop-blur-md border-b border-slate-200/60">
          <div className="flex items-center justify-between">
            <h1 className="text-slate-800 font-bold text-base">Memory - Indexed Sites</h1>
            <button
              onClick={() => setView('chat')}
              className="text-sm text-slate-600 hover:text-indigo-600 transition-colors"
            >
              ← Back to Chat
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-5">
          <SiteList onContextSelect={(url) => {
            // This is called when View button is clicked
            // The View button already handles everything, so this is just a placeholder
          }} />
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 via-white to-indigo-50/50 text-sm font-sans antialiased text-slate-900 selection:bg-indigo-100">

      {/* Offline Banner */}
      {isOffline && (
        <div className="bg-red-500 text-white px-4 py-2 text-center text-xs font-medium flex items-center justify-center gap-2">
          <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
          No internet connection - Some features may not work
        </div>
      )}

      {/* Crawler Selection Modal */}
      {showCrawlModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden ring-1 ring-slate-200">
             <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
               <h3 className="font-semibold text-slate-800">Add to Memory</h3>
               <button onClick={() => setShowCrawlModal(false)} className="p-1 hover:bg-slate-200 rounded-full transition-colors">
                 <X className="w-4 h-4 text-slate-500" />
               </button>
             </div>
             
             <div className="p-4 space-y-3">
               <button
                 onClick={() => handleIngest()}
                 className="flex items-center gap-4 w-full p-4 bg-white border border-slate-200 hover:border-blue-400 hover:bg-blue-50/30 rounded-xl transition-all group text-left shadow-sm hover:shadow-md"
               >
                 <div className="w-10 h-10 bg-blue-100/50 rounded-lg flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
                   <FileText className="w-5 h-5" />
                 </div>
                 <div>
                   <h4 className="font-medium text-slate-900 text-sm">Single Page</h4>
                   <p className="text-xs text-slate-500 mt-0.5">Embed only the current active tab.</p>
                 </div>
               </button>

               <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/30 space-y-3">
                 <button
                   onClick={() => handleIngest('multi')}
                   className="flex items-center gap-4 w-full text-left group"
                 >
                   <div className="w-10 h-10 bg-purple-100/50 rounded-lg flex items-center justify-center text-purple-600 group-hover:scale-110 transition-transform">
                     <Globe className="w-5 h-5" />
                   </div>
                   <div className="flex-1">
                     <h4 className="font-medium text-slate-900 text-sm group-hover:text-purple-700 transition-colors">Crawl Website</h4>
                     <p className="text-xs text-slate-500 mt-0.5">Embed multiple pages from this domain.</p>
                   </div>
                   <div className="text-xs font-semibold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">BETA</div>
                 </button>
                 
                 {/* Crawl Settings */}
                 <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200/60 mt-2">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Pages</label>
                      <input 
                        type="number" 
                        min="1" 
                        max="50"
                        value={crawlSettings.maxPages}
                        onChange={(e) => setCrawlSettings(prev => ({ ...prev, maxPages: parseInt(e.target.value) || 10 }))}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Depth</label>
                      <input 
                        type="number" 
                        min="1" 
                        max="5"
                        value={crawlSettings.maxDepth}
                        onChange={(e) => setCrawlSettings(prev => ({ ...prev, maxDepth: parseInt(e.target.value) || 2 }))}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none"
                      />
                    </div>
                 </div>
               </div>
             </div>
             
             <div className="p-3 bg-slate-50 text-center text-[10px] text-slate-400 border-t border-slate-100">
               Powered by Firecrawl & Mistral AI
             </div>
          </div>
        </div>
      )}

      {/* Modern Clean Header */}
      <header style={{
        background: 'var(--bg-primary)',
        borderBottom: '1px solid var(--border-light)',
        position: 'sticky',
        top: 0,
        zIndex: 20
      }} className="px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          {/* Left: Logo Only (Compact) - Clickable for Home */}
          <div className="flex items-center gap-2 flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setView('home')}>
            <div style={{
              background: 'var(--primary-500)',
              borderRadius: 'var(--radius-md)',
              padding: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Bot className="w-4 h-4 text-white" />
            </div>
             {/* Text removed to save space */}
          </div>

          {/* Center: Current Page Domain Pill - Clickable */}
          {currentUrl && (
            <a
              href={currentUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius-full)',
                padding: '4px 10px',
                fontSize: 'var(--text-xs)',
                color: 'var(--text-secondary)',
                fontWeight: 'var(--font-medium)',
                maxWidth: '120px', // Reduced width
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                textDecoration: 'none',
                transition: 'var(--transition-fast)',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--primary-50)';
                e.currentTarget.style.borderColor = 'var(--primary-200)';
                e.currentTarget.style.color = 'var(--primary-600)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--bg-secondary)';
                e.currentTarget.style.borderColor = 'var(--border-light)';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
              title={`Open ${currentUrl}`}
            >
              {new URL(currentUrl).hostname}
            </a>
          )}

          {/* Right: Icon Navigation */}
          <div className="flex items-center gap-0.5 flex-shrink-0">
            {/* [NEW] Dashboard Link */}
            <button
                onClick={() => chrome.tabs.create({ url: 'http://localhost:8080' })}
                title="Open Dashboard"
                style={{
                    padding: '6px',
                    borderRadius: 'var(--radius-md)',
                    transition: 'var(--transition-fast)',
                    color: 'var(--text-tertiary)',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--primary-50)';
                    e.currentTarget.style.color = 'var(--primary-600)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--text-tertiary)';
                }}
            >
                {/* External Link Icon */}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
            </button>

            {/* [NEW] Smart Capture Button */}
            <button
                onClick={handleSmartCapture}
                title="SnapMind Capture (Analyze & Save)"
                style={{
                    padding: '6px',
                    borderRadius: 'var(--radius-md)',
                    transition: 'var(--transition-fast)',
                    color: 'var(--secondary-600)', // Distinct color
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--secondary-50)';
                    e.currentTarget.style.color = 'var(--secondary-700)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--secondary-600)';
                }}
            >
                {/* Brain/Capture Icon */}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5 10 10 0 0 0-10 10"></path><path d="M16 12a4 4 0 1 0-8 0"></path><path d="M12 16h.01"></path></svg>
            </button>

            {/* Index Button */}
            <button
              onClick={handleIngest}
              disabled={isLoading || !currentUrl}
              title={indexedUrls.has(currentUrl) ? "Re-index this page" : "Index this page (Ctrl+I)"}
              style={{
                padding: '6px',
                borderRadius: 'var(--radius-md)',
                transition: 'var(--transition-fast)',
                color: isLoading ? 'var(--text-tertiary)' : (indexedUrls.has(currentUrl) ? 'var(--primary-600)' : 'var(--text-tertiary)'),
                background: indexedUrls.has(currentUrl) ? 'var(--primary-50)' : 'transparent',
                border: 'none',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
              onMouseEnter={(e) => {
                if (!isLoading) {
                  e.currentTarget.style.background = 'var(--primary-50)';
                  e.currentTarget.style.color = 'var(--primary-600)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isLoading) {
                  e.currentTarget.style.background = indexedUrls.has(currentUrl) ? 'var(--primary-50)' : 'transparent';
                  e.currentTarget.style.color = indexedUrls.has(currentUrl) ? 'var(--primary-600)' : 'var(--text-tertiary)';
                }
              }}
            >
              <Database className="w-4 h-4" />
              {indexedUrls.has(currentUrl) && <span style={{fontSize: '10px', fontWeight: 600}}>Re-Index</span>}
            </button>

            <button
              onClick={() => setView('history')}
              title="Conversation history"
              style={{
                padding: '6px',
                borderRadius: 'var(--radius-md)',
                transition: 'var(--transition-fast)',
                color: 'var(--text-tertiary)',
                background: 'transparent'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--primary-50)';
                e.currentTarget.style.color = 'var(--primary-600)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--text-tertiary)';
              }}
            >
              <History className="w-4 h-4" />
            </button>

             {/* Settings Removed */}
          </div>
        </div>
      </header>

      {/* Modern Pill-Style Mode Tabs */}
      <div style={{
        padding: 'var(--space-2)',
        background: 'var(--bg-primary)',
        borderBottom: '1px solid var(--border-light)'
      }}>
        <div style={{
          display: 'flex',
          gap: '4px',
          padding: '4px',
          background: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-light)'
        }}>
          <button
            onClick={() => { setMode('rag'); setCropPreview(null); }}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '10px 12px',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--font-semibold)',
              transition: 'var(--transition-fast)',
              background: mode === 'rag' ? 'var(--bg-primary)' : 'transparent',
              color: mode === 'rag' ? 'var(--primary-600)' : 'var(--text-secondary)',
              border: 'none',
              cursor: 'pointer',
              boxShadow: mode === 'rag' ? 'var(--shadow-sm)' : 'none'
            }}
          >
            <FileText className="w-4 h-4" />
            <span>RAG Analysis</span>
          </button>

          <button
            onClick={handleRegionScan}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '10px 12px',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--font-semibold)',
              transition: 'var(--transition-fast)',
              background: mode === 'visual' ? 'var(--bg-primary)' : 'transparent',
              color: mode === 'visual' ? 'var(--secondary-600)' : 'var(--text-secondary)',
              border: 'none',
              cursor: 'pointer',
              boxShadow: mode === 'visual' ? 'var(--shadow-sm)' : 'none'
            }}
          >
            <Crop className="w-4 h-4" />
            <span>Visual Scan</span>
          </button>

          <button
            onClick={() => { setView('memory'); }}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '10px 12px',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--font-semibold)',
              transition: 'var(--transition-fast)',
              background: view === 'memory' ? 'var(--bg-primary)' : 'transparent',
              color: view === 'memory' ? 'var(--primary-600)' : 'var(--text-secondary)',
              border: 'none',
              cursor: 'pointer',
              boxShadow: view === 'memory' ? 'var(--shadow-sm)' : 'none'
            }}
          >
            <Database className="w-4 h-4" />
            <span>Memory</span>
          </button>
        </div>
      </div>

      {/* Modern Memory View */}
      {
        view === 'memory' && (
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: 'var(--space-2)',
            background: 'var(--bg-secondary)'
          }}>
            <div style={{
              maxWidth: '600px',
              margin: '0 auto'
            }}>
              {/* Header */}
              <div style={{
                marginBottom: 'var(--space-3)',
                padding: 'var(--space-2)',
                background: 'var(--bg-primary)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-light)'
              }}>
                <h2 style={{
                  fontSize: 'var(--text-lg)',
                  fontWeight: 'var(--font-semibold)',
                  color: 'var(--text-primary)',
                  marginBottom: '4px'
                }}>
                  📚 Indexed Sites
                </h2>
                <p style={{
                  fontSize: 'var(--text-sm)',
                  color: 'var(--text-secondary)'
                }}>
                  Pages you've indexed for intelligent search
                </p>
              </div>

              {/* Site List */}
              <SiteList onBack={() => setView('chat')} />
            </div>
          </div>
        )
      }

      {/* Chat Container */}
      {
        view === 'chat' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth" style={{ background: 'var(--bg-secondary)' }}>
            
            {/* [NEW] Pre-Chat Indexing Call To Action */}
            {mode === 'rag' && !indexedUrls.has(currentUrl) && messages.length <= 1 ? (
               <div className="flex flex-col items-center justify-center h-full text-center p-6 animate-in fade-in zoom-in duration-300">
                  <div className="w-16 h-16 bg-gradient-to-br from-cyan-50 to-blue-100 rounded-full flex items-center justify-center mb-4">
                     <FileText className="w-8 h-8 text-blue-500" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 mb-2">Embed This Page</h3>
                  <p className="text-sm text-slate-500 mb-6 max-w-[240px]">
                    To chat with this page, we first need to read and index its content.
                  </p>
                  <button
                    onClick={() => setShowCrawlModal(true)}
                    disabled={isLoading}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-medium transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                    {isLoading ? "Indexing..." : "Embed & Start Chat"}
                  </button>
               </div>
            ) : (
                messages.map((msg, idx) => (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  gap: '12px',
                  flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                  animation: 'fadeIn 0.3s ease-in-out'
                }}
              >
                {/* Avatar */}
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  background: msg.role === 'user' ? 'var(--primary-500)' : 'var(--bg-secondary)',
                  border: msg.role === 'user' ? 'none' : '1px solid var(--border-light)',
                  color: msg.role === 'user' ? 'white' : 'var(--primary-600)'
                }}>
                  {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                {/* Message Card */}
                <div style={{
                  maxWidth: '85%',
                  padding: 'var(--space-2)',
                  borderRadius: 'var(--radius-xl)',
                  background: msg.role === 'user' ? 'var(--primary-50)' : 'var(--bg-primary)',
                  border: `1px solid ${msg.role === 'user' ? 'var(--primary-100)' : 'var(--border-light)'}`,
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  {/* Message Content */}
                  <div style={{
                    fontSize: 'var(--text-sm)',
                    lineHeight: 'var(--leading-relaxed)',
                    color: msg.role === 'user' ? 'var(--primary-700)' : 'var(--text-primary)'
                  }}>
                    {msg.role === 'user'
                      ? (<div>{msg.text}</div>)
                      : (
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          rehypePlugins={[rehypeHighlight]}
                          components={MarkdownComponents}
                          className="markdown-body"
                        >
                          {msg.text}
                        </ReactMarkdown>
                      )
                    }
                  </div>

                  {/* Citations Grid */}
                  {msg.role === 'assistant' && msg.citations && msg.citations.length > 0 && (
                    <div style={{
                      marginTop: '12px',
                      paddingTop: '12px',
                      borderTop: '1px solid var(--border-light)',
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '8px'
                    }}>
                      {msg.citations.map((cite, i) => (
                        <CitationHoverCard key={i} citation={cite} blocks={contentBlocks} />
                      ))}
                    </div>
                  )}

                  {/* Timestamp & Actions */}
                  <div style={{
                    marginTop: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--text-tertiary)'
                  }}>
                    <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    {msg.role === 'assistant' && (
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(msg.text);
                          toast.success('Copied to clipboard');
                        }}
                        style={{
                          padding: '6px 10px',
                          background: 'var(--bg-secondary)',
                          border: '1px solid var(--border-light)',
                          borderRadius: 'var(--radius-sm)',
                          cursor: 'pointer',
                          fontSize: 'var(--text-xs)',
                          color: 'var(--text-secondary)',
                          transition: 'var(--transition-fast)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontWeight: 'var(--font-medium)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'var(--primary-50)';
                          e.currentTarget.style.color = 'var(--primary-600)';
                          e.currentTarget.style.borderColor = 'var(--primary-200)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'var(--bg-secondary)';
                          e.currentTarget.style.color = 'var(--text-secondary)';
                          e.currentTarget.style.borderColor = 'var(--border-light)';
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                        Copy
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )))}
            {isLoading && (
              <div className="flex gap-3 animate-pulse px-2">
                <div className="w-8 h-8 rounded-full bg-white border border-slate-100 flex items-center justify-center shadow-sm">
                  <Bot className="w-4 h-4 text-emerald-600/50" />
                </div>
                <div className="flex items-center gap-2 text-slate-400 bg-white/50 px-4 py-2 rounded-full border border-slate-100">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                  <span className="text-xs font-medium tracking-wide">AI is thinking...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )
      }

      {/* Footer Input */}
      <footer className="p-4 bg-white/80 backdrop-blur-md border-t border-slate-200/60 transition-all focus-within:bg-white focus-within:shadow-[0_-4px_20px_-8px_rgba(0,0,0,0.1)]">
        {/* Preview Area for Crop */}
        {cropPreview && (
          <div className="mb-3 flex items-center gap-3 bg-white p-2 rounded-xl border border-slate-200 shadow-sm animate-in slide-in-from-bottom-2">
            <img src={cropPreview} className="h-12 w-auto rounded-lg border border-slate-100" alt="Selection" />
            <div className="flex-1 text-xs text-slate-500">
              Region Selected. Ask a question about it below.
            </div>
            <button onClick={() => setCropPreview(null)} className="p-1 hover:bg-slate-100 rounded-full text-slate-400">
              ✕
            </button>
          </div>
        )}

        <form
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="relative flex items-center group"
        >
          <input
            autoFocus
            type="text"
            className="w-full bg-slate-100/50 border border-slate-200 rounded-2xl pl-5 pr-14 py-4 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all placeholder:text-slate-400 text-[13px] text-slate-700"
            placeholder={cropPreview ? "Ask about this selection..." : (mode === 'rag' ? "Ask about page content..." : "Ask about the screen...")}
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="absolute right-2 p-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 disabled:from-slate-300 disabled:to-slate-300 disabled:cursor-not-allowed text-white rounded-xl transition-all shadow-md hover:shadow-lg hover:shadow-indigo-500/20 active:scale-95"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </footer>
      {/* Crawler Selection Modal */}
      {showCrawlModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden ring-1 ring-slate-200">
             <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
               <h3 className="font-semibold text-slate-800">Add to Memory</h3>
               <button onClick={() => setShowCrawlModal(false)} className="p-1 hover:bg-slate-200 rounded-full transition-colors">
                 <X className="w-4 h-4 text-slate-500" />
               </button>
             </div>
             
             <div className="p-4 space-y-3">
               <button
                 onClick={() => handleIngest()}
                 className="flex items-center gap-4 w-full p-4 bg-white border border-slate-200 hover:border-blue-400 hover:bg-blue-50/30 rounded-xl transition-all group text-left shadow-sm hover:shadow-md"
               >
                 <div className="w-10 h-10 bg-blue-100/50 rounded-lg flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
                   <FileText className="w-5 h-5" />
                 </div>
                 <div>
                   <h4 className="font-medium text-slate-900 text-sm">Single Page</h4>
                   <p className="text-xs text-slate-500 mt-0.5">Embed only the current active tab.</p>
                   {lastFailedAction?.type === 'ingest' && <span className="text-red-500 text-[10px] font-bold">Retry Failed</span>}
                 </div>
               </button>

               <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/30 space-y-3">
                 <button
                   onClick={() => handleIngest('multi')}
                   className="flex items-center gap-4 w-full text-left group"
                 >
                   <div className="w-10 h-10 bg-purple-100/50 rounded-lg flex items-center justify-center text-purple-600 group-hover:scale-110 transition-transform">
                     <Globe className="w-5 h-5" />
                   </div>
                   <div className="flex-1">
                     <h4 className="font-medium text-slate-900 text-sm group-hover:text-purple-700 transition-colors">Crawl Website</h4>
                     <p className="text-xs text-slate-500 mt-0.5">Embed multiple pages from this domain.</p>
                   </div>
                   <div className="text-xs font-semibold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">BETA</div>
                 </button>
                 
                 {/* Crawl Settings */}
                 <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200/60 mt-2">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Pages</label>
                      <input 
                        type="number" 
                        min="1" 
                        max="50"
                        value={crawlSettings.maxPages}
                        onChange={(e) => setCrawlSettings(prev => ({ ...prev, maxPages: parseInt(e.target.value) || 10 }))}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Depth</label>
                      <input 
                        type="number" 
                        min="1" 
                        max="5"
                        value={crawlSettings.maxDepth}
                        onChange={(e) => setCrawlSettings(prev => ({ ...prev, maxDepth: parseInt(e.target.value) || 2 }))}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none"
                      />
                    </div>
                 </div>
               </div>
             </div>
             
             <div className="p-3 bg-slate-50 text-center text-[10px] text-slate-400 border-t border-slate-100">
               Powered by Firecrawl & Mistral AI
             </div>
          </div>
        </div>
      )}

      <Toaster richColors position="top-center" />

      {/* Keyboard Shortcuts Modal */}
      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}
    </div >
  );
}

export default function AppWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
