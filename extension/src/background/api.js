/**
 * API Client for handling Backend/LLM communication.
 */

// WARNING: API Key is now managed via Settings (chrome.storage).
// WARNING: API Key is now managed via Settings (chrome.storage).
// User's working Python script uses "gemini-2.5-flash". Syncing extension to match.
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
const DEFAULT_KEY = import.meta.env.VITE_GEMINI_API_KEY; // Managed via .env

export const apiClient = {
    /**
     * Retrieves the API key from local storage or returns default.
     * @returns {Promise<string>} The API key or null.
     */
    async getApiKey() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['geminiApiKey'], (result) => {
                resolve(result.geminiApiKey || DEFAULT_KEY);
            });
        });
    },

    /**
     * Sends an image to the backend for analysis or extraction.
     * @param {string} base64Image - The base64 encoded image data.
     * @param {string} prompt - The user prompt or instruction.
     * @param {string} mode - "qa" or "extraction".
     * @returns {Promise<Object>} The analysis result.
     */
    async analyzeImage(base64Image, prompt, mode = "qa") {
        // Get Backend URL from storage
        const getBackendUrl = () => new Promise(resolve => {
            chrome.storage.local.get(['backendUrl'], (result) => {
                resolve(result.backendUrl || import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:8000");
            });
        });

        const baseUrl = await getBackendUrl();

        try {
            console.log(`[API] Sending image to ${baseUrl}/analyze-image (Mode: ${mode})...`);

            const response = await fetch(`${baseUrl}/analyze-image`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    image_data: base64Image,
                    prompt: prompt,
                    mode: mode
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || `Backend Error: ${response.status}`);
            }

            return {
                answer: data.answer,
                sources: []
            };

        } catch (error) {
            console.error("Backend Vision Error:", error);
            const isNetworkError = error.message.includes("Failed to fetch");
            return {
                answer: isNetworkError
                    ? `❌ **Connection Refused**: Cannot reach \`${baseUrl}\`.\n\nEnsure \`uvicorn main:app --reload\` is running.`
                    : `Error analyzing image: ${error.message}`
            };
        }
    },

    /**
     * Simulates RAG query against indexed page content.
     * (Keeping mock for RAG as we don't have a Vector DB setup in this Phase)
     */
    async queryRag(blocks, question) {
        console.log('[API] Sending RAG Query to Backend...', { count: blocks.length, question });

        const fullText = blocks.map(b => b.text).join('\n\n');

        // Get Backend URL from storage
        const getBackendUrl = () => new Promise(resolve => {
            chrome.storage.local.get(['backendUrl'], (result) => {
                // Default to 127.0.0.1 if not set
                resolve(result.backendUrl || "http://127.0.0.1:8000");
            });
        });

        const baseUrl = await getBackendUrl();
        const chatEndpoint = `${baseUrl}/chat`;

        try {
            console.log(`[API] Fetching ${chatEndpoint}...`);

            const response = await fetch(chatEndpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    query: question,
                    content_blocks: blocks, // [NEW] Phase 1: Send structured blocks
                    page_content: fullText  // Fallback / Debug
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[API] Backend responded with ${response.status}:`, errorText);
                throw new Error(`Server returned ${response.status}: ${errorText}`);
            }

            const data = await response.json();

            // Extract citations from the answer text
            // Regex to find [bi-block-X]
            const citationRegex = /\[(bi-block-\d+)\]/g;
            const citations = [];
            let match;

            // We can keep the tags in the text for context, or remove them. 
            // For now, let's keep them but ensure the UI knows about them in the citations array.
            while ((match = citationRegex.exec(data.answer)) !== null) {
                // Avoid duplicates
                const blockId = match[1];
                if (!citations.find(c => c.blockId === blockId)) {
                    citations.push({
                        blockId: blockId,
                        snippet: `Source Reference ${blockId}` // We could look up snippet if we had map
                    });
                }
            }

            return {
                answer: data.answer,
                citations: citations
            };

        } catch (error) {
            console.error("RAG Backend Error:", error);
            // Check if it's a specific fetch error (Failed to fetch)
            const isNetworkError = error.message.includes("Failed to fetch") || error.message.includes("NetworkError");

            return {
                answer: isNetworkError
                    ? `❌ **Connection Refused**: Cannot reach \`${baseUrl}\`. \n\n**Possible Fixes**:\n1. Ensure Backend is running: \`uvicorn main:app --reload\`\n2. Check the **Server URL** in Extension Settings.`
                    : `❌ **Backend Error**: ${error.message}`,
                citations: []
            };
        }
    },
    async ingestPage(url, options = {}) {
// Clean centralized URL logic
        const getBackendUrl = () => new Promise(resolve => {
            chrome.storage.local.get(['backendUrl'], (result) => {
                // Priority: User Settings > Env Var > Default Localhost
                resolve(result.backendUrl || import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:8000");
            });
        });

        const baseUrl = await getBackendUrl();
        const ingestEndpoint = `${baseUrl}/ingest`;

        try {
            console.log(`[API] Ingesting ${url} to ${ingestEndpoint}...`, options);
            const response = await fetch(ingestEndpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    url: url,
                    crawl: options.crawl || false,
                    max_pages: options.maxPages || 50,
                    max_depth: options.maxDepth || 3
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || `Ingest failed: ${response.status}`);
            }

            return { success: true, message: data.message, chunks_count: data.chunks_count, pages_indexed: data.pages_indexed };

        } catch (error) {
            console.error("Ingest Error:", error);
            return {
                success: false,
                message: error.message.includes("Failed to fetch")
                    ? `Cannot reach Backend at ${baseUrl}`
                    : error.message
            };
        }
    },

    /**
     * Ingests text content along with a URL to the backend.
     * @param {string} url - The URL associated with the text content.
     * @param {string} text - The text content to ingest.
     * @returns {Promise<Object>} Ingestion result.
     */
    async ingestText(url, text) {
// Clean centralized URL logic
        const getBackendUrl = () => new Promise(resolve => {
            chrome.storage.local.get(['backendUrl'], (result) => {
                // Priority: User Settings > Env Var > Default Localhost
                resolve(result.backendUrl || import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:8000");
            });
        });

        const baseUrl = await getBackendUrl();
        const ingestEndpoint = `${baseUrl}/ingest`; // Assuming the same ingest endpoint handles text content

        try {
            console.log(`[API] Ingesting text for ${url} to ${ingestEndpoint}...`);
            const response = await fetch(ingestEndpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    url: url,
                    text_content: text
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || `Text Ingestion failed: ${response.status}`);
            }

            return { success: true, message: data.message };

        } catch (error) {
            console.error("Text Ingestion Error:", error);
            return {
                success: false,
                message: error.message.includes("Failed to fetch")
                    ? `Cannot reach Backend at ${baseUrl}`
                    : error.message
            };
        }
    },
    /**
     * Streams RAG query response using NDJSON.
     * @param {Array} blocks - Content blocks.
     * @param {string} question - User query.
     * @param {function} onChunk - Callback(text) for each token.
     * @returns {Promise<Object>} Final result/metadata.
     */
    async streamQueryRag(blocks, question, onChunk, siteId = null, history = null) {
        console.log('[API] Stream RAG request...', siteId ? `(Site: ${siteId})` : '');
        const getBackendUrl = () => new Promise(r => chrome.storage.local.get(['backendUrl'], res => r(res.backendUrl || "http://127.0.0.1:8000")));
        const baseUrl = await getBackendUrl();

        try {
            const response = await fetch(`${baseUrl}/chat/stream`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    query: question,
                    content_blocks: blocks,
                    page_content: blocks.map(b => b.text).join('\n\n'),
                    site_id: siteId,
                    history: history // [NEW] Pass history
                })
            });

            if (!response.ok) {
                throw new Error(`Stream Error: ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let finalMetadata = {};

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n').filter(line => line.trim() !== '');

                for (const line of lines) {
                    try {
                        const data = JSON.parse(line);
                        if (data.type === 'token') {
                            onChunk(data.text);
                        } else if (data.type === 'usage' || data.type === 'error') {
                            finalMetadata = data;
                        }
                    } catch (e) {
                        console.warn("Stream parse error", e);
                    }
                }
            }
            return { success: true, ...finalMetadata };

        } catch (e) {
            console.error("Stream error", e);
            return { success: false, error: e.message };
        }
    },
    // --- Phase 3: Site Management ---
    async getSites() {
        const getBackendUrl = () => new Promise(r => chrome.storage.local.get(['backendUrl'], res => r(res.backendUrl || "http://127.0.0.1:8000")));
        const baseUrl = await getBackendUrl();
        try {
            const response = await fetch(`${baseUrl}/sites`);
            if (!response.ok) throw new Error("Failed to fetch sites");
            const data = await response.json();
            return data.sites || [];
        } catch (e) {
            console.error("Get Sites Error", e);
            return [];
        }
    },
    async deleteSite(siteId) {
        const getBackendUrl = () => new Promise(r => chrome.storage.local.get(['backendUrl'], res => r(res.backendUrl || "http://127.0.0.1:8000")));
        const baseUrl = await getBackendUrl();
        try {
            const response = await fetch(`${baseUrl}/sites/${siteId}`, { method: 'DELETE' });
            if (!response.ok) throw new Error("Failed to delete site");
            return { success: true };
        } catch (e) {
            console.error("Delete Site Error", e);
            return { success: false, error: e.message };
        }
    },

    /**
     * Export site content
     * @param {string} siteUrl - URL to export
     * @param {string} format - 'json' or 'text'
     */
    async exportSite(siteUrl, format = 'json') {
        const encodedUrl = encodeURIComponent(siteUrl);
        const getBackendUrl = () => new Promise(resolve => {
            chrome.storage.local.get(['backendUrl'], (result) => {
                 resolve(result.backendUrl || import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:8000");
            });
        });
        const baseUrl = await getBackendUrl();
        const url = `${baseUrl}/export/${encodedUrl}?format=${format}`;

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Export failed: ${response.statusText}`);

            // Trigger download
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = `export_${siteUrl.replace(/[^a-z0-9]/gi, '_')}.${format === 'json' ? 'json' : 'txt'}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(downloadUrl);

            return { success: true };
        } catch (error) {
            console.error('Export error:', error);
            return { success: false, error: error.message };
        }
    }
};
