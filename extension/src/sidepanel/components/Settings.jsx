import React, { useState, useEffect } from 'react';
import { Save, Key, ArrowLeft } from 'lucide-react';

export default function Settings({ onBack }) {
    const [apiKey, setApiKey] = useState('AIzaSyAik8tzY5M4KFBbPuBaxTxvBGIPxJzhJZY');
    const [backendUrl, setBackendUrl] = useState('http://127.0.0.1:8000');
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        // Load existing key
        if (chrome.storage && chrome.storage.local) {
            chrome.storage.local.get(['geminiApiKey', 'backendUrl'], (result) => {
                if (result.geminiApiKey) {
                    setApiKey(result.geminiApiKey);
                }
                if (result.backendUrl) {
                    setBackendUrl(result.backendUrl);
                }
            });
        }
    }, []);

    const handleSave = () => {
        if (chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({
                geminiApiKey: apiKey,
                backendUrl: backendUrl.replace(/\/$/, '') // Remove trailing slash
            }, () => {
                setSaved(true);
                setTimeout(() => setSaved(false), 2000);
            });
        } else {
            console.warn("Chrome storage not available (dev mode?)");
        }
    };

    return (
        <div className="h-full flex flex-col animate-in slide-in-from-right duration-300">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
                <button
                    onClick={onBack}
                    className="p-1 -ml-1 hover:bg-gray-100 rounded-lg transition-colors text-gray-500"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <h2 className="font-bold text-gray-900">Settings</h2>
            </div>

            <div className="p-5 space-y-6">
                {/* API KEY */}
                <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                        <Key className="w-3.5 h-3.5" />
                        Gemini API Key
                    </label>
                    <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="AIzaSy..."
                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all mb-1"
                    />
                    <p className="text-xs text-gray-400">
                        Required for visual analysis. Get a free key from Google AI Studio.
                    </p>
                </div>

                {/* BACKEND URL */}
                <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                        Server URL
                    </label>
                    <input
                        type="text"
                        value={backendUrl}
                        onChange={(e) => setBackendUrl(e.target.value)}
                        placeholder="http://127.0.0.1:8000"
                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono"
                    />
                    <p className="text-xs text-gray-400">
                        Address of your local Python server (e.g. <code>http://127.0.0.1:8000</code>).
                    </p>
                </div>

                <button
                    onClick={handleSave}
                    className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all ${saved
                        ? 'bg-emerald-500 text-white shadow-emerald-200'
                        : 'bg-gray-900 text-white hover:bg-gray-800 shadow-gray-200'
                        } shadow-lg mt-4`}
                >
                    {saved ? 'Saved!' : 'Save Configuration'}
                    {!saved && <Save className="w-4 h-4" />}
                </button>
            </div>
        </div>
    );
}
